import { describe, it, expect } from 'vitest';
import { validateCreateInvestmentInput } from '../validators/investment-validator.js';

describe('validateCreateInvestmentInput', () => {
  // ─── Valid inputs ───────────────────────────────────────────────────────────

  it('accepts valid ticker and uppercases + trims it', () => {
    const result = validateCreateInvestmentInput({ ticker: ' itub3 ' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.ticker).toBe('ITUB3');
  });

  it('accepts ticker with digits', () => {
    const result = validateCreateInvestmentInput({ ticker: 'PETR4' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.ticker).toBe('PETR4');
  });

  it('accepts ticker with dot (fund tickers like BOVA11 and US-style like BTC.USD)', () => {
    const result = validateCreateInvestmentInput({ ticker: 'bova11' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.ticker).toBe('BOVA11');
  });

  it('accepts ticker with a dot separator', () => {
    const result = validateCreateInvestmentInput({ ticker: 'BRK.B' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.ticker).toBe('BRK.B');
  });

  it('accepts ticker at max length of 10 characters', () => {
    const result = validateCreateInvestmentInput({ ticker: 'ABCDEFGHIJ' });
    expect(result.success).toBe(true);
  });

  it('accepts single-character ticker', () => {
    const result = validateCreateInvestmentInput({ ticker: 'A' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.ticker).toBe('A');
  });

  // ─── Invalid ticker — empty / whitespace ────────────────────────────────────

  it('rejects missing ticker field', () => {
    const result = validateCreateInvestmentInput({});
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['ticker']).toBeDefined();
  });

  it('rejects empty string ticker', () => {
    const result = validateCreateInvestmentInput({ ticker: '' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['ticker']).toBeDefined();
  });

  it('rejects whitespace-only ticker', () => {
    const result = validateCreateInvestmentInput({ ticker: '   ' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['ticker']).toBeDefined();
  });

  // ─── Invalid ticker — too long ───────────────────────────────────────────────

  it('rejects ticker longer than 10 characters', () => {
    const result = validateCreateInvestmentInput({ ticker: 'ABCDEFGHIJK' }); // 11 chars
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['ticker']).toBeDefined();
  });

  // ─── Invalid ticker — bad characters ────────────────────────────────────────

  it('rejects ticker with spaces', () => {
    const result = validateCreateInvestmentInput({ ticker: 'ITUB 3' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['ticker']).toBeDefined();
  });

  it('rejects ticker with special characters', () => {
    const result = validateCreateInvestmentInput({ ticker: 'ITUB@3' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['ticker']).toBeDefined();
  });

  it('rejects ticker with hyphen', () => {
    // Hyphens are not in the allowed set (letters, digits, dots only)
    const result = validateCreateInvestmentInput({ ticker: 'BTC-USD' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['ticker']).toBeDefined();
  });

  // ─── Non-string input ────────────────────────────────────────────────────────

  it('rejects non-string ticker', () => {
    const result = validateCreateInvestmentInput({ ticker: 123 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['ticker']).toBeDefined();
  });

  // ─── Extra fields are stripped (Zod strips unknown fields by default) ────────

  it('ignores extra fields and returns only ticker', () => {
    // v2 schema is ticker-only; extra fields like quantity/averagePrice are ignored
    const result = validateCreateInvestmentInput({
      ticker: 'VALE3',
      quantity: 100,
      averagePrice: 65.0,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.ticker).toBe('VALE3');
    expect('quantity' in result.data).toBe(false);
    expect('averagePrice' in result.data).toBe(false);
  });
});
