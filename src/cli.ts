#!/usr/bin/env node

import * as fs from 'fs';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { Interpreter, InterpreterOptions } from './interpreter.js';

interface CliArgs {
  program: string;
  files: string[];
  fieldSeparator?: string;
  variables: Record<string, string>;
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  let program = '';
  const files: string[] = [];
  let fieldSeparator: string | undefined;
  const variables: Record<string, string> = {};
  let programFromFile = false;

  let i = 0;
  while (i < args.length) {
    if (args[i] === '-F') {
      i++;
      if (i >= args.length) {
        process.stderr.write('tsawk: missing field separator\n');
        process.exit(1);
      }
      fieldSeparator = args[i];
      i++;
    } else if (args[i].startsWith('-F')) {
      fieldSeparator = args[i].slice(2);
      i++;
    } else if (args[i] === '-v') {
      i++;
      if (i >= args.length) {
        process.stderr.write('tsawk: missing variable assignment\n');
        process.exit(1);
      }
      const eq = args[i].indexOf('=');
      if (eq === -1) {
        process.stderr.write(`tsawk: invalid variable assignment: ${args[i]}\n`);
        process.exit(1);
      }
      variables[args[i].slice(0, eq)] = args[i].slice(eq + 1);
      i++;
    } else if (args[i] === '-f') {
      i++;
      if (i >= args.length) {
        process.stderr.write('tsawk: missing program file\n');
        process.exit(1);
      }
      try {
        program = fs.readFileSync(args[i], 'utf-8');
      } catch (e: any) {
        process.stderr.write(`tsawk: cannot open program file: ${args[i]}\n`);
        process.exit(1);
      }
      programFromFile = true;
      i++;
    } else if (args[i] === '--') {
      i++;
      while (i < args.length) {
        files.push(args[i]);
        i++;
      }
    } else if (!program && !programFromFile) {
      program = args[i];
      i++;
    } else {
      files.push(args[i]);
      i++;
    }
  }

  if (!program) {
    process.stderr.write('tsawk: no program given\n');
    process.exit(1);
  }

  return { program, files, fieldSeparator, variables };
}

async function main(): Promise<void> {
  const cliArgs = parseArgs(process.argv);

  const lexer = new Lexer(cliArgs.program);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const program = parser.parse();

  const options: InterpreterOptions = {
    inputFiles: cliArgs.files,
    variables: cliArgs.variables,
  };

  if (cliArgs.fieldSeparator !== undefined) {
    options.fieldSeparator = cliArgs.fieldSeparator;
  }

  if (cliArgs.files.length === 0) {
    const hasMainRules = program.rules.some(r =>
      r.pattern?.type !== 'BeginPattern' && r.pattern?.type !== 'EndPattern'
    );

    const hasBeginOnly = !hasMainRules && program.rules.every(r =>
      r.pattern?.type === 'BeginPattern' || r.pattern?.type === 'EndPattern'
    ) && program.rules.some(r => r.pattern?.type === 'BeginPattern');

    if (!hasBeginOnly) {
      const chunks: Buffer[] = [];
      const stdin = process.stdin;
      stdin.resume();
      for await (const chunk of stdin) {
        chunks.push(chunk as Buffer);
      }
      options.stdinData = Buffer.concat(chunks).toString('utf-8');
    }
  }

  const interpreter = new Interpreter(program, options);
  const exitCode = interpreter.run();
  process.exit(exitCode);
}

main().catch(err => {
  process.stderr.write(`tsawk: ${err.message}\n`);
  process.exit(2);
});
