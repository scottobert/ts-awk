import { runAwk, TEST_FILE } from '../helpers';

describe('Step 5: Control flow', () => {
  it('supports if/else', () => {
    const result = runAwk(
      '{ if ($2 > 25) print $1, "senior"; else print $1, "junior" }',
      { files: [TEST_FILE] }
    );
    expect(result).toBe(
      'John junior\nJane senior\nBob junior\nAlice senior\nCharlie senior\n'
    );
  });

  it('supports for loop iterating fields', () => {
    const result = runAwk('{ for (i = 1; i <= NF; i++) print $i }', { input: 'a b c\n' });
    expect(result).toBe('a\nb\nc\n');
  });

  it('supports next to skip records', () => {
    const result = runAwk('$1 == "Bob" { next } { print }', { files: [TEST_FILE] });
    expect(result).not.toContain('Bob');
    expect(result).toContain('John');
    expect(result).toContain('Alice');
  });

  it('supports exit to stop processing', () => {
    const result = runAwk('{ print; if (NR == 3) exit }', { files: [TEST_FILE] });
    const lines = result.trim().split('\n');
    expect(lines).toHaveLength(3);
  });

  it('supports ternary operator', () => {
    const result = runAwk(
      '{ print ($2 > 25) ? $1 " is senior" : $1 " is junior" }',
      { files: [TEST_FILE] }
    );
    expect(result).toContain('John is junior');
    expect(result).toContain('Jane is senior');
    expect(result).toContain('Alice is senior');
  });

  it('supports while loop', () => {
    const result = runAwk('BEGIN { x = 0; while (x < 5) { print x; x++ } }');
    expect(result).toBe('0\n1\n2\n3\n4\n');
  });

  it('supports do-while loop', () => {
    const result = runAwk('BEGIN { x = 0; do { print x; x++ } while (x < 3) }');
    expect(result).toBe('0\n1\n2\n');
  });

  it('supports break in loop', () => {
    const result = runAwk('BEGIN { for (i = 0; i < 10; i++) { if (i == 3) break; print i } }');
    expect(result).toBe('0\n1\n2\n');
  });

  it('supports continue in loop', () => {
    const result = runAwk('BEGIN { for (i = 0; i < 5; i++) { if (i == 2) continue; print i } }');
    expect(result).toBe('0\n1\n3\n4\n');
  });

  it('supports nested if-else', () => {
    const result = runAwk(
      '{ if ($2 > 30) print "old"; else if ($2 > 25) print "mid"; else print "young" }',
      { files: [TEST_FILE] }
    );
    expect(result).toBe('young\nmid\nyoung\nold\nmid\n');
  });

  it('supports nested loops', () => {
    const result = runAwk('BEGIN { for (i = 0; i < 3; i++) for (j = 0; j < 2; j++) print i, j }');
    expect(result).toBe('0 0\n0 1\n1 0\n1 1\n2 0\n2 1\n');
  });
});
