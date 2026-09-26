/**
 * RelationshipsPage — Visual relationship manager
 * Obsidian Forge: table link cards with type badges
 */
import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { GitBranch, Plus, Trash2, Edit3, ChevronLeft, ArrowRight, Network } from 'lucide-react';
import { useDB } from '@/contexts/DBContext';
import type { DBRelationship, RelationshipType } from '@/lib/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

const REL_TYPES: { value: RelationshipType; label: string; color: string; desc: string }[] = [
  { value: 'one_to_many', label: '1 → N', color: '#f5a623', desc: 'One record links to many (master-detail)' },
  { value: 'many_to_one', label: 'N → 1', color: '#6366f1', desc: 'Many records link to one (foreign key)' },
  { value: 'one_to_one',  label: '1 → 1', color: '#10b981', desc: 'One-to-one link between tables' },
  { value: 'lov',         label: 'LOV',   color: '#8b5cf6', desc: 'List of values lookup table' },
];

const DEFAULT_FORM = {
  name: '',
  type: 'one_to_many' as RelationshipType,
  fromTableId: '',
  fromFieldId: '',
  toTableId: '',
  toFieldId: '',
  cascadeDelete: false,
  description: '',
};

export default function RelationshipsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, navigate] = useLocation();
  const { projects, tables, fields, relationships, createRelationship, updateRelationship, deleteRelationship } = useDB();

  const project = projects.find((p) => p.id === projectId);
  const projectTables = tables.filter((t) => t.projectId === projectId);
  const projectRels = relationships.filter((r) => r.projectId === projectId);

  const [showCreate, setShowCreate] = useState(false);
  const [editRel, setEditRel] = useState<DBRelationship | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DBRelationship | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  const getTableName = (id: string) => tables.find((t) => t.id === id)?.displayName ?? id;
  const getFieldName = (id: string) => fields.find((f) => f.id === id)?.displayName ?? id;
  const getTableFields = (tableId: string) => fields.filter((f) => f.tableId === tableId);

  const handleCreate = async () => {
    if (!form.fromTableId || !form.toTableId) return;
    const safeName = form.name.trim() ||
      `${getTableName(form.fromTableId)}_${form.type}_${getTableName(form.toTableId)}`.toLowerCase().replace(/\s+/g, '_');
    await createRelationship({ ...form, name: safeName, projectId });
    setShowCreate(false);
    setForm(DEFAULT_FORM);
    toast.success('Relationship created');
  };

  const handleEdit = async () => {
    if (!editRel) return;
    await updateRelationship({ ...editRel, ...form });
    setEditRel(null);
    toast.success('Relationship updated');
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteRelationship(confirmDelete.id);
    setConfirmDelete(null);
    toast.success('Relationship deleted');
  };

  const openEdit = (r: DBRelationship) => {
    setEditRel(r);
    setForm({
      name: r.name,
      type: r.type,
      fromTableId: r.fromTableId,
      fromFieldId: r.fromFieldId,
      toTableId: r.toTableId,
      toFieldId: r.toFieldId,
      cascadeDelete: r.cascadeDelete,
      description: r.description,
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 animate-slide-in-up">
        <button
          onClick={() => navigate(`/designer/${projectId}`)}
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ color: 'var(--muted-foreground)', background: 'var(--neo-raised)', boxShadow: 'var(--neo-shadow-raised-sm)' }}
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>
              {project?.name}
            </span>
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
            Relationships
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {projectRels.length} relationship{projectRels.length !== 1 ? 's' : ''} defined
          </p>
        </div>
        <button
          onClick={() => navigate(`/erd/${projectId}`)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-150"
          style={{
            color: '#6366f1',
            background: 'oklch(0.6 0.2 270 / 0.12)',
            border: '1px solid oklch(0.6 0.2 270 / 0.25)',
            fontFamily: 'Space Grotesk, sans-serif',
          }}
        >
          <Network size={15} />
          ERD Diagram
        </button>
        <button
          onClick={() => { setShowCreate(true); setForm(DEFAULT_FORM); }}
          className="neo-btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg"
        >
          <Plus size={16} />
          Add Relationship
        </button>
      </div>

      {/* Relationships list */}
      {projectRels.length === 0 ? (
        <div className="animate-fade-in">
          <div
            className="rounded-2xl p-8"
            style={{ background: 'var(--neo-inset)', boxShadow: 'var(--neo-shadow-inset)' }}
          >
            {/* Relationship node diagram */}
            <div className="flex justify-center mb-6">
              <svg width="220" height="80" viewBox="0 0 220 80" fill="none" opacity="0.65">
                {/* Node A */}
                <rect x="10" y="25" width="70" height="30" rx="4" fill="none" stroke="rgba(245,166,35,0.6)" strokeWidth="1.5" />
                <text x="45" y="44" textAnchor="middle" fill="rgba(245,166,35,0.9)" fontSize="8" fontFamily="JetBrains Mono">PARENT</text>
                {/* Node B */}
                <rect x="140" y="25" width="70" height="30" rx="4" fill="none" stroke="rgba(99,102,241,0.6)" strokeWidth="1.5" />
                <text x="175" y="44" textAnchor="middle" fill="rgba(99,102,241,0.9)" fontSize="8" fontFamily="JetBrains Mono">CHILD</text>
                {/* Connector */}
                <line x1="80" y1="40" x2="140" y2="40" stroke="rgba(245,166,35,0.4)" strokeWidth="1.5" strokeDasharray="5 3" />
                {/* FK arrow */}
                <circle cx="80" cy="40" r="4" fill="rgba(245,166,35,0.7)" />
                <polygon points="136,36 140,40 136,44" fill="rgba(99,102,241,0.7)" />
                {/* Labels */}
                <text x="110" y="34" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="JetBrains Mono">FK</text>
                {/* 1:N indicator */}
                <text x="88" y="56" fill="rgba(245,166,35,0.5)" fontSize="7" fontFamily="JetBrains Mono">1</text>
                <text x="128" y="56" fill="rgba(99,102,241,0.5)" fontSize="7" fontFamily="JetBrains Mono">N</text>
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-lg font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
                No relationships yet
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
                Link tables together to enable master-detail forms and LOV lookups.
              </p>
              <button onClick={() => setShowCreate(true)} className="neo-btn-primary px-6 py-2.5 text-sm font-semibold rounded-lg">
                Add Relationship
              </button>
            </div>
          </div>
          {/* Relationship type hints */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: 'One-to-Many', desc: 'Parent → Children rows', color: '#f5a623' },
              { label: 'Many-to-One', desc: 'Lookup / LOV field', color: '#6366f1' },
              { label: 'Master-Detail', desc: 'Embedded sub-form', color: '#10b981' },
            ].map((t) => (
              <div key={t.label} className="rounded-xl p-3" style={{ background: 'var(--neo-raised)', boxShadow: 'var(--neo-shadow-raised)', borderTop: `2px solid ${t.color}` }}>
                <div className="text-xs font-bold mb-0.5" style={{ fontFamily: 'Space Grotesk, sans-serif', color: t.color }}>{t.label}</div>
                <div className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3 stagger-children">
          {projectRels.map((rel) => {
            const rt = REL_TYPES.find((x) => x.value === rel.type);
            return (
              <div key={rel.id} className="neo-raised rounded-xl p-4 flex items-center gap-4 group">
                {/* Type badge */}
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-sm"
                  style={{
                    background: `${rt?.color ?? '#6366f1'}22`,
                    color: rt?.color ?? '#6366f1',
                    fontFamily: 'JetBrains Mono, monospace',
                    boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.3)',
                  }}
                >
                  {rt?.label}
                </div>

                {/* From → To */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-sm font-semibold px-2 py-0.5 rounded"
                      style={{ background: 'oklch(1 0 0 / 0.06)', color: 'var(--foreground)', fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      {getTableName(rel.fromTableId)}
                    </span>
                    {rel.fromFieldId && (
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
                        .{getFieldName(rel.fromFieldId)}
                      </span>
                    )}
                    <ArrowRight size={14} style={{ color: 'var(--muted-foreground)' }} />
                    <span
                      className="text-sm font-semibold px-2 py-0.5 rounded"
                      style={{ background: 'oklch(1 0 0 / 0.06)', color: 'var(--foreground)', fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      {getTableName(rel.toTableId)}
                    </span>
                    {rel.toFieldId && (
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
                        .{getFieldName(rel.toFieldId)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <code className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>
                      {rel.name}
                    </code>
                    {rel.cascadeDelete && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(224,85,85,0.15)', color: '#e05555', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>
                        CASCADE DELETE
                      </span>
                    )}
                    {rel.description && (
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{rel.description}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1.5">
                  <button
                    onClick={() => openEdit(rel)}
                    className="w-7 h-7 rounded-md flex items-center justify-center"
                    style={{ color: 'var(--muted-foreground)', background: 'oklch(1 0 0 / 0.05)' }}
                  >
                    <Edit3 size={13} />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(rel)}
                    className="w-7 h-7 rounded-md flex items-center justify-center"
                    style={{ color: 'var(--destructive)', background: 'oklch(1 0 0 / 0.05)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate || !!editRel} onOpenChange={() => { setShowCreate(false); setEditRel(null); }}>
        <DialogContent
          className="max-w-lg"
          style={{ background: 'var(--neo-raised)', border: '1px solid oklch(1 0 0 / 0.07)', boxShadow: 'var(--neo-shadow-raised)' }}
        >
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
              {editRel ? 'Edit Relationship' : 'Add Relationship'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Type */}
            <div>
              <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>TYPE</label>
              <div className="grid grid-cols-2 gap-2">
                {REL_TYPES.map((rt) => (
                  <button
                    key={rt.value}
                    onClick={() => setForm({ ...form, type: rt.value })}
                    className="flex items-start gap-2 p-2.5 rounded-lg text-left transition-all"
                    style={{
                      background: form.type === rt.value ? `${rt.color}22` : 'oklch(1 0 0 / 0.03)',
                      border: `1px solid ${form.type === rt.value ? rt.color + '55' : 'oklch(1 0 0 / 0.06)'}`,
                    }}
                  >
                    <span className="font-bold text-sm" style={{ color: rt.color, fontFamily: 'JetBrains Mono, monospace' }}>{rt.label}</span>
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{rt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* From table + field */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>FROM TABLE</label>
                <select
                  className="neo-input w-full px-3 py-2 text-sm rounded-lg"
                  value={form.fromTableId}
                  onChange={(e) => setForm({ ...form, fromTableId: e.target.value, fromFieldId: '' })}
                >
                  <option value="">Select table...</option>
                  {projectTables.map((t) => (
                    <option key={t.id} value={t.id}>{t.displayName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>FROM FIELD</label>
                <select
                  className="neo-input w-full px-3 py-2 text-sm rounded-lg"
                  value={form.fromFieldId}
                  onChange={(e) => setForm({ ...form, fromFieldId: e.target.value })}
                  disabled={!form.fromTableId}
                >
                  <option value="">Select field...</option>
                  {getTableFields(form.fromTableId).map((f) => (
                    <option key={f.id} value={f.id}>{f.displayName}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* To table + field */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>TO TABLE</label>
                <select
                  className="neo-input w-full px-3 py-2 text-sm rounded-lg"
                  value={form.toTableId}
                  onChange={(e) => setForm({ ...form, toTableId: e.target.value, toFieldId: '' })}
                >
                  <option value="">Select table...</option>
                  {projectTables.map((t) => (
                    <option key={t.id} value={t.id}>{t.displayName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>TO FIELD</label>
                <select
                  className="neo-input w-full px-3 py-2 text-sm rounded-lg"
                  value={form.toFieldId}
                  onChange={(e) => setForm({ ...form, toFieldId: e.target.value })}
                  disabled={!form.toTableId}
                >
                  <option value="">Select field...</option>
                  {getTableFields(form.toTableId).map((f) => (
                    <option key={f.id} value={f.id}>{f.displayName}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Name + cascade */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>NAME</label>
                <input
                  className="neo-input w-full px-3 py-2 text-sm rounded-lg"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Auto-generated"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center"
                    style={{
                      background: form.cascadeDelete ? '#e05555' : 'var(--neo-inset)',
                      boxShadow: form.cascadeDelete ? '0 0 6px rgba(224,85,85,0.3)' : 'var(--neo-shadow-inset-sm)',
                    }}
                    onClick={() => setForm({ ...form, cascadeDelete: !form.cascadeDelete })}
                  >
                    {form.cascadeDelete && <span className="text-white text-xs">✓</span>}
                  </div>
                  <span className="text-sm" style={{ color: 'var(--foreground)' }}>Cascade Delete</span>
                </label>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>DESCRIPTION</label>
              <input
                className="neo-input w-full px-3 py-2 text-sm rounded-lg"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button onClick={() => { setShowCreate(false); setEditRel(null); }} className="neo-btn px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--muted-foreground)' }}>Cancel</button>
            <button
              onClick={editRel ? handleEdit : handleCreate}
              disabled={!form.fromTableId || !form.toTableId}
              className="neo-btn-primary px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
            >
              {editRel ? 'Save' : 'Create'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent style={{ background: 'var(--neo-raised)', border: '1px solid oklch(1 0 0 / 0.07)' }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>Delete Relationship</DialogTitle>
          </DialogHeader>
          <p className="text-sm py-2" style={{ color: 'var(--muted-foreground)' }}>
            Delete relationship <strong style={{ color: 'var(--foreground)', fontFamily: 'JetBrains Mono, monospace' }}>{confirmDelete?.name}</strong>?
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
