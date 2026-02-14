'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EmployeeRatesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin?tab=rates');
  }, [router]);
  return null;
}
