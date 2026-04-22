import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Interpreter, InterpreterOptions } from '../src/interpreter';
import * as path from 'path';

export const FIXTURES_DIR = path.join(__dirname, 'fixtures');
export const TEST_FILE = path.join(FIXTURES_DIR, 'test.txt');
export const TEST_FILE_2 = path.join(FIXTURES_DIR, 'test2.txt');

export function runAwk(
  program: string,
  options: {
    input?: string;
    files?: string[];
    fs?: string;
    vars?: Record<string, string>;
  } = {}
): string {
  const lexer = new Lexer(program);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  let output = '';
  const interpreterOptions: InterpreterOptions = {
    output: (text: string) => { output += text; },
    inputFiles: options.files ?? [],
    stdinData: options.input,
    fieldSeparator: options.fs,
    variables: options.vars,
  };

  const interpreter = new Interpreter(ast, interpreterOptions);
  interpreter.run();
  return output;
}
