'use client';

import { useState, useEffect } from 'react';
import { Plus, Loader2, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface Category {
  id: number;
  name: string;
  is_default: boolean;
  display_order: number;
}

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  async function loadCategories() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('overhead_categories')
      .select('*')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });
    if (err) {
      setError(err.message);
    } else {
      setCategories(data || []);
    }
    setLoading(false);
  }

  useEffect(() => { loadCategories(); }, []);

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('Category already exists');
      return;
    }
    setAdding(true);
    setError('');
    const maxOrder = categories.reduce((max, c) => Math.max(max, c.display_order), 0);
    const { error: err } = await supabase
      .from('overhead_categories')
      .insert({ name: trimmed, is_default: false, display_order: maxOrder + 1 });
    if (err) {
      setError(err.message);
    } else {
      setNewName('');
      await loadCategories();
    }
    setAdding(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Manage overhead categories used for vendor and transaction classification.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {categories.map(cat => (
          <div
            key={cat.id}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg"
          >
            <Tag className="w-4 h-4 text-teal-500 flex-shrink-0" />
            <span className="text-sm text-gray-900">{cat.name}</span>
            {cat.is_default && (
              <span className="ml-auto text-[10px] font-medium text-gray-400 uppercase">Default</span>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          placeholder="New category name..."
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newName.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium"
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
