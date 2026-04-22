export class LexerError extends Error {
  constructor(message: string, public line: number, public column: number) {
    super(`Lexer error at ${line}:${column}: ${message}`);
    this.name = 'LexerError';
  }
}

export class ParseError extends Error {
  constructor(message: string, public line: number, public column: number) {
    super(`Parse error at ${line}:${column}: ${message}`);
    this.name = 'ParseError';
  }
}

export class RuntimeError extends Error {
  constructor(message: string) {
    super(`Runtime error: ${message}`);
    this.name = 'RuntimeError';
  }
}

export class NextSignal {
  readonly _brand = 'NextSignal' as const;
}

export class BreakSignal {
  readonly _brand = 'BreakSignal' as const;
}

export class ContinueSignal {
  readonly _brand = 'ContinueSignal' as const;
}

export class ExitSignal {
  readonly _brand = 'ExitSignal' as const;
  constructor(public code: number) {}
}

export class ReturnSignal {
  readonly _brand = 'ReturnSignal' as const;
  constructor(public value: AwkValue) {}
}

export type AwkValue = string | number;
