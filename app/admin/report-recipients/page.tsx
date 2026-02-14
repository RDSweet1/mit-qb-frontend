'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ReportRecipientsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin?tab=recipients');
  }, [router]);
  return null;
}
