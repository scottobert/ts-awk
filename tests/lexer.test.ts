import { Lexer } from '../src/lexer';
import { TokenType } from '../src/tokens';
import { LexerError } from '../src/errors';

function tokenTypes(source: string): TokenType[] {
  return new Lexer(source).tokenize().map(t => t.type);
}

function tokenValues(source: string): string[] {
  return new Lexer(source).tokenize().map(t => t.value);
}

describe('Lexer', () => {
  describe('numbers', () => {
    it('tokenizes integers', () => {
      const tokens = new Lexer('42').tokenize();
      expect(tokens[0]).toMatchObject({ type: TokenType.NUMBER, value: '42' });
    });

    it('tokenizes floats', () => {
      const tokens = new Lexer('3.14').tokenize();
      expect(tokens[0]).toMatchObject({ type: TokenType.NUMBER, value: '3.14' });
    });

    it('tokenizes scientific notation', () => {
      const tokens = new Lexer('1e10').tokenize();
      expect(tokens[0]).toMatchObject({ type: TokenType.NUMBER, value: '1e10' });
    });

    it('tokenizes hex numbers', () => {
      const tokens = new Lexer('0xFF').tokenize();
      expect(tokens[0]).toMatchObject({ type: TokenType.NUMBER, value: '0xFF' });
    });
  });

  describe('strings', () => {
    it('tokenizes simple strings', () => {
      const tokens = new Lexer('"hello"').tokenize();
      expect(tokens[0]).toMatchObject({ type: TokenType.STRING, value: 'hello' });
    });

    it('handles escape sequences', () => {
      const tokens = new Lexer('"hello\\nworld"').tokenize();
      expect(tokens[0].value).toBe('hello\nworld');
    });

    it('handles tab escapes', () => {
      const tokens = new Lexer('"a\\tb"').tokenize();
      expect(tokens[0].value).toBe('a\tb');
    });

    it('throws on unterminated strings', () => {
      expect(() => new Lexer('"hello').tokenize()).toThrow(LexerError);
    });
  });

  describe('regex', () => {
    it('tokenizes regex at start of input', () => {
      const tokens = new Lexer('/pattern/').tokenize();
      expect(tokens[0]).toMatchObject({ type: TokenType.REGEX, value: 'pattern' });
    });

    it('tokenizes regex after operator', () => {
      const types = tokenTypes('x ~ /foo/');
      expect(types).toContain(TokenType.REGEX);
    });

    it('tokenizes division after identifier', () => {
      const types = tokenTypes('x / 2');
      expect(types).toContain(TokenType.SLASH);
      expect(types).not.toContain(TokenType.REGEX);
    });

    it('tokenizes division after number', () => {
      const types = tokenTypes('4 / 2');
      expect(types).toContain(TokenType.SLASH);
    });
  });

  describe('keywords', () => {
    it('recognizes BEGIN', () => {
      expect(tokenTypes('BEGIN')).toEqual([TokenType.BEGIN, TokenType.EOF]);
    });

    it('recognizes END', () => {
      expect(tokenTypes('END')).toEqual([TokenType.END, TokenType.EOF]);
    });

    it('recognizes control flow keywords', () => {
      const types = tokenTypes('if else while for do');
      expect(types).toContain(TokenType.IF);
      expect(types).toContain(TokenType.ELSE);
      expect(types).toContain(TokenType.WHILE);
      expect(types).toContain(TokenType.FOR);
      expect(types).toContain(TokenType.DO);
    });

    it('recognizes print and printf', () => {
      expect(tokenTypes('print')[0]).toBe(TokenType.PRINT);
      expect(tokenTypes('printf')[0]).toBe(TokenType.PRINTF);
    });

    it('recognizes function-related keywords', () => {
      expect(tokenTypes('function')[0]).toBe(TokenType.FUNCTION);
      expect(tokenTypes('return')[0]).toBe(TokenType.RETURN);
    });

    it('treats non-keywords as identifiers', () => {
      expect(tokenTypes('myvar')[0]).toBe(TokenType.IDENTIFIER);
    });
  });

  describe('operators', () => {
    it('tokenizes arithmetic operators', () => {
      expect(tokenTypes('1 + 2')).toContain(TokenType.PLUS);
      expect(tokenTypes('1 - 2')).toContain(TokenType.MINUS);
      expect(tokenTypes('1 * 2')).toContain(TokenType.STAR);
      expect(tokenTypes('1 / 2')).toContain(TokenType.SLASH);
      expect(tokenTypes('1 % 2')).toContain(TokenType.PERCENT);
      expect(tokenTypes('1 ^ 2')).toContain(TokenType.CARET);
    });

    it('tokenizes increment/decrement', () => {
      const types = tokenTypes('++ --');
      expect(types).toContain(TokenType.PLUS_PLUS);
      expect(types).toContain(TokenType.MINUS_MINUS);
    });

    it('tokenizes comparison operators', () => {
      const types = tokenTypes('== != < > <= >=');
      expect(types).toContain(TokenType.EQUAL);
      expect(types).toContain(TokenType.NOT_EQUAL);
      expect(types).toContain(TokenType.LESS);
      expect(types).toContain(TokenType.GREATER);
      expect(types).toContain(TokenType.LESS_EQUAL);
      expect(types).toContain(TokenType.GREATER_EQUAL);
    });

    it('tokenizes assignment operators', () => {
      expect(tokenTypes('x = 1')).toContain(TokenType.ASSIGN);
      expect(tokenTypes('x += 1')).toContain(TokenType.PLUS_ASSIGN);
      expect(tokenTypes('x -= 1')).toContain(TokenType.MINUS_ASSIGN);
      expect(tokenTypes('x *= 1')).toContain(TokenType.STAR_ASSIGN);
      expect(tokenTypes('x /= 1')).toContain(TokenType.SLASH_ASSIGN);
      expect(tokenTypes('x %= 1')).toContain(TokenType.PERCENT_ASSIGN);
      expect(tokenTypes('x ^= 1')).toContain(TokenType.CARET_ASSIGN);
    });

    it('tokenizes logical operators', () => {
      const types = tokenTypes('&& || !');
      expect(types).toContain(TokenType.AND);
      expect(types).toContain(TokenType.OR);
      expect(types).toContain(TokenType.NOT);
    });

    it('tokenizes match operators', () => {
      const types = tokenTypes('~ !~');
      expect(types).toContain(TokenType.MATCH);
      expect(types).toContain(TokenType.NOT_MATCH);
    });

    it('tokenizes pipe and append', () => {
      expect(tokenTypes('|')[0]).toBe(TokenType.PIPE);
      expect(tokenTypes('>>')[0]).toBe(TokenType.APPEND);
    });
  });

  describe('delimiters', () => {
    it('tokenizes braces and parens', () => {
      const types = tokenTypes('{ } ( ) [ ]');
      expect(types).toContain(TokenType.LBRACE);
      expect(types).toContain(TokenType.RBRACE);
      expect(types).toContain(TokenType.LPAREN);
      expect(types).toContain(TokenType.RPAREN);
      expect(types).toContain(TokenType.LBRACKET);
      expect(types).toContain(TokenType.RBRACKET);
    });

    it('tokenizes semicolons and commas', () => {
      const types = tokenTypes('; ,');
      expect(types).toContain(TokenType.SEMICOLON);
      expect(types).toContain(TokenType.COMMA);
    });

    it('tokenizes dollar sign', () => {
      expect(tokenTypes('$')[0]).toBe(TokenType.DOLLAR);
    });
  });

  describe('whitespace and comments', () => {
    it('skips spaces and tabs', () => {
      const types = tokenTypes('  42  ');
      expect(types).toEqual([TokenType.NUMBER, TokenType.EOF]);
    });

    it('skips comments', () => {
      const types = tokenTypes('42 # this is a comment');
      expect(types).toEqual([TokenType.NUMBER, TokenType.EOF]);
    });

    it('emits newline tokens', () => {
      const types = tokenTypes('a\nb');
      expect(types).toContain(TokenType.NEWLINE);
    });

    it('handles line continuation', () => {
      const types = tokenTypes('a \\\nb');
      expect(types).not.toContain(TokenType.NEWLINE);
    });
  });

  describe('complex expressions', () => {
    it('tokenizes a complete awk program', () => {
      const tokens = new Lexer('{ print $1, $2 }').tokenize();
      const types = tokens.map(t => t.type);
      expect(types).toEqual([
        TokenType.LBRACE, TokenType.PRINT, TokenType.DOLLAR, TokenType.NUMBER,
        TokenType.COMMA, TokenType.DOLLAR, TokenType.NUMBER, TokenType.RBRACE,
        TokenType.EOF,
      ]);
    });

    it('tokenizes field access expressions', () => {
      const types = tokenTypes('$0 $1 $NF');
      expect(types[0]).toBe(TokenType.DOLLAR);
      expect(types[1]).toBe(TokenType.NUMBER);
      expect(types[2]).toBe(TokenType.DOLLAR);
      expect(types[3]).toBe(TokenType.NUMBER);
      expect(types[4]).toBe(TokenType.DOLLAR);
      expect(types[5]).toBe(TokenType.IDENTIFIER);
    });
  });

  describe('error handling', () => {
    it('throws on unexpected characters', () => {
      expect(() => new Lexer('@').tokenize()).toThrow(LexerError);
    });

    it('includes line and column in errors', () => {
      try {
        new Lexer('@').tokenize();
      } catch (e) {
        expect(e).toBeInstanceOf(LexerError);
        expect((e as LexerError).line).toBe(1);
      }
    });
  });
});
