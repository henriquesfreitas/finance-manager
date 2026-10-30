export type TargetPriceAlertDelivery = 'telegram' | 'email-fallback';

/** Sends target alerts to Telegram first and uses email only when Telegram fails. */
export async function deliverTargetPriceAlerts(
  sendTelegram: () => Promise<void>,
  sendEmailFallback: (telegramError: unknown) => Promise<void>,
): Promise<TargetPriceAlertDelivery> {
  try {
    await sendTelegram();
    return 'telegram';
  } catch (telegramError: unknown) {
    try {
      await sendEmailFallback(telegramError);
      return 'email-fallback';
    } catch (emailError: unknown) {
      throw new AggregateError(
        [telegramError, emailError],
        'Telegram delivery and email fallback both failed',
      );
    }
  }
}
