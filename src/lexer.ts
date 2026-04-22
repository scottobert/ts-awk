import { Token, TokenType, KEYWORDS } from './tokens.js';
import { LexerError } from './errors.js';

export class Lexer {
  private source: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];
  private prevTokenType: TokenType | null = null;

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): Token[] {
    while (this.pos < this.source.length) {
      this.skipWhitespaceAndComments();
      if (this.pos >= this.source.length) break;

      const ch = this.source[this.pos];

      if (ch === '\n') {
        this.addToken(TokenType.NEWLINE, '\n');
        this.pos++;
        this.line++;
        this.column = 1;
        continue;
      }

      if (ch === '\\' && this.pos + 1 < this.source.length && this.source[this.pos + 1] === '\n') {
        this.pos += 2;
        this.line++;
        this.column = 1;
        continue;
      }

      if (this.isDigit(ch) || (ch === '.' && this.pos + 1 < this.source.length && this.isDigit(this.source[this.pos + 1]))) {
        this.readNumber();
        continue;
      }

      if (ch === '"') {
        this.readString();
        continue;
      }

      if (ch === '/' && this.shouldLexRegex()) {
        this.readRegex();
        continue;
      }

      if (this.isAlpha(ch) || ch === '_') {
        this.readIdentifier();
        continue;
      }

      this.readOperatorOrPunctuation();
    }

    this.addToken(TokenType.EOF, '');
    return this.tokens;
  }

  private skipWhitespaceAndComments(): void {
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        this.pos++;
        this.column++;
      } else if (ch === '#') {
        while (this.pos < this.source.length && this.source[this.pos] !== '\n') {
          this.pos++;
          this.column++;
        }
      } else {
        break;
      }
    }
  }

  private shouldLexRegex(): boolean {
    if (this.prevTokenType === null) return true;
    const valueProducingTokens = [
      TokenType.NUMBER,
      TokenType.STRING,
      TokenType.IDENTIFIER,
      TokenType.RPAREN,
      TokenType.RBRACKET,
      TokenType.PLUS_PLUS,
      TokenType.MINUS_MINUS,
    ];
    return !valueProducingTokens.includes(this.prevTokenType);
  }

  private readNumber(): void {
    const start = this.pos;
    const startCol = this.column;

    if (this.source[this.pos] === '0' && this.pos + 1 < this.source.length &&
        (this.source[this.pos + 1] === 'x' || this.source[this.pos + 1] === 'X')) {
      this.pos += 2;
      this.column += 2;
      while (this.pos < this.source.length && this.isHexDigit(this.source[this.pos])) {
        this.pos++;
        this.column++;
      }
    } else {
      while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
        this.pos++;
        this.column++;
      }
      if (this.pos < this.source.length && this.source[this.pos] === '.') {
        this.pos++;
        this.column++;
        while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
          this.pos++;
          this.column++;
        }
      }
      if (this.pos < this.source.length && (this.source[this.pos] === 'e' || this.source[this.pos] === 'E')) {
        this.pos++;
        this.column++;
        if (this.pos < this.source.length && (this.source[this.pos] === '+' || this.source[this.pos] === '-')) {
          this.pos++;
          this.column++;
        }
        while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
          this.pos++;
          this.column++;
        }
      }
    }

    const value = this.source.slice(start, this.pos);
    this.tokens.push({ type: TokenType.NUMBER, value, line: this.line, column: startCol });
    this.prevTokenType = TokenType.NUMBER;
  }

  private readString(): void {
    const startCol = this.column;
    this.pos++;
    this.column++;
    let value = '';

    while (this.pos < this.source.length && this.source[this.pos] !== '"') {
      if (this.source[this.pos] === '\\' && this.pos + 1 < this.source.length) {
        this.pos++;
        this.column++;
        const escaped = this.source[this.pos];
        switch (escaped) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case 'r': value += '\r'; break;
          case '\\': value += '\\'; break;
          case '"': value += '"'; break;
          case 'a': value += '\x07'; break;
          case 'b': value += '\b'; break;
          case 'f': value += '\f'; break;
          case 'v': value += '\v'; break;
          case '/': value += '/'; break;
          default:
            if (this.isOctalDigit(escaped)) {
              let octal = escaped;
              while (this.pos + 1 < this.source.length && octal.length < 3 && this.isOctalDigit(this.source[this.pos + 1])) {
                this.pos++;
                this.column++;
                octal += this.source[this.pos];
              }
              value += String.fromCharCode(parseInt(octal, 8));
            } else {
              value += '\\' + escaped;
            }
        }
      } else {
        value += this.source[this.pos];
      }
      this.pos++;
      this.column++;
    }

    if (this.pos >= this.source.length) {
      throw new LexerError('Unterminated string', this.line, startCol);
    }
    this.pos++;
    this.column++;

    this.tokens.push({ type: TokenType.STRING, value, line: this.line, column: startCol });
    this.prevTokenType = TokenType.STRING;
  }

  private readRegex(): void {
    const startCol = this.column;
    this.pos++;
    this.column++;
    let pattern = '';

    while (this.pos < this.source.length && this.source[this.pos] !== '/') {
      if (this.source[this.pos] === '\\' && this.pos + 1 < this.source.length) {
        pattern += this.source[this.pos];
        this.pos++;
        this.column++;
        pattern += this.source[this.pos];
      } else {
        pattern += this.source[this.pos];
      }
      this.pos++;
      this.column++;
    }

    if (this.pos >= this.source.length) {
      throw new LexerError('Unterminated regex', this.line, startCol);
    }
    this.pos++;
    this.column++;

    this.tokens.push({ type: TokenType.REGEX, value: pattern, line: this.line, column: startCol });
    this.prevTokenType = TokenType.REGEX;
  }

  private readIdentifier(): void {
    const start = this.pos;
    const startCol = this.column;

    while (this.pos < this.source.length && (this.isAlphaNumeric(this.source[this.pos]) || this.source[this.pos] === '_')) {
      this.pos++;
      this.column++;
    }

    const word = this.source.slice(start, this.pos);
    const keywordType = KEYWORDS[word];

    if (keywordType !== undefined) {
      this.tokens.push({ type: keywordType, value: word, line: this.line, column: startCol });
      this.prevTokenType = keywordType;
    } else {
      this.tokens.push({ type: TokenType.IDENTIFIER, value: word, line: this.line, column: startCol });
      this.prevTokenType = TokenType.IDENTIFIER;
    }
  }

  private readOperatorOrPunctuation(): void {
    const ch = this.source[this.pos];
    const next = this.pos + 1 < this.source.length ? this.source[this.pos + 1] : '';
    const startCol = this.column;

    switch (ch) {
      case '+':
        if (next === '+') { this.addToken(TokenType.PLUS_PLUS, '++'); this.pos += 2; this.column += 2; }
        else if (next === '=') { this.addToken(TokenType.PLUS_ASSIGN, '+='); this.pos += 2; this.column += 2; }
        else { this.addToken(TokenType.PLUS, '+'); this.pos++; this.column++; }
        break;
      case '-':
        if (next === '-') { this.addToken(TokenType.MINUS_MINUS, '--'); this.pos += 2; this.column += 2; }
        else if (next === '=') { this.addToken(TokenType.MINUS_ASSIGN, '-='); this.pos += 2; this.column += 2; }
        else { this.addToken(TokenType.MINUS, '-'); this.pos++; this.column++; }
        break;
      case '*':
        if (next === '=') { this.addToken(TokenType.STAR_ASSIGN, '*='); this.pos += 2; this.column += 2; }
        else { this.addToken(TokenType.STAR, '*'); this.pos++; this.column++; }
        break;
      case '/':
        if (next === '=') { this.addToken(TokenType.SLASH_ASSIGN, '/='); this.pos += 2; this.column += 2; }
        else { this.addToken(TokenType.SLASH, '/'); this.pos++; this.column++; }
        break;
      case '%':
        if (next === '=') { this.addToken(TokenType.PERCENT_ASSIGN, '%='); this.pos += 2; this.column += 2; }
        else { this.addToken(TokenType.PERCENT, '%'); this.pos++; this.column++; }
        break;
      case '^':
        if (next === '=') { this.addToken(TokenType.CARET_ASSIGN, '^='); this.pos += 2; this.column += 2; }
        else { this.addToken(TokenType.CARET, '^'); this.pos++; this.column++; }
        break;
      case '=':
        if (next === '=') { this.addToken(TokenType.EQUAL, '=='); this.pos += 2; this.column += 2; }
        else { this.addToken(TokenType.ASSIGN, '='); this.pos++; this.column++; }
        break;
      case '!':
        if (next === '=') { this.addToken(TokenType.NOT_EQUAL, '!='); this.pos += 2; this.column += 2; }
        else if (next === '~') { this.addToken(TokenType.NOT_MATCH, '!~'); this.pos += 2; this.column += 2; }
        else { this.addToken(TokenType.NOT, '!'); this.pos++; this.column++; }
        break;
      case '<':
        if (next === '=') { this.addToken(TokenType.LESS_EQUAL, '<='); this.pos += 2; this.column += 2; }
        else { this.addToken(TokenType.LESS, '<'); this.pos++; this.column++; }
        break;
      case '>':
        if (next === '=') { this.addToken(TokenType.GREATER_EQUAL, '>='); this.pos += 2; this.column += 2; }
        else if (next === '>') { this.addToken(TokenType.APPEND, '>>'); this.pos += 2; this.column += 2; }
        else { this.addToken(TokenType.GREATER, '>'); this.pos++; this.column++; }
        break;
      case '&':
        if (next === '&') { this.addToken(TokenType.AND, '&&'); this.pos += 2; this.column += 2; }
        else { throw new LexerError(`Unexpected character: ${ch}`, this.line, startCol); }
        break;
      case '|':
        if (next === '|') { this.addToken(TokenType.OR, '||'); this.pos += 2; this.column += 2; }
        else { this.addToken(TokenType.PIPE, '|'); this.pos++; this.column++; }
        break;
      case '~':
        this.addToken(TokenType.MATCH, '~'); this.pos++; this.column++;
        break;
      case '?':
        this.addToken(TokenType.QUESTION, '?'); this.pos++; this.column++;
        break;
      case ':':
        this.addToken(TokenType.COLON, ':'); this.pos++; this.column++;
        break;
      case '{':
        this.addToken(TokenType.LBRACE, '{'); this.pos++; this.column++;
        break;
      case '}':
        this.addToken(TokenType.RBRACE, '}'); this.pos++; this.column++;
        break;
      case '(':
        this.addToken(TokenType.LPAREN, '('); this.pos++; this.column++;
        break;
      case ')':
        this.addToken(TokenType.RPAREN, ')'); this.pos++; this.column++;
        break;
      case '[':
        this.addToken(TokenType.LBRACKET, '['); this.pos++; this.column++;
        break;
      case ']':
        this.addToken(TokenType.RBRACKET, ']'); this.pos++; this.column++;
        break;
      case ';':
        this.addToken(TokenType.SEMICOLON, ';'); this.pos++; this.column++;
        break;
      case ',':
        this.addToken(TokenType.COMMA, ','); this.pos++; this.column++;
        break;
      case '$':
        this.addToken(TokenType.DOLLAR, '$'); this.pos++; this.column++;
        break;
      default:
        throw new LexerError(`Unexpected character: ${ch}`, this.line, startCol);
    }
  }

  private addToken(type: TokenType, value: string): void {
    this.tokens.push({ type, value, line: this.line, column: this.column });
    this.prevTokenType = type;
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isHexDigit(ch: string): boolean {
    return this.isDigit(ch) || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F');
  }

  private isOctalDigit(ch: string): boolean {
    return ch >= '0' && ch <= '7';
  }

  private isAlpha(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
  }

  private isAlphaNumeric(ch: string): boolean {
    return this.isAlpha(ch) || this.isDigit(ch);
  }
}
