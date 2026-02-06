'use client';

import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { callEdgeFunction } from '@/lib/supabaseClient';

interface UserPermissions {
  can_view: boolean;
  can_send_reminders: boolean;
  can_create_invoices: boolean;
  is_admin: boolean;
  can_edit_time: boolean;
  can_manage_users: boolean;
}

interface AppUser {
  id: string;
  email: string;
  display_name: string;
  entra_id: string;
  last_login: string;
  created_at: string;
}

interface UseUserEnrollmentResult {
  user: AppUser | null;
  permissions: UserPermissions | null;
  loading: boolean;
  error: string | null;
}

export function useUserEnrollment(): UseUserEnrollmentResult {
  const { accounts } = useMsal();
  const [user, setUser] = useState<AppUser | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const account = accounts[0];

  useEffect(() => {
    if (!account) {
      setUser(null);
      setPermissions(null);
      return;
    }

    const enrollUser = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await callEdgeFunction('auto_enroll_user', {
          email: account.username,
          display_name: account.name || account.username.split('@')[0],
          entra_id: account.localAccountId || account.homeAccountId || '',
        });

        if (result.success) {
          setUser(result.user);
          setPermissions(result.permissions);
        } else {
          setError(result.error || 'Enrollment failed');
        }
      } catch (err) {
        console.error('User enrollment failed:', err);
        setError(err instanceof Error ? err.message : 'Enrollment failed');
      } finally {
        setLoading(false);
      }
    };

    enrollUser();
  }, [account?.username]);

  return { user, permissions, loading, error };
}
