import { runAwk, TEST_FILE } from '../helpers';

describe('Step 7: printf and string functions', () => {
  it('printf with format string', () => {
    const result = runAwk('{ printf "%-10s %3d %s\\n", $1, $2, $3 }', { files: [TEST_FILE] });
    expect(result).toContain('John');
    expect(result).toContain('25');
    const lines = result.trim().split('\n');
    expect(lines).toHaveLength(5);
  });

  it('length function', () => {
    const result = runAwk('{ print length($1) }', { files: [TEST_FILE] });
    expect(result).toBe('4\n4\n3\n5\n7\n');
  });

  it('substr function', () => {
    const result = runAwk('{ print substr($1, 1, 3) }', { files: [TEST_FILE] });
    expect(result).toBe('Joh\nJan\nBob\nAli\nCha\n');
  });

  it('gsub function replaces in field', () => {
    const result = runAwk('{ gsub(/o/, "0", $1); print }', { files: [TEST_FILE] });
    expect(result).toContain('B0b');
  });

  it('toupper function', () => {
    const result = runAwk('{ print toupper($1) }', { files: [TEST_FILE] });
    expect(result).toBe('JOHN\nJANE\nBOB\nALICE\nCHARLIE\n');
  });

  it('tolower function', () => {
    const result = runAwk('{ print tolower($1) }', { files: [TEST_FILE] });
    expect(result).toBe('john\njane\nbob\nalice\ncharlie\n');
  });

  it('index function', () => {
    const result = runAwk('BEGIN { print index("hello world", "world") }');
    expect(result).toBe('7\n');
  });

  it('index returns 0 when not found', () => {
    const result = runAwk('BEGIN { print index("hello", "xyz") }');
    expect(result).toBe('0\n');
  });

  it('substr without length', () => {
    const result = runAwk('BEGIN { print substr("hello", 3) }');
    expect(result).toBe('llo\n');
  });

  it('split function', () => {
    const result = runAwk('BEGIN { n = split("a:b:c", arr, ":"); print n, arr[1], arr[2], arr[3] }');
    expect(result).toBe('3 a b c\n');
  });

  it('sub function replaces first occurrence', () => {
    const result = runAwk('BEGIN { x = "aabbcc"; sub(/b/, "X", x); print x }');
    expect(result).toBe('aaXbcc\n');
  });

  it('match function', () => {
    const result = runAwk('BEGIN { print match("hello world", /wor/) }');
    expect(result).toBe('7\n');
  });

  it('sprintf function', () => {
    const result = runAwk('BEGIN { s = sprintf("%05d", 42); print s }');
    expect(result).toBe('00042\n');
  });

  it('printf with %d format', () => {
    const result = runAwk('BEGIN { printf "%d\\n", 42 }');
    expect(result).toBe('42\n');
  });

  it('printf with %s format', () => {
    const result = runAwk('BEGIN { printf "%10s\\n", "hello" }');
    expect(result).toBe('     hello\n');
  });

  it('printf with %f format', () => {
    const result = runAwk('BEGIN { printf "%.2f\\n", 3.14159 }');
    expect(result).toBe('3.14\n');
  });

  it('printf with %x format', () => {
    const result = runAwk('BEGIN { printf "%x\\n", 255 }');
    expect(result).toBe('ff\n');
  });

  it('length with no args uses $0', () => {
    const result = runAwk('{ print length }', { input: 'hello\nhi\n' });
    expect(result).toBe('5\n2\n');
  });
});
