import {
  Program, Rule, Statement, Expression, Block, FunctionDef,
  OutputRedirect,
} from './ast.js';
import {
  AwkValue, RuntimeError, NextSignal, BreakSignal, ContinueSignal,
  ExitSignal, ReturnSignal,
} from './errors.js';
import { toNumber, toString, formatString } from './formatter.js';
import { getBuiltins, BuiltinEnv } from './builtins.js';
import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';

export interface InterpreterOptions {
  fieldSeparator?: string;
  variables?: Record<string, string>;
  output?: (text: string) => void;
  inputFiles?: string[];
  stdinData?: string;
}

export class Interpreter {
  private program: Program;
  private variables: Map<string, AwkValue> = new Map();
  private arrays: Map<string, Map<string, AwkValue>> = new Map();
  private fields: string[] = [];
  private functions: Map<string, FunctionDef> = new Map();
  private builtins = getBuiltins();
  private output: (text: string) => void;
  private inputFiles: string[];
  private stdinData: string | undefined;
  private openPipes: Map<string, string[]> = new Map();
  private openFiles: Map<string, string[]> = new Map();
  private exitCode: number = 0;

  constructor(program: Program, options: InterpreterOptions = {}) {
    this.program = program;
    this.output = options.output ?? ((text: string) => process.stdout.write(text));
    this.inputFiles = options.inputFiles ?? [];
    this.stdinData = options.stdinData;

    this.variables.set('FS', options.fieldSeparator ?? ' ');
    this.variables.set('OFS', ' ');
    this.variables.set('ORS', '\n');
    this.variables.set('RS', '\n');
    this.variables.set('NR', 0);
    this.variables.set('NF', 0);
    this.variables.set('FILENAME', '');
    this.variables.set('SUBSEP', '\x1c');
    this.variables.set('RSTART', 0);
    this.variables.set('RLENGTH', 0);
    this.variables.set('ARGC', 0);

    if (options.variables) {
      for (const [k, v] of Object.entries(options.variables)) {
        this.variables.set(k, v);
      }
    }

    for (const fn of program.functions) {
      this.functions.set(fn.name, fn);
    }
  }

  run(): number {
    const beginRules = this.program.rules.filter(r => r.pattern?.type === 'BeginPattern');
    const endRules = this.program.rules.filter(r => r.pattern?.type === 'EndPattern');
    const mainRules = this.program.rules.filter(r =>
      r.pattern?.type !== 'BeginPattern' && r.pattern?.type !== 'EndPattern'
    );

    try {
      for (const rule of beginRules) {
        if (rule.action) this.executeBlock(rule.action);
      }

      if (mainRules.length > 0 || endRules.length > 0) {
        this.processInput(mainRules);
      }

      for (const rule of endRules) {
        if (rule.action) this.executeBlock(rule.action);
      }
    } catch (e) {
      if (e instanceof ExitSignal) {
        this.exitCode = e.code;
        try {
          for (const rule of endRules) {
            if (rule.action) this.executeBlock(rule.action);
          }
        } catch (e2) {
          if (e2 instanceof ExitSignal) {
            this.exitCode = e2.code;
          } else {
            throw e2;
          }
        }
      } else {
        throw e;
      }
    }

    this.flushPipes();
    return this.exitCode;
  }

  private processInput(rules: Rule[]): void {
    const lines = this.getInputLines();
    const rs = toString(this.variables.get('RS') ?? '\n');

    let nr = toNumber(this.variables.get('NR') ?? 0);

    for (const { line, filename } of lines) {
      nr++;
      this.variables.set('NR', nr);
      this.variables.set('FNR', nr);
      this.variables.set('FILENAME', filename);
      this.setRecord(line);

      try {
        for (const rule of rules) {
          if (this.matchPattern(rule)) {
            const action = rule.action ?? {
              type: 'Block' as const,
              statements: [{
                type: 'PrintStatement' as const,
                args: [{ type: 'FieldAccess' as const, index: { type: 'NumberLiteral' as const, value: 0 } }],
              }],
            };
            this.executeBlock(action);
          }
        }
      } catch (e) {
        if (e instanceof NextSignal) {
          continue;
        }
        throw e;
      }
    }
  }

  private *getInputLines(): Generator<{ line: string; filename: string }> {
    if (this.inputFiles.length > 0) {
      const argc = this.inputFiles.length + 1;
      this.variables.set('ARGC', argc);
      this.setArray('ARGV', new Map());
      const argv = this.arrays.get('ARGV')!;
      argv.set('0', 'tsawk');
      for (let i = 0; i < this.inputFiles.length; i++) {
        argv.set(String(i + 1), this.inputFiles[i]);
      }

      for (const file of this.inputFiles) {
        this.variables.set('FILENAME', file);
        let content: string;
        try {
          content = fs.readFileSync(file, 'utf-8');
        } catch (e: any) {
          throw new RuntimeError(`Cannot open file: ${file}`);
        }
        const rs = toString(this.variables.get('RS') ?? '\n');
        const lines = this.splitRecords(content, rs);
        for (const line of lines) {
          yield { line, filename: file };
        }
      }
    } else if (this.stdinData !== undefined) {
      const rs = toString(this.variables.get('RS') ?? '\n');
      const lines = this.splitRecords(this.stdinData, rs);
      for (const line of lines) {
        yield { line, filename: '' };
      }
    }
  }

  private splitRecords(content: string, rs: string): string[] {
    if (rs === '\n') {
      const lines = content.split('\n').map(line => line.endsWith('\r') ? line.slice(0, -1) : line);
      if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
      }
      return lines;
    }
    if (rs === '') {
      return content.split(/\n\n+/).filter(s => s.length > 0);
    }
    const lines = content.split(rs);
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    return lines;
  }

  private setRecord(line: string): void {
    this.fields = [line];
    const fs = toString(this.variables.get('FS') ?? ' ');

    let parts: string[];
    if (fs === ' ') {
      parts = line.trim().split(/\s+/);
      if (parts.length === 1 && parts[0] === '') parts = [];
    } else if (fs.length === 1) {
      parts = line.split(fs);
    } else {
      const regex = new RegExp(fs);
      parts = line.split(regex);
    }

    this.fields = [line, ...parts];
    this.variables.set('NF', parts.length);
  }

  private rebuildRecord(): void {
    const ofs = toString(this.variables.get('OFS') ?? ' ');
    const nf = toNumber(this.variables.get('NF') ?? 0);
    const parts: string[] = [];
    for (let i = 1; i <= nf; i++) {
      parts.push(this.fields[i] ?? '');
    }
    this.fields[0] = parts.join(ofs);
  }

  private matchPattern(rule: Rule): boolean {
    if (!rule.pattern) return true;

    switch (rule.pattern.type) {
      case 'ExpressionPattern':
        return this.isTruthy(this.evaluate(rule.pattern.expression));
      case 'BeginPattern':
      case 'EndPattern':
        return false;
      default:
        return false;
    }
  }

  private executeBlock(block: Block): void {
    for (const stmt of block.statements) {
      this.executeStatement(stmt);
    }
  }

  private executeStatement(stmt: Statement): void {
    switch (stmt.type) {
      case 'PrintStatement':
        this.executePrint(stmt);
        break;
      case 'PrintfStatement':
        this.executePrintf(stmt);
        break;
      case 'ExpressionStatement':
        this.evaluate(stmt.expression);
        break;
      case 'Block':
        this.executeBlock(stmt);
        break;
      case 'IfStatement':
        if (this.isTruthy(this.evaluate(stmt.condition))) {
          this.executeStatement(stmt.consequent);
        } else if (stmt.alternate) {
          this.executeStatement(stmt.alternate);
        }
        break;
      case 'WhileStatement':
        while (this.isTruthy(this.evaluate(stmt.condition))) {
          try {
            this.executeStatement(stmt.body);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
        }
        break;
      case 'ForStatement':
        if (stmt.init) this.executeStatement(stmt.init);
        while (stmt.condition === null || this.isTruthy(this.evaluate(stmt.condition))) {
          try {
            this.executeStatement(stmt.body);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) {
              if (stmt.update) this.executeStatement(stmt.update);
              continue;
            }
            throw e;
          }
          if (stmt.update) this.executeStatement(stmt.update);
        }
        break;
      case 'ForInStatement': {
        const arr = this.arrays.get(stmt.array);
        if (arr) {
          for (const key of arr.keys()) {
            this.variables.set(stmt.variable, key);
            try {
              this.executeStatement(stmt.body);
            } catch (e) {
              if (e instanceof BreakSignal) break;
              if (e instanceof ContinueSignal) continue;
              throw e;
            }
          }
        }
        break;
      }
      case 'DoWhileStatement':
        do {
          try {
            this.executeStatement(stmt.body);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
        } while (this.isTruthy(this.evaluate(stmt.condition)));
        break;
      case 'BreakStatement':
        throw new BreakSignal();
      case 'ContinueStatement':
        throw new ContinueSignal();
      case 'NextStatement':
        throw new NextSignal();
      case 'ExitStatement': {
        const code = stmt.value ? toNumber(this.evaluate(stmt.value)) : 0;
        throw new ExitSignal(code);
      }
      case 'ReturnStatement': {
        const value = stmt.value ? this.evaluate(stmt.value) : 0;
        throw new ReturnSignal(value);
      }
      case 'DeleteStatement': {
        const arr = this.arrays.get(stmt.array);
        if (arr) {
          if (stmt.index !== null) {
            const key = toString(this.evaluate(stmt.index));
            arr.delete(key);
          } else {
            this.arrays.delete(stmt.array);
          }
        }
        break;
      }
    }
  }

  private executePrint(stmt: { args: Expression[]; output?: OutputRedirect }): void {
    const ofs = toString(this.variables.get('OFS') ?? ' ');
    const ors = toString(this.variables.get('ORS') ?? '\n');

    let parts: string[];
    if (stmt.args.length === 0) {
      parts = [this.getField(0)];
    } else {
      parts = stmt.args.map(arg => this.formatValue(this.evaluate(arg)));
    }

    const text = parts.join(ofs) + ors;

    if (stmt.output) {
      this.handleOutputRedirect(stmt.output, text);
    } else {
      this.output(text);
    }
  }

  private executePrintf(stmt: { args: Expression[]; output?: OutputRedirect }): void {
    if (stmt.args.length === 0) return;

    const fmt = toString(this.evaluate(stmt.args[0]));
    const args = stmt.args.slice(1).map(a => this.evaluate(a));
    const text = formatString(fmt, args);

    if (stmt.output) {
      this.handleOutputRedirect(stmt.output, text);
    } else {
      this.output(text);
    }
  }

  private handleOutputRedirect(redirect: OutputRedirect, text: string): void {
    const target = toString(this.evaluate(redirect.target));

    switch (redirect.type) {
      case 'Pipe': {
        if (!this.openPipes.has(target)) {
          this.openPipes.set(target, []);
        }
        this.openPipes.get(target)!.push(text);
        break;
      }
      case 'Redirect': {
        if (!this.openFiles.has(target)) {
          this.openFiles.set(target, []);
        }
        this.openFiles.get(target)!.push(text);
        break;
      }
      case 'Append': {
        fs.appendFileSync(target, text);
        break;
      }
    }
  }

  private flushPipes(): void {
    for (const [cmd, data] of this.openPipes) {
      const input = data.join('');
      try {
        const result = execSync(cmd, { input, encoding: 'utf-8' });
        this.output(result);
      } catch (e) {
        // ignore pipe errors
      }
    }
    this.openPipes.clear();

    for (const [file, data] of this.openFiles) {
      fs.writeFileSync(file, data.join(''));
    }
    this.openFiles.clear();
  }

  evaluate(expr: Expression): AwkValue {
    switch (expr.type) {
      case 'NumberLiteral':
        return expr.value;

      case 'StringLiteral':
        return expr.value;

      case 'RegexLiteral': {
        const field0 = this.getField(0);
        const regex = new RegExp(expr.pattern);
        return regex.test(field0) ? 1 : 0;
      }

      case 'FieldAccess': {
        const idx = Math.trunc(toNumber(this.evaluate(expr.index)));
        return this.getField(idx);
      }

      case 'Identifier':
        if (expr.name === 'length') {
          return this.getField(0).length;
        }
        return this.getVariable(expr.name);

      case 'ArrayAccess': {
        const key = expr.index.map(i => toString(this.evaluate(i))).join(
          toString(this.variables.get('SUBSEP') ?? '\x1c')
        );
        const arr = this.arrays.get(expr.array);
        return arr?.get(key) ?? '';
      }

      case 'BinaryExpression':
        return this.evaluateBinary(expr.operator, expr.left, expr.right);

      case 'UnaryExpression':
        return this.evaluateUnary(expr.operator, expr.operand);

      case 'Assignment':
        return this.evaluateAssignment(expr);

      case 'TernaryExpression':
        return this.isTruthy(this.evaluate(expr.condition))
          ? this.evaluate(expr.consequent)
          : this.evaluate(expr.alternate);

      case 'Concatenation': {
        const left = this.formatValue(this.evaluate(expr.left));
        const right = this.formatValue(this.evaluate(expr.right));
        return left + right;
      }

      case 'MatchExpression': {
        const str = toString(this.evaluate(expr.string));
        let pattern: string;
        if (expr.pattern.type === 'RegexLiteral') {
          pattern = expr.pattern.pattern;
        } else {
          pattern = toString(this.evaluate(expr.pattern));
        }
        const regex = new RegExp(pattern);
        const matches = regex.test(str);
        return (expr.negated ? !matches : matches) ? 1 : 0;
      }

      case 'InExpression': {
        const key = expr.index.map(i => toString(this.evaluate(i))).join(
          toString(this.variables.get('SUBSEP') ?? '\x1c')
        );
        const arr = this.arrays.get(expr.array);
        return arr?.has(key) ? 1 : 0;
      }

      case 'CallExpression':
        return this.evaluateCall(expr.callee, expr.args);

      case 'GetlineExpression':
        return this.evaluateGetline(expr);

      case 'IncrementExpression':
        return this.evaluateIncrement(expr);
    }
  }

  private evaluateBinary(op: string, leftExpr: Expression, rightExpr: Expression): AwkValue {
    if (op === '&&') {
      return this.isTruthy(this.evaluate(leftExpr)) && this.isTruthy(this.evaluate(rightExpr)) ? 1 : 0;
    }
    if (op === '||') {
      return this.isTruthy(this.evaluate(leftExpr)) || this.isTruthy(this.evaluate(rightExpr)) ? 1 : 0;
    }

    const left = this.evaluate(leftExpr);
    const right = this.evaluate(rightExpr);

    switch (op) {
      case '+': return toNumber(left) + toNumber(right);
      case '-': return toNumber(left) - toNumber(right);
      case '*': return toNumber(left) * toNumber(right);
      case '/': {
        const divisor = toNumber(right);
        if (divisor === 0) throw new RuntimeError('Division by zero');
        return toNumber(left) / divisor;
      }
      case '%': {
        const divisor = toNumber(right);
        if (divisor === 0) throw new RuntimeError('Division by zero');
        return toNumber(left) % divisor;
      }
      case '^': return Math.pow(toNumber(left), toNumber(right));
      case '<': return this.compareValues(left, right) < 0 ? 1 : 0;
      case '<=': return this.compareValues(left, right) <= 0 ? 1 : 0;
      case '>': return this.compareValues(left, right) > 0 ? 1 : 0;
      case '>=': return this.compareValues(left, right) >= 0 ? 1 : 0;
      case '==': return this.compareValues(left, right) === 0 ? 1 : 0;
      case '!=': return this.compareValues(left, right) !== 0 ? 1 : 0;
      default:
        throw new RuntimeError(`Unknown operator: ${op}`);
    }
  }

  private evaluateUnary(op: string, operand: Expression): AwkValue {
    const val = this.evaluate(operand);
    switch (op) {
      case '-': return -toNumber(val);
      case '+': return toNumber(val);
      case '!': return this.isTruthy(val) ? 0 : 1;
      default:
        throw new RuntimeError(`Unknown unary operator: ${op}`);
    }
  }

  private evaluateAssignment(expr: import('./ast.js').Assignment): AwkValue {
    const value = this.evaluate(expr.value);
    const target = expr.target;

    let finalValue: AwkValue;
    if (expr.operator === '=') {
      finalValue = value;
    } else {
      const currentValue = this.evaluate(target);
      const op = expr.operator.slice(0, -1);
      switch (op) {
        case '+': finalValue = toNumber(currentValue) + toNumber(value); break;
        case '-': finalValue = toNumber(currentValue) - toNumber(value); break;
        case '*': finalValue = toNumber(currentValue) * toNumber(value); break;
        case '/': finalValue = toNumber(currentValue) / toNumber(value); break;
        case '%': finalValue = toNumber(currentValue) % toNumber(value); break;
        case '^': finalValue = Math.pow(toNumber(currentValue), toNumber(value)); break;
        default: throw new RuntimeError(`Unknown assignment operator: ${expr.operator}`);
      }
    }

    this.assignToTarget(target, finalValue);
    return finalValue;
  }

  private assignToTarget(target: Expression, value: AwkValue): void {
    switch (target.type) {
      case 'Identifier':
        this.setVariable(target.name, value);
        break;
      case 'FieldAccess': {
        const idx = Math.trunc(toNumber(this.evaluate(target.index)));
        this.setField(idx, toString(value));
        break;
      }
      case 'ArrayAccess': {
        const key = target.index.map(i => toString(this.evaluate(i))).join(
          toString(this.variables.get('SUBSEP') ?? '\x1c')
        );
        if (!this.arrays.has(target.array)) {
          this.arrays.set(target.array, new Map());
        }
        this.arrays.get(target.array)!.set(key, value);
        break;
      }
      default:
        throw new RuntimeError('Invalid assignment target');
    }
  }

  private evaluateIncrement(expr: import('./ast.js').IncrementExpression): AwkValue {
    const currentValue = toNumber(this.evaluate(expr.operand));
    const delta = expr.operator === '++' ? 1 : -1;
    const newValue = currentValue + delta;
    this.assignToTarget(expr.operand, newValue);
    return expr.prefix ? newValue : currentValue;
  }

  private evaluateCall(name: string, argExprs: Expression[]): AwkValue {
    if (name === 'sub' || name === 'gsub') {
      return this.evaluateSubGsub(name, argExprs);
    }

    if (name === 'split') {
      return this.evaluateSplit(argExprs);
    }

    const args = argExprs.map(a =>
      a.type === 'RegexLiteral' ? a.pattern : this.evaluate(a)
    );

    const builtin = this.builtins[name];
    if (builtin) {
      return builtin(args, this.getBuiltinEnv());
    }

    const fn = this.functions.get(name);
    if (fn) {
      return this.callUserFunction(fn, args);
    }

    throw new RuntimeError(`Unknown function: ${name}`);
  }

  private evaluateSubGsub(name: string, argExprs: Expression[]): AwkValue {
    const patternVal = this.evaluate(argExprs[0]);
    let pattern: string;
    if (argExprs[0].type === 'RegexLiteral') {
      pattern = argExprs[0].pattern;
    } else {
      pattern = toString(patternVal);
    }
    const replacement = toString(this.evaluate(argExprs[1]));
    const isGlobal = name === 'gsub';
    const regex = isGlobal ? new RegExp(pattern, 'g') : new RegExp(pattern);

    if (argExprs.length >= 3) {
      const target = argExprs[2];
      const currentValue = toString(this.evaluate(target));
      let count = 0;
      const newVal = currentValue.replace(regex, (match) => {
        count++;
        return replacement.replace(/&/g, match);
      });
      this.assignToTarget(target, newVal);
      return count;
    }

    const field0 = this.getField(0);
    let count = 0;
    const newVal = field0.replace(regex, (match) => {
      count++;
      return replacement.replace(/&/g, match);
    });
    this.setField(0, newVal);
    return count;
  }

  private evaluateSplit(argExprs: Expression[]): AwkValue {
    const str = toString(this.evaluate(argExprs[0]));

    let arrayName: string;
    if (argExprs[1].type === 'Identifier') {
      arrayName = argExprs[1].name;
    } else {
      arrayName = toString(this.evaluate(argExprs[1]));
    }

    const separator = argExprs.length >= 3
      ? toString(this.evaluate(argExprs[2]))
      : toString(this.variables.get('FS') ?? ' ');

    let parts: string[];
    if (separator === ' ') {
      parts = str.trim().split(/\s+/);
      if (parts.length === 1 && parts[0] === '') parts = [];
    } else {
      const regex = new RegExp(separator);
      parts = str.split(regex);
    }

    const arr = new Map<string, AwkValue>();
    for (let i = 0; i < parts.length; i++) {
      arr.set(String(i + 1), parts[i]);
    }
    this.arrays.set(arrayName, arr);
    return parts.length;
  }

  private callUserFunction(fn: FunctionDef, args: AwkValue[]): AwkValue {
    const savedVars = new Map<string, AwkValue>();
    const savedArrays = new Map<string, Map<string, AwkValue> | undefined>();

    for (let i = 0; i < fn.params.length; i++) {
      const param = fn.params[i];
      if (this.variables.has(param)) {
        savedVars.set(param, this.variables.get(param)!);
      }
      if (this.arrays.has(param)) {
        savedArrays.set(param, this.arrays.get(param));
      }

      if (i < args.length) {
        this.variables.set(param, args[i]);
      } else {
        this.variables.set(param, '');
        this.arrays.set(param, new Map());
      }
    }

    let result: AwkValue = '';
    try {
      this.executeBlock(fn.body);
    } catch (e) {
      if (e instanceof ReturnSignal) {
        result = e.value;
      } else {
        this.restoreScope(fn.params, savedVars, savedArrays);
        throw e;
      }
    }

    this.restoreScope(fn.params, savedVars, savedArrays);
    return result;
  }

  private restoreScope(
    params: string[],
    savedVars: Map<string, AwkValue>,
    savedArrays: Map<string, Map<string, AwkValue> | undefined>
  ): void {
    for (const param of params) {
      if (savedVars.has(param)) {
        this.variables.set(param, savedVars.get(param)!);
      } else {
        this.variables.delete(param);
      }
      if (savedArrays.has(param)) {
        const arr = savedArrays.get(param);
        if (arr) {
          this.arrays.set(param, arr);
        } else {
          this.arrays.delete(param);
        }
      } else {
        this.arrays.delete(param);
      }
    }
  }

  private evaluateGetline(expr: import('./ast.js').GetlineExpression): AwkValue {
    if (expr.source) {
      const filename = toString(this.evaluate(expr.source));
      try {
        const content = fs.readFileSync(filename, 'utf-8');
        const rs = toString(this.variables.get('RS') ?? '\n');
        const lines = this.splitRecords(content, rs);

        const fileKey = `getline:${filename}`;
        if (!this.arrays.has(fileKey)) {
          const lineMap = new Map<string, AwkValue>();
          lineMap.set('_pos', 0);
          lineMap.set('_lines', lines.length as any);
          for (let i = 0; i < lines.length; i++) {
            lineMap.set(String(i), lines[i]);
          }
          this.arrays.set(fileKey, lineMap);
        }

        const lineMap = this.arrays.get(fileKey)!;
        const pos = toNumber(lineMap.get('_pos') ?? 0);
        const totalLines = toNumber(lineMap.get('_lines') ?? 0);

        if (pos >= totalLines) return 0;

        const line = toString(lineMap.get(String(pos)) ?? '');
        lineMap.set('_pos', pos + 1);

        if (expr.variable) {
          this.variables.set(expr.variable, line);
        } else {
          this.setRecord(line);
        }

        return 1;
      } catch {
        return -1;
      }
    }

    if (expr.command) {
      const cmd = toString(this.evaluate(expr.command));
      try {
        const result = execSync(cmd, { encoding: 'utf-8' }).trimEnd();
        const lines = result.split('\n');

        if (expr.variable) {
          this.variables.set(expr.variable, lines[0] ?? '');
        } else {
          this.setRecord(lines[0] ?? '');
        }

        return lines.length > 0 ? 1 : 0;
      } catch {
        return -1;
      }
    }

    return 0;
  }

  private getField(index: number): string {
    if (index < 0) return '';
    return this.fields[index] ?? '';
  }

  private setField(index: number, value: string): void {
    while (this.fields.length <= index) {
      this.fields.push('');
    }
    this.fields[index] = value;

    if (index === 0) {
      this.setRecord(value);
    } else {
      const nf = Math.max(toNumber(this.variables.get('NF') ?? 0), index);
      this.variables.set('NF', nf);
      this.rebuildRecord();
    }
  }

  getVariable(name: string): AwkValue {
    return this.variables.get(name) ?? '';
  }

  private setVariable(name: string, value: AwkValue): void {
    this.variables.set(name, value);
    if (name === 'FS' || name === 'NF' || name === '$0') {
      // re-split if FS changes
    }
  }

  private setArray(name: string, arr: Map<string, AwkValue>): void {
    this.arrays.set(name, arr);
  }

  private isTruthy(val: AwkValue): boolean {
    if (typeof val === 'number') return val !== 0;
    return val !== '' && val !== '0';
  }

  private compareValues(left: AwkValue, right: AwkValue): number {
    if (typeof left === 'number' && typeof right === 'number') {
      return left - right;
    }

    const leftStr = toString(left);
    const rightStr = toString(right);

    if (this.looksNumeric(leftStr) && this.looksNumeric(rightStr)) {
      const diff = toNumber(left) - toNumber(right);
      if (diff !== 0) return diff;
      return 0;
    }

    if (leftStr < rightStr) return -1;
    if (leftStr > rightStr) return 1;
    return 0;
  }

  private looksNumeric(s: string): boolean {
    if (s === '') return false;
    return /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/.test(s);
  }

  private formatValue(val: AwkValue): string {
    if (typeof val === 'number') {
      if (Number.isInteger(val)) return val.toString();
      const ofmt = toString(this.variables.get('OFMT') ?? '%.6g');
      return formatString(ofmt, [val]);
    }
    return val;
  }

  private getBuiltinEnv(): BuiltinEnv {
    return {
      getVariable: (name: string) => this.getVariable(name),
      setVariable: (name: string, value: AwkValue) => this.setVariable(name, value),
      getField: (index: number) => this.getField(index),
      setField: (index: number, value: string) => this.setField(index, value),
      getNF: () => toNumber(this.variables.get('NF') ?? 0),
    };
  }
}
