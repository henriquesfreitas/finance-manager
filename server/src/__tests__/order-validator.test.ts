import { describe, it, expect } from 'vitest';
import { validateCreateOrderInput, validateUpdateOrderInput } from '../validators/order-validator.js';

describe('validateCreateOrderInput', () => {
  // ─── Valid inputs ─────────────────────────────────────────────────────────

  it('accepts a valid BUY order', () => {
    const result = validateCreateOrderInput({
      type: 'BUY',
      quantity: 100,
      price: 28.35,
      orderDate: '2025-01-15',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      type: 'BUY',
      quantity: 100,
      price: 28.35,
      orderDate: '2025-01-15',
    });
  });

  it('accepts a valid SELL order', () => {
    const result = validateCreateOrderInput({
      type: 'SELL',
      quantity: 50,
      price: 30.0,
      orderDate: '2025-06-01',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.type).toBe('SELL');
  });

  it('accepts a valid BONUS order', () => {
    const result = validateCreateOrderInput({
      type: 'BONUS',
      quantity: 10,
      price: 28.0,
      orderDate: '2025-03-20',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a SPLIT order with price = 0', () => {
    const result = validateCreateOrderInput({
      type: 'SPLIT',
      quantity: 2,
      price: 0,
      orderDate: '2025-05-10',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.price).toBe(0);
  });

  // ─── Invalid type ─────────────────────────────────────────────────────────

  it('rejects invalid order type', () => {
    const result = validateCreateOrderInput({
      type: 'TRANSFER',
      quantity: 100,
      price: 10,
      orderDate: '2025-01-01',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['type']).toBeDefined();
  });

  it('rejects missing type', () => {
    const result = validateCreateOrderInput({
      quantity: 100,
      price: 10,
      orderDate: '2025-01-01',
    });
    expect(result.success).toBe(false);
  });

  // ─── Invalid quantity ─────────────────────────────────────────────────────

  it('rejects zero quantity', () => {
    const result = validateCreateOrderInput({
      type: 'BUY',
      quantity: 0,
      price: 10,
      orderDate: '2025-01-01',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['quantity']).toBeDefined();
  });

  it('rejects negative quantity', () => {
    const result = validateCreateOrderInput({
      type: 'BUY',
      quantity: -5,
      price: 10,
      orderDate: '2025-01-01',
    });
    expect(result.success).toBe(false);
  });

  // ─── Invalid price ────────────────────────────────────────────────────────

  it('rejects negative price', () => {
    const result = validateCreateOrderInput({
      type: 'BUY',
      quantity: 100,
      price: -1,
      orderDate: '2025-01-01',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['price']).toBeDefined();
  });

  it('rejects zero price for BUY orders', () => {
    const result = validateCreateOrderInput({
      type: 'BUY',
      quantity: 100,
      price: 0,
      orderDate: '2025-01-01',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['price']).toBeDefined();
  });

  it('rejects zero price for SELL orders', () => {
    const result = validateCreateOrderInput({
      type: 'SELL',
      quantity: 50,
      price: 0,
      orderDate: '2025-01-01',
    });
    expect(result.success).toBe(false);
  });

  // ─── Invalid orderDate ────────────────────────────────────────────────────

  it('rejects future date', () => {
    const result = validateCreateOrderInput({
      type: 'BUY',
      quantity: 100,
      price: 10,
      orderDate: '2099-12-31',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['orderDate']).toBeDefined();
  });

  it('rejects invalid date format', () => {
    const result = validateCreateOrderInput({
      type: 'BUY',
      quantity: 100,
      price: 10,
      orderDate: '15/01/2025',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-date string', () => {
    const result = validateCreateOrderInput({
      type: 'BUY',
      quantity: 100,
      price: 10,
      orderDate: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });

  it('accepts today as a valid date', () => {
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    const result = validateCreateOrderInput({
      type: 'BUY',
      quantity: 100,
      price: 10,
      orderDate: today,
    });
    expect(result.success).toBe(true);
  });

  // ─── Missing fields ───────────────────────────────────────────────────────

  it('rejects completely empty object', () => {
    const result = validateCreateOrderInput({});
    expect(result.success).toBe(false);
  });
});

describe('validateUpdateOrderInput', () => {
  // ─── Valid inputs ─────────────────────────────────────────────────────────

  it('accepts partial update with just price', () => {
    const result = validateUpdateOrderInput({ price: 30.0 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.price).toBe(30.0);
  });

  it('accepts partial update with just quantity', () => {
    const result = validateUpdateOrderInput({ quantity: 200 });
    expect(result.success).toBe(true);
  });

  it('accepts partial update with just type', () => {
    const result = validateUpdateOrderInput({ type: 'SELL' });
    expect(result.success).toBe(true);
  });

  it('accepts partial update with just orderDate', () => {
    const result = validateUpdateOrderInput({ orderDate: '2025-03-15' });
    expect(result.success).toBe(true);
  });

  it('accepts full update with all fields', () => {
    const result = validateUpdateOrderInput({
      type: 'BUY',
      quantity: 150,
      price: 25.0,
      orderDate: '2025-02-01',
    });
    expect(result.success).toBe(true);
  });

  it('accepts averagePriceAtSell for a SELL order update', () => {
    const result = validateUpdateOrderInput({ averagePriceAtSell: 28.35 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.averagePriceAtSell).toBe(28.35);
  });

  it('accepts null averagePriceAtSell to clear the PM snapshot', () => {
    const result = validateUpdateOrderInput({ averagePriceAtSell: null });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.averagePriceAtSell).toBeNull();
  });

  // ─── Invalid inputs ───────────────────────────────────────────────────────

  it('rejects empty object (at least one field required)', () => {
    const result = validateUpdateOrderInput({});
    expect(result.success).toBe(false);
  });

  it('rejects negative quantity', () => {
    const result = validateUpdateOrderInput({ quantity: -10 });
    expect(result.success).toBe(false);
  });

  it('rejects future date', () => {
    const result = validateUpdateOrderInput({ orderDate: '2099-01-01' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid type', () => {
    const result = validateUpdateOrderInput({ type: 'INVALID' });
    expect(result.success).toBe(false);
  });

  it('rejects zero averagePriceAtSell (must be positive)', () => {
    const result = validateUpdateOrderInput({ averagePriceAtSell: 0 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors['averagePriceAtSell']).toBeDefined();
  });

  it('rejects negative averagePriceAtSell', () => {
    const result = validateUpdateOrderInput({ averagePriceAtSell: -5 });
    expect(result.success).toBe(false);
  });
});
