import { runAwk, TEST_FILE, TEST_FILE_2 } from '../helpers';

describe('Step 2: Field separators and built-in variables', () => {
  it('uses -F for custom field separator', () => {
    const result = runAwk('{ print $1 }', { files: [TEST_FILE_2], fs: ':' });
    expect(result).toBe('john\njane\nbob\n');
  });

  it('prints NR with first field', () => {
    const result = runAwk('{ print NR, $1 }', { files: [TEST_FILE] });
    expect(result).toBe('1 John\n2 Jane\n3 Bob\n4 Alice\n5 Charlie\n');
  });

  it('prints NF for each line', () => {
    const result = runAwk('{ print NF }', { files: [TEST_FILE] });
    expect(result).toBe('3\n4\n3\n3\n3\n');
  });

  it('supports colon separator for multi-word fields', () => {
    const result = runAwk('{ print $3 }', { files: [TEST_FILE_2], fs: ':' });
    expect(result).toBe('london\nnew york\nparis\n');
  });

  it('uses single character separator', () => {
    const result = runAwk('{ print NF }', { input: 'a:b:c\n', fs: ':' });
    expect(result).toBe('3\n');
  });

  it('NR increments correctly', () => {
    const result = runAwk('{ print NR }', { input: 'a\nb\nc\n' });
    expect(result).toBe('1\n2\n3\n');
  });
});
