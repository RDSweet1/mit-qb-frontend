'use client';

import { useState, useCallback } from 'react';
import { Bug, Camera, CheckCircle, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { callEdgeFunction } from '@/lib/supabaseClient';

interface ReportErrorButtonProps {
  /** Pre-fill with error details (from ErrorBoundary) */
  error?: Error | null;
  /** Compact mode for floating button in AppShell */
  compact?: boolean;
}

const ERROR_EMAIL = 'david@mitigationconsulting.com';

export function ReportErrorButton({ error, compact }: ReportErrorButtonProps) {
  const [status, setStatus] = useState<'idle' | 'capturing' | 'done'>('idle');

  const handleReport = useCallback(async () => {
    setStatus('capturing');

    let screenshotDataUrl = '';
    try {
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        logging: false,
        scale: 1,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
      });
      screenshotDataUrl = canvas.toDataURL('image/png');

      // Copy screenshot to clipboard so user can paste into Outlook
      const blob = await (await fetch(screenshotDataUrl)).blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
    } catch (e) {
      console.warn('Screenshot capture failed:', e);
    }

    // Log to Supabase silently for monitoring
    const errorPayload = {
      page: window.location.pathname,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      errorMessage: error?.message || null,
      errorStack: error?.stack || null,
      hasScreenshot: !!screenshotDataUrl,
    };

    try {
      await callEdgeFunction('log-frontend-error', errorPayload);
    } catch (e) {
      console.warn('Failed to log error to backend:', e);
    }

    // Build mailto link for Outlook
    const subject = encodeURIComponent(
      `[MIT App Error] ${error?.message || 'User-reported issue'} — ${new Date().toLocaleDateString()}`
    );
    const body = encodeURIComponent(
      [
        'ERROR REPORT',
        '────────────',
        `Page: ${window.location.href}`,
        `Time: ${new Date().toLocaleString()}`,
        '',
        error ? `Error: ${error.message}` : 'User-reported issue (no crash)',
        error?.stack ? `\nStack trace:\n${error.stack}` : '',
        '',
        '────────────',
        'A screenshot has been copied to your clipboard.',
        'Please paste it here (Ctrl+V) and add any additional details.',
        '',
        'Steps to reproduce:',
        '1. ',
        '2. ',
        '3. ',
      ].join('\n')
    );

    window.open(`mailto:${ERROR_EMAIL}?subject=${subject}&body=${body}`, '_self');

    setStatus('done');
    setTimeout(() => setStatus('idle'), 3000);
  }, [error]);

  if (compact) {
    return (
      <button
        onClick={handleReport}
        disabled={status === 'capturing'}
        className="fixed bottom-4 right-4 z-50 bg-white border border-gray-300 shadow-lg rounded-full p-3 hover:bg-red-50 hover:border-red-300 transition-all group"
        title="Report an error — captures screenshot and opens Outlook"
      >
        {status === 'capturing' ? (
          <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
        ) : status === 'done' ? (
          <CheckCircle className="w-5 h-5 text-green-600" />
        ) : (
          <Bug className="w-5 h-5 text-gray-500 group-hover:text-red-600 transition-colors" />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleReport}
      disabled={status === 'capturing'}
      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
    >
      {status === 'capturing' ? (
        <>
          <Camera className="w-4 h-4 animate-pulse" />
          Capturing screenshot...
        </>
      ) : status === 'done' ? (
        <>
          <CheckCircle className="w-4 h-4" />
          Screenshot copied — check Outlook
        </>
      ) : (
        <>
          <Bug className="w-4 h-4" />
          Report This Error
        </>
      )}
    </button>
  );
}
