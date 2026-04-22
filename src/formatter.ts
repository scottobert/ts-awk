import { AwkValue } from './errors.js';

export function formatString(format: string, args: AwkValue[]): string {
  let result = '';
  let argIdx = 0;
  let i = 0;

  while (i < format.length) {
    if (format[i] === '%') {
      i++;
      if (i >= format.length) { result += '%'; break; }
      if (format[i] === '%') { result += '%'; i++; continue; }

      let flags = '';
      while (i < format.length && '-+ 0#'.includes(format[i])) {
        flags += format[i];
        i++;
      }

      let width = '';
      if (i < format.length && format[i] === '*') {
        width = String(toNumber(args[argIdx++] ?? 0));
        i++;
      } else {
        while (i < format.length && format[i] >= '0' && format[i] <= '9') {
          width += format[i];
          i++;
        }
      }

      let precision = '';
      if (i < format.length && format[i] === '.') {
        i++;
        if (i < format.length && format[i] === '*') {
          precision = String(toNumber(args[argIdx++] ?? 0));
          i++;
        } else {
          while (i < format.length && format[i] >= '0' && format[i] <= '9') {
            precision += format[i];
            i++;
          }
          if (precision === '') precision = '0';
        }
      }

      if (i >= format.length) break;
      const spec = format[i];
      i++;

      const arg = args[argIdx++] ?? '';
      const widthNum = width ? parseInt(width) : 0;
      const precNum = precision !== '' ? parseInt(precision) : -1;

      result += formatSpecifier(spec, arg, flags, widthNum, precNum);
    } else if (format[i] === '\\') {
      i++;
      if (i < format.length) {
        switch (format[i]) {
          case 'n': result += '\n'; break;
          case 't': result += '\t'; break;
          case 'r': result += '\r'; break;
          case '\\': result += '\\'; break;
          case '"': result += '"'; break;
          case 'a': result += '\x07'; break;
          case 'b': result += '\b'; break;
          case 'f': result += '\f'; break;
          case '/': result += '/'; break;
          default: result += '\\' + format[i];
        }
        i++;
      }
    } else {
      result += format[i];
      i++;
    }
  }

  return result;
}

function formatSpecifier(spec: string, arg: AwkValue, flags: string, width: number, precision: number): string {
  let result: string;
  const leftAlign = flags.includes('-');
  const padZero = flags.includes('0') && !leftAlign;
  const showSign = flags.includes('+');
  const spaceSign = flags.includes(' ');

  switch (spec) {
    case 'd':
    case 'i': {
      const num = Math.trunc(toNumber(arg));
      let str = Math.abs(num).toString();
      const sign = num < 0 ? '-' : (showSign ? '+' : (spaceSign ? ' ' : ''));
      if (padZero && width > 0) {
        str = str.padStart(width - sign.length, '0');
      }
      result = sign + str;
      break;
    }
    case 'o': {
      const num = Math.trunc(toNumber(arg));
      const unsigned = num < 0 ? (0xFFFFFFFF + num + 1) : num;
      result = unsigned.toString(8);
      if (flags.includes('#') && !result.startsWith('0')) result = '0' + result;
      break;
    }
    case 'x': {
      const num = Math.trunc(toNumber(arg));
      const unsigned = num < 0 ? (0xFFFFFFFF + num + 1) : num;
      result = unsigned.toString(16);
      if (flags.includes('#')) result = '0x' + result;
      break;
    }
    case 'X': {
      const num = Math.trunc(toNumber(arg));
      const unsigned = num < 0 ? (0xFFFFFFFF + num + 1) : num;
      result = unsigned.toString(16).toUpperCase();
      if (flags.includes('#')) result = '0X' + result;
      break;
    }
    case 'f': {
      const num = toNumber(arg);
      const prec = precision >= 0 ? precision : 6;
      const str = Math.abs(num).toFixed(prec);
      const sign = num < 0 ? '-' : (showSign ? '+' : (spaceSign ? ' ' : ''));
      if (padZero && width > 0) {
        result = sign + str.padStart(width - sign.length, '0');
      } else {
        result = sign + str;
      }
      break;
    }
    case 'e': {
      const num = toNumber(arg);
      const prec = precision >= 0 ? precision : 6;
      result = num.toExponential(prec);
      break;
    }
    case 'E': {
      const num = toNumber(arg);
      const prec = precision >= 0 ? precision : 6;
      result = num.toExponential(prec).toUpperCase();
      break;
    }
    case 'g': {
      const num = toNumber(arg);
      const prec = precision >= 0 ? precision : 6;
      result = formatG(num, prec, false);
      break;
    }
    case 'G': {
      const num = toNumber(arg);
      const prec = precision >= 0 ? precision : 6;
      result = formatG(num, prec, true);
      break;
    }
    case 's': {
      result = String(arg);
      if (precision >= 0) {
        result = result.slice(0, precision);
      }
      break;
    }
    case 'c': {
      if (typeof arg === 'number' || (typeof arg === 'string' && /^\d+$/.test(arg))) {
        result = String.fromCharCode(toNumber(arg));
      } else {
        result = String(arg).charAt(0);
      }
      break;
    }
    default:
      result = String(arg);
  }

  if (width > 0 && result.length < width) {
    if (leftAlign) {
      result = result.padEnd(width);
    } else if (!padZero || spec === 's') {
      result = result.padStart(width);
    } else {
      result = result.padStart(width);
    }
  }

  return result;
}

function formatG(num: number, prec: number, upper: boolean): string {
  if (prec === 0) prec = 1;
  const absNum = Math.abs(num);
  const exp = absNum === 0 ? 0 : Math.floor(Math.log10(absNum));

  let result: string;
  if (exp < -4 || exp >= prec) {
    result = num.toExponential(prec - 1);
  } else {
    const decimals = Math.max(0, prec - exp - 1);
    result = num.toFixed(decimals);
  }

  if (result.includes('.')) {
    result = result.replace(/\.?0+(e|$)/i, '$1');
  }

  return upper ? result.toUpperCase() : result;
}

export function toNumber(val: AwkValue): number {
  if (typeof val === 'number') return val;
  if (val === '') return 0;
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
}

export function toString(val: AwkValue): string {
  if (typeof val === 'string') return val;
  if (Number.isInteger(val)) return val.toString();
  return val.toString();
}
