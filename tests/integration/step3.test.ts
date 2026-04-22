import { runAwk, TEST_FILE, TEST_FILE_2 } from '../helpers';

describe('Step 3: Patterns, comparisons, and regex', () => {
  it('filters by comparison $2 > 25', () => {
    const result = runAwk('$2 > 25 { print $1 }', { files: [TEST_FILE] });
    expect(result).toBe('Jane\nAlice\nCharlie\n');
  });

  it('filters by regex /London/', () => {
    const result = runAwk('/London/ { print $1 }', { files: [TEST_FILE] });
    expect(result).toBe('John\n');
  });

  it('filters by regex match operator $1 ~ /^[AJ]/', () => {
    const result = runAwk('$1 ~ /^[AJ]/ { print }', { files: [TEST_FILE] });
    expect(result).toContain('John');
    expect(result).toContain('Jane');
    expect(result).toContain('Alice');
    expect(result).not.toContain('Bob');
    expect(result).not.toContain('Charlie');
  });

  it('supports BEGIN and END patterns', () => {
    const result = runAwk(
      'BEGIN { print "Name Age" } { print $1, $2 } END { print "Done" }',
      { files: [TEST_FILE] }
    );
    expect(result).toBe(
      'Name Age\nJohn 25\nJane 30\nBob 22\nAlice 35\nCharlie 28\nDone\n'
    );
  });

  it('supports BEGIN with FS setting', () => {
    const result = runAwk('BEGIN { FS = ":" } { print $1 }', { files: [TEST_FILE_2] });
    expect(result).toBe('john\njane\nbob\n');
  });

  it('supports logical AND in patterns', () => {
    const result = runAwk('$2 > 25 && $2 < 35 { print $1, "mid-range" }', { files: [TEST_FILE] });
    expect(result).toBe('Jane mid-range\nCharlie mid-range\n');
  });

  it('supports multiple rules matching same line', () => {
    const result = runAwk('/London/ { print "City:", $3 } /^J/ { print "J-name:", $1 }', { files: [TEST_FILE] });
    expect(result).toContain('City: London');
    expect(result).toContain('J-name: John');
    expect(result).toContain('J-name: Jane');
  });

  it('supports equality comparison', () => {
    const result = runAwk('$1 == "Bob" { print $2 }', { files: [TEST_FILE] });
    expect(result).toBe('22\n');
  });

  it('supports not-equal comparison', () => {
    const result = runAwk('$1 != "Bob" { print $1 }', { files: [TEST_FILE] });
    expect(result).not.toContain('Bob');
  });

  it('pattern with no action defaults to print', () => {
    const result = runAwk('/London/', { files: [TEST_FILE] });
    expect(result).toBe('John 25 London\n');
  });

  it('supports logical NOT', () => {
    const result = runAwk('!($2 > 25) { print $1 }', { files: [TEST_FILE] });
    expect(result).toBe('John\nBob\n');
  });

  it('supports logical OR', () => {
    const result = runAwk('$1 == "Bob" || $1 == "Alice" { print $1 }', { files: [TEST_FILE] });
    expect(result).toBe('Bob\nAlice\n');
  });
});
