'use client';

import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';

interface InlineNotesEditorProps {
  entryId: number;
  currentNotes: string | null;
  isLocked: boolean;
  isSaving: boolean;
  onSave: (entryId: number, newNotes: string) => Promise<void>;
}

export function InlineNotesEditor({
  entryId,
  currentNotes,
  isLocked,
  isSaving,
  onSave,
}: InlineNotesEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(currentNotes || '');

  const handleEdit = () => {
    setEditValue(currentNotes || '');
    setIsEditing(true);
  };

  const handleSave = async () => {
    await onSave(entryId, editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(currentNotes || '');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="mt-1">
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
          rows={3}
          autoFocus
          disabled={isSaving}
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            <Check className="w-3 h-3" />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-1 group">
      <span className="text-sm text-gray-600 italic">
        <span className="font-medium">Notes:</span> {currentNotes || 'No notes'}
      </span>
      {!isLocked && (
        <button
          onClick={handleEdit}
          className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          title="Edit notes"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
