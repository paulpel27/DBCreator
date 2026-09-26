/**
 * FormsPage — Form designer and list
 * Obsidian Forge: drag-and-drop form builder with field widgets
 */
import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { FileText, Plus, Trash2, Edit3, Play, ChevronLeft, Settings, GripVertical, Eye } from 'lucide-react';
import { useDB } from '@/contexts/DBContext';
import type { DBForm, FormField, FormFieldWidget } from '@/lib/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';

const WIDGET_OPTIONS: { value: FormFieldWidget; label: string }[] = [
  { value: 'input', label: 'Text Input' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'number_input', label: 'Number Input' },
  { value: 'select', label: 'Dropdown Select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio Group' },
  { value: 'date_picker', label: 'Date Picker' },
  { value: 'image_upload', label: 'Image Upload' },
  { value: 'file_upload', label: 'File Upload' },
  { value: 'color_picker', label: 'Color Picker' },
  { value: 'rich_text', label: 'Rich Text Editor' },
  { value: 'lookup', label: 'Lookup / FK' },
];

const FIELD_TYPE_TO_WIDGET: Record<string, FormFieldWidget> = {
  id: 'input',
  text: 'input',
  large_text: 'textarea',
  number: 'number_input',
  decimal: 'number_input',
  boolean: 'checkbox',
  date: 'date_picker',
  datetime: 'date_picker',
  time: 'input',
  image: 'image_upload',
  file: 'file_upload',
  foreign_key: 'lookup',
  lov: 'select',
  email: 'input',
  url: 'input',
  color: 'color_picker',
  json: 'textarea',
};

export default function FormsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, navigate] = useLocation();
  const { projects, tables, fields, forms, createForm, updateForm, deleteForm } = useDB();

  const project = projects.find((p) => p.id === projectId);
  const projectForms = forms.filter((f) => f.projectId === projectId).sort((a, b) => a.sortOrder - b.sortOrder);
  const projectTables = tables.filter((t) => t.projectId === projectId);

  const [showCreate, setShowCreate] = useState(false);
  const [editForm, setEditForm] = useState<DBForm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DBForm | null>(null);
  const [formData, setFormData] = useState({
    tableId: '',
    displayName: '',
    description: '',
    columns: 2,
    allowCreate: true,
    allowEdit: true,
    allowDelete: true,
    allowSearch: true,
    detailFormIds: [] as string[],
  });
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const getTableName = (id: string) => tables.find((t) => t.id === id)?.displayName ?? id;
  const getTableFields = (tableId: string) => fields.filter((f) => f.tableId === tableId);

  const autoGenerateFields = (tableId: string) => {
    const tFields = getTableFields(tableId);
    return tFields.map((f, idx): FormField => ({
      id: nanoid(),
      fieldId: f.id,
      widget: FIELD_TYPE_TO_WIDGET[f.fieldType] ?? 'input',
      label: f.displayName,
      placeholder: f.placeholder ?? '',
      helpText: f.helpText ?? '',
      colSpan: f.fieldType === 'large_text' || f.fieldType === 'json' ? 2 : 1,
      row: Math.floor(idx / 2),
      col: idx % 2,
      visible: true,
      readOnly: f.fieldType === 'id',
      required: f.required,
      defaultValue: f.defaultValue ?? '',
      styleOverride: '{}',
    }));
  };

  const handleTableChange = (tableId: string) => {
    setFormData({ ...formData, tableId });
    setFormFields(autoGenerateFields(tableId));
  };

  const handleCreate = async () => {
    if (!formData.tableId || !formData.displayName.trim()) return;
    const safeName = formData.displayName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    await createForm({
      projectId,
      tableId: formData.tableId,
      name: safeName,
      displayName: formData.displayName.trim(),
      description: formData.description.trim(),
      formFields: JSON.stringify(formFields),
      columns: formData.columns,
      allowCreate: formData.allowCreate,
      allowEdit: formData.allowEdit,
      allowDelete: formData.allowDelete,
      allowSearch: formData.allowSearch,
      detailFormIds: formData.detailFormIds.length > 0 ? JSON.stringify(formData.detailFormIds) : undefined,
    });
    setShowCreate(false);
    resetFormState();
    toast.success('Form created');
  };

  const handleEdit = async () => {
    if (!editForm) return;
    await updateForm({
      ...editForm,
      tableId: formData.tableId,
      displayName: formData.displayName.trim(),
      description: formData.description.trim(),
      formFields: JSON.stringify(formFields),
      columns: formData.columns,
      allowCreate: formData.allowCreate,
      allowEdit: formData.allowEdit,
      allowDelete: formData.allowDelete,
      allowSearch: formData.allowSearch,
      detailFormIds: formData.detailFormIds.length > 0 ? JSON.stringify(formData.detailFormIds) : undefined,
    });
    setEditForm(null);
    toast.success('Form updated');
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteForm(confirmDelete.id);
    setConfirmDelete(null);
    toast.success('Form deleted');
  };

  const openEdit = (f: DBForm) => {
    setEditForm(f);
    let parsedDetailIds: string[] = [];
    try { parsedDetailIds = f.detailFormIds ? JSON.parse(f.detailFormIds) : []; } catch {}
    setFormData({
      tableId: f.tableId,
      displayName: f.displayName,
      description: f.description,
      columns: f.columns,
      allowCreate: f.allowCreate,
      allowEdit: f.allowEdit,
      allowDelete: f.allowDelete,
      allowSearch: f.allowSearch,
      detailFormIds: parsedDetailIds,
    });
    try {
      setFormFields(JSON.parse(f.formFields) as FormField[]);
    } catch {
      setFormFields([]);
    }
  };

  const resetFormState = () => {
    setFormData({ tableId: '', displayName: '', description: '', columns: 2, allowCreate: true, allowEdit: true, allowDelete: true, allowSearch: true, detailFormIds: [] });
    setFormFields([]);
  };

  const toggleFieldVisible = (id: string) => {
    setFormFields((prev) => prev.map((f) => f.id === id ? { ...f, visible: !f.visible } : f));
  };

  const toggleFieldReadOnly = (id: string) => {
    setFormFields((prev) => prev.map((f) => f.id === id ? { ...f, readOnly: !f.readOnly } : f));
  };

  const updateFieldWidget = (id: string, widget: FormFieldWidget) => {
    setFormFields((prev) => prev.map((f) => f.id === id ? { ...f, widget } : f));
  };

  const updateFieldColSpan = (id: string, colSpan: number) => {
    setFormFields((prev) => prev.map((f) => f.id === id ? { ...f, colSpan } : f));
  };

  // Drag reorder
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    const arr = [...formFields];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(idx, 0, moved);
    setFormFields(arr);
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const getFieldName = (fieldId: string) => fields.find((f) => f.id === fieldId)?.displayName ?? fieldId;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 animate-slide-in-up">
        <button onClick={() => navigate(`/designer/${projectId}`)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: 'var(--muted-foreground)', background: 'var(--neo-raised)', boxShadow: 'var(--neo-shadow-raised-sm)' }}>
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>{project?.name}</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>Form Designer</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{projectForms.length} form{projectForms.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { setShowCreate(true); resetFormState(); }} className="neo-btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg">
          <Plus size={16} />New Form
        </button>
      </div>

      {/* Forms list */}
      {projectForms.length === 0 ? (
        <div className="animate-fade-in">
          <div className="rounded-2xl p-8" style={{ background: 'var(--neo-inset)', boxShadow: 'var(--neo-shadow-inset)' }}>
            {/* Form canvas motif */}
            <div className="flex justify-center mb-6">
              <svg width="200" height="90" viewBox="0 0 200 90" fill="none" opacity="0.6">
                {/* Form outline */}
                <rect x="20" y="5" width="160" height="80" rx="5" fill="none" stroke="rgba(245,166,35,0.3)" strokeWidth="1" />
                {/* Header bar */}
                <rect x="20" y="5" width="160" height="16" rx="5" fill="rgba(245,166,35,0.12)" />
                <text x="100" y="17" textAnchor="middle" fill="rgba(245,166,35,0.8)" fontSize="7" fontFamily="JetBrains Mono">FORM TITLE</text>
                {/* Field rows */}
                <rect x="30" y="30" width="60" height="8" rx="2" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                <rect x="100" y="30" width="70" height="8" rx="2" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                <rect x="30" y="45" width="60" height="8" rx="2" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                <rect x="100" y="45" width="70" height="8" rx="2" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                <rect x="30" y="60" width="60" height="8" rx="2" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                <rect x="100" y="60" width="70" height="8" rx="2" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                {/* Save button */}
                <rect x="140" y="75" width="32" height="8" rx="2" fill="rgba(245,166,35,0.4)" />
                <text x="156" y="81" textAnchor="middle" fill="rgba(245,166,35,0.9)" fontSize="5" fontFamily="JetBrains Mono">SAVE</text>
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-lg font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>No forms yet</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>Create forms to enter and manage data in your tables.</p>
              <button onClick={() => setShowCreate(true)} className="neo-btn-primary px-6 py-2.5 text-sm font-semibold rounded-lg">Create Form</button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: 'Data Entry', desc: 'Standard input form', color: '#f5a623' },
              { label: 'Master-Detail', desc: 'Parent + child rows', color: '#6366f1' },
              { label: 'LOV Lookup', desc: 'Dropdown from table', color: '#10b981' },
            ].map((t) => (
              <div key={t.label} className="rounded-xl p-3" style={{ background: 'var(--neo-raised)', boxShadow: 'var(--neo-shadow-raised)', borderTop: `2px solid ${t.color}` }}>
                <div className="text-xs font-bold mb-0.5" style={{ fontFamily: 'Space Grotesk, sans-serif', color: t.color }}>{t.label}</div>
                <div className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {projectForms.map((form) => {
            let parsedFields: FormField[] = [];
            try { parsedFields = JSON.parse(form.formFields); } catch {}
            return (
              <div key={form.id} className="neo-raised rounded-xl overflow-hidden group">
                <div className="h-1" style={{ background: 'var(--amber)', boxShadow: '0 0 8px rgba(245,166,35,0.3)' }} />
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-sm" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>{form.displayName}</h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        Table: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{getTableName(form.tableId)}</span>
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(form)} className="w-6 h-6 rounded flex items-center justify-center" style={{ color: 'var(--muted-foreground)', background: 'oklch(1 0 0 / 0.05)' }}>
                        <Edit3 size={11} />
                      </button>
                      <button onClick={() => setConfirmDelete(form)} className="w-6 h-6 rounded flex items-center justify-center" style={{ color: 'var(--destructive)', background: 'oklch(1 0 0 / 0.05)' }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap mb-3">
                    {form.allowCreate && <span className="field-type-badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>Create</span>}
                    {form.allowEdit && <span className="field-type-badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>Edit</span>}
                    {form.allowDelete && <span className="field-type-badge" style={{ background: 'rgba(224,85,85,0.15)', color: '#e05555' }}>Delete</span>}
                    {form.allowSearch && <span className="field-type-badge" style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}>Search</span>}
                  </div>
                  <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>
                    {parsedFields.filter((f) => f.visible).length} visible fields · {form.columns} cols
                  </p>
                  <button
                    onClick={() => navigate(`/run/${projectId}/${form.id}`)}
                    className="neo-btn-primary w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg"
                  >
                    <Play size={12} />Run Form
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate || !!editForm} onOpenChange={() => { setShowCreate(false); setEditForm(null); }}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          style={{ background: 'var(--neo-raised)', border: '1px solid oklch(1 0 0 / 0.07)', boxShadow: 'var(--neo-shadow-raised)' }}
        >
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
              {editForm ? 'Edit Form' : 'Create Form'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>FORM NAME *</label>
                <input
                  className="neo-input w-full px-3 py-2 text-sm rounded-lg"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="Customer Entry Form"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>TABLE *</label>
                <select
                  className="neo-input w-full px-3 py-2 text-sm rounded-lg"
                  value={formData.tableId}
                  onChange={(e) => handleTableChange(e.target.value)}
                >
                  <option value="">Select table...</option>
                  {projectTables.map((t) => (
                    <option key={t.id} value={t.id}>{t.displayName}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Columns + permissions */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>COLUMNS:</label>
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => setFormData({ ...formData, columns: n })}
                    className="w-7 h-7 rounded text-xs font-bold transition-all"
                    style={{
                      background: formData.columns === n ? 'var(--amber)' : 'oklch(1 0 0 / 0.05)',
                      color: formData.columns === n ? '#1e1e2e' : 'var(--muted-foreground)',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {(['allowCreate', 'allowEdit', 'allowDelete', 'allowSearch'] as const).map((key) => (
                <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                  <div
                    className="w-3.5 h-3.5 rounded flex items-center justify-center"
                    style={{
                      background: formData[key] ? 'var(--amber)' : 'var(--neo-inset)',
                      boxShadow: formData[key] ? '0 0 4px rgba(245,166,35,0.3)' : 'var(--neo-shadow-inset-sm)',
                    }}
                    onClick={() => setFormData({ ...formData, [key]: !formData[key] })}
                  >
                    {formData[key] && <span className="text-[#1e1e2e] text-xs font-bold leading-none">✓</span>}
                  </div>
                  <span className="text-xs capitalize" style={{ color: 'var(--foreground)' }}>
                    {key.replace('allow', '')}
                  </span>
                </label>
              ))}
            </div>

            {/* Field designer */}
            {formFields.length > 0 && (
              <div className="space-y-0">
                <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
                  FORM FIELDS ({formFields.length})
                </label>
                <div className="neo-inset rounded-xl overflow-hidden">
                  <div
                    className="grid text-xs font-semibold uppercase tracking-wider px-3 py-2"
                    style={{
                      gridTemplateColumns: '24px 1fr 140px 60px 60px 60px',
                      color: 'var(--muted-foreground)',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '0.6rem',
                      borderBottom: '1px solid oklch(1 0 0 / 0.06)',
                    }}
                  >
                    <span />
                    <span>Field</span>
                    <span>Widget</span>
                    <span>Span</span>
                    <span>Visible</span>
                    <span>R/O</span>
                  </div>
                  {formFields.map((ff, idx) => (
                    <div
                      key={ff.id}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={() => handleDrop(idx)}
                      onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                      className="grid items-center px-3 py-2 transition-all"
                      style={{
                        gridTemplateColumns: '24px 1fr 140px 60px 60px 60px',
                        borderBottom: '1px solid oklch(1 0 0 / 0.04)',
                        opacity: dragIdx === idx ? 0.5 : 1,
                        background: dragOverIdx === idx ? 'var(--amber-soft)' : 'transparent',
                      }}
                    >
                      <div className="drag-handle"><GripVertical size={12} /></div>
                      <span className="text-xs truncate" style={{ color: 'var(--foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
                        {getFieldName(ff.fieldId)}
                      </span>
                      <select
                        className="neo-input px-1.5 py-1 text-xs rounded"
                        value={ff.widget}
                        onChange={(e) => updateFieldWidget(ff.id, e.target.value as FormFieldWidget)}
                        style={{ fontSize: '0.7rem' }}
                      >
                        {WIDGET_OPTIONS.map((w) => (
                          <option key={w.value} value={w.value}>{w.label}</option>
                        ))}
                      </select>
                      <select
                        className="neo-input px-1.5 py-1 text-xs rounded"
                        value={ff.colSpan}
                        onChange={(e) => updateFieldColSpan(ff.id, parseInt(e.target.value))}
                        style={{ fontSize: '0.7rem' }}
                      >
                        {[1, 2, 3, 4].map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => toggleFieldVisible(ff.id)}
                        className="text-xs font-semibold"
                        style={{ color: ff.visible ? '#10b981' : 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}
                      >
                        {ff.visible ? 'YES' : 'NO'}
                      </button>
                      <button
                        onClick={() => toggleFieldReadOnly(ff.id)}
                        className="text-xs font-semibold"
                        style={{ color: ff.readOnly ? '#6366f1' : 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}
                      >
                        {ff.readOnly ? 'YES' : 'NO'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Master-Detail configuration */}
          <div className="space-y-5 py-2">
            <div>
              <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>DETAIL FORMS (Master-Detail)</label>
              <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>
                Link detail forms to this master form. When running, a split-panel layout will show master records on the left and linked detail records on the right.
              </p>
              <div className="space-y-1.5">
                {projectForms
                  .filter((f) => f.id !== editForm?.id && !f.detailFormIds)
                  .map((f) => {
                    const isLinked = formData.detailFormIds.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        onClick={() => {
                          if (isLinked) {
                            setFormData({ ...formData, detailFormIds: formData.detailFormIds.filter((id) => id !== f.id) });
                          } else {
                            setFormData({ ...formData, detailFormIds: [...formData.detailFormIds, f.id] });
                          }
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-120"
                        style={{
                          background: isLinked ? 'rgba(99,102,241,0.12)' : 'oklch(1 0 0 / 0.03)',
                          border: `1px solid ${isLinked ? '#6366f155' : 'oklch(1 0 0 / 0.06)'}`,
                        }}
                      >
                        <div
                          className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                          style={{ background: isLinked ? '#6366f1' : 'var(--neo-inset)', boxShadow: isLinked ? '0 0 4px rgba(99,102,241,0.3)' : 'var(--neo-shadow-inset-sm)' }}
                        >
                          {isLinked && <span className="text-white text-xs font-bold leading-none">✓</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold" style={{ color: isLinked ? '#6366f1' : 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>{f.displayName}</span>
                          <span className="text-xs ml-2" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>
                            {getTableName(f.tableId)}
                          </span>
                        </div>
                        {isLinked && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}>DETAIL</span>
                        )}
                      </button>
                    );
                  })}
                {projectForms.filter((f) => f.id !== editForm?.id && !f.detailFormIds).length === 0 && (
                  <p className="text-xs py-2" style={{ color: 'var(--muted-foreground)' }}>No other forms available to link as detail forms.</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button onClick={() => { setShowCreate(false); setEditForm(null); }} className="neo-btn px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--muted-foreground)' }}>Cancel</button>
            <button
              onClick={editForm ? handleEdit : handleCreate}
              disabled={!formData.tableId || !formData.displayName.trim()}
              className="neo-btn-primary px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
            >
              {editForm ? 'Save' : 'Create'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent style={{ background: 'var(--neo-raised)', border: '1px solid oklch(1 0 0 / 0.07)' }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>Delete Form</DialogTitle>
          </DialogHeader>
          <p className="text-sm py-2" style={{ color: 'var(--muted-foreground)' }}>
            Delete form <strong style={{ color: 'var(--foreground)' }}>{confirmDelete?.displayName}</strong>?
          </p>
          <DialogFooter className="gap-2">
            <button onClick={() => setConfirmDelete(null)} className="neo-btn px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--muted-foreground)' }}>Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 text-sm font-semibold rounded-lg" style={{ background: 'var(--destructive)', color: 'white' }}>Delete</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
