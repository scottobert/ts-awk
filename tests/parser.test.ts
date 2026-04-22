import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Program } from '../src/ast';

function parse(source: string): Program {
  const tokens = new Lexer(source).tokenize();
  return new Parser(tokens).parse();
}

describe('Parser', () => {
  describe('basic rules', () => {
    it('parses a bare action block', () => {
      const program = parse('{ print $0 }');
      expect(program.rules).toHaveLength(1);
      expect(program.rules[0].pattern).toBeNull();
      expect(program.rules[0].action).not.toBeNull();
    });

    it('parses BEGIN pattern', () => {
      const program = parse('BEGIN { print "hello" }');
      expect(program.rules[0].pattern).toEqual({ type: 'BeginPattern' });
    });

    it('parses END pattern', () => {
      const program = parse('END { print "done" }');
      expect(program.rules[0].pattern).toEqual({ type: 'EndPattern' });
    });

    it('parses multiple rules', () => {
      const program = parse('BEGIN { x = 1 } { print } END { print "done" }');
      expect(program.rules).toHaveLength(3);
    });
  });

  describe('print statements', () => {
    it('parses print with no args', () => {
      const program = parse('{ print }');
      const stmt = program.rules[0].action!.statements[0];
      expect(stmt.type).toBe('PrintStatement');
    });

    it('parses print with field access', () => {
      const program = parse('{ print $1 }');
      const stmt = program.rules[0].action!.statements[0] as any;
      expect(stmt.type).toBe('PrintStatement');
      expect(stmt.args).toHaveLength(1);
      expect(stmt.args[0].type).toBe('FieldAccess');
    });

    it('parses print with multiple args', () => {
      const program = parse('{ print $1, $2, $3 }');
      const stmt = program.rules[0].action!.statements[0] as any;
      expect(stmt.args).toHaveLength(3);
    });

    it('parses print with pipe redirect', () => {
      const program = parse('{ print $1 | "sort" }');
      const stmt = program.rules[0].action!.statements[0] as any;
      expect(stmt.output).toBeDefined();
      expect(stmt.output.type).toBe('Pipe');
    });
  });

  describe('expressions', () => {
    it('parses number literals', () => {
      const program = parse('BEGIN { x = 42 }');
      const stmt = program.rules[0].action!.statements[0] as any;
      expect(stmt.expression.value.type).toBe('NumberLiteral');
      expect(stmt.expression.value.value).toBe(42);
    });

    it('parses string literals', () => {
      const program = parse('BEGIN { x = "hello" }');
      const stmt = program.rules[0].action!.statements[0] as any;
      expect(stmt.expression.value.type).toBe('StringLiteral');
    });

    it('parses arithmetic expressions', () => {
      const program = parse('BEGIN { x = 1 + 2 * 3 }');
      const stmt = program.rules[0].action!.statements[0] as any;
      const rhs = stmt.expression.value;
      expect(rhs.type).toBe('BinaryExpression');
      expect(rhs.operator).toBe('+');
    });

    it('parses comparison expressions', () => {
      const program = parse('$2 > 25 { print $1 }');
      const pattern = program.rules[0].pattern as any;
      expect(pattern.expression.type).toBe('BinaryExpression');
      expect(pattern.expression.operator).toBe('>');
    });

    it('parses regex patterns', () => {
      const program = parse('/London/ { print $1 }');
      const pattern = program.rules[0].pattern as any;
      expect(pattern.expression.type).toBe('RegexLiteral');
      expect(pattern.expression.pattern).toBe('London');
    });

    it('parses regex match operator', () => {
      const program = parse('$1 ~ /^A/ { print }');
      const pattern = program.rules[0].pattern as any;
      expect(pattern.expression.type).toBe('MatchExpression');
      expect(pattern.expression.negated).toBe(false);
    });

    it('parses regex not-match operator', () => {
      const program = parse('$1 !~ /^A/ { print }');
      const pattern = program.rules[0].pattern as any;
      expect(pattern.expression.type).toBe('MatchExpression');
      expect(pattern.expression.negated).toBe(true);
    });

    it('parses string concatenation', () => {
      const program = parse('BEGIN { x = "a" "b" }');
      const stmt = program.rules[0].action!.statements[0] as any;
      expect(stmt.expression.value.type).toBe('Concatenation');
    });

    it('parses ternary expression', () => {
      const program = parse('BEGIN { x = 1 > 0 ? "yes" : "no" }');
      const stmt = program.rules[0].action!.statements[0] as any;
      expect(stmt.expression.value.type).toBe('TernaryExpression');
    });

    it('parses increment expressions', () => {
      const program = parse('BEGIN { x++; ++y }');
      const stmts = program.rules[0].action!.statements;
      const expr1 = (stmts[0] as any).expression;
      const expr2 = (stmts[1] as any).expression;
      expect(expr1.type).toBe('IncrementExpression');
      expect(expr1.prefix).toBe(false);
      expect(expr2.type).toBe('IncrementExpression');
      expect(expr2.prefix).toBe(true);
    });
  });

  describe('control flow', () => {
    it('parses if statement', () => {
      const program = parse('{ if ($2 > 25) print $1 }');
      const stmt = program.rules[0].action!.statements[0];
      expect(stmt.type).toBe('IfStatement');
    });

    it('parses if-else statement', () => {
      const program = parse('{ if ($2 > 25) print "old"; else print "young" }');
      const stmt = program.rules[0].action!.statements[0] as any;
      expect(stmt.type).toBe('IfStatement');
      expect(stmt.alternate).not.toBeNull();
    });

    it('parses while loop', () => {
      const program = parse('BEGIN { while (x < 10) x++ }');
      const stmt = program.rules[0].action!.statements[0];
      expect(stmt.type).toBe('WhileStatement');
    });

    it('parses for loop', () => {
      const program = parse('{ for (i = 1; i <= NF; i++) print $i }');
      const stmt = program.rules[0].action!.statements[0];
      expect(stmt.type).toBe('ForStatement');
    });

    it('parses for-in loop', () => {
      const program = parse('END { for (k in arr) print k }');
      const stmt = program.rules[0].action!.statements[0];
      expect(stmt.type).toBe('ForInStatement');
    });

    it('parses do-while loop', () => {
      const program = parse('BEGIN { do { x++ } while (x < 10) }');
      const stmt = program.rules[0].action!.statements[0];
      expect(stmt.type).toBe('DoWhileStatement');
    });
  });

  describe('functions', () => {
    it('parses function definition', () => {
      const program = parse('function max(a, b) { return a > b ? a : b }');
      expect(program.functions).toHaveLength(1);
      expect(program.functions[0].name).toBe('max');
      expect(program.functions[0].params).toEqual(['a', 'b']);
    });

    it('parses function call', () => {
      const program = parse('BEGIN { x = max(1, 2) }');
      const stmt = program.rules[0].action!.statements[0] as any;
      expect(stmt.expression.value.type).toBe('CallExpression');
      expect(stmt.expression.value.callee).toBe('max');
    });
  });

  describe('arrays', () => {
    it('parses array access', () => {
      const program = parse('BEGIN { x = arr[1] }');
      const stmt = program.rules[0].action!.statements[0] as any;
      expect(stmt.expression.value.type).toBe('ArrayAccess');
    });

    it('parses delete statement', () => {
      const program = parse('BEGIN { delete arr["key"] }');
      const stmt = program.rules[0].action!.statements[0];
      expect(stmt.type).toBe('DeleteStatement');
    });

    it('parses in expression', () => {
      const program = parse('BEGIN { if ("key" in arr) print "found" }');
      const stmt = program.rules[0].action!.statements[0] as any;
      expect(stmt.condition.type).toBe('InExpression');
    });
  });

  describe('printf', () => {
    it('parses printf statement', () => {
      const program = parse('{ printf "%s %d\\n", $1, $2 }');
      const stmt = program.rules[0].action!.statements[0];
      expect(stmt.type).toBe('PrintfStatement');
    });
  });

  describe('assignment operators', () => {
    it('parses compound assignment', () => {
      const program = parse('{ total += $2 }');
      const stmt = program.rules[0].action!.statements[0] as any;
      expect(stmt.expression.type).toBe('Assignment');
      expect(stmt.expression.operator).toBe('+=');
    });
  });
});
