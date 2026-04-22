'use client';

import { useEffect, useState } from 'react';
import { Users, Mail, Plus, Trash2, Search, Save, Loader2, Info } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/PageHeader';

type Role = 'deliver_to' | 'cc' | 'bcc' | 'internal_cc';
const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: 'deliver_to', label: 'Deliver To', hint: 'Primary recipient (the TO line). For intermediaries like Dave Myers.' },
  { value: 'cc', label: 'CC', hint: 'Additional copy; visible to the TO recipient.' },
  { value: 'bcc', label: 'BCC', hint: 'Silent copy; not visible to other recipients.' },
  { value: 'internal_cc', label: 'Internal CC', hint: 'Overrides the default Sharon+David internal CC for this customer.' },
];

const FLOWS = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'report', label: 'Weekly Report' },
  { value: 'review', label: 'Review Portal' },
  { value: 'supplemental', label: 'Supplemental' },
];

interface Customer {
  id: number;
  qb_customer_id: string;
  display_name: string;
  email: string | null;
  qb_parent_customer_id: string | null;
  bill_to_cache: {
    name?: string;
    primary_email?: string;
    end_client_name?: string;
  } | null;
  mit_adds_markup: boolean;
  email_framing_template: string | null;
}

interface Recipient {
  id?: string;
  customer_id: number;
  email: string;
  name: string | null;
  role: Role;
  applies_to: string[];
  active: boolean;
  notes: string | null;
}

export default function CustomerRecipientsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  async function loadCustomers() {
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('id, qb_customer_id, display_name, email, qb_parent_customer_id, bill_to_cache, mit_adds_markup, email_framing_template')
      .eq('is_active', true)
      .order('display_name');
    if (error) {
      setToast({ type: 'error', message: `Load failed: ${error.message}` });
    } else {
      setCustomers(data || []);
    }
    setLoading(false);
  }

  async function loadRecipients(customer: Customer) {
    setSelectedCustomer(customer);
    const { data, error } = await supabase
      .from('customer_recipients')
      .select('*')
      .eq('customer_id', customer.id)
      .order('role')
      .order('email');
    if (error) {
      setToast({ type: 'error', message: `Load recipients failed: ${error.message}` });
      return;
    }
    setRecipients(data || []);
  }

  function addRecipient() {
    if (!selectedCustomer) return;
    setRecipients(prev => [
      ...prev,
      {
        customer_id: selectedCustomer.id,
        email: '',
        name: '',
        role: 'deliver_to',
        applies_to: ['invoice', 'report', 'review', 'supplemental'],
        active: true,
        notes: '',
      },
    ]);
  }

  function updateRecipient(idx: number, patch: Partial<Recipient>) {
    setRecipients(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function removeRecipient(idx: number) {
    setRecipients(prev => prev.filter((_, i) => i !== idx));
  }

  function toggleFlow(idx: number, flow: string) {
    setRecipients(prev =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const has = r.applies_to.includes(flow);
        return { ...r, applies_to: has ? r.applies_to.filter(f => f !== flow) : [...r.applies_to, flow] };
      })
    );
  }

  async function saveRecipients() {
    if (!selectedCustomer) return;
    setSaving(true);

    // Validate
    for (const r of recipients) {
      if (!r.email || !r.email.includes('@')) {
        setToast({ type: 'error', message: `Invalid email: "${r.email}"` });
        setSaving(false);
        return;
      }
      if (r.applies_to.length === 0) {
        setToast({ type: 'error', message: `Recipient ${r.email} must apply to at least one flow` });
        setSaving(false);
        return;
      }
    }

    // Strategy: delete all existing rows for this customer, then insert.
    // Not ideal for audit but fine for MVP given the low volume.
    const { error: delErr } = await supabase
      .from('customer_recipients')
      .delete()
      .eq('customer_id', selectedCustomer.id);
    if (delErr) {
      setToast({ type: 'error', message: `Save failed (delete): ${delErr.message}` });
      setSaving(false);
      return;
    }

    if (recipients.length > 0) {
      const rows = recipients.map(r => ({
        customer_id: r.customer_id,
        email: r.email.trim(),
        name: r.name || null,
        role: r.role,
        applies_to: r.applies_to,
        active: r.active,
        notes: r.notes || null,
      }));
      const { error: insErr } = await supabase.from('customer_recipients').insert(rows);
      if (insErr) {
        setToast({ type: 'error', message: `Save failed (insert): ${insErr.message}` });
        setSaving(false);
        return;
      }
    }

    setToast({ type: 'success', message: `Saved ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}` });
    await loadRecipients(selectedCustomer); // refresh to pick up new IDs
    setSaving(false);
  }

  async function updateCustomerSettings(patch: Partial<Customer>) {
    if (!selectedCustomer) return;
    const { error } = await supabase
      .from('customers')
      .update(patch)
      .eq('id', selectedCustomer.id);
    if (error) {
      setToast({ type: 'error', message: `Update failed: ${error.message}` });
      return;
    }
    setCustomers(prev => prev.map(c => (c.id === selectedCustomer.id ? { ...c, ...patch } : c)));
    setSelectedCustomer({ ...selectedCustomer, ...patch });
    setToast({ type: 'success', message: 'Customer settings saved' });
  }

  const filteredCustomers = customers.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.display_name.toLowerCase().includes(q) ||
      c.qb_customer_id.toLowerCase().includes(q) ||
      (c.bill_to_cache?.name || '').toLowerCase().includes(q)
    );
  });

  return (
    <AppShell>
      <PageHeader
        icon={<Users className="w-6 h-6" />}
        title="Customer Recipients"
        subtitle="Manage who receives invoices, reports, review links, and supplementals per customer. Supports the CertiDry-style pattern where an intermediary receives and presents to the end client."
      />

      <div className="grid grid-cols-12 gap-6">
        {/* Customer list */}
        <div className="col-span-4 bg-white rounded-lg border border-gray-200 p-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search customers..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading...
            </div>
          ) : (
            <div className="space-y-1 max-h-[70vh] overflow-y-auto">
              {filteredCustomers.map(c => (
                <button
                  key={c.id}
                  onClick={() => loadRecipients(c)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedCustomer?.id === c.id
                      ? 'bg-blue-50 border border-blue-200 text-blue-900'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="font-medium">{c.display_name}</div>
                  {c.bill_to_cache?.name && (
                    <div className="text-xs text-gray-500">
                      Bill to: {c.bill_to_cache.name}
                      {c.bill_to_cache.end_client_name && ` · client ${c.bill_to_cache.end_client_name}`}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recipient editor */}
        <div className="col-span-8">
          {!selectedCustomer ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
              Select a customer to manage their recipients.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Customer settings card */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-3">{selectedCustomer.display_name}</h3>
                <div className="text-sm text-gray-600 space-y-1 mb-4">
                  <div><span className="text-gray-500">QB ID:</span> {selectedCustomer.qb_customer_id}</div>
                  {selectedCustomer.bill_to_cache?.name && (
                    <div><span className="text-gray-500">Parent / Bill To:</span> {selectedCustomer.bill_to_cache.name}</div>
                  )}
                  {selectedCustomer.bill_to_cache?.primary_email && (
                    <div><span className="text-gray-500">Parent email:</span> {selectedCustomer.bill_to_cache.primary_email}</div>
                  )}
                  {selectedCustomer.email && (
                    <div><span className="text-gray-500">Customer email (fallback):</span> {selectedCustomer.email}</div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedCustomer.mit_adds_markup}
                      onChange={e => updateCustomerSettings({ mit_adds_markup: e.target.checked })}
                    />
                    <span>
                      <strong>MIT applies markup</strong>
                      <span className="text-xs text-gray-500 block">
                        Uncheck when a downstream intermediary (e.g. CertiDry) handles markup.
                      </span>
                    </span>
                  </label>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      Email framing template{' '}
                      <span className="text-xs text-gray-400">(optional override)</span>
                    </label>
                    <input
                      value={selectedCustomer.email_framing_template || ''}
                      onChange={e => setSelectedCustomer({ ...selectedCustomer, email_framing_template: e.target.value })}
                      onBlur={e => updateCustomerSettings({ email_framing_template: e.target.value || null })}
                      placeholder="in care of {bill_to} on behalf of {end_client}"
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                  </div>
                </div>
              </div>

              {/* Recipients list */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Recipients
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={addRecipient}
                      className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Add recipient
                    </button>
                    <button
                      onClick={saveRecipients}
                      disabled={saving}
                      className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save
                    </button>
                  </div>
                </div>

                {recipients.length === 0 ? (
                  <div className="text-sm text-gray-500 py-4 flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      No explicit recipients. Emails will fall back to <strong>customers.email</strong>
                      {selectedCustomer.bill_to_cache?.primary_email && (
                        <> or the parent&apos;s QB email (<code className="text-xs">{selectedCustomer.bill_to_cache.primary_email}</code>)</>
                      )}, plus the default internal CC (Sharon + David).
                    </span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recipients.map((r, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-md p-3 space-y-2">
                        <div className="grid grid-cols-12 gap-2">
                          <input
                            value={r.email}
                            onChange={e => updateRecipient(idx, { email: e.target.value })}
                            placeholder="email@example.com"
                            className="col-span-5 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <input
                            value={r.name || ''}
                            onChange={e => updateRecipient(idx, { name: e.target.value })}
                            placeholder="Name (optional)"
                            className="col-span-3 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <select
                            value={r.role}
                            onChange={e => updateRecipient(idx, { role: e.target.value as Role })}
                            className="col-span-3 px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            {ROLES.map(role => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => removeRecipient(idx)}
                            className="col-span-1 text-red-600 hover:bg-red-50 rounded flex items-center justify-center"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-gray-500">Applies to:</span>
                          {FLOWS.map(f => (
                            <label key={f.value} className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={r.applies_to.includes(f.value)}
                                onChange={() => toggleFlow(idx, f.value)}
                              />
                              {f.label}
                            </label>
                          ))}
                        </div>
                        <input
                          value={r.notes || ''}
                          onChange={e => updateRecipient(idx, { notes: e.target.value })}
                          placeholder="Notes (e.g. 'Dave presents to NewLand in person')"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-gray-600"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div
          className={`fixed bottom-4 right-4 px-4 py-3 rounded-md shadow-lg text-sm z-50 ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
    </AppShell>
  );
}
