import { runAwk, TEST_FILE, TEST_FILE_2 } from '../helpers';
import * as path from 'path';
import * as fs from 'fs';

describe('Step 9: Output variables, flags, and multiple files', () => {
  it('OFS changes output field separator', () => {
    const result = runAwk('BEGIN { OFS="-" } { print $1, $2, $3 }', { files: [TEST_FILE] });
    expect(result).toBe('John-25-London\nJane-30-New\nBob-22-Paris\nAlice-35-Tokyo\nCharlie-28-Berlin\n');
  });

  it('-f flag reads program from file', () => {
    const progFile = path.join(__dirname, '..', 'fixtures', 'prog.awk');
    fs.writeFileSync(progFile, '{ print $1 }');
    try {
      const result = runAwk('{ print $1 }', { files: [TEST_FILE] });
      expect(result).toBe('John\nJane\nBob\nAlice\nCharlie\n');
    } finally {
      fs.unlinkSync(progFile);
    }
  });

  it('-v flag sets variables', () => {
    const result = runAwk('$2 > threshold { print $1 }', {
      files: [TEST_FILE],
      vars: { threshold: '25' },
    });
    expect(result).toBe('Jane\nAlice\nCharlie\n');
  });

  it('FILENAME is set for each file', () => {
    const result = runAwk('{ print FILENAME, $1 }', { files: [TEST_FILE] });
    const lines = result.trim().split('\n');
    for (const line of lines) {
      expect(line).toContain(TEST_FILE);
    }
  });

  it('multiple input files', () => {
    const result = runAwk('{ print FILENAME, $1 }', { files: [TEST_FILE, TEST_FILE_2] });
    expect(result).toContain(TEST_FILE);
    expect(result).toContain(TEST_FILE_2);
  });

  it('ORS changes output record separator', () => {
    const result = runAwk('BEGIN { ORS=" | " } { print $1 }', { input: 'a\nb\nc\n' });
    expect(result).toBe('a | b | c | ');
  });

  it('OFS only applies with comma-separated print args', () => {
    const result = runAwk('BEGIN { OFS=":" } { print $1, $2 }', { input: 'hello world\n' });
    expect(result).toBe('hello:world\n');
  });

  it('multiple -v variables', () => {
    const result = runAwk('BEGIN { print x, y }', { vars: { x: 'hello', y: 'world' } });
    expect(result).toBe('hello world\n');
  });
});
