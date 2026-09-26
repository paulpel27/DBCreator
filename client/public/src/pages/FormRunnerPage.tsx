/**
 * FormRunnerPage — Runtime form for data entry and management
 * Obsidian Forge: neomorphic form inputs, data grid with CRUD
 * Supports master-detail split-panel layout when detailFormIds is set
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  ChevronLeft, Plus, Edit3, Trash2, Search, Save, X,
  Upload, Calendar, Check, AlertCircle, ChevronRight,
  Layers, FileText, Hash, Sparkles
} from 'lucide-react';
import { useDB } from '@/contexts/DBContext';
import type { DataRow, DBField, DBForm, DBTable, FormField } from '@/lib/db';
import { MockDataGeneratorDialog } from '@/components/MockDataGeneratorDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';
import { cn } from '@/lib/utils';

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function FormRunnerPage() {
  const { projectId, formId } = useParams<{ projectId: string; formId: string }>();
  const [, navigate] = useLocation();
  const { projects, tables, fields, forms, getRows, saveRow, deleteRow } = useDB();

  const project = projects.find((p) => p.id === projectId);
  const form = forms.find((f) => f.id === formId);
  const table = form ? tables.find((t) => t.id === form.tableId) : undefined;

  // Detect detail forms linked to this master form
  let detailFormIds: string[] = [];
  try { detailFormIds = form?.detailFormIds ? JSON.parse(form.detailFormIds) : []; } catch {}
  const isMasterForm = detailFormIds.length > 0;

  if (!form || !table) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p style={{ color: 'var(--muted-foreground)' }}>Form not found.</p>
      </div>
    );
  }

  if (isMasterForm) {
    return (
      <MasterDetailRunner
        projectId={projectId!}
        masterForm={form}
        masterTable={table}
        detailFormIds={detailFormIds}
        forms={forms}
        tables={tables}
        fields={fields}
        getRows={getRows}
        saveRow={saveRow}
        deleteRow={deleteRow}
        navigate={navigate}
      />
    );
  }

  return (
    <StandardFormRunner
      projectId={projectId!}
      form={form}
      table={table}
      fields={fields}
      forms={forms}
      getRows={getRows}
      saveRow={saveRow}
      deleteRow={deleteRow}
      navigate={navigate}
      backPath={`/forms/${projectId}`}
    />
  );
}

// ─── Master-Detail Runner ──────────────────────────────────────────────────────
function MasterDetailRunner({
  projectId, masterForm, masterTable, detailFormIds,
  forms, tables, fields, getRows, saveRow, deleteRow, navigate,
}: {
  projectId: string;
  masterForm: DBForm;
  masterTable: ReturnType<typeof Array.prototype.find>;
  detailFormIds: string[];
  forms: DBForm[];
  tables: ReturnType<typeof Array.prototype.find>[];
  fields: DBField[];
  getRows: (tableId: string) => Promise<DataRow[]>;
  saveRow: (tableId: string, row: Partial<DataRow>) => Promise<DataRow>;
  deleteRow: (tableId: string, id: string) => Promise<void>;
  navigate: (path: string) => void;
}) {
  const [masterRows, setMasterRows] = useState<DataRow[]>([]);
  const [selectedMaster, setSelectedMaster] = useState<DataRow | null>(null);
  const [masterLoading, setMasterLoading] = useState(true);
  const [masterSearch, setMasterSearch] = useState('');
  const [activeDetailIdx, setActiveDetailIdx] = useState(0);

  // Master form fields
  let masterFormFields: FormField[] = [];
  try { masterFormFields = JSON.parse(masterForm.formFields); } catch {}
  const masterVisibleFields = masterFormFields.filter((ff) => ff.visible);
  const masterTableFields = fields.filter((f) => f.tableId === masterTable.id);

  const loadMasterRows = useCallback(async () => {
    setMasterLoading(true);
    const data = await getRows(masterTable.id);
    setMasterRows(data.sort((a, b) => b._createdAt - a._createdAt));
    setMasterLoading(false);
  }, [masterTable, getRows]);

  useEffect(() => { loadMasterRows(); }, [loadMasterRows]);

  const getDisplayValue = (row: DataRow, fieldId: string, tableFieldList: DBField[]): string => {
    const field = tableFieldList.find((f) => f.id === fieldId);
    if (!field) return '';
    const val = row[field.name];
    if (val === undefined || val === null) return '—';
    if (field.fieldType === 'boolean') return val ? 'Yes' : 'No';
    if (field.fieldType === 'image' || field.fieldType === 'file') return '[File]';
    if (field.fieldType === 'large_text') return String(val).substring(0, 50) + (String(val).length > 50 ? '…' : '');
    if (field.fieldType === 'date' || field.fieldType === 'datetime') {
      try { return new Date(String(val)).toLocaleDateString(); } catch { return String(val); }
    }
    return String(val);
  };

  const getMasterSummary = (row: DataRow): string => {
    const firstField = masterVisibleFields.find((ff) => {
      const f = masterTableFields.find((tf) => tf.id === ff.fieldId);
      return f && f.fieldType !== 'id';
    });
    if (!firstField) return row._id;
    return getDisplayValue(row, firstField.fieldId, masterTableFields) || row._id;
  };

  const getMasterSubtitle = (row: DataRow): string => {
    const secondField = masterVisibleFields.filter((ff) => {
      const f = masterTableFields.find((tf) => tf.id === ff.fieldId);
      return f && f.fieldType !== 'id';
    })[1];
    if (!secondField) return '';
    return getDisplayValue(row, secondField.fieldId, masterTableFields);
  };

  const filteredMasterRows = masterRows.filter((row) => {
    if (!masterSearch.trim()) return true;
    const s = masterSearch.toLowerCase();
    return Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(s));
  });

  const detailForms = detailFormIds
    .map((id) => forms.find((f) => f.id === id))
    .filter(Boolean) as DBForm[];

  const activeDetailForm = detailForms[activeDetailIdx];
  const activeDetailTable = activeDetailForm
    ? tables.find((t) => t.id === activeDetailForm.tableId)
    : undefined;

  // Find the FK field in the detail table that points to the master table
  const detailFKField = activeDetailForm
    ? fields.find((f) =>
        f.tableId === activeDetailForm.tableId &&
        f.fieldType === 'foreign_key' &&
        f.referencedTableId === masterTable.id
      )
    : undefined;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid oklch(1 0 0 / 0.06)', background: 'var(--neo-inset)' }}
      >
        <button
          onClick={() => navigate(`/forms/${projectId}`)}
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--neo-raised)', boxShadow: 'var(--neo-shadow-raised-sm)', color: 'var(--muted-foreground)' }}
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold"
              style={{ background: 'rgba(245,166,35,0.15)', color: 'var(--amber)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}
            >
              <Layers size={10} />
              MASTER-DETAIL
            </div>
          </div>
          <h1 className="text-lg font-bold mt-0.5" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
            {masterForm.displayName}
          </h1>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>
            {masterTable.displayName} · {masterRows.length} records
          </p>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left: Master list ── */}
        <div
          className="flex flex-col overflow-hidden flex-shrink-0"
          style={{
            width: '300px',
            borderRight: '1px solid oklch(1 0 0 / 0.06)',
            background: 'var(--neo-inset)',
          }}
        >
          {/* Master list header */}
          <div
            className="flex items-center gap-2 px-3 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid oklch(1 0 0 / 0.06)' }}
          >
            <div className="relative flex-1">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
              <input
                className="neo-input pl-7 pr-2 py-1.5 text-xs rounded-lg w-full"
                value={masterSearch}
                onChange={(e) => setMasterSearch(e.target.value)}
                placeholder="Search..."
              />
            </div>
            {masterForm.allowCreate && (
              <MasterCreateButton
                form={masterForm}
                table={masterTable}
                fields={masterTableFields}
                saveRow={saveRow}
                onCreated={async (row) => {
                  await loadMasterRows();
                  setSelectedMaster(row);
                }}
              />
            )}
          </div>

          {/* Master rows */}
          <div className="flex-1 overflow-y-auto">
            {masterLoading ? (
              <div className="flex items-center justify-center h-20">
                <div className="w-5 h-5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
              </div>
            ) : filteredMasterRows.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {masterSearch ? 'No matches.' : 'No records yet.'}
                </p>
              </div>
            ) : (
              filteredMasterRows.map((row) => {
                const isSelected = selectedMaster?._id === row._id;
                return (
                  <button
                    key={row._id}
                    onClick={() => setSelectedMaster(row)}
                    className="w-full text-left px-3 py-3 transition-all duration-120 group relative"
                    style={{
                      borderBottom: '1px solid oklch(1 0 0 / 0.04)',
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(245,166,35,0.12), rgba(245,166,35,0.06))'
                        : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--amber)' : '3px solid transparent',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                        style={{
                          background: isSelected ? 'rgba(245,166,35,0.2)' : 'oklch(1 0 0 / 0.06)',
                          color: isSelected ? 'var(--amber)' : 'var(--muted-foreground)',
                          fontFamily: 'Space Grotesk, sans-serif',
                        }}
                      >
                        {getMasterSummary(row).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-sm font-semibold truncate"
                          style={{
                            fontFamily: 'Space Grotesk, sans-serif',
                            color: isSelected ? 'var(--amber)' : 'var(--foreground)',
                          }}
                        >
                          {getMasterSummary(row)}
                        </div>
                        {getMasterSubtitle(row) && (
                          <div
                            className="text-xs truncate mt-0.5"
                            style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}
                          >
                            {getMasterSubtitle(row)}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <ChevronRight size={12} style={{ color: 'var(--amber)', flexShrink: 0 }} />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right: Detail panel ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedMaster ? (
            <>
              {/* Master record summary bar */}
              <div
                className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
                style={{
                  borderBottom: '1px solid oklch(1 0 0 / 0.06)',
                  background: 'linear-gradient(135deg, rgba(245,166,35,0.06), transparent)',
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: 'rgba(245,166,35,0.15)', color: 'var(--amber)', fontFamily: 'Space Grotesk, sans-serif' }}
                >
                  {getMasterSummary(selectedMaster).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold truncate" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
                      {getMasterSummary(selectedMaster)}
                    </span>
                    {getMasterSubtitle(selectedMaster) && (
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        · {getMasterSubtitle(selectedMaster)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {masterVisibleFields.slice(0, 4).map((ff) => {
                      const f = masterTableFields.find((tf) => tf.id === ff.fieldId);
                      if (!f || f.fieldType === 'id') return null;
                      const val = getDisplayValue(selectedMaster, ff.fieldId, masterTableFields);
                      if (!val || val === '—') return null;
                      return (
                        <span key={ff.id} className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>
                          <span style={{ opacity: 0.6 }}>{f.displayName}: </span>{val}
                        </span>
                      );
                    })}
                  </div>
                </div>
                {masterForm.allowEdit && (
                  <MasterEditButton
                    form={masterForm}
                    table={masterTable}
                    fields={masterTableFields}
                    row={selectedMaster}
                    saveRow={saveRow}
                    onSaved={async (updated) => {
                      await loadMasterRows();
                      setSelectedMaster(updated);
                    }}
                  />
                )}
                {masterForm.allowDelete && (
                  <MasterDeleteButton
                    row={selectedMaster}
                    table={masterTable}
                    deleteRow={deleteRow}
                    onDeleted={async () => {
                      await loadMasterRows();
                      setSelectedMaster(null);
                    }}
                  />
                )}
              </div>

              {/* Detail form tabs */}
              {detailForms.length > 1 && (
                <div
                  className="flex gap-1 px-5 py-2 flex-shrink-0"
                  style={{ borderBottom: '1px solid oklch(1 0 0 / 0.06)', background: 'oklch(1 0 0 / 0.01)' }}
                >
                  {detailForms.map((df, idx) => {
                    const dt = tables.find((t) => t.id === df.tableId);
                    return (
                      <button
                        key={df.id}
                        onClick={() => setActiveDetailIdx(idx)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-120"
                        style={{
                          background: activeDetailIdx === idx ? 'rgba(99,102,241,0.15)' : 'oklch(1 0 0 / 0.04)',
                          color: activeDetailIdx === idx ? '#6366f1' : 'var(--muted-foreground)',
                          border: `1px solid ${activeDetailIdx === idx ? '#6366f155' : 'transparent'}`,
                          fontFamily: 'Space Grotesk, sans-serif',
                        }}
                      >
                        <FileText size={11} />
                        {df.displayName}
                        {dt && <span style={{ opacity: 0.6, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}>({dt.displayName})</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Detail grid */}
              {activeDetailForm && activeDetailTable ? (
                <DetailGrid
                  masterRow={selectedMaster}
                  detailForm={activeDetailForm}
                  detailTable={activeDetailTable}
                  detailFKField={detailFKField}
                  allFields={fields}
                  getRows={getRows}
                  saveRow={saveRow}
                  deleteRow={deleteRow}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No detail form configured.</p>
                </div>
              )}
            </>
          ) : (
            /* Empty state — no master selected */
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--neo-raised)', boxShadow: 'var(--neo-shadow-raised)' }}
              >
                <Layers size={28} style={{ color: 'var(--muted-foreground)', opacity: 0.5 }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
                  Select a {masterTable.displayName} record
                </p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Choose a record from the left panel to view and edit its related {detailForms.map((df) => df.displayName).join(', ')}.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Detail Grid (sub-table for selected master) ───────────────────────────────
function DetailGrid({
  masterRow, detailForm, detailTable, detailFKField, allFields, getRows, saveRow, deleteRow,
}: {
  masterRow: DataRow;
  detailForm: DBForm;
  detailTable: { id: string; displayName: string };
  detailFKField: DBField | undefined;
  allFields: DBField[];
  getRows: (tableId: string) => Promise<DataRow[]>;
  saveRow: (tableId: string, row: Partial<DataRow>) => Promise<DataRow>;
  deleteRow: (tableId: string, id: string) => Promise<void>;
}) {
  const [rows, setRows] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState<DataRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DataRow | null>(null);
  const [rowData, setRowData] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  let detailFormFields: FormField[] = [];
  try { detailFormFields = JSON.parse(detailForm.formFields); } catch {}
  const visibleFields = detailFormFields.filter((ff) => ff.visible);
  const tableFields = allFields.filter((f) => f.tableId === detailTable.id);

  const loadRows = useCallback(async () => {
    setLoading(true);
    const all = await getRows(detailTable.id);
    // Filter by FK to master
    const filtered = detailFKField
      ? all.filter((r) => String(r[detailFKField.name]) === String(masterRow._id))
      : all;
    setRows(filtered.sort((a, b) => b._createdAt - a._createdAt));
    setLoading(false);
  }, [detailTable, detailFKField, masterRow, getRows]);

  useEffect(() => { loadRows(); }, [loadRows]);

  const getField = (fieldId: string) => tableFields.find((f) => f.id === fieldId);

  const getDisplayValue = (row: DataRow, fieldId: string): string => {
    const field = getField(fieldId);
    if (!field) return '';
    const val = row[field.name];
    if (val === undefined || val === null) return '—';
    if (field.fieldType === 'boolean') return val ? 'Yes' : 'No';
    if (field.fieldType === 'image' || field.fieldType === 'file') return '[File]';
    if (field.fieldType === 'large_text') return String(val).substring(0, 50) + (String(val).length > 50 ? '…' : '');
    if (field.fieldType === 'date' || field.fieldType === 'datetime') {
      try { return new Date(String(val)).toLocaleDateString(); } catch { return String(val); }
    }
    return String(val);
  };

  const openCreate = () => {
    const defaults: Record<string, unknown> = {};
    tableFields.forEach((f) => {
      if (f.defaultValue !== null && f.defaultValue !== undefined) defaults[f.name] = f.defaultValue;
    });
    // Pre-fill FK to master
    if (detailFKField) defaults[detailFKField.name] = masterRow._id;
    setRowData(defaults);
    setErrors({});
    setEditRow(null);
    setShowForm(true);
  };

  const openEdit = (row: DataRow) => {
    setRowData({ ...row });
    setErrors({});
    setEditRow(row);
    setShowForm(true);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    visibleFields.forEach((ff) => {
      const field = getField(ff.fieldId);
      if (!field) return;
      const val = rowData[field.name];
      if (field.required && field.fieldType !== 'id' && (val === undefined || val === null || val === '')) {
        errs[field.name] = `${field.displayName} is required`;
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const row: Partial<DataRow> = {
      ...rowData,
      _id: editRow?._id ?? nanoid(),
      _createdAt: editRow?._createdAt,
    } as Partial<DataRow>;
    // Always ensure FK is set
    if (detailFKField) row[detailFKField.name] = masterRow._id;
    await saveRow(detailTable.id, row);
    setShowForm(false);
    await loadRows();
    toast.success(editRow ? 'Record updated' : 'Record added');
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteRow(detailTable.id, confirmDelete._id);
    setConfirmDelete(null);
    await loadRows();
    toast.success('Record deleted');
  };

  // Columns to show: exclude the FK field that points to master (it's implicit)
  const displayFields = visibleFields.filter((ff) => {
    if (!detailFKField) return true;
    const f = getField(ff.fieldId);
    return f?.id !== detailFKField.id;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Detail header */}
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid oklch(1 0 0 / 0.06)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: '#6366f1', boxShadow: '0 0 6px rgba(99,102,241,0.4)' }}
          />
          <span className="text-sm font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
            {detailForm.displayName}
          </span>
          <span
            className="px-1.5 py-0.5 rounded text-xs font-semibold"
            style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}
          >
            {rows.length} {rows.length === 1 ? 'record' : 'records'}
          </span>
        </div>
        {detailForm.allowCreate && (
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-120"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)' }}
          >
            <Plus size={12} />
            Add {detailTable.displayName}
          </button>
        )}
      </div>

      {/* Detail grid */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-24">
            <div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div
            className="rounded-xl p-8 text-center"
            style={{ background: 'var(--neo-inset)', boxShadow: 'var(--neo-shadow-inset)' }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
              style={{ background: 'rgba(99,102,241,0.1)' }}
            >
              <Hash size={18} style={{ color: '#6366f1', opacity: 0.6 }} />
            </div>
            <p className="text-sm font-semibold mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
              No {detailTable.displayName} records yet
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
              {detailFKField
                ? `Add records linked to this ${detailFKField.displayName || 'master record'}.`
                : 'Click "Add" to create the first record.'}
            </p>
            {detailForm.allowCreate && (
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold mx-auto"
                style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)' }}
              >
                <Plus size={12} />Add First Record
              </button>
            )}
          </div>
        ) : (
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--neo-inset)', boxShadow: 'var(--neo-shadow-inset)' }}
          >
            {/* Table header */}
            <div
              className="flex items-center px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
              style={{
                color: 'var(--muted-foreground)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.62rem',
                borderBottom: '1px solid oklch(1 0 0 / 0.06)',
                background: 'oklch(1 0 0 / 0.02)',
              }}
            >
              {displayFields.slice(0, 6).map((ff) => {
                const field = getField(ff.fieldId);
                return (
                  <div key={ff.id} className="flex-1 min-w-0 px-1">
                    {field?.displayName ?? ff.fieldId}
                  </div>
                );
              })}
              <div className="w-20 flex-shrink-0 text-right">Actions</div>
            </div>

            {/* Rows */}
            {rows.map((row, rowIdx) => (
              <div
                key={row._id}
                className="flex items-center px-4 py-3 transition-all duration-120"
                style={{
                  borderBottom: rowIdx < rows.length - 1 ? '1px solid oklch(1 0 0 / 0.04)' : 'none',
                }}
              >
                {displayFields.slice(0, 6).map((ff) => {
                  const field = getField(ff.fieldId);
                  const val = field ? getDisplayValue(row, ff.fieldId) : '—';
                  const isNumeric = field && (field.fieldType === 'number' || field.fieldType === 'decimal');
                  return (
                    <div key={ff.id} className="flex-1 min-w-0 px-1">
                      <span
                        className="text-sm truncate block"
                        style={{
                          color: val === '—' ? 'var(--muted-foreground)' : 'var(--foreground)',
                          fontFamily: isNumeric ? 'JetBrains Mono, monospace' : 'Inter, sans-serif',
                          fontSize: '0.82rem',
                          textAlign: isNumeric ? 'right' : 'left',
                        }}
                      >
                        {val}
                      </span>
                    </div>
                  );
                })}
                <div className="w-20 flex-shrink-0 flex justify-end gap-1">
                  {detailForm.allowEdit && (
                    <button
                      onClick={() => openEdit(row)}
                      className="w-6 h-6 rounded flex items-center justify-center transition-all duration-120"
                      style={{ color: '#6366f1', background: 'rgba(99,102,241,0.1)' }}
                      title="Edit"
                    >
                      <Edit3 size={11} />
                    </button>
                  )}
                  {detailForm.allowDelete && (
                    <button
                      onClick={() => setConfirmDelete(row)}
                      className="w-6 h-6 rounded flex items-center justify-center transition-all duration-120"
                      style={{ color: 'var(--destructive)', background: 'oklch(1 0 0 / 0.06)' }}
                      title="Delete"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={() => setShowForm(false)}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          style={{ background: 'var(--neo-raised)', border: '1px solid oklch(1 0 0 / 0.07)', boxShadow: 'var(--neo-shadow-raised)' }}
        >
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
              {editRow ? `Edit ${detailTable.displayName}` : `New ${detailTable.displayName}`}
            </DialogTitle>
          </DialogHeader>
          <div
            className="py-3"
            style={{ display: 'grid', gridTemplateColumns: `repeat(${detailForm.columns}, 1fr)`, gap: '16px' }}
          >
            {visibleFields.map((ff) => {
              const field = getField(ff.fieldId);
              if (!field) return null;
              // Hide the FK field (it's auto-set)
              if (detailFKField && field.id === detailFKField.id) return null;
              const val = rowData[field.name];
              const err = errors[field.name];
              return (
                <div key={ff.id} style={{ gridColumn: `span ${Math.min(ff.colSpan, detailForm.columns)}` }}>
                  <label
                    className="text-xs font-semibold mb-1.5 flex items-center gap-1"
                    style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    {field.displayName.toUpperCase()}
                    {field.required && <span style={{ color: 'var(--destructive)' }}>*</span>}
                  </label>
                  <FieldWidget
                    field={field}
                    formField={ff}
                    value={val}
                    onChange={(v) => setRowData({ ...rowData, [field.name]: v })}
                    allFields={tableFields}
                    allRows={rows}
                  />
                  {err && (
                    <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--destructive)' }}>
                      <AlertCircle size={10} />{err}
                    </p>
                  )}
                  {field.helpText && !err && (
                    <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{field.helpText}</p>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter className="gap-2">
            <button onClick={() => setShowForm(false)} className="neo-btn px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--muted-foreground)' }}>
              <X size={14} className="inline mr-1" />Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg"
              style={{ background: '#6366f1', color: 'white' }}
            >
              <Save size={14} />{editRow ? 'Update' : 'Add Record'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent style={{ background: 'var(--neo-raised)', border: '1px solid oklch(1 0 0 / 0.07)' }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>Delete Record</DialogTitle>
          </DialogHeader>
          <p className="text-sm py-2" style={{ color: 'var(--muted-foreground)' }}>Delete this {detailTable.displayName} record? This cannot be undone.</p>
          <DialogFooter className="gap-2">
            <button onClick={() => setConfirmDelete(null)} className="neo-btn px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--muted-foreground)' }}>Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 text-sm font-semibold rounded-lg" style={{ background: 'var(--destructive)', color: 'white' }}>Delete</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Master Create Button (inline quick-create) ────────────────────────────────
function MasterCreateButton({
  form, table, fields, saveRow, onCreated,
}: {
  form: DBForm;
  table: { id: string; displayName: string };
  fields: DBField[];
  saveRow: (tableId: string, row: Partial<DataRow>) => Promise<DataRow>;
  onCreated: (row: DataRow) => void;
}) {
  const [open, setOpen] = useState(false);
  let formFields: FormField[] = [];
  try { formFields = JSON.parse(form.formFields); } catch {}
  const visibleFields = formFields.filter((ff) => ff.visible);
  const [rowData, setRowData] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const getField = (fieldId: string) => fields.find((f) => f.id === fieldId);

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    visibleFields.forEach((ff) => {
      const field = getField(ff.fieldId);
      if (!field) return;
      const val = rowData[field.name];
      if (field.required && field.fieldType !== 'id' && (val === undefined || val === null || val === '')) {
        errs[field.name] = `${field.displayName} is required`;
      }
    });
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    const saved = await saveRow(table.id, { ...rowData, _id: nanoid() } as Partial<DataRow>);
    setOpen(false);
    setRowData({});
    onCreated(saved);
    toast.success(`${table.displayName} created`);
  };

  return (
    <>
      <button
        onClick={() => { setRowData({}); setErrors({}); setOpen(true); }}
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-120"
        style={{ background: 'rgba(245,166,35,0.15)', color: 'var(--amber)', border: '1px solid rgba(245,166,35,0.3)' }}
        title={`New ${table.displayName}`}
      >
        <Plus size={13} />
      </button>
      <Dialog open={open} onOpenChange={() => setOpen(false)}>
        <DialogContent
          className="max-w-xl max-h-[90vh] overflow-y-auto"
          style={{ background: 'var(--neo-raised)', border: '1px solid oklch(1 0 0 / 0.07)', boxShadow: 'var(--neo-shadow-raised)' }}
        >
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
              New {table.displayName}
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-3">
            {visibleFields.map((ff) => {
              const field = getField(ff.fieldId);
              if (!field || field.fieldType === 'id') return null;
              const val = rowData[field.name];
              const err = errors[field.name];
              return (
                <div key={ff.id}>
                  <label className="text-xs font-semibold mb-1.5 flex items-center gap-1" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {field.displayName.toUpperCase()}
                    {field.required && <span style={{ color: 'var(--destructive)' }}>*</span>}
                  </label>
                  <FieldWidget field={field} formField={ff} value={val} onChange={(v) => setRowData({ ...rowData, [field.name]: v })} allFields={fields} allRows={[]} />
                  {err && <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--destructive)' }}><AlertCircle size={10} />{err}</p>}
                </div>
              );
            })}
          </div>
          <DialogFooter className="gap-2">
            <button onClick={() => setOpen(false)} className="neo-btn px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--muted-foreground)' }}>Cancel</button>
            <button onClick={handleSave} className="neo-btn-primary flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg">
              <Save size={14} />Create
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Master Edit Button ────────────────────────────────────────────────────────
function MasterEditButton({
  form, table, fields, row, saveRow, onSaved,
}: {
  form: DBForm;
  table: { id: string; displayName: string };
  fields: DBField[];
  row: DataRow;
  saveRow: (tableId: string, row: Partial<DataRow>) => Promise<DataRow>;
  onSaved: (updated: DataRow) => void;
}) {
  const [open, setOpen] = useState(false);
  let formFields: FormField[] = [];
  try { formFields = JSON.parse(form.formFields); } catch {}
  const visibleFields = formFields.filter((ff) => ff.visible);
  const [rowData, setRowData] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const getField = (fieldId: string) => fields.find((f) => f.id === fieldId);

  const openDialog = () => { setRowData({ ...row }); setErrors({}); setOpen(true); };

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    visibleFields.forEach((ff) => {
      const field = getField(ff.fieldId);
      if (!field) return;
      const val = rowData[field.name];
      if (field.required && field.fieldType !== 'id' && (val === undefined || val === null || val === '')) {
        errs[field.name] = `${field.displayName} is required`;
      }
    });
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    const saved = await saveRow(table.id, { ...rowData, _id: row._id, _createdAt: row._createdAt } as Partial<DataRow>);
    setOpen(false);
    onSaved(saved);
    toast.success(`${table.displayName} updated`);
  };

  return (
    <>
      <button
        onClick={openDialog}
        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-120"
        style={{ background: 'oklch(1 0 0 / 0.06)', color: 'var(--muted-foreground)' }}
        title={`Edit ${table.displayName}`}
      >
        <Edit3 size={13} />
      </button>
      <Dialog open={open} onOpenChange={() => setOpen(false)}>
        <DialogContent
          className="max-w-xl max-h-[90vh] overflow-y-auto"
          style={{ background: 'var(--neo-raised)', border: '1px solid oklch(1 0 0 / 0.07)', boxShadow: 'var(--neo-shadow-raised)' }}
        >
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
              Edit {table.displayName}
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-3">
            {visibleFields.map((ff) => {
              const field = getField(ff.fieldId);
              if (!field) return null;
              const val = rowData[field.name];
              const err = errors[field.name];
              return (
                <div key={ff.id}>
                  <label className="text-xs font-semibold mb-1.5 flex items-center gap-1" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {field.displayName.toUpperCase()}
                    {field.required && <span style={{ color: 'var(--destructive)' }}>*</span>}
                  </label>
                  <FieldWidget field={field} formField={ff} value={val} onChange={(v) => setRowData({ ...rowData, [field.name]: v })} allFields={fields} allRows={[]} />
                  {err && <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--destructive)' }}><AlertCircle size={10} />{err}</p>}
                </div>
              );
            })}
          </div>
          <DialogFooter className="gap-2">
            <button onClick={() => setOpen(false)} className="neo-btn px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--muted-foreground)' }}>Cancel</button>
            <button onClick={handleSave} className="neo-btn-primary flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg">
              <Save size={14} />Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Master Delete Button ──────────────────────────────────────────────────────
function MasterDeleteButton({
  row, table, deleteRow, onDeleted,
}: {
  row: DataRow;
  table: { id: string; displayName: string };
  deleteRow: (tableId: string, id: string) => Promise<void>;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const handleDelete = async () => {
    await deleteRow(table.id, row._id);
    setOpen(false);
    onDeleted();
    toast.success(`${table.displayName} deleted`);
  };
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-120"
        style={{ background: 'oklch(1 0 0 / 0.06)', color: 'var(--destructive)' }}
        title={`Delete ${table.displayName}`}
      >
        <Trash2 size={13} />
      </button>
      <Dialog open={open} onOpenChange={() => setOpen(false)}>
        <DialogContent style={{ background: 'var(--neo-raised)', border: '1px solid oklch(1 0 0 / 0.07)' }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>Delete {table.displayName}</DialogTitle>
          </DialogHeader>
          <p className="text-sm py-2" style={{ color: 'var(--muted-foreground)' }}>
            Delete this {table.displayName} record? This cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <button onClick={() => setOpen(false)} className="neo-btn px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--muted-foreground)' }}>Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 text-sm font-semibold rounded-lg" style={{ background: 'var(--destructive)', color: 'white' }}>Delete</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Standard Form Runner (unchanged flat form) ────────────────────────────────
function StandardFormRunner({
  projectId, form, table, fields, forms, getRows, saveRow, deleteRow, navigate, backPath,
}: {
  projectId: string;
  form: DBForm;
  table: DBTable;
  fields: DBField[];
  forms: DBForm[];
  getRows: (tableId: string) => Promise<DataRow[]>;
  saveRow: (tableId: string, row: Partial<DataRow>) => Promise<DataRow>;
  deleteRow: (tableId: string, id: string) => Promise<void>;
  navigate: (path: string) => void;
  backPath: string;
}) {
  const tableFields = fields.filter((f) => f.tableId === table.id);
  let formFields: FormField[] = [];
  try { formFields = JSON.parse(form.formFields); } catch {}
  const visibleFields = formFields.filter((ff) => ff.visible);

  const [rows, setRows] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState<DataRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DataRow | null>(null);
  const [rowData, setRowData] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mockDataOpen, setMockDataOpen] = useState(false);

  const loadRows = useCallback(async () => {
    setLoading(true);
    const data = await getRows(table.id);
    setRows(data.sort((a, b) => b._createdAt - a._createdAt));
    setLoading(false);
  }, [table, getRows]);

  useEffect(() => { loadRows(); }, [loadRows]);

  const getField = (fieldId: string): DBField | undefined => tableFields.find((f) => f.id === fieldId);

  const openCreate = () => {
    const defaults: Record<string, unknown> = {};
    tableFields.forEach((f) => {
      if (f.defaultValue !== null && f.defaultValue !== undefined) defaults[f.name] = f.defaultValue;
    });
    setRowData(defaults);
    setErrors({});
    setEditRow(null);
    setShowForm(true);
  };

  const openEdit = (row: DataRow) => {
    setRowData({ ...row });
    setErrors({});
    setEditRow(row);
    setShowForm(true);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    visibleFields.forEach((ff) => {
      const field = getField(ff.fieldId);
      if (!field) return;
      const val = rowData[field.name];
      if (field.required && field.fieldType !== 'id' && (val === undefined || val === null || val === '')) {
        errs[field.name] = `${field.displayName} is required`;
      }
      if (field.fieldType === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val))) {
        errs[field.name] = 'Invalid email address';
      }
      if (field.fieldType === 'url' && val && !/^https?:\/\/.+/.test(String(val))) {
        errs[field.name] = 'Invalid URL (must start with http:// or https://)';
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const row: Partial<DataRow> = {
      ...rowData,
      _id: editRow?._id ?? nanoid(),
      _createdAt: editRow?._createdAt,
    } as Partial<DataRow>;
    await saveRow(table.id, row);
    setShowForm(false);
    await loadRows();
    toast.success(editRow ? 'Record updated' : 'Record created');
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteRow(table.id, confirmDelete._id);
    setConfirmDelete(null);
    await loadRows();
    toast.success('Record deleted');
  };

  const filteredRows = rows.filter((row) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(s));
  });

  const getDisplayValue = (row: DataRow, fieldId: string): string => {
    const field = getField(fieldId);
    if (!field) return '';
    const val = row[field.name];
    if (val === undefined || val === null) return '—';
    if (field.fieldType === 'boolean') return val ? 'Yes' : 'No';
    if (field.fieldType === 'image') return '[Image]';
    if (field.fieldType === 'file') return '[File]';
    if (field.fieldType === 'large_text') return String(val).substring(0, 60) + (String(val).length > 60 ? '…' : '');
    if (field.fieldType === 'date' || field.fieldType === 'datetime') {
      try { return new Date(String(val)).toLocaleDateString(); } catch { return String(val); }
    }
    return String(val);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header bar */}
      <div
        className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid oklch(1 0 0 / 0.06)', background: 'var(--neo-inset)' }}
      >
        <button
          onClick={() => navigate(backPath)}
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--neo-raised)', boxShadow: 'var(--neo-shadow-raised-sm)', color: 'var(--muted-foreground)' }}
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
            {form.displayName}
          </h1>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>
            {table.displayName} · {rows.length} records
          </p>
        </div>
        <div className="flex items-center gap-2">
          {form.allowSearch && (
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
              <input
                className="neo-input pl-8 pr-3 py-2 text-sm rounded-lg w-48"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
              />
            </div>
          )}
          {form.allowCreate && (
            <button onClick={openCreate} className="neo-btn-primary flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg">
              <Plus size={14} />New
            </button>
          )}
        </div>
      </div>

      {/* Data grid */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="neo-inset rounded-xl p-10 text-center flex flex-col items-center gap-4">
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {search ? 'No records match your search.' : 'No records yet. Click New to add the first one.'}
            </p>
            {!search && (
              <button
                onClick={() => setMockDataOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg"
                style={{ background: 'oklch(0.65 0.18 75 / 0.15)', color: '#f5a623', border: '1px solid oklch(0.65 0.18 75 / 0.3)' }}
              >
                <Sparkles size={14} />
                Generate Mock Data with AI
              </button>
            )}
          </div>
        ) : (
          <div className="neo-inset rounded-xl overflow-hidden">
            <div
              className="flex items-center px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
              style={{
                color: 'var(--muted-foreground)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.65rem',
                borderBottom: '1px solid oklch(1 0 0 / 0.06)',
                background: 'oklch(1 0 0 / 0.02)',
              }}
            >
              {visibleFields.slice(0, 6).map((ff) => {
                const field = getField(ff.fieldId);
                return (
                  <div key={ff.id} className="flex-1 min-w-0 px-1">
                    {field?.displayName ?? ff.fieldId}
                  </div>
                );
              })}
              <div className="w-20 flex-shrink-0 text-right">Actions</div>
            </div>
            {filteredRows.map((row) => (
              <div
                key={row._id}
                className="flex items-center px-4 py-3 transition-all duration-120"
                style={{ borderBottom: '1px solid oklch(1 0 0 / 0.04)' }}
              >
                {visibleFields.slice(0, 6).map((ff) => {
                  const field = getField(ff.fieldId);
                  return (
                    <div key={ff.id} className="flex-1 min-w-0 px-1">
                      <span
                        className="text-sm truncate block"
                        style={{ color: 'var(--foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}
                      >
                        {field ? getDisplayValue(row, ff.fieldId) : '—'}
                      </span>
                    </div>
                  );
                })}
                <div className="w-20 flex-shrink-0 flex justify-end gap-1">
                  {form.allowEdit && (
                    <button
                      onClick={() => openEdit(row)}
                      className="w-6 h-6 rounded flex items-center justify-center"
                      style={{ color: 'var(--muted-foreground)', background: 'oklch(1 0 0 / 0.06)' }}
                    >
                      <Edit3 size={11} />
                    </button>
                  )}
                  {form.allowDelete && (
                    <button
                      onClick={() => setConfirmDelete(row)}
                      className="w-6 h-6 rounded flex items-center justify-center"
                      style={{ color: 'var(--destructive)', background: 'oklch(1 0 0 / 0.06)' }}
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={() => setShowForm(false)}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          style={{ background: 'var(--neo-raised)', border: '1px solid oklch(1 0 0 / 0.07)', boxShadow: 'var(--neo-shadow-raised)' }}
        >
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
              {editRow ? `Edit Record` : `New Record`}
            </DialogTitle>
          </DialogHeader>
          <div
            className="py-3"
            style={{ display: 'grid', gridTemplateColumns: `repeat(${form.columns}, 1fr)`, gap: '16px' }}
          >
            {visibleFields.map((ff) => {
              const field = getField(ff.fieldId);
              if (!field) return null;
              const val = rowData[field.name];
              const err = errors[field.name];
              return (
                <div key={ff.id} style={{ gridColumn: `span ${Math.min(ff.colSpan, form.columns)}` }}>
                  <label
                    className="text-xs font-semibold mb-1.5 flex items-center gap-1"
                    style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    {field.displayName.toUpperCase()}
                    {field.required && <span style={{ color: 'var(--destructive)' }}>*</span>}
                  </label>
                  <FieldWidget
                    field={field}
                    formField={ff}
                    value={val}
                    onChange={(v) => setRowData({ ...rowData, [field.name]: v })}
                    allFields={tableFields}
                    allRows={rows}
                  />
                  {err && (
                    <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--destructive)' }}>
                      <AlertCircle size={10} />{err}
                    </p>
                  )}
                  {field.helpText && !err && (
                    <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{field.helpText}</p>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter className="gap-2">
            <button onClick={() => setShowForm(false)} className="neo-btn px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--muted-foreground)' }}>
              <X size={14} className="inline mr-1" />Cancel
            </button>
            <button onClick={handleSave} className="neo-btn-primary flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg">
              <Save size={14} />{editRow ? 'Update' : 'Create'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent style={{ background: 'var(--neo-raised)', border: '1px solid oklch(1 0 0 / 0.07)' }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>Delete Record</DialogTitle>
          </DialogHeader>
          <p className="text-sm py-2" style={{ color: 'var(--muted-foreground)' }}>Delete this record? This cannot be undone.</p>
          <DialogFooter className="gap-2">
            <button onClick={() => setConfirmDelete(null)} className="neo-btn px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--muted-foreground)' }}>Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 text-sm font-semibold rounded-lg" style={{ background: 'var(--destructive)', color: 'white' }}>Delete</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mock Data Generator */}
      <MockDataGeneratorDialog
        open={mockDataOpen}
        onOpenChange={setMockDataOpen}
        projectId={projectId}
        table={table}
        fields={tableFields}
        onSeeded={async () => { await loadRows(); }}
      />
    </div>
  );
}

// ─── Field Widget Component ────────────────────────────────────────────────────
function FieldWidget({
  field, formField, value, onChange, allFields, allRows,
}: {
  field: DBField;
  formField: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  allFields: DBField[];
  allRows: DataRow[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  if (formField.readOnly || field.fieldType === 'id') {
    return (
      <div
        className="px-3 py-2 rounded-lg text-sm"
        style={{ background: 'var(--neo-inset)', boxShadow: 'var(--neo-shadow-inset-sm)', color: value ? 'var(--foreground)' : 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}
      >
        {String(value ?? (field.fieldType === 'id' ? '(auto)' : '—')) as string}
      </div>
    );
  }

  if (field.fieldType === 'boolean') {
    return (
      <button
        onClick={() => onChange(!value)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all"
        style={{
          background: value ? 'rgba(16,185,129,0.15)' : 'var(--neo-inset)',
          border: `1px solid ${value ? '#10b98155' : 'oklch(1 0 0 / 0.06)'}`,
          color: value ? '#10b981' : 'var(--muted-foreground)',
        }}
      >
        <div className="w-4 h-4 rounded flex items-center justify-center" style={{ background: value ? '#10b981' : 'oklch(1 0 0 / 0.1)' }}>
          {!!value && <Check size={10} className="text-white" />}
        </div>
        <span className="text-sm">{value ? 'Yes' : 'No'}</span>
      </button>
    );
  }

  if (field.fieldType === 'large_text' || field.fieldType === 'json') {
    return (
      <textarea
        className="neo-input w-full px-3 py-2 text-sm rounded-lg resize-none"
        rows={4}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        placeholder={formField.placeholder || field.placeholder || ''}
        style={{ fontFamily: field.fieldType === 'json' ? 'JetBrains Mono, monospace' : 'Inter, sans-serif', fontSize: '0.85rem' }}
      />
    );
  }

  if (field.fieldType === 'lov') {
    let options: { value: string; label: string }[] = [];
    try { options = JSON.parse(field.lovValues ?? '[]'); } catch {}
    return (
      <select className="neo-input w-full px-3 py-2 text-sm rounded-lg" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select...</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  if (field.fieldType === 'color') {
    return (
      <div className="flex items-center gap-2">
        <input type="color" className="w-10 h-10 rounded-lg cursor-pointer border-0" style={{ background: 'var(--neo-inset)', boxShadow: 'var(--neo-shadow-inset-sm)' }} value={String(value ?? '#f5a623')} onChange={(e) => onChange(e.target.value)} />
        <input className="neo-input flex-1 px-3 py-2 text-sm rounded-lg" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} placeholder="#f5a623" style={{ fontFamily: 'JetBrains Mono, monospace' }} />
      </div>
    );
  }

  if (field.fieldType === 'image' || field.fieldType === 'file') {
    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => onChange(reader.result);
      reader.readAsDataURL(file);
    };
    return (
      <div>
        <input ref={fileRef} type="file" className="hidden" accept={field.fieldType === 'image' ? 'image/*' : '*'} onChange={handleFile} />
        <button onClick={() => fileRef.current?.click()} className="neo-btn flex items-center gap-2 px-3 py-2 text-sm rounded-lg w-full justify-center" style={{ color: 'var(--muted-foreground)' }}>
          <Upload size={14} />{value ? 'Change File' : `Upload ${field.fieldType === 'image' ? 'Image' : 'File'}`}
        </button>
        {!!value && field.fieldType === 'image' && <img src={String(value)} alt="preview" className="mt-2 rounded-lg max-h-24 object-cover" />}
        {!!value && field.fieldType === 'file' && <p className="mt-1 text-xs" style={{ color: '#10b981' }}>File loaded ✓</p>}
      </div>
    );
  }

  if (field.fieldType === 'date') {
    return <input type="date" className="neo-input w-full px-3 py-2 text-sm rounded-lg" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} style={{ colorScheme: 'dark' }} />;
  }

  if (field.fieldType === 'datetime') {
    return <input type="datetime-local" className="neo-input w-full px-3 py-2 text-sm rounded-lg" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} style={{ colorScheme: 'dark' }} />;
  }

  if (field.fieldType === 'time') {
    return <input type="time" className="neo-input w-full px-3 py-2 text-sm rounded-lg" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} style={{ colorScheme: 'dark' }} />;
  }

  if (field.fieldType === 'number' || field.fieldType === 'decimal') {
    return (
      <input
        type="number"
        className="neo-input w-full px-3 py-2 text-sm rounded-lg"
        value={String(value ?? '')}
        onChange={(e) => onChange(field.fieldType === 'decimal' ? parseFloat(e.target.value) : parseInt(e.target.value))}
        min={field.min} max={field.max}
        step={field.fieldType === 'decimal' ? 'any' : '1'}
        placeholder={formField.placeholder || field.placeholder || '0'}
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
      />
    );
  }

  if (field.fieldType === 'email') {
    return <input type="email" className="neo-input w-full px-3 py-2 text-sm rounded-lg" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} placeholder={formField.placeholder || field.placeholder || 'user@example.com'} />;
  }

  if (field.fieldType === 'url') {
    return <input type="url" className="neo-input w-full px-3 py-2 text-sm rounded-lg" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} placeholder={formField.placeholder || field.placeholder || 'https://'} />;
  }

  return (
    <input
      type="text"
      className="neo-input w-full px-3 py-2 text-sm rounded-lg"
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      maxLength={field.maxLength}
      minLength={field.minLength}
      placeholder={formField.placeholder || field.placeholder || ''}
    />
  );
}
