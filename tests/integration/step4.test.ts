import { runAwk, TEST_FILE } from '../helpers';

describe('Step 4: Variables, arithmetic, and assignment', () => {
  it('accumulates with += in END', () => {
    const result = runAwk('{ total += $2 } END { print "Total age:", total }', { files: [TEST_FILE] });
    expect(result).toBe('Total age: 140\n');
  });

  it('performs arithmetic in print', () => {
    const result = runAwk('{ print $1, $2 * 2 }', { files: [TEST_FILE] });
    expect(result).toBe('John 50\nJane 60\nBob 44\nAlice 70\nCharlie 56\n');
  });

  it('concatenates strings with variables', () => {
    const result = runAwk('{ name = $1 " from " $3; print name }', { files: [TEST_FILE] });
    expect(result).toContain('John from London');
    expect(result).toContain('Bob from Paris');
  });

  it('computes exponentiation', () => {
    const result = runAwk('BEGIN { x = 2; print x ^ 10 }');
    expect(result).toBe('1024\n');
  });

  it('handles modulo operator', () => {
    const result = runAwk('BEGIN { print 10 % 3 }');
    expect(result).toBe('1\n');
  });

  it('handles subtraction', () => {
    const result = runAwk('BEGIN { print 10 - 3 }');
    expect(result).toBe('7\n');
  });

  it('handles division', () => {
    const result = runAwk('BEGIN { print 10 / 4 }');
    expect(result).toBe('2.5\n');
  });

  it('handles multiple assignment operators', () => {
    const result = runAwk('BEGIN { x = 10; x -= 3; print x }');
    expect(result).toBe('7\n');
  });

  it('handles *= assignment', () => {
    const result = runAwk('BEGIN { x = 5; x *= 3; print x }');
    expect(result).toBe('15\n');
  });

  it('handles uninitialized variables as 0', () => {
    const result = runAwk('BEGIN { x += 5; print x }');
    expect(result).toBe('5\n');
  });

  it('handles uninitialized variables as empty string', () => {
    const result = runAwk('BEGIN { print x }');
    expect(result).toBe('\n');
  });

  it('handles negative numbers', () => {
    const result = runAwk('BEGIN { print -5 + 3 }');
    expect(result).toBe('-2\n');
  });

  it('respects operator precedence', () => {
    const result = runAwk('BEGIN { print 2 + 3 * 4 }');
    expect(result).toBe('14\n');
  });
});
