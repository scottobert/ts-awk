# ts-awk

A TypeScript implementation of AWK based on [Coding Challenge #116](https://codingchallenges.fyi/challenges/challenge-awk).

## Architecture

Classic three-phase interpreter pipeline:

```
Source string → Lexer → Token[] → Parser → AST (Program) → Interpreter → output
```

- **Lexer** (`src/lexer.ts`): Tokenizer with regex/division disambiguation based on previous token type.
- **Parser** (`src/parser.ts`): Recursive-descent with operator-precedence climbing. Key ambiguities: `>` in print context (redirect vs comparison, controlled by `inPrintArgs` flag), implicit string concatenation (detected in `isConcatStart`), `"cmd" | getline` (handled in postfix parsing).
- **AST** (`src/ast.ts`): Type definitions for all AWK constructs.
- **Interpreter** (`src/interpreter.ts`): Tree-walking interpreter. Control flow (`next`, `break`, `continue`, `exit`, `return`) uses thrown signal objects caught at appropriate levels.
- **Builtins** (`src/builtins.ts`): String functions and math functions.
- **Formatter** (`src/formatter.ts`): printf/sprintf with C-style format specifiers.
- **CLI** (`src/cli.ts`): Entry point, argument parsing, stdin/file I/O.

## Build & Test

```sh
npm run build     # tsc -p tsconfig.build.json
npm test          # jest (193 tests)
npm run test:coverage
```

## Test Structure

- `tests/lexer.test.ts` — Token output for each token type, edge cases
- `tests/parser.test.ts` — AST structure for each language construct
- `tests/interpreter.test.ts` — Value semantics, field handling, special variables, edge cases
- `tests/cli.test.ts` — End-to-end CLI tests using `execFileSync`
- `tests/integration/step1-10.test.ts` — One file per feature step, matching the challenge specification below

## Cross-Platform Notes

- CLI tests use `execFileSync` with an args array (not shell string interpolation) to avoid PowerShell quoting issues.
- Step 10 tests normalize file paths to forward slashes before embedding in AWK program strings to avoid backslash escape interpretation on Windows.

## AWK Feature Specification

This project implements AWK following the steps below. Each step has corresponding integration tests.

### Step 1 — Basic print with field splitting

Read input from a file (or stdin if no file is given), split each line into fields on whitespace, and support the print statement. `$0` refers to the whole line, `$1` to the first field, `$2` to the second, and so on. A bare action block with no pattern runs for every line of input.

```
tsawk '{ print }' test.txt
tsawk '{ print $0 }' test.txt
tsawk '{ print $1 }' test.txt
tsawk '{ print $1, $3 }' test.txt
echo -e "hello\nworld" | tsawk '{ print $0 }'
```

### Step 2 — Custom field separator and built-in variables

`-F` flag for custom field separator. Built-in variables: `NR` (current record number, starting at 1), `NF` (number of fields in the current record), `FS` (field separator).

```
tsawk -F: '{ print $1 }' test2.txt
tsawk '{ print NR, $1 }' test.txt
tsawk '{ print NF }' test.txt
```

### Step 3 — Patterns, comparisons, and regex

Comparison operators (`==`, `!=`, `<`, `>`, `<=`, `>=`), regular expression matching with `/regex/` patterns and `~` / `!~` operators, logical operators (`&&`, `||`, `!`), and `BEGIN` / `END` special patterns. Multiple pattern-action rules per program.

```
tsawk '$2 > 25 { print $1 }' test.txt
tsawk '/London/ { print $1 }' test.txt
tsawk '$1 ~ /^[AJ]/ { print }' test.txt
tsawk 'BEGIN { print "Name Age" } { print $1, $2 } END { print "Done" }' test.txt
tsawk 'BEGIN { FS = ":" } { print $1 }' test2.txt
tsawk '$2 > 25 && $2 < 35 { print $1, "mid-range" }' test.txt
tsawk '/London/ { print "City:", $3 } /^J/ { print "J-name:", $1 }' test.txt
```

### Step 4 — Variables, arithmetic, and assignment

Dynamically typed variables (default to 0 as numbers, "" as strings). Arithmetic operators (`+`, `-`, `*`, `/`, `%`, `^`), assignment operators (`=`, `+=`, `-=`, `*=`, `/=`, `%=`), and string concatenation (juxtaposition).

```
tsawk '{ total += $2 } END { print "Total age:", total }' test.txt
tsawk '{ print $1, $2 * 2 }' test.txt
tsawk '{ name = $1 " from " $3; print name }' test.txt
tsawk 'BEGIN { x = 2; print x ^ 10 }'
```

### Step 5 — Control flow

`if`/`else`, `while`, `for`, `do-while`, C-style for loops. `break`, `continue`, `next`, `exit`, and ternary operator (`?:`).

```
tsawk '{ if ($2 > 25) print $1, "senior"; else print $1, "junior" }' test.txt
tsawk '{ for (i = 1; i <= NF; i++) print $i }' test.txt
tsawk '$1 == "Bob" { next } { print }' test.txt
tsawk '{ print; if (NR == 3) exit }' test.txt
tsawk '{ print ($2 > 25) ? $1 " is senior" : $1 " is junior" }' test.txt
```

### Step 6 — Associative arrays

String-indexed arrays, `in` operator for membership, `for (key in array)` iteration, `delete` statement.

```
tsawk '{ count[$3]++ } END { for (city in count) print city, count[city] }' test.txt
tsawk '{ ages[$1] = $2 } END { if ("Bob" in ages) print "Bob is", ages["Bob"] }' test.txt
tsawk '{ a[$1] = $2 } END { delete a["Bob"]; for (k in a) print k, a[k] }' test.txt
```

### Step 7 — printf and string functions

`printf` with C-style format strings (`%d`, `%f`, `%s`, `%c`, `%x` with width/precision). String functions: `length`, `substr`, `index`, `split`, `sub`, `gsub`, `match`, `sprintf`, `tolower`, `toupper`.

```
tsawk '{ printf "%-10s %3d %s\n", $1, $2, $3 }' test.txt
tsawk '{ print length($1) }' test.txt
tsawk '{ print substr($1, 1, 3) }' test.txt
tsawk '{ gsub(/o/, "0", $1); print }' test.txt
tsawk '{ print toupper($1) }' test.txt
```

### Step 8 — User-defined functions and math

`function name(params) { body }` with local variables (extra params) and `return`. Math builtins: `int`, `sqrt`, `sin`, `cos`, `atan2`, `exp`, `log`, `rand`, `srand`.

```
tsawk 'function max(a, b) { return a > b ? a : b } { print $1, max($2, 30) }' test.txt
tsawk 'BEGIN { srand(42); for (i = 0; i < 5; i++) printf "%.4f\n", rand() }'
tsawk '{ print $1, int(sqrt($2)) }' test.txt
```

### Step 9 — Output variables, flags, and multiple files

`OFS` (output field separator), `ORS` (output record separator), `RS` (record separator). `-f` flag to read program from file, `-v var=value` for pre-execution variable assignment. Multiple input files, `FILENAME`, `ARGC`, `ARGV`.

```
tsawk 'BEGIN { OFS="-" } { print $1, $2, $3 }' test.txt
tsawk -f prog.awk test.txt
tsawk -v threshold=25 '$2 > threshold { print $1 }' test.txt
tsawk '{ print FILENAME, $0 }' test.txt test2.txt
```

### Step 10 — Pipes and getline

Pipe output from print to shell commands (`print "hello" | "sort"`). `getline` forms: `getline` (next line from input), `getline var`, `getline < "file"`, `"command" | getline`. `close()` function.

```
tsawk '{ print $1 | "sort" }' test.txt
tsawk 'BEGIN { while ((getline line < "test.txt") > 0) print line }'
tsawk 'BEGIN { "date" | getline line; print line }'
```
