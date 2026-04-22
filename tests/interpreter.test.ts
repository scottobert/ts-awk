import { runAwk } from './helpers';

describe('Interpreter', () => {
  describe('value semantics', () => {
    it('converts string to number for arithmetic', () => {
      const result = runAwk('BEGIN { x = "5"; print x + 3 }');
      expect(result).toBe('8\n');
    });

    it('converts number to string for concatenation', () => {
      const result = runAwk('BEGIN { x = 42; print x "" }');
      expect(result).toBe('42\n');
    });

    it('numeric string comparison is numeric', () => {
      const result = runAwk('BEGIN { print ("9" > "10") ? "string" : "numeric" }');
      expect(result).toBe('numeric\n');
    });

    it('non-numeric comparison is lexicographic', () => {
      const result = runAwk('BEGIN { print ("abc" > "abd") ? "yes" : "no" }');
      expect(result).toBe('no\n');
    });
  });

  describe('field handling', () => {
    it('$0 contains the whole line', () => {
      const result = runAwk('{ print $0 }', { input: 'hello world\n' });
      expect(result).toBe('hello world\n');
    });

    it('assigning to a field updates $0', () => {
      const result = runAwk('{ $2 = "replaced"; print }', { input: 'hello world foo\n' });
      expect(result).toBe('hello replaced foo\n');
    });

    it('accessing beyond NF returns empty string', () => {
      const result = runAwk('{ print $99 == "" ? "empty" : "not" }', { input: 'a b\n' });
      expect(result).toBe('empty\n');
    });

    it('extending fields creates new ones', () => {
      const result = runAwk('{ $4 = "new"; print }', { input: 'a b c\n' });
      expect(result).toBe('a b c new\n');
    });
  });

  describe('special variables', () => {
    it('NR counts records', () => {
      const result = runAwk('END { print NR }', { input: 'a\nb\nc\n' });
      expect(result).toBe('3\n');
    });

    it('NF counts fields', () => {
      const result = runAwk('{ print NF }', { input: 'a b c d\n' });
      expect(result).toBe('4\n');
    });

    it('FS can be set in BEGIN', () => {
      const result = runAwk('BEGIN { FS = "," } { print $2 }', { input: 'a,b,c\n' });
      expect(result).toBe('b\n');
    });
  });

  describe('error handling', () => {
    it('division by zero throws', () => {
      expect(() => runAwk('BEGIN { print 1/0 }')).toThrow();
    });

    it('unknown function throws', () => {
      expect(() => runAwk('BEGIN { print foo() }')).toThrow();
    });
  });

  describe('edge cases', () => {
    it('empty BEGIN block', () => {
      const result = runAwk('BEGIN { }');
      expect(result).toBe('');
    });

    it('multiple BEGIN blocks', () => {
      const result = runAwk('BEGIN { print "a" } BEGIN { print "b" }');
      expect(result).toBe('a\nb\n');
    });

    it('multiple END blocks', () => {
      const result = runAwk('END { print "a" } END { print "b" }', { input: '' });
      expect(result).toBe('a\nb\n');
    });

    it('print with no newline in input', () => {
      const result = runAwk('{ print }', { input: 'hello' });
      expect(result).toBe('hello\n');
    });
  });
});
