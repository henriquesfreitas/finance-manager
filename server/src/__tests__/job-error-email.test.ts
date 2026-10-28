import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendJobErrorEmail } from '../jobs/job-error-email.js';

describe('sendJobErrorEmail', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sends a failure report with escaped error details', async () => {
    vi.stubEnv('BACKUP_NOTIFY_EMAIL', 'alerts@example.com');
    vi.stubEnv('BACKUP_FROM_EMAIL', 'backup@example.com');
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await sendJobErrorEmail('price target alerts', new Error('<Telegram> failed'));

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(request.headers).toEqual({
      Authorization: 'Bearer test-key',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(request.body))).toMatchObject({
      from: 'Finance Manager <backup@example.com>',
      to: ['alerts@example.com'],
      subject: '[Finance Manager] price target alerts failed',
    });
    expect(JSON.parse(String(request.body)).html).toContain('&lt;Telegram&gt; failed');
  });

  it('reports delivery failures so the caller can log them', async () => {
    vi.stubEnv('BACKUP_NOTIFY_EMAIL', 'alerts@example.com');
    vi.stubEnv('BACKUP_FROM_EMAIL', 'backup@example.com');
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('domain not verified', { status: 403 })));

    await expect(sendJobErrorEmail('price target alerts', new Error('Telegram 429')))
      .rejects.toThrow('Resend error email failed (HTTP 403): domain not verified');
  });
});
