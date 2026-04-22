import { runAwk, TEST_FILE } from '../helpers';

describe('Step 8: User-defined functions and math', () => {
  it('user-defined max function', () => {
    const result = runAwk(
      'function max(a, b) { return a > b ? a : b } { print $1, max($2, 30) }',
      { files: [TEST_FILE] }
    );
    expect(result).toBe('John 30\nJane 30\nBob 30\nAlice 35\nCharlie 30\n');
  });

  it('int and sqrt built-in functions', () => {
    const result = runAwk('{ print $1, int(sqrt($2)) }', { files: [TEST_FILE] });
    expect(result).toBe('John 5\nJane 5\nBob 4\nAlice 5\nCharlie 5\n');
  });

  it('srand and rand produce numbers', () => {
    const result = runAwk('BEGIN { srand(42); for (i = 0; i < 5; i++) printf "%.4f\\n", rand() }');
    const lines = result.trim().split('\n');
    expect(lines).toHaveLength(5);
    for (const line of lines) {
      const num = parseFloat(line);
      expect(num).toBeGreaterThanOrEqual(0);
      expect(num).toBeLessThan(1);
    }
  });

  it('sin function', () => {
    const result = runAwk('BEGIN { printf "%.4f\\n", sin(0) }');
    expect(result).toBe('0.0000\n');
  });

  it('cos function', () => {
    const result = runAwk('BEGIN { printf "%.4f\\n", cos(0) }');
    expect(result).toBe('1.0000\n');
  });

  it('exp function', () => {
    const result = runAwk('BEGIN { printf "%.4f\\n", exp(0) }');
    expect(result).toBe('1.0000\n');
  });

  it('log function', () => {
    const result = runAwk('BEGIN { printf "%.4f\\n", log(1) }');
    expect(result).toBe('0.0000\n');
  });

  it('atan2 function', () => {
    const result = runAwk('BEGIN { printf "%.4f\\n", atan2(1, 1) }');
    expect(parseFloat(result.trim())).toBeCloseTo(Math.PI / 4, 4);
  });

  it('user function with local variables', () => {
    const result = runAwk(
      'function add(a, b,    sum) { sum = a + b; return sum } BEGIN { print add(3, 4) }',
    );
    expect(result).toBe('7\n');
  });

  it('recursive function', () => {
    const result = runAwk(
      'function fact(n) { if (n <= 1) return 1; return n * fact(n - 1) } BEGIN { print fact(5) }',
    );
    expect(result).toBe('120\n');
  });

  it('function with no return returns empty', () => {
    const result = runAwk(
      'function noop() { x = 1 } BEGIN { r = noop(); print r == "" ? "empty" : "not empty" }',
    );
    expect(result).toBe('empty\n');
  });
});
