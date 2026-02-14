'use client';

import { useState, useEffect } from 'react';
import { X, Send, UserPlus, MessageSquare } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase, callEdgeFunction } from '@/lib/supabaseClient';
import { clarificationAssignmentSchema, type ClarificationAssignmentData } from '@/lib/validations';

interface AppUser {
  id: string;
  email: string;
  display_name: string;
}

interface EntryInfo {
  id: number;
  employee_name: string;
  txn_date: string;
  hours: number;
  minutes: number;
  cost_code: string;
  description: string;
  qb_customer_id: string;
}

interface AssignClarificationDialogProps {
  isOpen: boolean;
  entries: EntryInfo[];
  customerName?: string;
  adminEmail: string;
  onClose: () => void;
  onAssigned: () => void;
}

export function AssignClarificationDialog({
  isOpen,
  entries,
  customerName,
  adminEmail,
  onClose,
  onAssigned,
}: AssignClarificationDialogProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [showNewPerson, setShowNewPerson] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<ClarificationAssignmentData>({
    resolver: zodResolver(clarificationAssignmentSchema),
    defaultValues: {
      assigneeEmail: '',
      assigneeName: '',
      assigneeUserId: '',
      question: '',
      createUserIfMissing: false,
    },
  });

  useEffect(() => {
    if (isOpen) {
      loadUsersAndPrefill();
    }
  }, [isOpen]);

  const loadUsersAndPrefill = async () => {
    reset({
      assigneeEmail: '',
      assigneeName: '',
      assigneeUserId: '',
      question: '',
      createUserIfMissing: false,
    });
    setShowNewPerson(false);
    setSubmitError(null);

    const { data } = await supabase
      .from('app_users')
      .select('id, email, display_name')
      .order('display_name');
    const loadedUsers = data || [];
    setUsers(loadedUsers);

    // Pre-fill assignee from the entry's employee name
    if (entries.length > 0) {
      const employeeName = entries[0].employee_name;
      const allSameEmployee = entries.every(e => e.employee_name === employeeName);
      if (allSameEmployee && employeeName) {
        const match = loadedUsers.find(
          u => u.display_name.toLowerCase() === employeeName.toLowerCase()
        );
        if (match) {
          setValue('assigneeUserId', match.id);
          setValue('assigneeEmail', match.email);
          setValue('assigneeName', match.display_name);
          setValue('createUserIfMissing', false);
        } else {
          setShowNewPerson(true);
          setValue('assigneeName', employeeName);
          setValue('createUserIfMissing', true);
        }
      }
    }
  };

  const handleUserSelect = (userId: string) => {
    setShowNewPerson(false);
    const user = users.find(u => u.id === userId);
    if (user) {
      setValue('assigneeUserId', user.id);
      setValue('assigneeEmail', user.email);
      setValue('assigneeName', user.display_name);
      setValue('createUserIfMissing', false);
    }
  };

  const onSubmit = async (data: ClarificationAssignmentData) => {
    setSending(true);
    setSubmitError(null);

    try {
      await callEdgeFunction('create-internal-assignment', {
        time_entry_ids: entries.map(e => e.id),
        assignee_email: data.assigneeEmail,
        assignee_name: data.assigneeName,
        assignee_user_id: data.createUserIfMissing ? undefined : data.assigneeUserId || undefined,
        create_user_if_missing: data.createUserIfMissing,
        question: data.question.trim(),
        admin_email: adminEmail,
      });

      onAssigned();
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to send clarification request');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  const fieldError = errors.assigneeEmail?.message || errors.assigneeName?.message || errors.question?.message;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-white" />
            <div>
              <h2 className="text-lg font-bold text-white">Request Clarification</h2>
              <p className="text-amber-100 text-xs">
                {entries.length === 1
                  ? `${entries[0].employee_name} — ${entries[0].txn_date}`
                  : `${entries.length} entries selected`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Close dialog">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <form onSubmit={handleSubmit(onSubmit)} className="overflow-y-auto flex-1 p-6">
          {/* Entry Summary */}
          {entries.length <= 3 && (
            <div className="mb-5">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                {entries.length === 1 ? 'Entry' : 'Entries'}
              </h4>
              {entries.map(e => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-gray-100 text-sm">
                  <div>
                    <span className="font-medium text-gray-900">{e.employee_name}</span>
                    <span className="text-gray-400 mx-2">&middot;</span>
                    <span className="text-gray-600">{e.txn_date}</span>
                    {e.cost_code && (
                      <>
                        <span className="text-gray-400 mx-2">&middot;</span>
                        <span className="text-gray-500 text-xs">{e.cost_code}</span>
                      </>
                    )}
                  </div>
                  <span className="font-semibold text-gray-900">{(e.hours + e.minutes / 60).toFixed(2)}h</span>
                </div>
              ))}
            </div>
          )}
          {entries.length > 3 && (
            <div className="mb-5 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
              {entries.length} time entries selected
              {customerName && <> for <strong>{customerName}</strong></>}
            </div>
          )}

          {/* Assignee Picker */}
          <div className="mb-5">
            <label htmlFor="assignee-select" className="block text-sm font-semibold text-gray-700 mb-1">Assign To</label>
            {!showNewPerson ? (
              <>
                <select
                  id="assignee-select"
                  value={watch('assigneeUserId') || ''}
                  onChange={(e) => handleUserSelect(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none"
                >
                  <option value="">Select a person...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.display_name} ({u.email})</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewPerson(true);
                    setValue('createUserIfMissing', true);
                    if (!watch('assigneeName') && entries.length > 0) {
                      setValue('assigneeName', entries[0].employee_name);
                    }
                  }}
                  className="mt-2 flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900"
                >
                  <UserPlus className="w-4 h-4" />
                  Assign to someone else
                </button>
              </>
            ) : (
              <div className="space-y-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <input
                  type="text"
                  {...register('assigneeName')}
                  placeholder="Full name"
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none"
                />
                <input
                  type="email"
                  {...register('assigneeEmail')}
                  placeholder="Email address"
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none"
                  autoFocus={!!watch('assigneeName') && !watch('assigneeEmail')}
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowNewPerson(false);
                    setValue('assigneeEmail', '');
                    setValue('assigneeName', '');
                    setValue('createUserIfMissing', false);
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel — choose existing user
                </button>
              </div>
            )}
          </div>

          {/* Question */}
          <div className="mb-2">
            <label htmlFor="clarification-question" className="block text-sm font-semibold text-gray-700 mb-1">
              Question <span className="text-red-500">*</span>
            </label>
            <textarea
              id="clarification-question"
              {...register('question')}
              placeholder="What additional detail do you need? E.g., 'What specific work was performed on this date?'"
              className="w-full p-3 border border-gray-300 rounded-lg text-sm resize-vertical min-h-[80px] focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none"
            />
          </div>

          {/* Validation / Submit Error */}
          {(fieldError || submitError) && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {submitError || fieldError}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={sending}
            className="px-5 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {sending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Request
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
