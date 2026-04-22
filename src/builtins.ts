import { AwkValue, RuntimeError } from './errors.js';
import { toNumber, toString, formatString } from './formatter.js';

export type BuiltinFunction = (args: AwkValue[], env: BuiltinEnv) => AwkValue;

export interface BuiltinEnv {
  getVariable(name: string): AwkValue;
  setVariable(name: string, value: AwkValue): void;
  getField(index: number): string;
  setField(index: number, value: string): void;
  getNF(): number;
}

let randState: (() => number) | null = null;

function createRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export function getBuiltins(): Record<string, BuiltinFunction> {
  return {
    length(args: AwkValue[], env: BuiltinEnv): AwkValue {
      if (args.length === 0) {
        return env.getField(0).length;
      }
      return toString(args[0]).length;
    },

    substr(args: AwkValue[]): AwkValue {
      const str = toString(args[0]);
      const start = Math.max(1, Math.trunc(toNumber(args[1])));
      if (args.length >= 3) {
        const len = Math.trunc(toNumber(args[2]));
        return str.slice(start - 1, start - 1 + len);
      }
      return str.slice(start - 1);
    },

    index(args: AwkValue[]): AwkValue {
      const str = toString(args[0]);
      const target = toString(args[1]);
      const pos = str.indexOf(target);
      return pos === -1 ? 0 : pos + 1;
    },

    split(args: AwkValue[], env: BuiltinEnv): AwkValue {
      const str = toString(args[0]);
      const arrayName = toString(args[1]);
      const fs = args.length >= 3 ? toString(args[2]) : toString(env.getVariable('FS'));

      let parts: string[];
      if (fs === ' ') {
        parts = str.trim().split(/\s+/);
        if (parts.length === 1 && parts[0] === '') parts = [];
      } else {
        const regex = new RegExp(fs);
        parts = str.split(regex);
      }

      const arr = new Map<string, AwkValue>();
      for (let i = 0; i < parts.length; i++) {
        arr.set(String(i + 1), parts[i]);
      }
      (env as any).setArray(arrayName, arr);
      return parts.length;
    },

    sub(args: AwkValue[], env: BuiltinEnv): AwkValue {
      const pattern = toString(args[0]);
      const replacement = toString(args[1]);
      const regex = new RegExp(pattern);

      if (args.length >= 3) {
        const fieldStr = toString(args[2]);
        const targetName = (args as any)[2]?._targetName;
        const newVal = fieldStr.replace(regex, createReplacement(replacement));
        if (targetName !== undefined) {
          if (typeof targetName === 'number') {
            env.setField(targetName, newVal);
          } else {
            env.setVariable(targetName, newVal);
          }
        }
        return fieldStr !== newVal ? 1 : 0;
      }

      const field0 = env.getField(0);
      const newVal = field0.replace(regex, createReplacement(replacement));
      env.setField(0, newVal);
      return field0 !== newVal ? 1 : 0;
    },

    gsub(args: AwkValue[], env: BuiltinEnv): AwkValue {
      const pattern = toString(args[0]);
      const replacement = toString(args[1]);
      const regex = new RegExp(pattern, 'g');

      if (args.length >= 3) {
        const fieldStr = toString(args[2]);
        const targetName = (args as any)[2]?._targetName;
        let count = 0;
        const newVal = fieldStr.replace(regex, () => { count++; return createReplacement(replacement)(''); });
        if (targetName !== undefined) {
          if (typeof targetName === 'number') {
            env.setField(targetName, newVal);
          } else {
            env.setVariable(targetName, newVal);
          }
        }
        return count;
      }

      const field0 = env.getField(0);
      let count = 0;
      const newVal = field0.replace(regex, () => { count++; return createReplacement(replacement)(''); });
      env.setField(0, newVal);
      return count;
    },

    match(args: AwkValue[], env: BuiltinEnv): AwkValue {
      const str = toString(args[0]);
      const pattern = toString(args[1]);
      const regex = new RegExp(pattern);
      const m = str.match(regex);
      if (m && m.index !== undefined) {
        env.setVariable('RSTART', m.index + 1);
        env.setVariable('RLENGTH', m[0].length);
        return m.index + 1;
      }
      env.setVariable('RSTART', 0);
      env.setVariable('RLENGTH', -1);
      return 0;
    },

    sprintf(args: AwkValue[]): AwkValue {
      const fmt = toString(args[0]);
      return formatString(fmt, args.slice(1));
    },

    tolower(args: AwkValue[]): AwkValue {
      return toString(args[0]).toLowerCase();
    },

    toupper(args: AwkValue[]): AwkValue {
      return toString(args[0]).toUpperCase();
    },

    int(args: AwkValue[]): AwkValue {
      return Math.trunc(toNumber(args[0]));
    },

    sqrt(args: AwkValue[]): AwkValue {
      return Math.sqrt(toNumber(args[0]));
    },

    sin(args: AwkValue[]): AwkValue {
      return Math.sin(toNumber(args[0]));
    },

    cos(args: AwkValue[]): AwkValue {
      return Math.cos(toNumber(args[0]));
    },

    atan2(args: AwkValue[]): AwkValue {
      return Math.atan2(toNumber(args[0]), toNumber(args[1]));
    },

    exp(args: AwkValue[]): AwkValue {
      return Math.exp(toNumber(args[0]));
    },

    log(args: AwkValue[]): AwkValue {
      return Math.log(toNumber(args[0]));
    },

    rand(): AwkValue {
      if (!randState) {
        randState = createRng(Date.now());
      }
      return randState();
    },

    srand(args: AwkValue[]): AwkValue {
      const seed = args.length > 0 ? toNumber(args[0]) : Date.now();
      randState = createRng(seed);
      return seed;
    },

    system(args: AwkValue[]): AwkValue {
      const { execSync } = require('child_process');
      try {
        execSync(toString(args[0]), { stdio: 'inherit' });
        return 0;
      } catch (e: any) {
        return e.status ?? 1;
      }
    },

    close(): AwkValue {
      return 0;
    },
  };
}

function createReplacement(replacement: string): (match: string) => string {
  return () => replacement.replace(/&/g, '');
}
