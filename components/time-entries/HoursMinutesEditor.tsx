'use client';

import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';

interface HoursMinutesEditorProps {
  entryId: number;
  currentHours: number;
  currentMinutes: number;
  isLocked: boolean;
  isSaving: boolean;
  onSave: (entryId: number, hours: number, minutes: number) => Promise<void>;
}

function formatDuration(hours: number, minutes: number) {
  return `${hours}.${minutes.toString().padStart(2, '0')} hrs`;
}

export function HoursMinutesEditor({
  entryId,
  currentHours,
  currentMinutes,
  isLocked,
  isSaving,
  onSave,
}: HoursMinutesEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editHours, setEditHours] = useState(currentHours);
  const [editMinutes, setEditMinutes] = useState(currentMinutes);

  const handleEdit = () => {
    setEditHours(currentHours);
    setEditMinutes(currentMinutes);
    setIsEditing(true);
  };

  const handleSave = async () => {
    // Validation
    if (editHours < 0 || editHours > 24 || editMinutes < 0 || editMinutes > 59) return;
    if (editHours === 0 && editMinutes === 0) return;
    // No-op if unchanged
    if (editHours === currentHours && editMinutes === currentMinutes) {
      setIsEditing(false);
      return;
    }
    await onSave(entryId, editHours, editMinutes);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditHours(currentHours);
    setEditMinutes(currentMinutes);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={24}
            value={editHours}
            onChange={(e) => setEditHours(Math.max(0, Math.min(24, parseInt(e.target.value) || 0)))}
            className="w-14 px-2 py-1 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
            autoFocus
            disabled={isSaving}
          />
          <span className="text-xs text-gray-500">h</span>
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={59}
            value={editMinutes}
            onChange={(e) => setEditMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
            className="w-14 px-2 py-1 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
            disabled={isSaving}
          />
          <span className="text-xs text-gray-500">m</span>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || (editHours === 0 && editMinutes === 0)}
          className="p-1 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
          title="Save"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="p-1 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
          title="Cancel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 group">
      <span className="text-sm font-semibold text-blue-600">
        {formatDuration(currentHours, currentMinutes)}
      </span>
      {!isLocked && (
        <button
          onClick={handleEdit}
          className="flex-shrink-0 p-0.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
          title="Edit hours"
        >
          <Pencil className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
