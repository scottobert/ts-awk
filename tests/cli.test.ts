import { execFileSync } from 'child_process';
import * as path from 'path';

const CLI = path.join(__dirname, '..', 'dist', 'cli.js');
const TEST_FILE = path.join(__dirname, 'fixtures', 'test.txt');
const TEST_FILE_2 = path.join(__dirname, 'fixtures', 'test2.txt');

function tsawk(args: string[], input?: string): string {
  const opts: any = { encoding: 'utf-8', timeout: 10000 };
  if (input !== undefined) {
    opts.input = input;
  }
  return execFileSync(process.execPath, [CLI, ...args], opts);
}

describe('CLI', () => {
  it('prints all lines from file', () => {
    const result = tsawk(['{ print }', TEST_FILE]);
    expect(result).toBe(
      'John 25 London\nJane 30 New York\nBob 22 Paris\nAlice 35 Tokyo\nCharlie 28 Berlin\n'
    );
  });

  it('prints first field', () => {
    const result = tsawk(['{ print $1 }', TEST_FILE]);
    expect(result).toBe('John\nJane\nBob\nAlice\nCharlie\n');
  });

  it('supports -F flag', () => {
    const result = tsawk(['-F:', '{ print $1 }', TEST_FILE_2]);
    expect(result).toBe('john\njane\nbob\n');
  });

  it('supports -F with space', () => {
    const result = tsawk(['-F', ':', '{ print $1 }', TEST_FILE_2]);
    expect(result).toBe('john\njane\nbob\n');
  });

  it('reads from stdin', () => {
    const result = tsawk(['{ print $1 }'], 'hello world\n');
    expect(result).toBe('hello\n');
  });

  it('supports -v flag', () => {
    const result = tsawk(['-v', 'threshold=25', '$2 > threshold { print $1 }', TEST_FILE]);
    expect(result).toBe('Jane\nAlice\nCharlie\n');
  });

  it('supports BEGIN-only programs without input', () => {
    const result = tsawk(['BEGIN { print "hello" }']);
    expect(result).toBe('hello\n');
  });

  it('supports multiple files', () => {
    const result = tsawk(['{ print NR, $1 }', TEST_FILE, TEST_FILE_2]);
    expect(result).toContain('1 John');
    expect(result).toContain('6 john');
  });

  it('processes complex program', () => {
    const result = tsawk(['BEGIN { print "---" } { total += $2 } END { print "Total:", total }', TEST_FILE]);
    expect(result).toBe('---\nTotal: 140\n');
  });
});
