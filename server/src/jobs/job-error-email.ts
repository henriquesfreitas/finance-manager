function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatError(error: unknown): string {
  if (error instanceof AggregateError) {
    return Array.from(error.errors, formatError).join('\n');
  }
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

export async function sendJobErrorEmail(jobName: string, error: unknown): Promise<void> {
  const recipient = process.env['BACKUP_NOTIFY_EMAIL'];
  const sender = process.env['BACKUP_FROM_EMAIL'];
  const apiKey = process.env['RESEND_API_KEY'];
  if (!recipient || !sender || !apiKey) {
    throw new Error('BACKUP_NOTIFY_EMAIL, BACKUP_FROM_EMAIL, and RESEND_API_KEY must be configured');
  }

  const details = formatError(error);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Finance Manager <${sender}>`,
      to: [recipient],
      subject: `[Finance Manager] ${jobName} failed`,
      html: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#222">
        <h2>Finance Manager: ${escapeHtml(jobName)} failed</h2>
        <p>The scheduled job failed at ${escapeHtml(new Date().toISOString())}.</p>
        <pre style="white-space:pre-wrap;background:#f3f4f6;padding:12px">${escapeHtml(details)}</pre>
        <p>Check the production job log for more information.</p>
      </body></html>`,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resend error email failed (HTTP ${response.status}): ${details}`);
  }
}
