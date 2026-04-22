export interface Program {
  type: 'Program';
  rules: Rule[];
  functions: FunctionDef[];
}

export interface Rule {
  type: 'Rule';
  pattern: Pattern | null;
  action: Block | null;
}

export type Pattern =
  | ExpressionPattern
  | BeginPattern
  | EndPattern;

export interface ExpressionPattern {
  type: 'ExpressionPattern';
  expression: Expression;
}

export interface BeginPattern {
  type: 'BeginPattern';
}

export interface EndPattern {
  type: 'EndPattern';
}

export type Statement =
  | PrintStatement
  | PrintfStatement
  | ExpressionStatement
  | Block
  | IfStatement
  | WhileStatement
  | ForStatement
  | ForInStatement
  | DoWhileStatement
  | BreakStatement
  | ContinueStatement
  | NextStatement
  | ExitStatement
  | ReturnStatement
  | DeleteStatement;

export interface Block {
  type: 'Block';
  statements: Statement[];
}

export interface PrintStatement {
  type: 'PrintStatement';
  args: Expression[];
  output?: OutputRedirect;
}

export interface PrintfStatement {
  type: 'PrintfStatement';
  args: Expression[];
  output?: OutputRedirect;
}

export interface IfStatement {
  type: 'IfStatement';
  condition: Expression;
  consequent: Statement;
  alternate: Statement | null;
}

export interface WhileStatement {
  type: 'WhileStatement';
  condition: Expression;
  body: Statement;
}

export interface ForStatement {
  type: 'ForStatement';
  init: Statement | null;
  condition: Expression | null;
  update: Statement | null;
  body: Statement;
}

export interface ForInStatement {
  type: 'ForInStatement';
  variable: string;
  array: string;
  body: Statement;
}

export interface DoWhileStatement {
  type: 'DoWhileStatement';
  body: Statement;
  condition: Expression;
}

export interface BreakStatement {
  type: 'BreakStatement';
}

export interface ContinueStatement {
  type: 'ContinueStatement';
}

export interface NextStatement {
  type: 'NextStatement';
}

export interface ExitStatement {
  type: 'ExitStatement';
  value: Expression | null;
}

export interface ReturnStatement {
  type: 'ReturnStatement';
  value: Expression | null;
}

export interface DeleteStatement {
  type: 'DeleteStatement';
  array: string;
  index: Expression | null;
}

export interface ExpressionStatement {
  type: 'ExpressionStatement';
  expression: Expression;
}

export interface OutputRedirect {
  type: 'Pipe' | 'Redirect' | 'Append';
  target: Expression;
}

export type Expression =
  | NumberLiteral
  | StringLiteral
  | RegexLiteral
  | FieldAccess
  | Identifier
  | ArrayAccess
  | BinaryExpression
  | UnaryExpression
  | Assignment
  | TernaryExpression
  | Concatenation
  | MatchExpression
  | InExpression
  | CallExpression
  | GetlineExpression
  | IncrementExpression;

export interface NumberLiteral {
  type: 'NumberLiteral';
  value: number;
}

export interface StringLiteral {
  type: 'StringLiteral';
  value: string;
}

export interface RegexLiteral {
  type: 'RegexLiteral';
  pattern: string;
}

export interface FieldAccess {
  type: 'FieldAccess';
  index: Expression;
}

export interface Identifier {
  type: 'Identifier';
  name: string;
}

export interface ArrayAccess {
  type: 'ArrayAccess';
  array: string;
  index: Expression[];
}

export interface BinaryExpression {
  type: 'BinaryExpression';
  operator: string;
  left: Expression;
  right: Expression;
}

export interface UnaryExpression {
  type: 'UnaryExpression';
  operator: string;
  operand: Expression;
  prefix: boolean;
}

export interface Assignment {
  type: 'Assignment';
  operator: string;
  target: Expression;
  value: Expression;
}

export interface TernaryExpression {
  type: 'TernaryExpression';
  condition: Expression;
  consequent: Expression;
  alternate: Expression;
}

export interface Concatenation {
  type: 'Concatenation';
  left: Expression;
  right: Expression;
}

export interface MatchExpression {
  type: 'MatchExpression';
  string: Expression;
  pattern: Expression;
  negated: boolean;
}

export interface InExpression {
  type: 'InExpression';
  index: Expression[];
  array: string;
}

export interface CallExpression {
  type: 'CallExpression';
  callee: string;
  args: Expression[];
}

export interface GetlineExpression {
  type: 'GetlineExpression';
  variable?: string;
  source?: Expression;
  command?: Expression;
}

export interface IncrementExpression {
  type: 'IncrementExpression';
  operand: Expression;
  operator: '++' | '--';
  prefix: boolean;
}

export interface FunctionDef {
  type: 'FunctionDef';
  name: string;
  params: string[];
  body: Block;
}
