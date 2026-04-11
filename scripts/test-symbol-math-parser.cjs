/**
 * TradingView-style Symbol Math Expression Parser
 *
 * Parses expressions like "DE02Y/US02Y", "1000*XAUUSD", "(EURUSD+GBPUSD)/2"
 * into a structured representation for downstream evaluation.
 *
 * This is a standalone proof-of-concept — no project dependencies required.
 */

'use strict';

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

const TOKEN_TYPES = {
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  OPERATOR: 'OPERATOR',
  SYMBOL: 'SYMBOL',
  NUMBER: 'NUMBER',
};

const OPERATORS = new Set(['+', '-', '*', '/']);

/**
 * Tokenize a symbol-math expression string.
 *
 * Produces tokens: LPAREN, RPAREN, OPERATOR, SYMBOL, NUMBER.
 * Whitespace is ignored. Operands are greedy (alphanumeric + /- inside symbols).
 */
function tokenize(input) {
  const tokens = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    // skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: TOKEN_TYPES.LPAREN, value: '(' });
      i++;
    } else if (ch === ')') {
      tokens.push({ type: TOKEN_TYPES.RPAREN, value: ')' });
      i++;
    } else if (OPERATORS.has(ch)) {
      // Distinguish unary minus from subtraction:
      // Unary minus if first token, or preceded by LPAREN or another OPERATOR
      const isUnary =
        tokens.length === 0 ||
        tokens[tokens.length - 1].type === TOKEN_TYPES.LPAREN ||
        tokens[tokens.length - 1].type === TOKEN_TYPES.OPERATOR;

      if (isUnary && ch === '-') {
        // Consume the minus as part of the following number/symbol
        i++;
        // Fall through to operand parsing below — the '-' prefix will be attached
        const rest = input.slice(i);
        const operandMatch = rest.match(/^[A-Za-z0-9.]+/);
        if (operandMatch) {
          const raw = '-' + operandMatch[0];
          const withoutMinus = operandMatch[0];
          if (/^\d+(\.\d+)?$/.test(withoutMinus)) {
            tokens.push({ type: TOKEN_TYPES.NUMBER, value: raw });
          } else if (/^[A-Za-z0-9]+$/.test(withoutMinus)) {
            tokens.push({ type: TOKEN_TYPES.SYMBOL, value: raw.toUpperCase() });
          } else {
            throw new Error(`Invalid operand after unary minus: "${raw}"`);
          }
          i += operandMatch[0].length;
        } else {
          throw new Error('Expected operand after unary minus');
        }
      } else {
        tokens.push({ type: TOKEN_TYPES.OPERATOR, value: ch });
        i++;
      }
    } else {
      // Operand: symbol or number — consume greedily
      const rest = input.slice(i);
      const operandMatch = rest.match(/^[A-Za-z0-9.]+/);
      if (!operandMatch) {
        throw new Error(`Unexpected character "${ch}" at position ${i}`);
      }
      const value = operandMatch[0];
      if (/^\d+(\.\d+)?$/.test(value)) {
        tokens.push({ type: TOKEN_TYPES.NUMBER, value });
      } else if (/^[A-Za-z0-9]+$/.test(value)) {
        tokens.push({ type: TOKEN_TYPES.SYMBOL, value: value.toUpperCase() });
      } else {
        throw new Error(`Invalid operand "${value}" — must be a symbol (letters+digits) or a number`);
      }
      i += value.length;
    }
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Recursive-descent parser producing an AST
// ---------------------------------------------------------------------------

/**
 * Grammar (precedence low→high):
 *
 *   expr   → term (('+' | '-') term)*
 *   term   → unary (('*' | '/') unary)*
 *   unary  → '-' unary | primary
 *   primary→ '(' expr ')' | SYMBOL | NUMBER
 *
 * AST nodes:
 *   { node: 'binop', op: string, left: Node, right: Node }
 *   { node: 'neg', child: Node }
 *   { node: 'symbol', value: string }
 *   { node: 'number', value: string }
 */
function parseTokens(tokens) {
  let pos = 0;

  function peek() {
    return tokens[pos] || null;
  }

  function consume(expectedType) {
    const tok = peek();
    if (!tok) throw new Error(`Unexpected end of expression, expected ${expectedType}`);
    if (expectedType && tok.type !== expectedType) {
      throw new Error(`Expected ${expectedType} but got ${tok.type} ("${tok.value}")`);
    }
    pos++;
    return tok;
  }

  function parseExpr() {
    let left = parseTerm();
    while (peek() && peek().type === TOKEN_TYPES.OPERATOR && (peek().value === '+' || peek().value === '-')) {
      const op = consume().value;
      const right = parseTerm();
      left = { node: 'binop', op, left, right };
    }
    return left;
  }

  function parseTerm() {
    let left = parseUnary();
    while (peek() && peek().type === TOKEN_TYPES.OPERATOR && (peek().value === '*' || peek().value === '/')) {
      const op = consume().value;
      const right = parseUnary();
      left = { node: 'binop', op, left, right };
    }
    return left;
  }

  function parseUnary() {
    if (peek() && peek().type === TOKEN_TYPES.OPERATOR && peek().value === '-') {
      consume();
      const child = parseUnary();
      return { node: 'neg', child };
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const tok = peek();
    if (!tok) throw new Error('Unexpected end of expression');

    if (tok.type === TOKEN_TYPES.LPAREN) {
      consume();
      const inner = parseExpr();
      consume(TOKEN_TYPES.RPAREN);
      return inner;
    }

    if (tok.type === TOKEN_TYPES.SYMBOL) {
      consume();
      return { node: 'symbol', value: tok.value };
    }

    if (tok.type === TOKEN_TYPES.NUMBER) {
      consume();
      return { node: 'number', value: tok.value };
    }

    throw new Error(`Unexpected token ${tok.type} ("${tok.value}")`);
  }

  const ast = parseExpr();
  if (pos < tokens.length) {
    throw new Error(`Unexpected token after end of expression: "${tokens[pos].value}"`);
  }
  return ast;
}

// ---------------------------------------------------------------------------
// AST → flat representation (operands + operators in evaluation order)
// ---------------------------------------------------------------------------

/**
 * Walk the AST and collect operands and operators in left-to-right evaluation
 * order. Also detect whether this is a simple single-symbol passthrough.
 */
function flattenAST(ast) {
  const operands = [];
  const operators = [];

  function walk(node) {
    if (node.node === 'binop') {
      walk(node.left);
      walk(node.right);
      operators.push(node.op);
    } else if (node.node === 'neg') {
      walk(node.child);
      // Represent negation as multiplication by -1
      operands.push({ type: 'number', value: '-1' });
      operators.push('*');
    } else if (node.node === 'symbol') {
      operands.push({ type: 'symbol', value: node.value });
    } else if (node.node === 'number') {
      operands.push({ type: 'number', value: node.value });
    }
  }

  walk(ast);

  const isSimple = ast.node === 'symbol';

  return { operands, operators, isSimple };
}

// ---------------------------------------------------------------------------
// Public parser
// ---------------------------------------------------------------------------

/**
 * Parse a TradingView-style symbol math expression.
 *
 * @param {string} raw - The expression string, e.g. "DE02Y/US02Y"
 * @returns {{ type: 'simple'|'expression', operands: Array<{type:string,value:string}>, operators: string[], raw: string }}
 * @throws {Error} If the expression is syntactically invalid.
 */
function parseSymbolMath(raw) {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new Error('Expression must be a non-empty string');
  }

  const tokens = tokenize(raw);
  if (tokens.length === 0) {
    throw new Error('No tokens found in expression');
  }

  const ast = parseTokens(tokens);
  const { operands, operators, isSimple } = flattenAST(ast);

  return {
    type: isSimple ? 'simple' : 'expression',
    operands,
    operators,
    raw: raw.trim(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function indent(obj, depth = 1) {
  const pad = '  '.repeat(depth);
  return String(obj)
    .split('\n')
    .map((line) => pad + line)
    .join('\n');
}

function formatResult(label, fn) {
  console.log(`\n--- ${label} ---`);
  try {
    const result = fn();
    console.log('input :', result.raw);
    console.log('type  :', result.type);
    console.log('operands:', JSON.stringify(result.operands, null, 2));
    console.log('operators:', JSON.stringify(result.operators));
    return { label, ok: true, result };
  } catch (err) {
    console.log('ERROR :', err.message);
    return { label, ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

function runTests() {
  console.log('='.repeat(60));
  console.log('  Symbol Math Expression Parser — Proof of Concept');
  console.log('='.repeat(60));

  const results = [];

  // --- Valid expressions ---
  results.push(
    formatResult('Spread: DE02Y/US02Y', () => parseSymbolMath('DE02Y/US02Y')),
  );

  results.push(
    formatResult('Inverse: 1/XAUUSD', () => parseSymbolMath('1/XAUUSD')),
  );

  results.push(
    formatResult('Product: EURUSD*GBPUSD', () => parseSymbolMath('EURUSD*GBPUSD')),
  );

  results.push(
    formatResult('Difference: EURUSD-GBPUSD', () => parseSymbolMath('EURUSD-GBPUSD')),
  );

  results.push(
    formatResult('Average: (EURUSD+GBPUSD)/2', () => parseSymbolMath('(EURUSD+GBPUSD)/2')),
  );

  results.push(
    formatResult('Scalar multiplication: 1000*XAUUSD', () => parseSymbolMath('1000*XAUUSD')),
  );

  results.push(
    formatResult('Simple symbol: EURUSD', () => parseSymbolMath('EURUSD')),
  );

  results.push(
    formatResult('Complex: (DE10Y-US10Y)/(DE02Y/US02Y)', () =>
      parseSymbolMath('(DE10Y-US10Y)/(DE02Y/US02Y)'),
    ),
  );

  results.push(
    formatResult('Decimal scalar: 0.5*EURUSD', () => parseSymbolMath('0.5*EURUSD')),
  );

  results.push(
    formatResult('Triple add: EURUSD+GBPUSD+USDJPY', () =>
      parseSymbolMath('EURUSD+GBPUSD+USDJPY'),
    ),
  );

  results.push(
    formatResult('Chained multiply: 100*EURUSD*GBPUSD', () =>
      parseSymbolMath('100*EURUSD*GBPUSD'),
    ),
  );

  results.push(
    formatResult('Whitespace tolerance:  EURUSD + GBPUSD ', () =>
      parseSymbolMath('  EURUSD + GBPUSD '),
    ),
  );

  // --- Error cases ---
  results.push(
    formatResult('Error: empty string', () => parseSymbolMath('')),
  );

  results.push(
    formatResult('Error: mismatched parens (EURUSD+GBPUSD', () =>
      parseSymbolMath('(EURUSD+GBPUSD'),
    ),
  );

  results.push(
    formatResult('Error: trailing operator EURUSD+', () =>
      parseSymbolMath('EURUSD+'),
    ),
  );

  results.push(
    formatResult('Error: consecutive operators EURUSD*/GBPUSD', () =>
      parseSymbolMath('EURUSD*/GBPUSD'),
    ),
  );

  results.push(
    formatResult('Error: invalid characters EURUSD@GBPUSD', () =>
      parseSymbolMath('EURUSD@GBPUSD'),
    ),
  );

  results.push(
    formatResult('Lone number: 42 (valid expression)', () => parseSymbolMath('42')),
  );

  results.push(
    formatResult('Error: unclosed paren EURUSD)', () =>
      parseSymbolMath('EURUSD)'),
    ),
  );

  // --- Summary ---
  console.log('\n' + '='.repeat(60));
  console.log('  Summary');
  console.log('='.repeat(60));

  const passed = results.filter((r) => r.ok);
  const expectedErrors = [
    'Error: empty string',
    'Error: mismatched parens (EURUSD+GBPUSD',
    'Error: trailing operator EURUSD+',
    'Error: consecutive operators EURUSD*/GBPUSD',
    'Error: invalid characters EURUSD@GBPUSD',
    'Error: unclosed paren EURUSD)',
  ];
  const errorResults = results.filter((r) => !r.ok);
  const unexpectedFails = errorResults.filter(
    (r) => !expectedErrors.includes(r.label),
  );
  const unexpectedPasses = passed.filter(
    (r) => expectedErrors.includes(r.label),
  );

  console.log(`  Valid expressions passed : ${passed.length - unexpectedPasses.length}`);
  console.log(`  Error cases caught       : ${errorResults.length - unexpectedFails.length}`);
  console.log(`  Unexpected failures      : ${unexpectedFails.length}`);
  console.log(`  Unexpected passes        : ${unexpectedPasses.length}`);

  if (unexpectedFails.length > 0) {
    console.log('\n  Unexpected failures:');
    unexpectedFails.forEach((r) => console.log(`    - ${r.label}: ${r.error}`));
  }

  if (unexpectedPasses.length > 0) {
    console.log('\n  Unexpected passes (expected to fail):');
    unexpectedPasses.forEach((r) => console.log(`    - ${r.label}`));
  }

  const allOk = unexpectedFails.length === 0 && unexpectedPasses.length === 0;
  console.log(`\n  Overall: ${allOk ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'}`);
  console.log('='.repeat(60));
}

runTests();
