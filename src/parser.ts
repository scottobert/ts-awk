import { Token, TokenType } from './tokens.js';
import { ParseError } from './errors.js';
import {
  Program, Rule, Pattern, Statement, Block, Expression,
  FunctionDef, OutputRedirect, PrintStatement, PrintfStatement,
} from './ast.js';

export class Parser {
  private tokens: Token[];
  private pos: number = 0;
  private inPrintArgs: boolean = false;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): Program {
    const rules: Rule[] = [];
    const functions: FunctionDef[] = [];

    this.skipNewlines();

    while (!this.isAtEnd()) {
      this.skipNewlines();
      if (this.isAtEnd()) break;

      if (this.check(TokenType.FUNCTION)) {
        functions.push(this.parseFunctionDef());
      } else {
        rules.push(this.parseRule());
      }
      this.skipTerminators();
    }

    return { type: 'Program', rules, functions };
  }

  private parseFunctionDef(): FunctionDef {
    this.expect(TokenType.FUNCTION);
    const name = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.LPAREN);
    const params: string[] = [];
    if (!this.check(TokenType.RPAREN)) {
      params.push(this.expect(TokenType.IDENTIFIER).value);
      while (this.match(TokenType.COMMA)) {
        params.push(this.expect(TokenType.IDENTIFIER).value);
      }
    }
    this.expect(TokenType.RPAREN);
    this.skipNewlines();
    const body = this.parseBlock();
    return { type: 'FunctionDef', name, params, body };
  }

  private parseRule(): Rule {
    let pattern: Pattern | null = null;
    let action: Block | null = null;

    if (this.check(TokenType.BEGIN)) {
      this.advance();
      pattern = { type: 'BeginPattern' };
      this.skipNewlines();
      if (this.check(TokenType.LBRACE)) {
        action = this.parseBlock();
      }
    } else if (this.check(TokenType.END)) {
      this.advance();
      pattern = { type: 'EndPattern' };
      this.skipNewlines();
      if (this.check(TokenType.LBRACE)) {
        action = this.parseBlock();
      }
    } else if (this.check(TokenType.LBRACE)) {
      action = this.parseBlock();
    } else {
      const expr = this.parseExpression();
      pattern = { type: 'ExpressionPattern', expression: expr };
      this.skipNewlines();
      if (this.check(TokenType.LBRACE)) {
        action = this.parseBlock();
      }
    }

    return { type: 'Rule', pattern, action };
  }

  private parseBlock(): Block {
    this.expect(TokenType.LBRACE);
    this.skipNewlines();
    const statements: Statement[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      statements.push(this.parseStatement());
      this.skipTerminators();
    }

    this.expect(TokenType.RBRACE);
    return { type: 'Block', statements };
  }

  private parseStatement(): Statement {
    if (this.check(TokenType.IF)) return this.parseIf();
    if (this.check(TokenType.WHILE)) return this.parseWhile();
    if (this.check(TokenType.FOR)) return this.parseFor();
    if (this.check(TokenType.DO)) return this.parseDoWhile();
    if (this.check(TokenType.LBRACE)) return this.parseBlock();
    if (this.check(TokenType.BREAK)) { this.advance(); return { type: 'BreakStatement' }; }
    if (this.check(TokenType.CONTINUE)) { this.advance(); return { type: 'ContinueStatement' }; }
    if (this.check(TokenType.NEXT)) { this.advance(); return { type: 'NextStatement' }; }
    if (this.check(TokenType.EXIT)) return this.parseExit();
    if (this.check(TokenType.RETURN)) return this.parseReturn();
    if (this.check(TokenType.DELETE)) return this.parseDelete();
    if (this.check(TokenType.PRINT)) return this.parsePrint();
    if (this.check(TokenType.PRINTF)) return this.parsePrintf();

    const expr = this.parseExpression();
    return { type: 'ExpressionStatement', expression: expr };
  }

  private parseIf(): Statement {
    this.expect(TokenType.IF);
    this.expect(TokenType.LPAREN);
    const condition = this.parseExpression();
    this.expect(TokenType.RPAREN);
    this.skipNewlines();
    const consequent = this.parseStatement();
    this.skipTerminators();
    let alternate: Statement | null = null;
    if (this.check(TokenType.ELSE)) {
      this.advance();
      this.skipNewlines();
      alternate = this.parseStatement();
    }
    return { type: 'IfStatement', condition, consequent, alternate };
  }

  private parseWhile(): Statement {
    this.expect(TokenType.WHILE);
    this.expect(TokenType.LPAREN);
    const condition = this.parseExpression();
    this.expect(TokenType.RPAREN);
    this.skipNewlines();
    const body = this.parseStatement();
    return { type: 'WhileStatement', condition, body };
  }

  private parseFor(): Statement {
    this.expect(TokenType.FOR);
    this.expect(TokenType.LPAREN);

    if (this.check(TokenType.IDENTIFIER) && this.lookAhead(1)?.type === TokenType.IN) {
      const variable = this.expect(TokenType.IDENTIFIER).value;
      this.expect(TokenType.IN);
      const array = this.expect(TokenType.IDENTIFIER).value;
      this.expect(TokenType.RPAREN);
      this.skipNewlines();
      const body = this.parseStatement();
      return { type: 'ForInStatement', variable, array, body };
    }

    let init: Statement | null = null;
    if (!this.check(TokenType.SEMICOLON)) {
      init = this.parseSimpleStatement();
    }
    this.expect(TokenType.SEMICOLON);

    let condition: Expression | null = null;
    if (!this.check(TokenType.SEMICOLON)) {
      condition = this.parseExpression();
    }
    this.expect(TokenType.SEMICOLON);

    let update: Statement | null = null;
    if (!this.check(TokenType.RPAREN)) {
      update = this.parseSimpleStatement();
    }
    this.expect(TokenType.RPAREN);
    this.skipNewlines();
    const body = this.parseStatement();

    return { type: 'ForStatement', init, condition, update, body };
  }

  private parseSimpleStatement(): Statement {
    const expr = this.parseExpression();
    return { type: 'ExpressionStatement', expression: expr };
  }

  private parseDoWhile(): Statement {
    this.expect(TokenType.DO);
    this.skipNewlines();
    const body = this.parseStatement();
    this.skipTerminators();
    this.expect(TokenType.WHILE);
    this.expect(TokenType.LPAREN);
    const condition = this.parseExpression();
    this.expect(TokenType.RPAREN);
    return { type: 'DoWhileStatement', body, condition };
  }

  private parseExit(): Statement {
    this.advance();
    let value: Expression | null = null;
    if (!this.isStatementEnd()) {
      value = this.parseExpression();
    }
    return { type: 'ExitStatement', value };
  }

  private parseReturn(): Statement {
    this.advance();
    let value: Expression | null = null;
    if (!this.isStatementEnd()) {
      value = this.parseExpression();
    }
    return { type: 'ReturnStatement', value };
  }

  private parseDelete(): Statement {
    this.advance();
    const name = this.expect(TokenType.IDENTIFIER).value;
    let index: Expression | null = null;
    if (this.match(TokenType.LBRACKET)) {
      index = this.parseExpression();
      this.expect(TokenType.RBRACKET);
    }
    return { type: 'DeleteStatement', array: name, index };
  }

  private parsePrint(): PrintStatement {
    this.advance();
    return this.parsePrintArgs('PrintStatement') as PrintStatement;
  }

  private parsePrintf(): PrintfStatement {
    this.advance();
    return this.parsePrintArgs('PrintfStatement') as PrintfStatement;
  }

  private parsePrintArgs(stmtType: 'PrintStatement' | 'PrintfStatement'): PrintStatement | PrintfStatement {
    const args: Expression[] = [];
    let output: OutputRedirect | undefined;

    if (!this.isStatementEnd() && !this.check(TokenType.PIPE) &&
        !this.check(TokenType.GREATER) && !this.check(TokenType.APPEND)) {
      this.inPrintArgs = true;
      args.push(this.parseTernary());
      while (this.match(TokenType.COMMA)) {
        args.push(this.parseTernary());
      }
      this.inPrintArgs = false;
    }

    if (this.check(TokenType.PIPE)) {
      this.advance();
      output = { type: 'Pipe', target: this.parsePrimary() };
    } else if (this.check(TokenType.GREATER)) {
      this.advance();
      output = { type: 'Redirect', target: this.parsePrimary() };
    } else if (this.check(TokenType.APPEND)) {
      this.advance();
      output = { type: 'Append', target: this.parsePrimary() };
    }

    return { type: stmtType, args, output } as PrintStatement | PrintfStatement;
  }

  private parseExpression(): Expression {
    return this.parseAssignment();
  }

  private parseNonAssignmentExpression(): Expression {
    return this.parseTernary();
  }

  private parseAssignment(): Expression {
    const expr = this.parseTernary();

    if (this.isAssignmentOp()) {
      const op = this.advance().value;
      const value = this.parseAssignment();
      return { type: 'Assignment', operator: op, target: expr, value };
    }

    return expr;
  }

  private isAssignmentOp(): boolean {
    return this.check(TokenType.ASSIGN) || this.check(TokenType.PLUS_ASSIGN) ||
           this.check(TokenType.MINUS_ASSIGN) || this.check(TokenType.STAR_ASSIGN) ||
           this.check(TokenType.SLASH_ASSIGN) || this.check(TokenType.PERCENT_ASSIGN) ||
           this.check(TokenType.CARET_ASSIGN);
  }

  private parseTernary(): Expression {
    let expr = this.parseOr();

    if (this.match(TokenType.QUESTION)) {
      const consequent = this.parseAssignment();
      this.expect(TokenType.COLON);
      const alternate = this.parseAssignment();
      expr = { type: 'TernaryExpression', condition: expr, consequent, alternate };
    }

    return expr;
  }

  private parseOr(): Expression {
    let left = this.parseAnd();
    while (this.match(TokenType.OR)) {
      const right = this.parseAnd();
      left = { type: 'BinaryExpression', operator: '||', left, right };
    }
    return left;
  }

  private parseAnd(): Expression {
    let left = this.parseIn();
    while (this.match(TokenType.AND)) {
      const right = this.parseIn();
      left = { type: 'BinaryExpression', operator: '&&', left, right };
    }
    return left;
  }

  private parseIn(): Expression {
    let left = this.parseMatch();

    if (this.check(TokenType.IN)) {
      this.advance();
      const array = this.expect(TokenType.IDENTIFIER).value;
      const index = left.type === 'BinaryExpression' && left.operator === 'COMMA_LIST'
        ? (left as any).elements
        : [left];
      return { type: 'InExpression', index, array };
    }

    return left;
  }

  private parseMatch(): Expression {
    let left = this.parseComparison();

    while (this.check(TokenType.MATCH) || this.check(TokenType.NOT_MATCH)) {
      const negated = this.peek().type === TokenType.NOT_MATCH;
      this.advance();
      const pattern = this.parseConcatenation();
      left = { type: 'MatchExpression', string: left, pattern, negated };
    }

    return left;
  }

  private parseComparison(): Expression {
    let left = this.parseConcatenation();

    if (this.isComparisonOp()) {
      const op = this.advance().value;
      const right = this.parseConcatenation();
      left = { type: 'BinaryExpression', operator: op, left, right };
    }

    return left;
  }

  private isComparisonOp(): boolean {
    if (this.inPrintArgs &&
        (this.check(TokenType.GREATER) || this.check(TokenType.GREATER_EQUAL) || this.check(TokenType.APPEND))) {
      return false;
    }
    return this.check(TokenType.LESS) || this.check(TokenType.LESS_EQUAL) ||
           this.check(TokenType.GREATER) || this.check(TokenType.GREATER_EQUAL) ||
           this.check(TokenType.EQUAL) || this.check(TokenType.NOT_EQUAL);
  }

  private parseConcatenation(): Expression {
    let left = this.parseAddition();

    while (this.isConcatStart()) {
      const right = this.parseAddition();
      left = { type: 'Concatenation', left, right };
    }

    return left;
  }

  private isConcatStart(): boolean {
    if (this.isAtEnd()) return false;
    const t = this.peek().type;
    return (t === TokenType.NUMBER || t === TokenType.STRING || t === TokenType.IDENTIFIER ||
            t === TokenType.DOLLAR || t === TokenType.LPAREN || t === TokenType.NOT ||
            t === TokenType.MINUS || t === TokenType.PLUS_PLUS || t === TokenType.MINUS_MINUS) &&
           !this.isStatementEnd();
  }

  private parseAddition(): Expression {
    let left = this.parseMultiplication();

    while (this.check(TokenType.PLUS) || this.check(TokenType.MINUS)) {
      const op = this.advance().value;
      const right = this.parseMultiplication();
      left = { type: 'BinaryExpression', operator: op, left, right };
    }

    return left;
  }

  private parseMultiplication(): Expression {
    let left = this.parseExponentiation();

    while (this.check(TokenType.STAR) || this.check(TokenType.SLASH) || this.check(TokenType.PERCENT)) {
      const op = this.advance().value;
      const right = this.parseExponentiation();
      left = { type: 'BinaryExpression', operator: op, left, right };
    }

    return left;
  }

  private parseExponentiation(): Expression {
    const base = this.parseUnary();

    if (this.match(TokenType.CARET)) {
      const exp = this.parseExponentiation();
      return { type: 'BinaryExpression', operator: '^', left: base, right: exp };
    }

    return base;
  }

  private parseUnary(): Expression {
    if (this.check(TokenType.NOT)) {
      this.advance();
      const operand = this.parseUnary();
      return { type: 'UnaryExpression', operator: '!', operand, prefix: true };
    }
    if (this.check(TokenType.MINUS)) {
      this.advance();
      const operand = this.parseUnary();
      return { type: 'UnaryExpression', operator: '-', operand, prefix: true };
    }
    if (this.check(TokenType.PLUS)) {
      this.advance();
      const operand = this.parseUnary();
      return { type: 'UnaryExpression', operator: '+', operand, prefix: true };
    }
    if (this.check(TokenType.PLUS_PLUS)) {
      this.advance();
      const operand = this.parseUnary();
      return { type: 'IncrementExpression', operand, operator: '++', prefix: true };
    }
    if (this.check(TokenType.MINUS_MINUS)) {
      this.advance();
      const operand = this.parseUnary();
      return { type: 'IncrementExpression', operand, operator: '--', prefix: true };
    }

    return this.parseFieldAccess();
  }

  private parseFieldAccess(): Expression {
    if (this.match(TokenType.DOLLAR)) {
      const index = this.parseFieldAccess();
      return { type: 'FieldAccess', index };
    }

    return this.parsePostfix();
  }

  private parsePostfix(): Expression {
    let expr = this.parsePrimary();

    while (true) {
      if (this.check(TokenType.PIPE) && this.lookAhead(1)?.type === TokenType.GETLINE) {
        this.advance(); // consume |
        this.advance(); // consume getline
        let variable: string | undefined;
        if (this.check(TokenType.IDENTIFIER) && !this.isStatementEnd()) {
          variable = this.advance().value;
        }
        expr = { type: 'GetlineExpression', command: expr, variable };
      } else if (this.check(TokenType.PLUS_PLUS)) {
        this.advance();
        expr = { type: 'IncrementExpression', operand: expr, operator: '++', prefix: false };
      } else if (this.check(TokenType.MINUS_MINUS)) {
        this.advance();
        expr = { type: 'IncrementExpression', operand: expr, operator: '--', prefix: false };
      } else if (this.check(TokenType.LBRACKET)) {
        if (expr.type !== 'Identifier') break;
        this.advance();
        const indices: Expression[] = [this.parseExpression()];
        while (this.match(TokenType.COMMA)) {
          indices.push(this.parseExpression());
        }
        this.expect(TokenType.RBRACKET);
        expr = { type: 'ArrayAccess', array: expr.name, index: indices };
      } else {
        break;
      }
    }

    return expr;
  }

  private parsePrimary(): Expression {
    if (this.check(TokenType.NUMBER)) {
      const token = this.advance();
      return { type: 'NumberLiteral', value: Number(token.value) };
    }

    if (this.check(TokenType.STRING)) {
      const token = this.advance();
      return { type: 'StringLiteral', value: token.value };
    }

    if (this.check(TokenType.REGEX)) {
      const token = this.advance();
      return { type: 'RegexLiteral', pattern: token.value };
    }

    if (this.check(TokenType.GETLINE)) {
      return this.parseGetline();
    }

    if (this.check(TokenType.IDENTIFIER)) {
      const name = this.advance().value;

      if (this.check(TokenType.LPAREN) && !this.check(TokenType.IN)) {
        this.advance();
        const args: Expression[] = [];
        if (!this.check(TokenType.RPAREN)) {
          args.push(this.parseExpression());
          while (this.match(TokenType.COMMA)) {
            args.push(this.parseExpression());
          }
        }
        this.expect(TokenType.RPAREN);
        return { type: 'CallExpression', callee: name, args };
      }

      return { type: 'Identifier', name };
    }

    if (this.match(TokenType.LPAREN)) {
      const saved = this.inPrintArgs;
      this.inPrintArgs = false;
      const expr = this.parseExpression();
      this.inPrintArgs = saved;
      this.expect(TokenType.RPAREN);
      return expr;
    }

    const token = this.peek();
    throw new ParseError(`Unexpected token: ${token.value || TokenType[token.type]}`, token.line, token.column);
  }

  private parseGetline(): GetlineExpression {
    this.expect(TokenType.GETLINE);
    const result: GetlineExpression = { type: 'GetlineExpression' };

    if (this.check(TokenType.IDENTIFIER) && !this.check(TokenType.LESS) &&
        this.lookAhead(1)?.type !== TokenType.LBRACKET &&
        this.lookAhead(1)?.type !== TokenType.LPAREN) {
      const next = this.peek();
      if (next.type === TokenType.IDENTIFIER) {
        result.variable = this.advance().value;
      }
    }

    if (this.match(TokenType.LESS)) {
      result.source = this.parsePrimary();
    }

    return result;
  }

  // --- Utility methods ---

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private lookAhead(offset: number): Token | undefined {
    return this.tokens[this.pos + offset];
  }

  private advance(): Token {
    const token = this.tokens[this.pos];
    this.pos++;
    return token;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private expect(type: TokenType): Token {
    if (this.check(type)) return this.advance();
    const token = this.peek();
    throw new ParseError(
      `Expected ${TokenType[type]}, got ${token ? (token.value || TokenType[token.type]) : 'EOF'}`,
      token?.line ?? 0,
      token?.column ?? 0
    );
  }

  private isAtEnd(): boolean {
    return this.pos >= this.tokens.length || this.peek().type === TokenType.EOF;
  }

  private skipNewlines(): void {
    while (this.check(TokenType.NEWLINE) || this.check(TokenType.SEMICOLON)) {
      this.advance();
    }
  }

  private skipTerminators(): void {
    while (this.check(TokenType.NEWLINE) || this.check(TokenType.SEMICOLON)) {
      this.advance();
    }
  }

  private isStatementEnd(): boolean {
    return this.isAtEnd() || this.check(TokenType.NEWLINE) || this.check(TokenType.SEMICOLON) ||
           this.check(TokenType.RBRACE);
  }
}

type GetlineExpression = import('./ast.js').GetlineExpression;
