/**
 * Home Page — Project dashboard
 * Obsidian Forge: neomorphic project cards, amber accents
 * Includes: project export (JSON backup) and import from JSON
 */
import { useRef, useState } from 'react';
import { useLocation } from 'wouter';
import {
  Database, Plus, Trash2, Edit3, Calendar,
  Table2, FileText, BarChart3, Download, Upload, Package,
} from 'lucide-react';
import { useDB } from '@/contexts/DBContext';
import {
  type DataRow, type DBField, type DBForm, type DBMenu,
  type DBRelationship, type DBReport, type DBTable, type Project,
  dbGetAll, dbGetByIndex, dbPut, openDataDB, openMetaDB,
  rowGetAll, rowPut, ensureTableStore,
} from '@/lib/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { InstallBanner } from '@/components/InstallBanner';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';

const PROJECT_COLORS = [
  '#f5a623', '#6366f1', '#10b981', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f59e0b', '#ec4899', '#14b8a6', '#84cc16',
];

// ─── Export / Import types ────────────────────────────────────────────────────

interface ProjectBackup {
  version: number;
  exportedAt: number;
  project: Project;
  tables: DBTable[];
  fields: DBField[];
  relationships: DBRelationship[];
  forms: DBForm[];
  reports: DBReport[];
  menus: DBMenu[];
  data: Record<string, DataRow[]>; // tableId → rows
}

// ─── Export helper ────────────────────────────────────────────────────────────

async function exportProject(projectId: string): Promise<ProjectBackup> {
  await openMetaDB();
  const [project, tables, fields, relationships, forms, reports, menus] = await Promise.all([
    dbGetAll<Project>('projects').then(ps => ps.find(p => p.id === projectId)!),
    dbGetByIndex<DBTable>('tables', 'projectId', projectId),
    dbGetByIndex<DBField>('fields', 'projectId', projectId),
    dbGetByIndex<DBRelationship>('relationships', 'projectId', projectId),
    dbGetByIndex<DBForm>('forms', 'projectId', projectId),
    dbGetByIndex<DBReport>('reports', 'projectId', projectId),
    dbGetByIndex<DBMenu>('menus', 'projectId', projectId),
  ]);

  // Open data DB for this project
  const tableIds = tables.map(t => t.id);
  if (tableIds.length > 0) {
    await openDataDB(projectId, tableIds);
  }

  const data: Record<string, DataRow[]> = {};
  for (const table of tables) {
    data[table.id] = await rowGetAll(projectId, table.id);
  }

  return {
    version: 1,
    exportedAt: Date.now(),
    project,
    tables,
    fields,
    relationships,
    forms,
    reports,
    menus,
    data,
  };
}

// ─── Import helper ────────────────────────────────────────────────────────────

async function importProject(backup: ProjectBackup, newId?: string): Promise<string> {
  const pid = newId ?? nanoid();
  const now = Date.now();

  // Build ID remapping (old → new) to avoid collisions
  const idMap: Record<string, string> = { [backup.project.id]: pid };
  for (const t of backup.tables) idMap[t.id] = nanoid();
  for (const f of backup.fields) idMap[f.id] = nanoid();
  for (const r of backup.relationships) idMap[r.id] = nanoid();
  for (const fm of backup.forms) idMap[fm.id] = nanoid();
  for (const rp of backup.reports) idMap[rp.id] = nanoid();
  for (const m of backup.menus) idMap[m.id] = nanoid();

  const remap = (id: string) => idMap[id] ?? id;

  await openMetaDB();

  // Write project
  const project: Project = {
    ...backup.project,
    id: pid,
    name: backup.project.name,
    createdAt: now,
    updatedAt: now,
  };
  await dbPut<Project>('projects', project);

  // Write tables
  for (const t of backup.tables) {
    await dbPut<DBTable>('tables', { ...t, id: remap(t.id), projectId: pid, updatedAt: now });
  }

  // Write fields (remap referencedTableId / referencedFieldId / displayFieldId)
  for (const f of backup.fields) {
    await dbPut<DBField>('fields', {
      ...f,
      id: remap(f.id),
      tableId: remap(f.tableId),
      projectId: pid,
      referencedTableId: f.referencedTableId ? remap(f.referencedTableId) : undefined,
      referencedFieldId: f.referencedFieldId ? remap(f.referencedFieldId) : undefined,
      displayFieldId: f.displayFieldId ? remap(f.displayFieldId) : undefined,
    });
  }

  // Write relationships
  for (const r of backup.relationships) {
    await dbPut<DBRelationship>('relationships', {
      ...r,
      id: remap(r.id),
      projectId: pid,
      fromTableId: remap(r.fromTableId),
      toTableId: remap(r.toTableId),
    });
  }

  // Write forms (remap tableId and field IDs in formFields — stored as JSON string)
  for (const fm of backup.forms) {
    let remappedFields = fm.formFields;
    try {
      const parsed: Record<string, unknown>[] = JSON.parse(fm.formFields as string);
      remappedFields = JSON.stringify(parsed.map((ff) => ({
        ...ff,
        id: nanoid(),
        fieldId: ff.fieldId ? remap(ff.fieldId as string) : ff.fieldId,
      })));
    } catch { /* keep original */ }
    await dbPut<DBForm>('forms', {
      ...fm,
      id: remap(fm.id),
      projectId: pid,
      tableId: remap(fm.tableId),
      formFields: remappedFields,
      updatedAt: now,
    });
  }

  // Write reports (remap tableId and column fieldIds — stored as JSON string)
  for (const rp of backup.reports) {
    let remappedCols = rp.reportColumns;
    try {
      const parsed: Record<string, unknown>[] = JSON.parse(rp.reportColumns as string);
      remappedCols = JSON.stringify(parsed.map((c) => ({
        ...c,
        fieldId: c.fieldId ? remap(c.fieldId as string) : c.fieldId,
      })));
    } catch { /* keep original */ }
    await dbPut<DBReport>('reports', {
      ...rp,
      id: remap(rp.id),
      projectId: pid,
      tableId: remap(rp.tableId),
      reportColumns: remappedCols,
      updatedAt: now,
    });
  }

  // Write menus (remap item links — items stored as JSON string)
  for (const m of backup.menus) {
    let remappedItems = m.items;
    try {
      const remapItems = (items: Record<string, unknown>[]): Record<string, unknown>[] =>
        items.map(item => ({
          ...item,
          id: nanoid(),
          targetId: item.targetId ? remap(item.targetId as string) : item.targetId,
          children: item.children ? remapItems(item.children as Record<string, unknown>[]) : [],
        }));
      const parsed: Record<string, unknown>[] = JSON.parse(m.items as string);
      remappedItems = JSON.stringify(remapItems(parsed));
    } catch { /* keep original */ }
    await dbPut<DBMenu>('menus', {
      ...m,
      id: remap(m.id),
      projectId: pid,
      items: remappedItems,
      updatedAt: now,
    });
  }

  // Write row data — preserve _id values so FK references in row data remain intact.
  // Only generate a new _id if there is a collision (duplicate key in same table).
  const newTableIds = backup.tables.map(t => remap(t.id));
  await openDataDB(pid, newTableIds);
  for (const table of backup.tables) {
    const newTableId = remap(table.id);
    await ensureTableStore(pid, newTableId);
    const rows = backup.data[table.id] ?? [];
    const seenIds = new Set<string>();
    for (const row of rows) {
      const rowId = seenIds.has(row._id) ? nanoid() : row._id;
      seenIds.add(rowId);
      await rowPut(pid, newTableId, { ...row, _id: rowId });
    }
  }

  return pid;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Home() {
  const [, navigate] = useLocation();
  const { projects, createProject, updateProject, deleteProject, setActiveProject, tables, forms, reports, refresh } = useDB();
  const [showCreate, setShowCreate] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState(PROJECT_COLORS[0]);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const p = await createProject({ name: newName.trim(), description: newDesc.trim(), color: newColor });
    await setActiveProject(p);
    setShowCreate(false);
    setNewName('');
    setNewDesc('');
    setNewColor(PROJECT_COLORS[0]);
    navigate(`/designer/${p.id}`);
    toast.success(`Database "${p.name}" created`);
  };

  const handleEdit = async () => {
    if (!editProject || !newName.trim()) return;
    await updateProject({ ...editProject, name: newName.trim(), description: newDesc.trim(), color: newColor });
    setEditProject(null);
    toast.success('Database updated');
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteProject(confirmDelete.id);
    setConfirmDelete(null);
    toast.success(`Database "${confirmDelete.name}" deleted`);
  };

  const openEdit = (p: Project) => {
    setEditProject(p);
    setNewName(p.name);
    setNewDesc(p.description);
    setNewColor(p.color);
  };

  const handleExport = async (proj: Project) => {
    setExporting(proj.id);
    try {
      const backup = await exportProject(proj.id);
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${proj.name.replace(/\s+/g, '_')}_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`"${proj.name}" exported successfully`);
    } catch (err) {
      toast.error('Export failed: ' + String(err));
    } finally {
      setExporting(null);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const backup: ProjectBackup = JSON.parse(text);
      if (!backup.version || !backup.project || !backup.tables) {
        throw new Error('Invalid backup file format');
      }
      // Check if project with same ID already exists → create with new ID
      const existingIds = projects.map(p => p.id);
      const useNewId = existingIds.includes(backup.project.id);
      const newProjectId = await importProject(backup, useNewId ? undefined : backup.project.id);
      await refresh();
      toast.success(`"${backup.project.name}" imported successfully`);
      // Navigate to the imported project
      const allProjects = await dbGetAll<Project>('projects');
      const imported = allProjects.find(p => p.id === newProjectId);
      if (imported) {
        await setActiveProject(imported);
        navigate(`/designer/${newProjectId}`);
      }
    } catch (err) {
      toast.error('Import failed: ' + String(err));
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = '';
    }
  };

  const getStats = (projectId: string) => ({
    tables: tables.filter((t) => t.projectId === projectId).length,
    forms: forms.filter((f) => f.projectId === projectId).length,
    reports: reports.filter((r) => r.projectId === projectId).length,
  });

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Hidden file input for import */}
      <input
        ref={importRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* Header */}
      <div className="mb-8 animate-slide-in-up">
        <h1
          className="text-3xl font-bold mb-1"
          style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}
        >
          Your Databases
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
          All data stored locally on this device — no server required.
        </p>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button
          onClick={() => { setShowCreate(true); setNewName(''); setNewDesc(''); setNewColor(PROJECT_COLORS[0]); }}
          className="neo-btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          <Plus size={16} />
          New Database
        </button>
        <button
          onClick={() => importRef.current?.click()}
          disabled={importing}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-150"
          style={{
            background: 'var(--neo-raised)',
            boxShadow: 'var(--neo-shadow-raised)',
            color: 'var(--muted-foreground)',
            border: '1px solid oklch(1 0 0 / 0.07)',
            fontFamily: 'Space Grotesk, sans-serif',
            cursor: importing ? 'wait' : 'pointer',
          }}
        >
          <Upload size={15} />
          {importing ? 'Importing…' : 'Import Backup'}
        </button>

        {/* Export All Backup — prominent top-level button */}
        {projects.length > 0 && (
          <button
            onClick={async () => {
              if (projects.length === 1) {
                handleExport(projects[0]);
              } else {
                // Export all databases as a single zip-like JSON bundle
                setExporting('__all__');
                try {
                  const all = await Promise.all(projects.map(p => exportProject(p.id)));
                  const bundle = { version: 1, exportedAt: Date.now(), databases: all };
                  const json = JSON.stringify(bundle, null, 2);
                  const blob = new Blob([json], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `dbcreator_all_backup_${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success(`All ${projects.length} databases exported`);
                } catch (err) {
                  toast.error('Export failed: ' + String(err));
                } finally {
                  setExporting(null);
                }
              }
            }}
            disabled={exporting !== null}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-150 active:scale-95"
            style={{
              background: exporting !== null ? 'oklch(1 0 0 / 0.05)' : 'rgba(245,166,35,0.12)',
              border: '1px solid rgba(245,166,35,0.35)',
              color: exporting !== null ? 'var(--muted-foreground)' : 'var(--amber)',
              boxShadow: exporting !== null ? 'none' : '0 0 14px rgba(245,166,35,0.15)',
              fontFamily: 'Space Grotesk, sans-serif',
              cursor: exporting !== null ? 'wait' : 'pointer',
            }}
          >
            <Download size={15} />
            {exporting === '__all__' ? 'Exporting…' : projects.length === 1 ? 'Export Backup' : 'Export All Backups'}
          </button>
        )}
      </div>

      {/* PWA Install Banner */}
      <div className="mb-6">
        <InstallBanner />
      </div>

      {/* Projects grid */}
      {projects.length === 0 ? (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {/* Empty state */}
          <div
            className="rounded-2xl p-8 flex flex-col justify-center"
            style={{
              background: 'var(--neo-inset)',
              boxShadow: 'var(--neo-shadow-inset)',
              gridColumn: '1 / -1',
            }}
          >
            <div className="flex justify-center mb-6">
              <svg width="180" height="100" viewBox="0 0 180 100" fill="none" opacity="0.6">
                <rect x="10" y="20" width="60" height="14" rx="3" fill="none" stroke="rgba(245,166,35,0.5)" strokeWidth="1.5" />
                <rect x="10" y="34" width="60" height="8" rx="0" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                <rect x="10" y="42" width="60" height="8" rx="0" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                <rect x="10" y="50" width="60" height="8" rx="0" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                <text x="40" y="31" textAnchor="middle" fill="rgba(245,166,35,0.8)" fontSize="7" fontFamily="JetBrains Mono">{"TABLE_A"}</text>
                <rect x="110" y="30" width="60" height="14" rx="3" fill="none" stroke="rgba(99,102,241,0.5)" strokeWidth="1.5" />
                <rect x="110" y="44" width="60" height="8" rx="0" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                <rect x="110" y="52" width="60" height="8" rx="0" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                <text x="140" y="41" textAnchor="middle" fill="rgba(99,102,241,0.8)" fontSize="7" fontFamily="JetBrains Mono">{"TABLE_B"}</text>
                <line x1="70" y1="44" x2="110" y2="44" stroke="rgba(245,166,35,0.4)" strokeWidth="1.5" strokeDasharray="4 3" />
                <circle cx="70" cy="44" r="3" fill="rgba(245,166,35,0.6)" />
                <circle cx="110" cy="44" r="3" fill="rgba(245,166,35,0.6)" />
                <rect x="55" y="70" width="70" height="14" rx="3" fill="none" stroke="rgba(16,185,129,0.5)" strokeWidth="1.5" />
                <text x="90" y="81" textAnchor="middle" fill="rgba(16,185,129,0.8)" fontSize="7" fontFamily="JetBrains Mono">{"TABLE_C"}</text>
                <line x1="90" y1="58" x2="90" y2="70" stroke="rgba(16,185,129,0.3)" strokeWidth="1.5" strokeDasharray="4 3" />
              </svg>
            </div>
            <div className="text-center">
              <h2
                className="text-xl font-bold mb-2"
                style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}
              >
                No databases yet
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
                Create your first database to start designing tables, forms, and reports.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  onClick={() => setShowCreate(true)}
                  className="neo-btn-primary px-6 py-2.5 text-sm font-semibold rounded-lg"
                  style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                >
                  Create Database
                </button>
                <button
                  onClick={() => importRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg"
                  style={{
                    background: 'var(--neo-raised)',
                    boxShadow: 'var(--neo-shadow-raised)',
                    color: 'var(--muted-foreground)',
                    border: '1px solid oklch(1 0 0 / 0.07)',
                    fontFamily: 'Space Grotesk, sans-serif',
                  }}
                >
                  <Upload size={14} />
                  Import Backup
                </button>
              </div>
            </div>
          </div>
          {/* Feature tiles */}
          {[
            { color: '#f5a623', label: 'Table Designer', desc: 'Define schemas with 17 field types', icon: '⬛' },
            { color: '#6366f1', label: 'Relationships', desc: 'Master-detail, LOV, foreign keys', icon: '⬡' },
            { color: '#10b981', label: 'Form Builder', desc: 'Drag-and-drop data entry forms', icon: '▦' },
            { color: '#ec4899', label: 'Report Engine', desc: 'Filter, sort, group, and export', icon: '▤' },
          ].map((feat) => (
            <div
              key={feat.label}
              className="rounded-xl p-4"
              style={{
                background: 'var(--neo-raised)',
                boxShadow: 'var(--neo-shadow-raised)',
                borderLeft: `3px solid ${feat.color}`,
              }}
            >
              <div className="text-lg mb-1" style={{ color: feat.color }}>{feat.icon}</div>
              <div className="text-sm font-bold mb-0.5" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>{feat.label}</div>
              <div className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>{feat.desc}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {projects.map((proj) => {
            const stats = getStats(proj.id);
            return (
              <div
                key={proj.id}
                className="neo-raised rounded-xl overflow-hidden cursor-pointer group transition-all duration-200"
                style={{ transitionTimingFunction: 'var(--ease-neo)' }}
                onClick={async () => {
                  await setActiveProject(proj);
                  navigate(`/designer/${proj.id}`);
                }}
              >
                {/* Color bar */}
                <div
                  className="h-1.5"
                  style={{ background: proj.color, boxShadow: `0 0 12px ${proj.color}44` }}
                />

                <div className="p-5">
                  {/* Title row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-base font-bold flex-shrink-0"
                        style={{
                          background: `${proj.color}22`,
                          color: proj.color,
                          boxShadow: `inset 2px 2px 5px rgba(0,0,0,0.3), inset -1px -1px 3px rgba(255,255,255,0.03)`,
                        }}
                      >
                        {proj.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3
                          className="font-bold text-base leading-tight"
                          style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}
                        >
                          {proj.name}
                        </h3>
                        {proj.description && (
                          <p
                            className="text-xs mt-0.5 line-clamp-1"
                            style={{ color: 'var(--muted-foreground)' }}
                          >
                            {proj.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Edit + Delete — always visible */}
                    <div
                      className="flex gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        title="Edit"
                        onClick={() => openEdit(proj)}
                        className="w-7 h-7 rounded-md flex items-center justify-center transition-all duration-120 active:scale-90"
                        style={{ color: 'var(--muted-foreground)', background: 'oklch(1 0 0 / 0.05)' }}
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        title="Delete"
                        onClick={() => setConfirmDelete(proj)}
                        className="w-7 h-7 rounded-md flex items-center justify-center transition-all duration-120 active:scale-90"
                        style={{ color: 'var(--destructive)', background: 'oklch(1 0 0 / 0.05)' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex gap-3 mt-4">
                    {[
                      { icon: <Table2 size={12} />, count: stats.tables, label: 'Tables' },
                      { icon: <FileText size={12} />, count: stats.forms, label: 'Forms' },
                      { icon: <BarChart3 size={12} />, count: stats.reports, label: 'Reports' },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md"
                        style={{
                          background: 'oklch(1 0 0 / 0.04)',
                          boxShadow: 'inset 1px 1px 3px rgba(0,0,0,0.3)',
                        }}
                      >
                        <span style={{ color: 'var(--muted-foreground)' }}>{s.icon}</span>
                        <span
                          className="text-xs font-semibold"
                          style={{ color: 'var(--foreground)', fontFamily: 'JetBrains Mono, monospace' }}
                        >
                          {s.count}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {s.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Date + Export Backup button — always visible */}
                  <div
                    className="flex items-center justify-between mt-4 pt-3"
                    style={{ borderTop: '1px solid oklch(1 0 0 / 0.06)' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className="flex items-center gap-1.5"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      <Calendar size={11} />
                      <span className="text-xs" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>
                        {new Date(proj.updatedAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Prominent Export Backup button */}
                    <button
                      onClick={() => handleExport(proj)}
                      disabled={exporting === proj.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-95"
                      style={{
                        background: exporting === proj.id ? 'oklch(1 0 0 / 0.04)' : 'rgba(245,166,35,0.10)',
                        border: '1px solid rgba(245,166,35,0.28)',
                        color: exporting === proj.id ? 'var(--muted-foreground)' : 'var(--amber)',
                        boxShadow: exporting === proj.id ? 'none' : '0 0 8px rgba(245,166,35,0.12)',
                        fontFamily: 'Space Grotesk, sans-serif',
                        cursor: exporting === proj.id ? 'wait' : 'pointer',
                      }}
                    >
                      {exporting === proj.id
                        ? <><Package size={11} style={{ opacity: 0.5 }} /> Exporting…</>
                        : <><Download size={11} /> Export Backup</>
                      }
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <ProjectDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Database"
        name={newName}
        desc={newDesc}
        color={newColor}
        onName={setNewName}
        onDesc={setNewDesc}
        onColor={setNewColor}
        onConfirm={handleCreate}
        confirmLabel="Create"
      />

      {/* Edit Dialog */}
      <ProjectDialog
        open={!!editProject}
        onClose={() => setEditProject(null)}
        title="Edit Database"
        name={newName}
        desc={newDesc}
        color={newColor}
        onName={setNewName}
        onDesc={setNewDesc}
        onColor={setNewColor}
        onConfirm={handleEdit}
        confirmLabel="Save"
      />

      {/* Delete Confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent
          style={{
            background: 'var(--neo-raised)',
            border: '1px solid oklch(1 0 0 / 0.07)',
            boxShadow: 'var(--neo-shadow-raised)',
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
              Delete Database
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm py-2" style={{ color: 'var(--muted-foreground)' }}>
            Delete <strong style={{ color: 'var(--foreground)' }}>{confirmDelete?.name}</strong>? This will permanently remove all tables, forms, reports, and data.
          </p>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setConfirmDelete(null)}
              className="neo-btn px-4 py-2 text-sm rounded-lg"
              style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-150"
              style={{
                background: 'var(--destructive)',
                color: 'white',
                boxShadow: '3px 3px 8px rgba(0,0,0,0.4)',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectDialog({
  open, onClose, title, name, desc, color,
  onName, onDesc, onColor, onConfirm, confirmLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  name: string;
  desc: string;
  color: string;
  onName: (v: string) => void;
  onDesc: (v: string) => void;
  onColor: (v: string) => void;
  onConfirm: () => void;
  confirmLabel: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        style={{
          background: 'var(--neo-raised)',
          border: '1px solid oklch(1 0 0 / 0.07)',
          boxShadow: 'var(--neo-shadow-raised)',
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
              NAME
            </label>
            <input
              className="neo-input w-full px-3 py-2.5 text-sm rounded-lg"
              value={name}
              onChange={(e) => onName(e.target.value)}
              placeholder="My Database"
              onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
              DESCRIPTION
            </label>
            <input
              className="neo-input w-full px-3 py-2.5 text-sm rounded-lg"
              value={desc}
              onChange={(e) => onDesc(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
              COLOR
            </label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => onColor(c)}
                  className="w-7 h-7 rounded-full transition-all duration-120"
                  style={{
                    background: c,
                    boxShadow: color === c
                      ? `0 0 0 2px var(--neo-raised), 0 0 0 4px ${c}, 0 0 12px ${c}66`
                      : '2px 2px 5px rgba(0,0,0,0.4)',
                    transform: color === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button
            onClick={onClose}
            className="neo-btn px-4 py-2 text-sm rounded-lg"
            style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!name.trim()}
            className="neo-btn-primary px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
