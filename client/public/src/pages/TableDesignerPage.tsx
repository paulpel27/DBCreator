/**
 * TableDesignerPage — Full field designer for a single table
 * Obsidian Forge: inset field list, amber active state, all 16 field types
 */
import { useState, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  Plus, Trash2, Edit3, GripVertical, ChevronLeft, Save,
  Hash, Type, AlignLeft, Calendar, Image, Link2, List,
  Key, AtSign, Globe, Palette, Code2, Clock, ToggleLeft, FileIcon, Sparkles
} from 'lucide-react';
import { useDB } from '@/contexts/DBContext';
import type { DBField, DBTable, FieldType, TableType } from '@/lib/db';
import { MockDataGeneratorDialog } from '@/components/MockDataGeneratorDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';

const FIELD_TYPES: { value: FieldType; label: string; icon: React.ReactNode; color: string; desc: string }[] = [
  { value: 'id',         label: 'ID',          icon: <Key size={14} />,        color: '#f5a623', desc: 'Auto-generated unique identifier' },
  { value: 'text',       label: 'Text',         icon: <Type size={14} />,       color: '#6366f1', desc: 'Short text, up to 255 chars' },
  { value: 'large_text', label: 'Large Text',   icon: <AlignLeft size={14} />,  color: '#6366f1', desc: 'Long text, memos, notes' },
  { value: 'number',     label: 'Number',       icon: <Hash size={14} />,       color: '#10b981', desc: 'Integer number' },
  { value: 'decimal',    label: 'Decimal',      icon: <Hash size={14} />,       color: '#10b981', desc: 'Floating point number' },
  { value: 'boolean',    label: 'Boolean',      icon: <ToggleLeft size={14} />, color: '#8b5cf6', desc: 'True / False checkbox' },
  { value: 'date',       label: 'Date',         icon: <Calendar size={14} />,   color: '#06b6d4', desc: 'Date only (YYYY-MM-DD)' },
  { value: 'datetime',   label: 'DateTime',     icon: <Calendar size={14} />,   color: '#06b6d4', desc: 'Date and time' },
  { value: 'time',       label: 'Time',         icon: <Clock size={14} />,      color: '#06b6d4', desc: 'Time only (HH:MM:SS)' },
  { value: 'image',      label: 'Image',        icon: <Image size={14} />,      color: '#ec4899', desc: 'Image file stored as base64' },
  { value: 'file',       label: 'File',         icon: <FileIcon size={14} />,   color: '#ec4899', desc: 'Any file stored as base64' },
  { value: 'foreign_key',label: 'Foreign Key',  icon: <Link2 size={14} />,      color: '#f59e0b', desc: 'Reference to another table' },
  { value: 'lov',        label: 'LOV',          icon: <List size={14} />,       color: '#f59e0b', desc: 'List of values (dropdown)' },
  { value: 'email',      label: 'Email',        icon: <AtSign size={14} />,     color: '#6366f1', desc: 'Email address with validation' },
  { value: 'url',        label: 'URL',          icon: <Globe size={14} />,      color: '#6366f1', desc: 'Web URL with validation' },
  { value: 'color',      label: 'Color',        icon: <Palette size={14} />,    color: '#ec4899', desc: 'Color picker value' },
  { value: 'json',       label: 'JSON',         icon: <Code2 size={14} />,      color: '#84cc16', desc: 'Structured JSON data' },
];

const TABLE_TYPES: { value: TableType; label: string; desc: string; color: string }[] = [
  { value: 'standard', label: 'Standard', desc: 'Regular data table', color: '#6366f1' },
  { value: 'master', label: 'Master', desc: 'Parent in master-detail', color: '#f5a623' },
  { value: 'detail', label: 'Detail', desc: 'Child in master-detail', color: '#10b981' },
  { value: 'lov', label: 'LOV', desc: 'List of values / lookup', color: '#8b5cf6' },
];

const TABLE_COLORS = [
  '#6366f1', '#f5a623', '#10b981', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f59e0b', '#ec4899', '#14b8a6', '#84cc16',
];

const DEFAULT_FIELD: Partial<DBField> = {
  name: '',
  displayName: '',
  fieldType: 'text',
  required: false,
  unique: false,
  defaultValue: null,
  description: '',
  placeholder: '',
  helpText: '',
  maxLength: undefined,
  min: undefined,
  max: undefined,
  lovValues: '[]',
};

export default function TableDesignerPage() {
  const { projectId, tableId } = useParams<{ projectId: string; tableId: string }>();
  const [, navigate] = useLocation();
  const { projects, tables, fields, createField, updateField, deleteField, reorderFields, updateTable } = useDB();

  const project = projects.find((p) => p.id === projectId);
  const table = tables.find((t) => t.id === tableId);
  const tableFields = fields
    .filter((f) => f.tableId === tableId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const [showAdd, setShowAdd] = useState(false);
  const [editField, setEditField] = useState<DBField | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DBField | null>(null);
  const [showEditTable, setShowEditTable] = useState(false);
  const [mockDataOpen, setMockDataOpen] = useState(false);
  const [tableForm, setTableForm] = useState({ name: '', displayName: '', description: '', tableType: 'standard' as TableType, color: '#6366f1' });
  const [fieldForm, setFieldForm] = useState<Partial<DBField>>(DEFAULT_FIELD);
  const [lovInput, setLovInput] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragOrder = useRef<string[]>([]);

  const resetForm = () => {
    setFieldForm(DEFAULT_FIELD);
    setLovInput('');
  };

  const openEditTable = () => {
    if (!table) return;
    setTableForm({ name: table.name, displayName: table.displayName, description: table.description, tableType: table.tableType, color: table.color });
    setShowEditTable(true);
  };

  const handleSaveTable = async () => {
    if (!table || !tableForm.displayName.trim()) return;
    await updateTable({
      ...table,
      name: tableForm.name.trim() || table.name,
      displayName: tableForm.displayName.trim(),
      description: tableForm.description.trim(),
      tableType: tableForm.tableType,
      color: tableForm.color,
    });
    setShowEditTable(false);
    toast.success('Table updated');
  };

  const openAdd = () => {
    resetForm();
    setShowAdd(true);
  };

  const openEdit = (f: DBField) => {
    setEditField(f);
    setFieldForm({ ...f });
    if (f.fieldType === 'lov' && f.lovValues) {
      try {
        const arr = JSON.parse(f.lovValues) as { value: string; label: string }[];
        setLovInput(arr.map((x) => `${x.value}:${x.label}`).join('\n'));
      } catch {
        setLovInput('');
      }
    }
  };

  const parseLovValues = () => {
    if (!lovInput.trim()) return '[]';
    const lines = lovInput.split('\n').filter((l) => l.trim());
    const arr = lines.map((line) => {
      const [value, ...rest] = line.split(':');
      return { value: value.trim(), label: rest.join(':').trim() || value.trim() };
    });
    return JSON.stringify(arr);
  };

  const handleSave = async () => {
    if (!fieldForm.displayName?.trim()) return;
    const safeName = fieldForm.name?.trim() ||
      fieldForm.displayName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    const data: Partial<DBField> = {
      ...fieldForm,
      name: safeName,
      tableId,
      projectId,
      lovValues: fieldForm.fieldType === 'lov' ? parseLovValues() : undefined,
    };

    if (editField) {
      await updateField({ ...editField, ...data } as DBField);
      setEditField(null);
      toast.success('Field updated');
    } else {
      await createField(data);
      setShowAdd(false);
      toast.success(`Field "${data.displayName}" added`);
    }
    resetForm();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    if (confirmDelete.fieldType === 'id') {
      toast.error('Cannot delete the ID field');
      setConfirmDelete(null);
      return;
    }
    await deleteField(confirmDelete.id);
    setConfirmDelete(null);
    toast.success('Field deleted');
  };

  // Drag-to-reorder
  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
    dragOrder.current = tableFields.map((f) => f.id);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = async (idx: number) => {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const order = [...dragOrder.current];
    const [moved] = order.splice(dragIdx, 1);
    order.splice(idx, 0, moved);
    setDragIdx(null);
    setDragOverIdx(null);
    await reorderFields(tableId, order);
    toast.success('Fields reordered');
  };

  const selectedFT = FIELD_TYPES.find((ft) => ft.value === fieldForm.fieldType);

  if (!table) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p style={{ color: 'var(--muted-foreground)' }}>Table not found.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 animate-slide-in-up">
        <button
          onClick={() => navigate(`/designer/${projectId}`)}
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--neo-raised)', boxShadow: 'var(--neo-shadow-raised-sm)', color: 'var(--muted-foreground)' }}
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: table.color }} />
            <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>
              {project?.name} / Table Designer
            </span>
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
            {table.displayName}
          </h1>
          <code className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
            {table.name} · {tableFields.length} fields
          </code>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openEditTable}
            className="neo-btn flex items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-lg"
            style={{ color: 'var(--muted-foreground)' }}
            title="Edit table name, type, and color"
          >
            <Edit3 size={14} />
            Edit Table
          </button>
          <button
            onClick={() => setMockDataOpen(true)}
            className="neo-btn flex items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-lg"
            style={{ color: '#f5a623' }}
            title="Generate mock data for this table using AI"
          >
            <Sparkles size={14} />
            Mock Data
          </button>
          <button
            onClick={openAdd}
            className="neo-btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg"
          >
            <Plus size={16} />
            Add Field
          </button>
        </div>
      </div>

      {/* Fields list */}
      <div className="neo-inset rounded-xl overflow-hidden">
        {/* Header row */}
        <div
          className="grid text-xs font-semibold uppercase tracking-wider px-4 py-2.5"
          style={{
            gridTemplateColumns: '32px 1fr 120px 80px 80px 80px 64px',
            color: 'var(--muted-foreground)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.65rem',
            borderBottom: '1px solid oklch(1 0 0 / 0.06)',
          }}
        >
          <span />
          <span>Field</span>
          <span>Type</span>
          <span>Required</span>
          <span>Unique</span>
          <span>Default</span>
          <span />
        </div>

        {tableFields.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No fields yet. Add your first field.</p>
          </div>
        ) : (
          tableFields.map((f, idx) => {
            const ft = FIELD_TYPES.find((x) => x.value === f.fieldType);
            const isDragging = dragIdx === idx;
            const isDragOver = dragOverIdx === idx;
            return (
              <div
                key={f.id}
                draggable={f.fieldType !== 'id'}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                className="grid items-center px-4 py-3 transition-all duration-120 group"
                style={{
                  gridTemplateColumns: '32px 1fr 120px 80px 80px 80px 64px',
                  borderBottom: '1px solid oklch(1 0 0 / 0.04)',
                  opacity: isDragging ? 0.5 : 1,
                  background: isDragOver ? 'var(--amber-soft)' : 'transparent',
                }}
              >
                {/* Drag handle */}
                <div className={f.fieldType === 'id' ? 'opacity-0' : 'drag-handle'}>
                  <GripVertical size={14} />
                </div>

                {/* Name */}
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="font-medium text-sm"
                      style={{ color: 'var(--foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}
                    >
                      {f.name}
                    </span>
                    {f.required && (
                      <span className="text-xs" style={{ color: 'var(--destructive)' }}>*</span>
                    )}
                  </div>
                  {f.displayName !== f.name && (
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
                      {f.displayName}
                    </span>
                  )}
                </div>

                {/* Type badge */}
                <div>
                  <span
                    className="field-type-badge inline-flex items-center gap-1"
                    style={{
                      background: `${ft?.color ?? '#6366f1'}22`,
                      color: ft?.color ?? '#6366f1',
                    }}
                  >
                    {ft?.icon}
                    {f.fieldType}
                  </span>
                </div>

                {/* Required */}
                <div>
                  <span
                    className="text-xs font-semibold"
                    style={{
                      color: f.required ? '#10b981' : 'var(--muted-foreground)',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    {f.required ? 'YES' : 'NO'}
                  </span>
                </div>

                {/* Unique */}
                <div>
                  <span
                    className="text-xs font-semibold"
                    style={{
                      color: f.unique ? '#6366f1' : 'var(--muted-foreground)',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    {f.unique ? 'YES' : 'NO'}
                  </span>
                </div>

                {/* Default */}
                <div>
                  <span
                    className="text-xs truncate block max-w-[72px]"
                    style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}
                  >
                    {f.defaultValue ?? '—'}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(f)}
                    className="w-6 h-6 rounded flex items-center justify-center"
                    style={{ color: 'var(--muted-foreground)', background: 'oklch(1 0 0 / 0.06)' }}
                  >
                    <Edit3 size={11} />
                  </button>
                  {f.fieldType !== 'id' && (
                    <button
                      onClick={() => setConfirmDelete(f)}
                      className="w-6 h-6 rounded flex items-center justify-center"
                      style={{ color: 'var(--destructive)', background: 'oklch(1 0 0 / 0.06)' }}
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Field Form Dialog */}
      <Dialog open={showAdd || !!editField} onOpenChange={() => { setShowAdd(false); setEditField(null); resetForm(); }}>
        <DialogContent
          className="max-w-xl max-h-[90vh] overflow-y-auto"
          style={{ background: 'var(--neo-raised)', border: '1px solid oklch(1 0 0 / 0.07)', boxShadow: 'var(--neo-shadow-raised)' }}
        >
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
              {editField ? 'Edit Field' : 'Add Field'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Display name + name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>DISPLAY NAME *</label>
                <input
                  className="neo-input w-full px-3 py-2 text-sm rounded-lg"
                  value={fieldForm.displayName ?? ''}
                  onChange={(e) => setFieldForm({ ...fieldForm, displayName: e.target.value })}
                  placeholder="First Name"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>FIELD NAME</label>
                <input
                  className="neo-input w-full px-3 py-2 text-sm rounded-lg"
                  value={fieldForm.name ?? ''}
                  onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') })}
                  placeholder="first_name"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                />
              </div>
            </div>

            {/* Field type selector */}
            <div>
              <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>FIELD TYPE</label>
              <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {FIELD_TYPES.map((ft) => (
                  <button
                    key={ft.value}
                    onClick={() => setFieldForm({ ...fieldForm, fieldType: ft.value })}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all duration-120"
                    style={{
                      background: fieldForm.fieldType === ft.value ? `${ft.color}22` : 'oklch(1 0 0 / 0.03)',
                      border: `1px solid ${fieldForm.fieldType === ft.value ? ft.color + '55' : 'oklch(1 0 0 / 0.06)'}`,
                    }}
                  >
                    <span style={{ color: ft.color }}>{ft.icon}</span>
                    <span className="text-xs font-medium truncate" style={{ color: fieldForm.fieldType === ft.value ? ft.color : 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>
                      {ft.label}
                    </span>
                  </button>
                ))}
              </div>
              {selectedFT && (
                <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)' }}>{selectedFT.desc}</p>
              )}
            </div>

            {/* Options row */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  className="w-4 h-4 rounded flex items-center justify-center transition-all"
                  style={{
                    background: fieldForm.required ? '#10b981' : 'var(--neo-inset)',
                    boxShadow: fieldForm.required ? '0 0 6px rgba(16,185,129,0.3)' : 'var(--neo-shadow-inset-sm)',
                  }}
                  onClick={() => setFieldForm({ ...fieldForm, required: !fieldForm.required })}
                >
                  {fieldForm.required && <span className="text-white text-xs">✓</span>}
                </div>
                <span className="text-sm" style={{ color: 'var(--foreground)', fontFamily: 'Inter, sans-serif' }}>Required</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  className="w-4 h-4 rounded flex items-center justify-center transition-all"
                  style={{
                    background: fieldForm.unique ? '#6366f1' : 'var(--neo-inset)',
                    boxShadow: fieldForm.unique ? '0 0 6px rgba(99,102,241,0.3)' : 'var(--neo-shadow-inset-sm)',
                  }}
                  onClick={() => setFieldForm({ ...fieldForm, unique: !fieldForm.unique })}
                >
                  {fieldForm.unique && <span className="text-white text-xs">✓</span>}
                </div>
                <span className="text-sm" style={{ color: 'var(--foreground)', fontFamily: 'Inter, sans-serif' }}>Unique</span>
              </label>
            </div>

            {/* Default value */}
            {!['id', 'image', 'file', 'foreign_key', 'lov'].includes(fieldForm.fieldType ?? '') && (
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>DEFAULT VALUE</label>
                <input
                  className="neo-input w-full px-3 py-2 text-sm rounded-lg"
                  value={fieldForm.defaultValue ?? ''}
                  onChange={(e) => setFieldForm({ ...fieldForm, defaultValue: e.target.value || null })}
                  placeholder="Leave empty for no default"
                />
              </div>
            )}

            {/* Text constraints */}
            {['text', 'email', 'url'].includes(fieldForm.fieldType ?? '') && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>MAX LENGTH</label>
                  <input
                    type="number"
                    className="neo-input w-full px-3 py-2 text-sm rounded-lg"
                    value={fieldForm.maxLength ?? ''}
                    onChange={(e) => setFieldForm({ ...fieldForm, maxLength: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="255"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>MIN LENGTH</label>
                  <input
                    type="number"
                    className="neo-input w-full px-3 py-2 text-sm rounded-lg"
                    value={fieldForm.minLength ?? ''}
                    onChange={(e) => setFieldForm({ ...fieldForm, minLength: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="0"
                  />
                </div>
              </div>
            )}

            {/* Number constraints */}
            {['number', 'decimal'].includes(fieldForm.fieldType ?? '') && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>MIN VALUE</label>
                  <input
                    type="number"
                    className="neo-input w-full px-3 py-2 text-sm rounded-lg"
                    value={fieldForm.min ?? ''}
                    onChange={(e) => setFieldForm({ ...fieldForm, min: e.target.value ? parseFloat(e.target.value) : undefined })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>MAX VALUE</label>
                  <input
                    type="number"
                    className="neo-input w-full px-3 py-2 text-sm rounded-lg"
                    value={fieldForm.max ?? ''}
                    onChange={(e) => setFieldForm({ ...fieldForm, max: e.target.value ? parseFloat(e.target.value) : undefined })}
                  />
                </div>
              </div>
            )}

            {/* LOV values */}
            {fieldForm.fieldType === 'lov' && (
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
                  LOV VALUES (one per line: value:Label)
                </label>
                <textarea
                  className="neo-input w-full px-3 py-2 text-sm rounded-lg resize-none"
                  rows={5}
                  value={lovInput}
                  onChange={(e) => setLovInput(e.target.value)}
                  placeholder={'active:Active\ninactive:Inactive\npending:Pending'}
                  style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}
                />
              </div>
            )}

            {/* Foreign key configuration */}
            {fieldForm.fieldType === 'foreign_key' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>REFERENCED TABLE</label>
                  <select
                    className="neo-input w-full px-3 py-2 text-sm rounded-lg"
                    value={fieldForm.referencedTableId ?? ''}
                    onChange={(e) => setFieldForm({ ...fieldForm, referencedTableId: e.target.value, referencedFieldId: '', displayFieldId: '' })}
                  >
                    <option value="">Select table...</option>
                    {tables.filter((t) => t.projectId === projectId).map((t) => (
                      <option key={t.id} value={t.id}>{t.displayName}</option>
                    ))}
                  </select>
                </div>
                {fieldForm.referencedTableId && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>KEY FIELD</label>
                      <select
                        className="neo-input w-full px-3 py-2 text-sm rounded-lg"
                        value={fieldForm.referencedFieldId ?? ''}
                        onChange={(e) => setFieldForm({ ...fieldForm, referencedFieldId: e.target.value })}
                      >
                        <option value="">Select field...</option>
                        {fields.filter((f) => f.tableId === fieldForm.referencedTableId).map((f) => (
                          <option key={f.id} value={f.id}>{f.displayName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>DISPLAY FIELD</label>
                      <select
                        className="neo-input w-full px-3 py-2 text-sm rounded-lg"
                        value={fieldForm.displayFieldId ?? ''}
                        onChange={(e) => setFieldForm({ ...fieldForm, displayFieldId: e.target.value })}
                      >
                        <option value="">Same as key</option>
                        {fields.filter((f) => f.tableId === fieldForm.referencedTableId).map((f) => (
                          <option key={f.id} value={f.id}>{f.displayName}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Placeholder + help */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>PLACEHOLDER</label>
                <input
                  className="neo-input w-full px-3 py-2 text-sm rounded-lg"
                  value={fieldForm.placeholder ?? ''}
                  onChange={(e) => setFieldForm({ ...fieldForm, placeholder: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>HELP TEXT</label>
                <input
                  className="neo-input w-full px-3 py-2 text-sm rounded-lg"
                  value={fieldForm.helpText ?? ''}
                  onChange={(e) => setFieldForm({ ...fieldForm, helpText: e.target.value })}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>DESCRIPTION</label>
              <input
                className="neo-input w-full px-3 py-2 text-sm rounded-lg"
                value={fieldForm.description ?? ''}
                onChange={(e) => setFieldForm({ ...fieldForm, description: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button
              onClick={() => { setShowAdd(false); setEditField(null); resetForm(); }}
              className="neo-btn px-4 py-2 text-sm rounded-lg"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!fieldForm.displayName?.trim()}
              className="neo-btn-primary flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
            >
              <Save size={14} />
              {editField ? 'Save' : 'Add Field'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Table Dialog */}
      <Dialog open={showEditTable} onOpenChange={() => setShowEditTable(false)}>
        <DialogContent style={{ background: 'var(--neo-raised)', border: '1px solid oklch(1 0 0 / 0.07)', boxShadow: 'var(--neo-shadow-raised)' }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>Edit Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>DISPLAY NAME *</label>
                <input
                  className="neo-input w-full px-3 py-2 text-sm rounded-lg"
                  value={tableForm.displayName}
                  onChange={(e) => setTableForm({ ...tableForm, displayName: e.target.value })}
                  placeholder="My Table"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>TABLE NAME</label>
                <input
                  className="neo-input w-full px-3 py-2 text-sm rounded-lg"
                  value={tableForm.name}
                  onChange={(e) => setTableForm({ ...tableForm, name: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') })}
                  placeholder="my_table"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>TABLE TYPE</label>
              <div className="grid grid-cols-2 gap-2">
                {TABLE_TYPES.map((tt) => (
                  <button
                    key={tt.value}
                    onClick={() => setTableForm({ ...tableForm, tableType: tt.value })}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all duration-120"
                    style={{
                      background: tableForm.tableType === tt.value ? `${tt.color}22` : 'oklch(1 0 0 / 0.03)',
                      border: `1px solid ${tableForm.tableType === tt.value ? tt.color + '55' : 'oklch(1 0 0 / 0.06)'}`,
                    }}
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tt.color }} />
                    <div>
                      <div className="text-xs font-semibold" style={{ color: tableForm.tableType === tt.value ? tt.color : 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>{tt.label}</div>
                      <div className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>{tt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>COLOR</label>
              <div className="flex gap-2 flex-wrap">
                {TABLE_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setTableForm({ ...tableForm, color: c })}
                    className="w-6 h-6 rounded-full transition-all"
                    style={{
                      background: c,
                      boxShadow: tableForm.color === c ? `0 0 0 2px var(--background), 0 0 0 4px ${c}` : 'none',
                      transform: tableForm.color === c ? 'scale(1.2)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button onClick={() => setShowEditTable(false)} className="neo-btn px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--muted-foreground)' }}>Cancel</button>
            <button
              onClick={handleSaveTable}
              disabled={!tableForm.displayName.trim()}
              className="neo-btn-primary flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
            >
              <Save size={14} />
              Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent style={{ background: 'var(--neo-raised)', border: '1px solid oklch(1 0 0 / 0.07)', boxShadow: 'var(--neo-shadow-raised)' }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>Delete Field</DialogTitle>
          </DialogHeader>
          <p className="text-sm py-2" style={{ color: 'var(--muted-foreground)' }}>
            Delete field <strong style={{ color: 'var(--foreground)', fontFamily: 'JetBrains Mono, monospace' }}>{confirmDelete?.name}</strong>? This cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <button onClick={() => setConfirmDelete(null)} className="neo-btn px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--muted-foreground)' }}>Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 text-sm font-semibold rounded-lg" style={{ background: 'var(--destructive)', color: 'white' }}>Delete</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mock Data Generator Dialog */}
      <MockDataGeneratorDialog
        open={mockDataOpen}
        onOpenChange={setMockDataOpen}
        projectId={projectId!}
        table={table}
        fields={tableFields}
        onSeeded={(count) => {
          // Optionally refresh the field list or show a toast
          console.log(`Seeded ${count} rows into ${table.name}`);
        }}
      />
    </div>
  );
}
