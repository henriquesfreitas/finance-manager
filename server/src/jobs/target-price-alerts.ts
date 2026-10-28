import 'dotenv/config';
import { createPrismaClient } from '../lib/create-prisma-client.js';
import { resolve } from 'node:path';
import { fetchQuotes } from '../services/yahoo-finance-quote-service.js';
import { findReachedTargetAlerts } from '../services/target-price-alert-service.js';
import { sendJobErrorEmail } from './job-error-email.js';

const prisma = createPrismaClient();

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function sendTargetAlertEmail(alerts: ReturnType<typeof findReachedTargetAlerts>): Promise<void> {
  const recipient = process.env['BACKUP_NOTIFY_EMAIL'];
  const sender = process.env['BACKUP_FROM_EMAIL'];
  const apiKey = process.env['RESEND_API_KEY'];
  if (!recipient || !sender || !apiKey) {
    throw new Error('BACKUP_NOTIFY_EMAIL, BACKUP_FROM_EMAIL, and RESEND_API_KEY must be configured');
  }

  const rows = alerts.map((alert) => {
    const actions = alert.reached.map((action) => {
      const target = action === 'SELL' ? alert.sellTarget : alert.buyTarget;
      const label = action === 'SELL' ? 'Sell target reached' : 'Buy target reached';
      return `<div><strong>${label}:</strong> ${formatCurrency(target!)}</div>`;
    }).join('');

    return `<tr>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb">${escapeHtml(alert.ticker)}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb">${formatCurrency(alert.currentPrice)}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb">${actions}</td>
    </tr>`;
  }).join('');

  const checkedAt = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#222">
    <h2>Finance Manager — price target alert</h2>
    <p>Checked ${escapeHtml(checkedAt)} (Brasília time). These active investments reached a target:</p>
    <table style="border-collapse:collapse;width:100%;text-align:left">
      <thead><tr style="background:#f3f4f6">
        <th style="padding:10px">Ticker</th><th style="padding:10px">Price now</th><th style="padding:10px">Target</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#6b7280;font-size:12px">This alert repeats on each scheduled check while a target remains reached.</p>
  </body></html>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Finance Manager <${sender}>`,
      to: [recipient],
      subject: `[Finance Manager] ${alerts.length} price target${alerts.length === 1 ? '' : 's'} reached`,
      html,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resend email failed (HTTP ${response.status}): ${details}`);
  }

  const responseBody = await response.text();
  let result: { id?: string } = {};
  try {
    result = JSON.parse(responseBody) as { id?: string };
  } catch {
    // Resend accepted the request; keep logging useful even if its response isn't JSON.
  }
  console.log(`[target-alerts] Resend accepted the email (HTTP ${response.status}${result.id ? `, id ${result.id}` : ''}).`);
}

async function sendTargetAlertTelegram(alerts: ReturnType<typeof findReachedTargetAlerts>): Promise<void> {
  const botToken = process.env['TELEGRAM_BOT_TOKEN'];
  const chatId = process.env['TELEGRAM_CHAT_ID'];
  if (!botToken && !chatId) {
    console.log('[target-alerts] Telegram is not configured; skipping Telegram notification.');
    return;
  }
  if (!botToken || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must both be configured');
  }

  const checkedAt = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const lines = [
    `Finance Manager — price target alert (${checkedAt} Brasília time)`,
    ...alerts.flatMap((alert) => [
      '',
      `${alert.ticker}: price now ${formatCurrency(alert.currentPrice)}`,
      ...alert.reached.map((action) => {
        const target = action === 'SELL' ? alert.sellTarget : alert.buyTarget;
        const label = action === 'SELL' ? 'Sell target reached' : 'Buy target reached';
        return `${label}: ${formatCurrency(target!)}`;
      }),
    ]),
  ];

  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: lines.join('\n') }),
    });
  } catch {
    // Never include fetch errors here: they can contain the token-bearing request URL.
    throw new Error('Telegram request failed before receiving a response');
  }

  if (!response.ok) {
    throw new Error(`Telegram message failed (HTTP ${response.status})`);
  }
  console.log(`[target-alerts] Telegram accepted the message for ${alerts.length} investment(s).`);
}

async function run(): Promise<void> {
  const startedAt = new Date();
  console.log(`[target-alerts] Started at ${startedAt.toISOString()}`);

  try {
    const rows = await prisma.investment.findMany({
      where: {
        archivedAt: null,
        OR: [{ targetSellPrice: { not: null } }, { targetBuyPrice: { not: null } }],
      },
      select: {
        ticker: true,
        type: true,
        targetSellPrice: true,
        targetBuyPrice: true,
        currentValue: true,
        treasuryProduct: { select: { name: true } },
      },
    });

    const stockTickers = rows.filter((row) => row.type === 'STOCK').map((row) => row.ticker);
    const quotes = stockTickers.length > 0 ? await fetchQuotes(stockTickers) : new Map();
    const missingQuotes = stockTickers.filter((ticker) => quotes.get(ticker) === null || quotes.get(ticker) === undefined);
    console.log(`[target-alerts] Found ${rows.length} active investment(s) with targets; fetched ${stockTickers.length} stock quote(s).`);
    if (missingQuotes.length > 0) {
      console.warn(`[target-alerts] No quote available for: ${missingQuotes.join(', ')}`);
    }

    const alerts = findReachedTargetAlerts(
      rows.map((row) => ({
        ticker: row.type === 'TREASURY' && row.treasuryProduct ? row.treasuryProduct.name : row.ticker,
        // Quotes are keyed by ticker/slug, so retain stock tickers as their lookup key.
        type: row.type,
        currentValue: row.currentValue?.toNumber() ?? null,
        targetSellPrice: row.targetSellPrice?.toNumber() ?? null,
        targetBuyPrice: row.targetBuyPrice?.toNumber() ?? null,
      })),
      quotes,
    );

    if (alerts.length === 0) {
      console.log('[target-alerts] No active buy or sell targets were reached; no email sent.');
      return;
    }

    for (const alert of alerts) {
      console.log(`[target-alerts] ${alert.ticker}: price ${formatCurrency(alert.currentPrice)}; reached ${alert.reached.map((action) => `${action} ${formatCurrency(action === 'SELL' ? alert.sellTarget! : alert.buyTarget!)}`).join(', ')}.`);
    }

    const deliveries = await Promise.allSettled([
      sendTargetAlertEmail(alerts),
      sendTargetAlertTelegram(alerts),
    ]);
    const failures = deliveries.flatMap((delivery) =>
      delivery.status === 'rejected' ? [delivery.reason] : [],
    );
    if (failures.length > 0) {
      throw new AggregateError(failures, 'One or more target alert notifications failed');
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(`[target-alerts] Failed at ${new Date().toISOString()}: ${message}`);
    try {
      await sendJobErrorEmail('price target alerts', error);
      console.log('[target-alerts] Failure email accepted by Resend.');
    } catch (emailError: unknown) {
      const emailMessage = emailError instanceof Error ? emailError.message : String(emailError);
      console.error(`[target-alerts] Could not send failure email: ${emailMessage}`);
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  run().catch((error: unknown) => {
    console.error('Target alert job failed:', error);
    process.exitCode = 1;
  });
}
