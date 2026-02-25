import { test, expect } from '@playwright/test';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const fnHeaders = {
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

test.describe('Ask Assistant API', () => {
  test('OPTIONS returns 200 (CORS preflight)', async ({ request }) => {
    const res = await request.fetch(
      `${SUPABASE_URL}/functions/v1/ask-assistant`,
      {
        method: 'OPTIONS',
        headers: fnHeaders,
      }
    );
    expect(res.status()).toBe(200);
  });

  test('CORS headers are present in response', async ({ request }) => {
    const res = await request.fetch(
      `${SUPABASE_URL}/functions/v1/ask-assistant`,
      {
        method: 'OPTIONS',
        headers: fnHeaders,
      }
    );
    const headers = res.headers();
    expect(headers['access-control-allow-origin']).toBe('*');
  });

  test('returns success and answer for simple question', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/ask-assistant`,
      {
        headers: fnHeaders,
        data: { question: 'List active customers' },
      }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.answer).toBeTruthy();
    expect(typeof body.answer).toBe('string');
    expect(body.answer.length).toBeGreaterThan(0);
    expect(Array.isArray(body.sources)).toBeTruthy();
  });

  test('handles empty question gracefully', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/ask-assistant`,
      {
        headers: fnHeaders,
        data: { question: '' },
      }
    );
    // Should return 400 for empty question
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('response has expected shape', async ({ request }) => {
    const res = await request.post(
      `${SUPABASE_URL}/functions/v1/ask-assistant`,
      {
        headers: fnHeaders,
        data: { question: 'How many automations are configured?' },
      }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();

    // Expected response shape
    expect(body).toHaveProperty('success');
    expect(body).toHaveProperty('answer');
    expect(body).toHaveProperty('sources');
    expect(typeof body.success).toBe('boolean');
    expect(typeof body.answer).toBe('string');
    expect(Array.isArray(body.sources)).toBeTruthy();

    // Sources should be tool names that were called
    for (const source of body.sources) {
      expect(typeof source).toBe('string');
      expect(source).toMatch(/^query_/);
    }
  });
});
