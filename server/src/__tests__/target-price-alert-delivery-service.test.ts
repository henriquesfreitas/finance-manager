import { describe, expect, it, vi } from 'vitest';
import { deliverTargetPriceAlerts } from '../services/target-price-alert-delivery-service.js';

describe('deliverTargetPriceAlerts', () => {
  it('sends no email when Telegram accepts the alert', async () => {
    const sendTelegram = vi.fn().mockResolvedValue(undefined);
    const sendEmailFallback = vi.fn().mockResolvedValue(undefined);

    await expect(deliverTargetPriceAlerts(sendTelegram, sendEmailFallback)).resolves.toBe('telegram');

    expect(sendTelegram).toHaveBeenCalledOnce();
    expect(sendEmailFallback).not.toHaveBeenCalled();
  });

  it('uses email only when Telegram delivery fails', async () => {
    const telegramError = new Error('Telegram HTTP 429');
    const sendTelegram = vi.fn().mockRejectedValue(telegramError);
    const sendEmailFallback = vi.fn().mockResolvedValue(undefined);

    await expect(deliverTargetPriceAlerts(sendTelegram, sendEmailFallback)).resolves.toBe('email-fallback');

    expect(sendEmailFallback).toHaveBeenCalledExactlyOnceWith(telegramError);
  });

  it('reports both delivery failures when email fallback also fails', async () => {
    const telegramError = new Error('Telegram HTTP 429');
    const emailError = new Error('Resend HTTP 403');
    const sendTelegram = vi.fn().mockRejectedValue(telegramError);
    const sendEmailFallback = vi.fn().mockRejectedValue(emailError);

    await expect(deliverTargetPriceAlerts(sendTelegram, sendEmailFallback))
      .rejects.toMatchObject({ errors: [telegramError, emailError] });
  });
});
