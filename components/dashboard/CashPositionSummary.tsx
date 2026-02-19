'use client';

import { useEffect, useState } from 'react';
import { Wallet, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fmtMoney, fmtPct } from '@/lib/utils';
import { startOfYear } from 'date-fns';

interface CashStats {
  ytdBilled: number;
  ytdReceived: number;
  collectionRate: number;
  outstandingAR: number;
}

export function CashPositionSummary() {
  const [stats, setStats] = useState<CashStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCashStats();
  }, []);

  async function loadCashStats() {
    try {
      const yearStart = startOfYear(new Date()).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      const [invoicesRes, paymentsRes, arRes] = await Promise.all([
        // YTD invoices billed (from qb_invoice_balances — total_amount for invoices created this year)
        supabase
          .from('qb_invoice_balances')
          .select('total_amount')
          .gte('txn_date', yearStart)
          .lte('txn_date', today),
        // YTD payments received
        supabase
          .from('qb_payments')
          .select('total_amount')
          .gte('txn_date', yearStart)
          .lte('txn_date', today),
        // Outstanding A/R (all invoices with balance > 0)
        supabase
          .from('qb_invoice_balances')
          .select('balance')
          .gt('balance', 0),
      ]);

      const ytdBilled = (invoicesRes.data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
      const ytdReceived = (paymentsRes.data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
      const outstandingAR = (arRes.data || []).reduce((s, r) => s + Number(r.balance || 0), 0);
      const collectionRate = ytdBilled > 0 ? (ytdReceived / ytdBilled) * 100 : 0;

      setStats({ ytdBilled, ytdReceived, collectionRate, outstandingAR });
    } catch (err) {
      console.error('Error loading cash position summary:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i}>
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats || (stats.ytdBilled === 0 && stats.ytdReceived === 0 && stats.outstandingAR === 0)) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-600" />
            Cash Position
          </h3>
          <Link href="/profitability?tab=cash-position" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
            View Details <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <p className="text-sm text-gray-500">No payment data yet. Sync payments on the Cash Position tab to populate.</p>
      </div>
    );
  }

  const collectionColor = stats.collectionRate >= 90 ? 'bg-green-100 text-green-800' :
    stats.collectionRate >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-blue-600" />
          Cash Position
        </h3>
        <Link href="/profitability?tab=cash-position" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
          View Details <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* YTD Billed */}
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">YTD Billed</p>
          <p className="text-lg font-bold text-green-700">{fmtMoney(stats.ytdBilled)}</p>
        </div>

        {/* YTD Received */}
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">YTD Received</p>
          <p className="text-lg font-bold text-blue-700">{fmtMoney(stats.ytdReceived)}</p>
        </div>

        {/* Collection Rate */}
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Collection Rate</p>
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold text-purple-700">{fmtPct(stats.collectionRate)}</p>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${collectionColor}`}>
              {stats.collectionRate >= 90 ? 'Good' : stats.collectionRate >= 70 ? 'Fair' : 'Low'}
            </span>
          </div>
        </div>

        {/* Outstanding A/R */}
        <div className="bg-amber-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Outstanding A/R</p>
          <div className="flex items-center gap-1.5">
            <p className="text-lg font-bold text-amber-700">{fmtMoney(stats.outstandingAR)}</p>
            {stats.outstandingAR > 0 ? (
              <TrendingDown className="w-4 h-4 text-amber-500" />
            ) : (
              <TrendingUp className="w-4 h-4 text-green-500" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
