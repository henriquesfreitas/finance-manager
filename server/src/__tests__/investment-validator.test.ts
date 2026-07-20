import { describe, it, expect } from 'vitest';
import {
  validateCreateInvestmentInput,
  validateUpdateTargetPricesInput,
} from '../validators/investment-validator.js';

describe('validateCreateInvestmentInput', () => {
  // ─── Valid inputs ───────────────────────────────────────────────────────────

  it('accepts valid ticker and uppercases + trims it', () => {
    const result = validateCreateInvestmentInput({ ticker: ' itub3 ', sector: 'Bancos' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.ticker).toBe('ITUB3');
  });

  it('accepts ticker with digits', () => {
    const result = validateCreateInvestmentInput({ ticker: 'PETR4', sector: 'Petróleo e Gás' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.ticker).toBe('PETR4');
  });

  it('accepts ticker with dot (fund tickers like BOVA11 and US-style like BTC.USD)', () => {
    const result = validateCreateInvestmentInput({ ticker: 'bova11', sector: 'ETFs' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.ticker).toBe('BOVA11');
  });

  it('accepts ticker with a dot separator', () => {
    const result = validateCreateInvestmentInput({ ticker: 'BRK.B', sector: 'Bancos' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.ticker).toBe('BRK.B');
  });

  it('accepts ticker at max length of 10 characters', () => {
    const result = validateCreateInvestmentInput({ ticker: 'ABCDEFGHIJ', sector: 'Bancos' });
    expect(result.success).toBe(true);
  });

  it('accepts single-character ticker', () => {
    const result = validateCreateInvestmentInput({ ticker: 'A', sector: 'Bancos' });
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

  it('rejects ticker longer than 20 characters', () => {
    const result = validateCreateInvestmentInput({ ticker: 'ABCDEFGHIJKLMNOPQRSTU' }); // 21 chars
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

  it('accepts ticker with hyphen (used by treasury slugs like TESOURO-IPCA-2026)', () => {
    // Hyphens are now allowed — treasury products use slug format
    const result = validateCreateInvestmentInput({ ticker: 'BTC-USD', sector: 'Criptomoedas' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.ticker).toBe('BTC-USD');
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
    // v2 schema is ticker + sector; extra fields like quantity/averagePrice are ignored
    const result = validateCreateInvestmentInput({
      ticker: 'VALE3',
      sector: 'Mineração',
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

describe('validateUpdateTargetPricesInput', () => {
  // ─── Valid inputs ───────────────────────────────────────────────────────────

  it('accepts both target prices as positive numbers', () => {
    const result = validateUpdateTargetPricesInput({
      targetSellPrice: 35.5,
      targetBuyPrice: 28.0,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.targetSellPrice).toBe(35.5);
    expect(result.data.targetBuyPrice).toBe(28.0);
  });

  it('accepts only targetSellPrice (partial update)', () => {
    const result = validateUpdateTargetPricesInput({ targetSellPrice: 42.0 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.targetSellPrice).toBe(42.0);
    expect(result.data.targetBuyPrice).toBeUndefined();
  });

  it('accepts only targetBuyPrice (partial update)', () => {
    const result = validateUpdateTargetPricesInput({ targetBuyPrice: 20.0 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.targetSellPrice).toBeUndefined();
    expect(result.data.targetBuyPrice).toBe(20.0);
  });

  it('accepts null to explicitly clear a target', () => {
    const result = validateUpdateTargetPricesInput({
      targetSellPrice: null,
      targetBuyPrice: null,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.targetSellPrice).toBeNull();
    expect(result.data.targetBuyPrice).toBeNull();
  });

  it('accepts an empty object (no-op update)', () => {
    const result = validateUpdateTargetPricesInput({});
    expect(result.success).toBe(true);
  });

  // ─── Invalid inputs ─────────────────────────────────────────────────────────

  it('rejects targetSellPrice of zero', () => {
    const result = validateUpdateTargetPricesInput({ targetSellPrice: 0 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['targetSellPrice']).toBeDefined();
  });

  it('rejects negative targetSellPrice', () => {
    const result = validateUpdateTargetPricesInput({ targetSellPrice: -10 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['targetSellPrice']).toBeDefined();
  });

  it('rejects negative targetBuyPrice', () => {
    const result = validateUpdateTargetPricesInput({ targetBuyPrice: -5.5 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['targetBuyPrice']).toBeDefined();
  });

  it('rejects non-numeric targetSellPrice', () => {
    const result = validateUpdateTargetPricesInput({ targetSellPrice: 'thirty-five' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['targetSellPrice']).toBeDefined();
  });

  it('rejects non-numeric targetBuyPrice', () => {
    const result = validateUpdateTargetPricesInput({ targetBuyPrice: 'twenty' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['targetBuyPrice']).toBeDefined();
  });
});

import {
  validateCreateTreasuryInvestmentInput,
  validateUpdateCurrentValueInput,
} from '../validators/investment-validator.js';

describe('validateCreateTreasuryInvestmentInput', () => {
  it('accepts a valid UUID', () => {
    const result = validateCreateTreasuryInvestmentInput({
      treasuryProductId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.treasuryProductId).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  });

  it('rejects missing treasuryProductId', () => {
    const result = validateCreateTreasuryInvestmentInput({});
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['treasuryProductId']).toBeDefined();
  });

  it('rejects a non-UUID string', () => {
    const result = validateCreateTreasuryInvestmentInput({ treasuryProductId: 'not-a-uuid' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['treasuryProductId']).toBeDefined();
  });

  it('rejects a non-string value', () => {
    const result = validateCreateTreasuryInvestmentInput({ treasuryProductId: 12345 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['treasuryProductId']).toBeDefined();
  });
});

describe('validateUpdateCurrentValueInput', () => {
  it('accepts a positive number', () => {
    const result = validateUpdateCurrentValueInput({ currentValue: 30882.59 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.currentValue).toBe(30882.59);
  });

  it('accepts null to clear the value', () => {
    const result = validateUpdateCurrentValueInput({ currentValue: null });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.currentValue).toBeNull();
  });

  it('rejects zero', () => {
    const result = validateUpdateCurrentValueInput({ currentValue: 0 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['currentValue']).toBeDefined();
  });

  it('rejects a negative number', () => {
    const result = validateUpdateCurrentValueInput({ currentValue: -100 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['currentValue']).toBeDefined();
  });

  it('rejects a non-numeric value', () => {
    const result = validateUpdateCurrentValueInput({ currentValue: 'thirty' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['currentValue']).toBeDefined();
  });

  it('rejects missing currentValue field', () => {
    const result = validateUpdateCurrentValueInput({});
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['currentValue']).toBeDefined();
  });
});
