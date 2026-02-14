'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OverheadRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/profitability?tab=vendor-overhead');
  }, [router]);
  return null;
}
