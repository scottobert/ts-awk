import { runAwk, TEST_FILE } from '../helpers';

describe('Step 6: Associative arrays', () => {
  it('counts by key with post-increment', () => {
    const result = runAwk(
      '{ count[$3]++ } END { for (city in count) print city, count[city] }',
      { files: [TEST_FILE] }
    );
    expect(result).toContain('London 1');
    expect(result).toContain('Paris 1');
    expect(result).toContain('Tokyo 1');
    expect(result).toContain('Berlin 1');
  });

  it('supports in operator for membership', () => {
    const result = runAwk(
      '{ ages[$1] = $2 } END { if ("Bob" in ages) print "Bob is", ages["Bob"] }',
      { files: [TEST_FILE] }
    );
    expect(result).toBe('Bob is 22\n');
  });

  it('supports delete statement', () => {
    const result = runAwk(
      '{ a[$1] = $2 } END { delete a["Bob"]; for (k in a) print k, a[k] }',
      { files: [TEST_FILE] }
    );
    expect(result).not.toContain('Bob');
    expect(result).toContain('John');
    expect(result).toContain('Alice');
  });

  it('supports array assignment and access', () => {
    const result = runAwk('BEGIN { arr["key"] = "value"; print arr["key"] }');
    expect(result).toBe('value\n');
  });

  it('supports numeric array indices', () => {
    const result = runAwk('BEGIN { arr[1] = "one"; arr[2] = "two"; print arr[1], arr[2] }');
    expect(result).toBe('one two\n');
  });

  it('uninitialized array element returns empty', () => {
    const result = runAwk('BEGIN { print arr["missing"] == "" ? "yes" : "no" }');
    expect(result).toBe('yes\n');
  });

  it('in operator returns false for missing key', () => {
    const result = runAwk('BEGIN { if ("x" in arr) print "yes"; else print "no" }');
    expect(result).toBe('no\n');
  });

  it('for-in iterates all keys', () => {
    const result = runAwk('BEGIN { a["x"]=1; a["y"]=2; a["z"]=3; n=0; for(k in a) n++; print n }');
    expect(result).toBe('3\n');
  });
});
