# ts-awk

[![CI](https://github.com/scottobert/ts-awk/actions/workflows/ci.yml/badge.svg)](https://github.com/scottobert/ts-awk/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/ts-awk.svg)](https://www.npmjs.com/package/ts-awk)
[![npm downloads](https://img.shields.io/npm/dm/ts-awk.svg)](https://www.npmjs.com/package/ts-awk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/node/v/ts-awk.svg)](https://nodejs.org)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=scottobert_ts-awk&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=scottobert_ts-awk)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=scottobert_ts-awk&metric=coverage)](https://sonarcloud.io/summary/new_code?id=scottobert_ts-awk)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=scottobert_ts-awk&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=scottobert_ts-awk)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=scottobert_ts-awk&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=scottobert_ts-awk)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=scottobert_ts-awk&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=scottobert_ts-awk)

A TypeScript implementation of [AWK](https://pubs.opengroup.org/onlinepubs/9699919799/utilities/awk.html), the classic text processing language. Usable as a CLI tool or as a library.

## Installation

```sh
npm install -g ts-awk
```

Or as a project dependency:

```sh
npm install ts-awk
```

## CLI Usage

```sh
tsawk [options] 'program' [file ...]
```

### Options

| Flag | Description |
|------|-------------|
| `-F sep` | Set the field separator (default: whitespace) |
| `-v var=value` | Assign a variable before execution |
| `-f progfile` | Read the AWK program from a file |

### Examples

```sh
# Print the first field of each line
tsawk '{ print $1 }' data.txt

# Sum a column
tsawk '{ total += $2 } END { print total }' data.txt

# Custom field separator
tsawk -F: '{ print $1, $3 }' /etc/passwd

# Filter with pattern matching
tsawk '/error/i { print NR, $0 }' log.txt

# Multiple rules
tsawk 'BEGIN { print "Name,Age" } $2 > 25 { print $1 "," $2 }' data.txt

# Read from stdin
cat data.txt | tsawk '{ print NF }'
```

## Library Usage

```typescript
import { Lexer, Parser, Interpreter } from 'ts-awk';

const program = '{ total += $2 } END { print total }';
const input = 'Alice 30\nBob 25\nCharlie 35\n';

const tokens = new Lexer(program).tokenize();
const ast = new Parser(tokens).parse();

let output = '';
const interpreter = new Interpreter(ast, {
  stdinData: input,
  output: (text) => { output += text; },
});

interpreter.run();
console.log(output); // "90\n"
```

## Supported Features

- **Field splitting** &mdash; `$0`, `$1`..`$NF`, custom separators via `-F` or `FS`
- **Patterns** &mdash; `BEGIN`, `END`, `/regex/`, comparison expressions, `~`, `!~`
- **Multiple rules** &mdash; each input line is checked against every rule
- **Variables** &mdash; dynamically typed, automatic string/number coercion
- **Arithmetic** &mdash; `+`, `-`, `*`, `/`, `%`, `^`, compound assignment (`+=`, etc.)
- **String concatenation** &mdash; implicit (juxtaposition)
- **Control flow** &mdash; `if`/`else`, `while`, `for`, `do-while`, `break`, `continue`, `next`, `exit`, ternary (`?:`)
- **Associative arrays** &mdash; `arr[key]`, `for (k in arr)`, `delete`, `in`
- **printf / sprintf** &mdash; `%d`, `%f`, `%s`, `%c`, `%x`, `%o`, `%e`, `%g` with width and precision
- **String functions** &mdash; `length`, `substr`, `index`, `split`, `sub`, `gsub`, `match`, `sprintf`, `tolower`, `toupper`
- **Math functions** &mdash; `int`, `sqrt`, `sin`, `cos`, `atan2`, `exp`, `log`, `rand`, `srand`
- **User-defined functions** &mdash; `function name(params) { body }` with `return` and local variables
- **Output variables** &mdash; `OFS`, `ORS`, `RS`
- **Built-in variables** &mdash; `NR`, `NF`, `FS`, `FILENAME`, `ARGC`, `ARGV`, `RSTART`, `RLENGTH`
- **I/O** &mdash; `print ... | "cmd"`, `print ... > "file"`, `print ... >> "file"`, `getline`, `close()`
- **Multiple input files**

## Development

```sh
git clone https://github.com/scottobert/ts-awk.git
cd ts-awk
npm install
npm run build
npm test
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm test` | Run all tests |
| `npm run test:coverage` | Run tests with coverage report |

### Project Structure

```
src/
  lexer.ts          Tokenizer
  parser.ts         Recursive-descent parser
  ast.ts            AST type definitions
  interpreter.ts    Tree-walking interpreter
  builtins.ts       Built-in string and math functions
  formatter.ts      printf/sprintf formatting
  cli.ts            CLI entry point
  index.ts          Library exports
tests/
  lexer.test.ts     Lexer unit tests
  parser.test.ts    Parser unit tests
  interpreter.test.ts  Interpreter unit tests
  cli.test.ts       CLI end-to-end tests
  integration/      Feature tests (one file per AWK feature area)
```

## License

MIT
