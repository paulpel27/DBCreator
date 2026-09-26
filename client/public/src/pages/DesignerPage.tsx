/**
 * DesignerPage — Table list for a project
 * Obsidian Forge: neomorphic table cards with field counts and type badges
 */
import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  Table2, Plus, Trash2, Edit3, ChevronRight,
  Hash, Type, Calendar, Image, Link2, List, AlignLeft, Key
} from 'lucide-react';
import { useDB } from '@/contexts/DBContext';
import type { DBTable, TableType } from '@/lib/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

const FIELD_TYPE_ICONS: Record<string, React.ReactNode> = {
  id: <Key size={11} />,
  text: <Type size={11} />,
  large_text: <AlignLeft size={11} />,
  number: <Hash size={11} />,
  decimal: <Hash size={11} />,
  boolean: <List size={11} />,
  date: <Calendar size={11} />,
  datetime: <Calendar size={11} />,
  time: <Calendar size={11} />,
  image: <Image size={11} />,
  file: <Image size={11} />,
  foreign_key: <Link2 size={11} />,
  lov: <List size={11} />,
  email: <Type size={11} />,
  url: <Link2 size={11} />,
  color: <Type size={11} />,
  json: <AlignLeft size={11} />,
};

const FIELD_TYPE_COLORS: Record<string, string> = {
  id: '#f5a623',
  text: '#6366f1',
  large_text: '#6366f1',
  number: '#10b981',
  decimal: '#10b981',
  boolean: '#8b5cf6',
  date: '#06b6d4',
  datetime: '#06b6d4',
  time: '#06b6d4',
  image: '#ec4899',
  file: '#ec4899',
  foreign_key: '#f59e0b',
  lov: '#f59e0b',
  email: '#6366f1',
  url: '#6366f1',
  color: '#ec4899',
  json: '#84cc16',
};

export default function DesignerPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, navigate] = useLocation();
  const { projects, tables, fields, createTable, updateTable, deleteTable } = useDB();

  const project = projects.find((p) => p.id === projectId);
  const projectTables = tables
    .filter((t) => t.projectId === projectId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const [showCreate, setShowCreate] = useState(false);
  const [editTable, setEditTable] = useState<DBTable | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DBTable | null>(null);
  const [form, setForm] = useState({ name: '', displayName: '', description: '', tableType: 'standard' as TableType, color: TABLE_COLORS[0] });

  const resetForm = () => setForm({ name: '', displayName: '', description: '', tableType: 'standard', color: TABLE_COLORS[0] });

  const handleCreate = async () => {
    if (!form.displayName.trim()) return;
    const safeName = form.name.trim() || form.displayName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const t = await createTable({
      projectId,
      name: safeName,
      displayName: form.displayName.trim(),
      description: form.description.trim(),
      tableType: form.tableType,
      color: form.color,
    });
    setShowCreate(false);
    resetForm();
    toast.success(`Table "${t.displayName}" created`);
    navigate(`/tables/${projectId}/${t.id}`);
  };

  const handleEdit = async () => {
    if (!editTable || !form.displayName.trim()) return;
    await updateTable({
      ...editTable,
      name: form.name.trim() || editTable.name,
      displayName: form.displayName.trim(),
      description: form.description.trim(),
      tableType: form.tableType,
      color: form.color,
    });
    setEditTable(null);
    toast.success('Table updated');
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteTable(confirmDelete.id);
    setConfirmDelete(null);
    toast.success(`Table "${confirmDelete.displayName}" deleted`);
  };

  const openEdit = (t: DBTable) => {
    setEditTable(t);
    setForm({ name: t.name, displayName: t.displayName, description: t.description, tableType: t.tableType, color: t.color });
  };

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p style={{ color: 'var(--muted-foreground)' }}>Project not found.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-slide-in-up">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ background: project.color, boxShadow: `0 0 8px ${project.color}66` }}
            />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>
              {project.name}
            </span>
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
            Table Designer
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {projectTables.length} table{projectTables.length !== 1 ? 's' : ''} defined
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(true); resetForm(); }}
          className="neo-btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          <Plus size={16} />
          New Table
        </button>
      </div>

      {/* Tables grid */}
      {projectTables.length === 0 ? (
        <div className="neo-inset rounded-2xl p-12 text-center animate-fade-in">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--amber-soft)' }}
          >
            <Table2 size={24} style={{ color: 'var(--amber)' }} />
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
            No tables yet
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
            Add your first table to start defining your schema.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="neo-btn-primary px-6 py-2.5 text-sm font-semibold rounded-lg"
          >
            Create Table
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {projectTables.map((table) => {
            const tableFields = fields.filter((f) => f.tableId === table.id);
            const tableType = TABLE_TYPES.find((tt) => tt.value === table.tableType);
            return (
              <div
                key={table.id}
                className="neo-raised rounded-xl overflow-hidden cursor-pointer group transition-all duration-200"
                style={{ transitionTimingFunction: 'var(--ease-neo)' }}
                onClick={() => navigate(`/tables/${projectId}/${table.id}`)}
              >
                {/* Color accent */}
                <div className="h-1" style={{ background: table.color, boxShadow: `0 0 8px ${table.color}44` }} />

                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          background: `${table.color}22`,
                          boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.3)',
                        }}
                      >
                        <Table2 size={16} style={{ color: table.color }} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
                          {table.displayName}
                        </h3>
                        <code className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>
                          {table.name}
                        </code>
                      </div>
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openEdit(table)}
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{ color: 'var(--muted-foreground)', background: 'oklch(1 0 0 / 0.05)' }}
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(table)}
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{ color: 'var(--destructive)', background: 'oklch(1 0 0 / 0.05)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Table type badge */}
                  {tableType && (
                    <span
                      className="field-type-badge inline-flex items-center gap-1 mb-3"
                      style={{ background: `${tableType.color}22`, color: tableType.color }}
                    >
                      {tableType.label}
                    </span>
                  )}

                  {/* Field preview */}
                  <div className="space-y-1">
                    {tableFields.slice(0, 4).map((f) => (
                      <div key={f.id} className="flex items-center gap-2">
                        <span
                          className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                          style={{ background: `${FIELD_TYPE_COLORS[f.fieldType] ?? '#6366f1'}22`, color: FIELD_TYPE_COLORS[f.fieldType] ?? '#6366f1' }}
                        >
                          {FIELD_TYPE_ICONS[f.fieldType]}
                        </span>
                        <span className="text-xs truncate" style={{ color: 'var(--foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem' }}>
                          {f.name}
                        </span>
                        <span className="text-xs ml-auto flex-shrink-0" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>
                          {f.fieldType}
                        </span>
                      </div>
                    ))}
                    {tableFields.length > 4 && (
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem' }}>
                        +{tableFields.length - 4} more fields
                      </p>
                    )}
                    {tableFields.length === 0 && (
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>No fields defined</p>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid oklch(1 0 0 / 0.06)' }}>
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem' }}>
                      {tableFields.length} field{tableFields.length !== 1 ? 's' : ''}
                    </span>
                    <ChevronRight size={14} style={{ color: 'var(--muted-foreground)' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <TableFormDialog
        open={showCreate || !!editTable}
        onClose={() => { setShowCreate(false); setEditTable(null); }}
        title={editTable ? 'Edit Table' : 'Create Table'}
        form={form}
        onForm={setForm}
        onConfirm={editTable ? handleEdit : handleCreate}
        confirmLabel={editTable ? 'Save' : 'Create'}
      />

      {/* Delete Confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent style={{ background: 'var(--neo-raised)', border: '1px solid oklch(1 0 0 / 0.07)', boxShadow: 'var(--neo-shadow-raised)' }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>Delete Table</DialogTitle>
          </DialogHeader>
          <p className="text-sm py-2" style={{ color: 'var(--muted-foreground)' }}>
            Delete <strong style={{ color: 'var(--foreground)' }}>{confirmDelete?.displayName}</strong>? All fields and data will be permanently removed.
          </p>
          <DialogFooter className="gap-2">
            <button onClick={() => setConfirmDelete(null)} className="neo-btn px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--muted-foreground)' }}>Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 text-sm font-semibold rounded-lg" style={{ background: 'var(--destructive)', color: 'white', boxShadow: '3px 3px 8px rgba(0,0,0,0.4)' }}>Delete</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TableFormDialog({ open, onClose, title, form, onForm, onConfirm, confirmLabel }: {
  open: boolean;
  onClose: () => void;
  title: string;
  form: { name: string; displayName: string; description: string; tableType: TableType; color: string };
  onForm: (f: typeof form) => void;
  onConfirm: () => void;
  confirmLabel: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent style={{ background: 'var(--neo-raised)', border: '1px solid oklch(1 0 0 / 0.07)', boxShadow: 'var(--neo-shadow-raised)' }}>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>DISPLAY NAME</label>
            <input
              className="neo-input w-full px-3 py-2.5 text-sm rounded-lg"
              value={form.displayName}
              onChange={(e) => onForm({ ...form, displayName: e.target.value })}
              placeholder="Customers"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>TABLE NAME (identifier)</label>
            <input
              className="neo-input w-full px-3 py-2.5 text-sm rounded-lg font-mono"
              value={form.name}
              onChange={(e) => onForm({ ...form, name: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') })}
              placeholder="customers (auto-generated)"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>TABLE TYPE</label>
            <div className="grid grid-cols-2 gap-2">
              {TABLE_TYPES.map((tt) => (
                <button
                  key={tt.value}
                  onClick={() => onForm({ ...form, tableType: tt.value })}
                  className="flex items-start gap-2 p-2.5 rounded-lg text-left transition-all duration-120"
                  style={{
                    background: form.tableType === tt.value ? `${tt.color}22` : 'oklch(1 0 0 / 0.03)',
                    border: `1px solid ${form.tableType === tt.value ? tt.color + '55' : 'oklch(1 0 0 / 0.06)'}`,
                    boxShadow: form.tableType === tt.value ? `0 0 8px ${tt.color}22` : 'none',
                  }}
                >
                  <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: tt.color }} />
                  <div>
                    <div className="text-xs font-semibold" style={{ color: form.tableType === tt.value ? tt.color : 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>{tt.label}</div>
                    <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{tt.desc}</div>
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
                  onClick={() => onForm({ ...form, color: c })}
                  className="w-6 h-6 rounded-full transition-all duration-120"
                  style={{
                    background: c,
                    boxShadow: form.color === c ? `0 0 0 2px var(--neo-raised), 0 0 0 3px ${c}` : '2px 2px 4px rgba(0,0,0,0.4)',
                    transform: form.color === c ? 'scale(1.2)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className="neo-btn px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--muted-foreground)' }}>Cancel</button>
          <button onClick={onConfirm} disabled={!form.displayName.trim()} className="neo-btn-primary px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50">{confirmLabel}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
