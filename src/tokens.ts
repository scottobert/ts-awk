export enum TokenType {
  // Literals
  NUMBER,
  STRING,
  REGEX,

  // Identifiers and fields
  IDENTIFIER,
  DOLLAR,

  // Keywords
  BEGIN,
  END,
  IF,
  ELSE,
  WHILE,
  FOR,
  DO,
  BREAK,
  CONTINUE,
  NEXT,
  EXIT,
  FUNCTION,
  RETURN,
  DELETE,
  GETLINE,
  PRINT,
  PRINTF,
  IN,

  // Arithmetic operators
  PLUS,
  MINUS,
  STAR,
  SLASH,
  PERCENT,
  CARET,

  // Increment/Decrement
  PLUS_PLUS,
  MINUS_MINUS,

  // Assignment operators
  ASSIGN,
  PLUS_ASSIGN,
  MINUS_ASSIGN,
  STAR_ASSIGN,
  SLASH_ASSIGN,
  PERCENT_ASSIGN,
  CARET_ASSIGN,

  // Comparison operators
  EQUAL,
  NOT_EQUAL,
  LESS,
  LESS_EQUAL,
  GREATER,
  GREATER_EQUAL,

  // Regex matching operators
  MATCH,
  NOT_MATCH,

  // Logical operators
  AND,
  OR,
  NOT,

  // Ternary
  QUESTION,
  COLON,

  // Delimiters
  LBRACE,
  RBRACE,
  LPAREN,
  RPAREN,
  LBRACKET,
  RBRACKET,
  SEMICOLON,
  COMMA,

  // I/O
  PIPE,
  APPEND,

  // Special
  NEWLINE,
  EOF,
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export const KEYWORDS: Record<string, TokenType> = {
  BEGIN: TokenType.BEGIN,
  END: TokenType.END,
  if: TokenType.IF,
  else: TokenType.ELSE,
  while: TokenType.WHILE,
  for: TokenType.FOR,
  do: TokenType.DO,
  break: TokenType.BREAK,
  continue: TokenType.CONTINUE,
  next: TokenType.NEXT,
  exit: TokenType.EXIT,
  function: TokenType.FUNCTION,
  return: TokenType.RETURN,
  delete: TokenType.DELETE,
  getline: TokenType.GETLINE,
  print: TokenType.PRINT,
  printf: TokenType.PRINTF,
  in: TokenType.IN,
};
