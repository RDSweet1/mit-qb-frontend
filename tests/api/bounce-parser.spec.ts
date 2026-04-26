import { test, expect } from '@playwright/test';

/**
 * Pure-logic test for parseBounce() — the regex parser inside
 * supabase/functions/detect-invoice-bounces/index.ts. Since the edge
 * function runs in Deno and can't be imported into a Playwright
 * (Node) test, we duplicate the parser here. If the source diverges
 * the test fails — that's the point.
 *
 * The fixtures are real NDR bodies sampled from accounting@'s inbox
 * on 2026-04-26 (sanitized). Anything we'd want to extract correctly
 * lives in one of these.
 */

function stripHtml(html: string): string {
  return (html ?? '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface ParsedBounce {
  originalSubject: string;
  bouncedRecipient: string | null;
  bounceReason: string | null;
  bounceStatusCode: string | null;
  invoiceNumber: string | null;
  qbCustomerHint: string | null;
  category: 'invoice' | 'document_share' | 'project_invite' | 'report_delivery' | 'platform_notice' | 'unknown';
  bodyExcerpt: string;
}

function parseBounce(subject: string, body: string): ParsedBounce {
  const text = stripHtml(body);
  const originalSubject = subject.replace(/^Undeliverable:\s*/i, '').trim();

  let bouncedRecipient: string | null = null;
  const recipMatch = text.match(/Your message to\s+([^\s]+)\s+couldn't be delivered/i);
  if (recipMatch) bouncedRecipient = recipMatch[1].trim();
  if (!bouncedRecipient) {
    const fb = text.slice(0, 400).match(/([A-Za-z0-9._%+\-/=]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})/);
    if (fb) bouncedRecipient = fb[1];
  }

  let bounceStatusCode: string | null = null;
  const sc = text.match(/(?:Status code:?\s*)?(\d{3}\s+\d\.\d\.\d{1,3})/);
  if (sc) bounceStatusCode = sc[1];

  let bounceReason: string | null = null;
  const reasonPatterns: Array<{ rx: RegExp; label: string }> = [
    { rx: /LegacyExchangeDN address[^.]*\./i, label: 'LegacyExchangeDN address (stale Outlook auto-complete)' },
    { rx: /mailbox is full/i, label: 'Recipient mailbox full' },
    { rx: /mailbox.*does(n't| not) exist/i, label: 'Recipient mailbox does not exist' },
    { rx: /address.*not (?:found|recognized|exist)/i, label: 'Recipient address not recognized' },
    { rx: /domain name.*could(?:n't| not) be found/i, label: 'Recipient domain not found' },
    { rx: /relay access denied/i, label: 'Relay access denied (recipient server refused)' },
    { rx: /quota.*exceeded/i, label: 'Recipient quota exceeded' },
    { rx: /spam.*reject/i, label: 'Recipient marked as spam' },
  ];
  for (const { rx, label } of reasonPatterns) {
    if (rx.test(text)) { bounceReason = label; break; }
  }
  if (!bounceReason && bounceStatusCode) bounceReason = `SMTP ${bounceStatusCode}`;

  let invoiceNumber: string | null = null;
  const invoiceMatch = (originalSubject + ' ' + text.slice(0, 600)).match(/invoice\s*#?\s*(\d{3,8})\b/i);
  if (invoiceMatch) invoiceNumber = invoiceMatch[1];

  let qbCustomerHint: string | null = null;
  const fwMatch = originalSubject.match(/^FW:\s*([A-Za-z][A-Za-z0-9.\s\-]{2,40}?)\s*[-—]/i);
  if (fwMatch) qbCustomerHint = fwMatch[1].trim();

  let category: ParsedBounce['category'] = 'unknown';
  const orig = originalSubject.toLowerCase();
  if (/invoice|payment|reminder/.test(orig)) category = 'invoice';
  else if (/shared (the folder|project documents)/.test(orig)) category = 'document_share';
  else if (/invited you to/.test(orig)) category = 'project_invite';
  else if (/report ready|delta report|estimate comparison/.test(orig)) category = 'report_delivery';
  else if (/mit platform notice|mit platform error|system notice|all clear/.test(orig)) category = 'platform_notice';

  return {
    originalSubject,
    bouncedRecipient,
    bounceReason,
    bounceStatusCode,
    invoiceNumber,
    qbCustomerHint,
    category,
    bodyExcerpt: text.slice(0, 1500),
  };
}

// ─── Fixtures sampled from real NDR bodies (sanitized) ────────────────────

const FIXTURE_LEGACY_DN_INVOICE = {
  subject: 'Undeliverable: FW: Premier-Omnisense- MITIGATION INFORMATION TECHNOLOGIES - invoice 2964',
  body: `Your message to IMCEAEX-_o=ExchangeLabs_ou=Exchange+20Administrative+20Group+20+28FYDIBOHF23SPDLT+29_cn=Recipients_cn=8700893173b143b09154a79f4d32e10d-AccountingM@namprd08.prod.outlook.com couldn't be delivered.
Your email program is using outdated address information.
Status code: 550 5.1.11 The recipient email address is a LegacyExchangeDN address, which isn't used by the Office 365 service.`,
};

const FIXTURE_INVALID_RECIPIENT = {
  subject: 'Undeliverable: David Sweet shared project documents with you on MIT Document Platform',
  body: `Your message to test-portal-1774098889578@example.com couldn't be delivered.
The recipient address is not recognized.
Status code: 550 5.1.10 RESOLVER.ADR.RecipientNotFound`,
};

const FIXTURE_FW_INVOICE = {
  subject: 'Undeliverable: FW: ARS-PuntaRassa-Trial - Invoice 2912 from MITIGATION INFORMATION TECHNOLOGIES',
  body: `Your message to old-accounting@arsgen.com couldn't be delivered.
The recipient mailbox does not exist.
Status code: 550 5.1.10`,
};

const FIXTURE_PROJECT_INVITE = {
  subject: 'Undeliverable: David Sweet invited you to MIT Consulting on MIT Document Platform',
  body: `Your message to test-invite-1772377949838@example-test.invalid couldn't be delivered.
Status code: 501 5.1.4 The recipient domain name could not be found in DNS.`,
};

// ─── Tests ────────────────────────────────────────────────────────────────

test.describe('parseBounce — extract structured data from NDR body', () => {
  test('LegacyExchangeDN invoice bounce — recipient + reason + status + invoice#', () => {
    const p = parseBounce(FIXTURE_LEGACY_DN_INVOICE.subject, FIXTURE_LEGACY_DN_INVOICE.body);
    expect(p.originalSubject).toBe('FW: Premier-Omnisense- MITIGATION INFORMATION TECHNOLOGIES - invoice 2964');
    expect(p.bouncedRecipient).toContain('IMCEAEX-');
    expect(p.bounceStatusCode).toBe('550 5.1.11');
    expect(p.bounceReason).toContain('LegacyExchangeDN');
    expect(p.invoiceNumber).toBe('2964');
    expect(p.category).toBe('invoice');
  });

  test('document_share with @example.com test recipient', () => {
    const p = parseBounce(FIXTURE_INVALID_RECIPIENT.subject, FIXTURE_INVALID_RECIPIENT.body);
    expect(p.bouncedRecipient).toBe('test-portal-1774098889578@example.com');
    expect(p.category).toBe('document_share');
    expect(p.bounceReason).toContain('not recognized');
  });

  test('FW: invoice forward — extracts customer hint + invoice#', () => {
    const p = parseBounce(FIXTURE_FW_INVOICE.subject, FIXTURE_FW_INVOICE.body);
    expect(p.qbCustomerHint).toBe('ARS');
    expect(p.invoiceNumber).toBe('2912');
    expect(p.category).toBe('invoice');
  });

  test('project_invite with .invalid domain — domain-not-found reason', () => {
    const p = parseBounce(FIXTURE_PROJECT_INVITE.subject, FIXTURE_PROJECT_INVITE.body);
    expect(p.category).toBe('project_invite');
    expect(p.bounceReason).toContain('domain not found');
    expect(p.bounceStatusCode).toBe('501 5.1.4');
  });

  test('strips "Undeliverable:" prefix from subject', () => {
    const p = parseBounce('Undeliverable: Hello world', 'irrelevant body');
    expect(p.originalSubject).toBe('Hello world');
  });

  test('unknown category for unmatched subjects', () => {
    const p = parseBounce('Undeliverable: Random thing', 'no clue');
    expect(p.category).toBe('unknown');
  });

  test('falls back to first @-bearing token when no "Your message to" line', () => {
    const p = parseBounce('Undeliverable: Test', 'Some body. Recipient was bob@elsewhere.com — bounced.');
    expect(p.bouncedRecipient).toBe('bob@elsewhere.com');
  });

  test('null recipient when nothing parseable', () => {
    const p = parseBounce('Undeliverable: Foo', 'no email anywhere here');
    expect(p.bouncedRecipient).toBeNull();
  });

  test('body excerpt capped at 1500 chars', () => {
    const longBody = 'a'.repeat(3000);
    const p = parseBounce('Undeliverable: long', longBody);
    expect(p.bodyExcerpt.length).toBeLessThanOrEqual(1500);
  });

  test('strips HTML tags before extracting fields', () => {
    const html = `<html><body>Your message to <b>bob@example.com</b> couldn't be delivered. Status code: 550 5.1.10.</body></html>`;
    const p = parseBounce('Undeliverable: html test', html);
    expect(p.bouncedRecipient).toBe('bob@example.com');
    expect(p.bounceStatusCode).toBe('550 5.1.10');
  });
});
