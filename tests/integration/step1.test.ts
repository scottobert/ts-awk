import { runAwk, TEST_FILE } from '../helpers';

describe('Step 1: Basic print with field splitting', () => {
  it('prints every line with print', () => {
    const result = runAwk('{ print }', { files: [TEST_FILE] });
    expect(result).toBe(
      'John 25 London\nJane 30 New York\nBob 22 Paris\nAlice 35 Tokyo\nCharlie 28 Berlin\n'
    );
  });

  it('prints every line with print $0', () => {
    const result = runAwk('{ print $0 }', { files: [TEST_FILE] });
    expect(result).toBe(
      'John 25 London\nJane 30 New York\nBob 22 Paris\nAlice 35 Tokyo\nCharlie 28 Berlin\n'
    );
  });

  it('prints first field with print $1', () => {
    const result = runAwk('{ print $1 }', { files: [TEST_FILE] });
    expect(result).toBe('John\nJane\nBob\nAlice\nCharlie\n');
  });

  it('prints multiple fields with print $1, $3', () => {
    const result = runAwk('{ print $1, $3 }', { files: [TEST_FILE] });
    expect(result).toBe('John London\nJane New\nBob Paris\nAlice Tokyo\nCharlie Berlin\n');
  });

  it('reads from stdin', () => {
    const result = runAwk('{ print $0 }', { input: 'hello\nworld\n' });
    expect(result).toBe('hello\nworld\n');
  });

  it('handles empty input', () => {
    const result = runAwk('{ print }', { input: '' });
    expect(result).toBe('');
  });

  it('handles single line input', () => {
    const result = runAwk('{ print $1 }', { input: 'hello world\n' });
    expect(result).toBe('hello\n');
  });

  it('splits on whitespace by default', () => {
    const result = runAwk('{ print $2 }', { input: '  hello   world  \n' });
    expect(result).toBe('world\n');
  });
});
