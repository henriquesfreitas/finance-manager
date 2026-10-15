import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('application security responses', () => {
  it('does not send the Express X-Powered-By header', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('returns a generic error response while logging the parser error', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"username":');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal server error' });
    expect(errorLog).toHaveBeenCalledOnce();
    expect(String(errorLog.mock.calls[0]?.[0])).toContain('Unexpected end of JSON input');
  });
});
