import { runAwk, TEST_FILE } from '../helpers';
import * as path from 'path';
import * as fs from 'fs';

function toAwkPath(p: string): string {
  return p.replace(/\\/g, '/');
}

describe('Step 10: Pipes and getline', () => {
  it('pipes output to sort command', () => {
    const result = runAwk('{ print $1 | "sort" }', { files: [TEST_FILE] });
    const lines = result.trim().split('\n');
    const sorted = [...lines].sort();
    expect(lines).toEqual(sorted);
  });

  it('getline reads from file in BEGIN', () => {
    const awkPath = toAwkPath(TEST_FILE);
    const result = runAwk(`BEGIN { while ((getline line < "${awkPath}") > 0) print line }`);
    expect(result).toContain('John 25 London');
    expect(result).toContain('Charlie 28 Berlin');
  });

  it('getline reads first line from file', () => {
    const awkPath = toAwkPath(TEST_FILE);
    const result = runAwk(`BEGIN { getline line < "${awkPath}"; print line }`);
    expect(result).toBe('John 25 London\n');
  });

  it('print redirect to file', () => {
    const tmpFile = path.join(__dirname, '..', 'fixtures', 'tmp_output.txt');
    const awkPath = toAwkPath(tmpFile);
    try {
      runAwk(`{ print $1 > "${awkPath}" }`, { files: [TEST_FILE] });
      const content = fs.readFileSync(tmpFile, 'utf-8');
      expect(content).toContain('John');
      expect(content).toContain('Charlie');
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }
  });

  it('command pipe with getline', () => {
    const cmd = process.platform === 'win32' ? 'cmd /c echo hello' : 'echo hello';
    const result = runAwk(`BEGIN { "${cmd}" | getline line; print line }`);
    expect(result.trim()).toBe('hello');
  });
});
