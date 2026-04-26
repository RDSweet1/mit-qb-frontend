'use client';

/**
 * BounceTrackerPopup — small floating notification chip that links to
 * /bounces.
 *
 * Shows a red badge in the bottom-right when there are open invoice
 * bounces. Clicking takes Sharon to the full /bounces management
 * screen where she can resend, update the customer address, or mark
 * resolved out-of-band. Polls every 60s so new bounces from the
 * cron surface without a page refresh.
 *
 * Pre-2026-04-26 this was a self-contained modal; David asked for the
 * notification + dedicated screen pattern instead, matching the rest
 * of the dashboard's "things-not-done" badges.
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

export function BounceTrackerPopup() {
  const [openCount, setOpenCount] = useState(0);
  const pathname = usePathname();

  const load = useCallback(async () => {
    const { count, error } = await supabase
      .from('invoice_bounce_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open');
    if (error) {
      console.warn('[BounceTracker] count failed:', error.message);
      return;
    }
    setOpenCount(count ?? 0);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  // Don't show the chip on the bounces page itself — Sharon is already there.
  if (openCount === 0 || pathname === '/bounces') return null;

  return (
    <Link
      href="/bounces"
      className="fixed bottom-20 right-4 z-50 group"
      title={`${openCount} email bounce${openCount === 1 ? ' needs' : 's need'} follow-up — click to review and resolve`}
      data-testid="bounce-tracker-chip"
    >
      <div className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg shadow-2xl border-2 border-red-700 flex items-center gap-2 animate-pulse group-hover:animate-none transition-colors">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <div className="text-left">
          <div className="text-sm font-bold leading-tight">
            {openCount} email bounce{openCount === 1 ? '' : 's'} need follow-up
          </div>
          <div className="text-xs opacity-90 leading-tight">Click to review &amp; clear</div>
        </div>
      </div>
    </Link>
  );
}
