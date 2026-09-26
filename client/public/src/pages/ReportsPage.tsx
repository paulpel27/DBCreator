/**
 * ReportsPage — Report designer and list
 * Obsidian Forge: column selector, filters, aggregations
 */
import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { BarChart3, Plus, Trash2, Edit3, Play, ChevronLeft, GripVertical } from 'lucide-react';
import { useDB } from '@/contexts/DBContext';
import type { DBReport, ReportColumn, ReportColumnAgg, ReportFilter } from '@/lib/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';

const AGG_OPTIONS: { value: ReportColumnAgg; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Avg' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
];

const FILTER_OPS = [
  { value: 'eq', label: '= Equals' },
  { value: 'neq', label: '≠ Not equals' },
  { value: 'gt', label: '> Greater than' },
  { value: 'gte', label: '≥ Greater or equal' },
  { value: 'lt', label: '< Less than' },
  { value: 'lte', label: '≤ Less or equal' },
  { value: 'contains', label: '⊃ Contains' },
  { value: 'starts', label: '⌖ Starts with' },
  { value: 'empty', label: '∅ Is empty' },
  { value: 'notempty', label: '⊘ Is not empty' },
];

export default function ReportsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, navigate] = useLocation();
  const { projects, tables, fields, reports, createReport, updateReport, deleteReport } = useDB();

  const project = projects.find((p) => p.id === projectId);
  const projectReports = reports.filter((r) => r.projectId === projectId).sort((a, b) => a.sortOrder - b.sortOrder);
  const projectTables = tables.filter((t) => t.projectId === projectId);

  const [showCreate, setShowCreate] = useState(false);
  const [editReport, setEditReport] = useState<DBReport | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DBReport | null>(null);
  const [formData, setFormData] = useState({
    tableId: '',
    displayName: '',
    description: '',
    defaultSortDir: 'asc' as 'asc' | 'desc',
    showTotals: false,
    pageSize: 25,
    allowExport: true,
    allowPrint: true,
  });
  const [columns, setColumns] = useState<ReportColumn[]>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const getTableFields = (tableId: string) => fields.filter((f) => f.tableId === tableId);
  const getTableName = (id: string) => tables.find((t) => t.id === id)?.displayName ?? id;
  const getFieldName = (id: string) => fields.find((f) => f.id === id)?.displayName ?? id;

  const autoGenerateColumns = (tableId: string) => {
    const tFields = getTableFields(tableId);
    return tFields.map((f, idx): ReportColumn => ({
      id: nanoid(),
      fieldId: f.id,
      label: f.displayName,
      width: 150,
      sortable: true,
      filterable: true,
      aggregation: 'none',
      format: '',
      visible: true,
      sortOrder: idx,
    }));
  };

  const handleTableChange = (tableId: string) => {
    setFormData({ ...formData, tableId });
    setColumns(autoGenerateColumns(tableId));
    setFilters([]);
  };

  const handleCreate = async () => {
    if (!formData.tableId || !formData.displayName.trim()) return;
    const safeName = formData.displayName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    await createReport({
      projectId,
      tableId: formData.tableId,
      name: safeName,
      displayName: formData.displayName.trim(),
      description: formData.description.trim(),
      reportColumns: JSON.stringify(columns),
      filters: JSON.stringify(filters),
      defaultSort: '',
      defaultSortDir: formData.defaultSortDir,
      groupBy: '',
      showTotals: formData.showTotals,
      pageSize: formData.pageSize,
      allowExport: formData.allowExport,
      allowPrint: formData.allowPrint,
    });
    setShowCreate(false);
    resetState();
    toast.success('Report created');
  };

  const handleEdit = async () => {
    if (!editReport) return;
    await updateReport({
      ...editReport,
      tableId: formData.tableId,
      displayName: formData.displayName.trim(),
      description: formData.description.trim(),
      reportColumns: JSON.stringify(columns),
      filters: JSON.stringify(filters),
      defaultSortDir: formData.defaultSortDir,
      showTotals: formData.showTotals,
      pageSize: formData.pageSize,
      allowExport: formData.allowExport,
      allowPrint: formData.allowPrint,
    });
    setEditReport(null);
    toast.success('Report updated');
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteReport(confirmDelete.id);
    setConfirmDelete(null);
    toast.success('Report deleted');
  };

  const openEdit = (r: DBReport) => {
    setEditReport(r);
    setFormData({
      tableId: r.tableId,
      displayName: r.displayName,
      description: r.description,
      defaultSortDir: r.defaultSortDir,
      showTotals: r.showTotals,
      pageSize: r.pageSize,
      allowExport: r.allowExport,
      allowPrint: r.allowPrint,
    });
    try { setColumns(JSON.parse(r.reportColumns) as ReportColumn[]); } catch { setColumns([]); }
    try { setFilters(JSON.parse(r.filters) as ReportFilter[]); } catch { setFilters([]); }
  };

  const resetState = () => {
    setFormData({ tableId: '', displayName: '', description: '', defaultSortDir: 'asc', showTotals: false, pageSize: 25, allowExport: true, allowPrint: true });
    setColumns([]);
    setFilters([]);
  };

  const addFilter = () => {
    const tFields = getTableFields(formData.tableId);
    if (!tFields.length) return;
    setFilters([...filters, { id: nanoid(), fieldId: tFields[0].id, operator: 'eq', value: '', label: '' }]);
  };

  const updateFilter = (id: string, patch: Partial<ReportFilter>) => {
    setFilters((prev) => prev.map((f) => f.id === id ? { ...f, ...patch } : f));
  };

  const removeFilter = (id: string) => setFilters((prev) => prev.filter((f) => f.id !== id));

  const toggleColumnVisible = (id: string) => {
    setColumns((prev) => prev.map((c) => c.id === id ? { ...c, visible: !c.visible } : c));
  };

  const updateColumnAgg = (id: string, aggregation: ReportColumnAgg) => {
    setColumns((prev) => prev.map((c) => c.id === id ? { ...c, aggregation } : c));
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    const arr = [...columns];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(idx, 0, moved);
    setColumns(arr);
    setDragIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 animate-slide-in-up">
        <button onClick={() => navigate(`/designer/${projectId}`)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--neo-raised)', boxShadow: 'var(--neo-shadow-raised-sm)', color: 'var(--muted-foreground)' }}>
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>{project?.name}</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>Report Designer</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{projectReports.length} report{projectReports.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { setShowCreate(true); resetState(); }} className="neo-btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg">
          <Plus size={16} />New Report
        </button>
      </div>

      {/* Reports list */}
      {projectReports.length === 0 ? (
        <div className="neo-inset rounded-2xl p-12 text-center animate-fade-in">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--amber-soft)' }}>
            <BarChart3 size={24} style={{ color: 'var(--amber)' }} />
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>No reports yet</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>Create reports to view and analyze your data with filters and aggregations.</p>
          <button onClick={() => setShowCreate(true)} className="neo-btn-primary px-6 py-2.5 text-sm font-semibold rounded-lg">Create Report</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {projectReports.map((report) => {
            let parsedCols: ReportColumn[] = [];
            try { parsedCols = JSON.parse(report.reportColumns); } catch {}
            let parsedFilters: ReportFilter[] = [];
            try { parsedFilters = JSON.parse(report.filters); } catch {}
            return (
              <div key={report.id} className="neo-raised rounded-xl overflow-hidden group">
                <div className="h-1" style={{ background: '#6366f1', boxShadow: '0 0 8px rgba(99,102,241,0.3)' }} />
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-sm" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>{report.displayName}</h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        Table: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{getTableName(report.tableId)}</span>
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(report)} className="w-6 h-6 rounded flex items-center justify-center" style={{ color: 'var(--muted-foreground)', background: 'oklch(1 0 0 / 0.05)' }}>
                        <Edit3 size={11} />
                      </button>
                      <button onClick={() => setConfirmDelete(report)} className="w-6 h-6 rounded flex items-center justify-center" style={{ color: 'var(--destructive)', background: 'oklch(1 0 0 / 0.05)' }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap mb-3">
                    {report.allowExport && <span className="field-type-badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>Export</span>}
                    {report.allowPrint && <span className="field-type-badge" style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}>Print</span>}
                    {report.showTotals && <span className="field-type-badge" style={{ background: 'rgba(245,166,35,0.15)', color: '#f5a623' }}>Totals</span>}
                  </div>
                  <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>
                    {parsedCols.filter((c) => c.visible).length} cols · {parsedFilters.length} filters · {report.pageSize}/page
                  </p>
                  <button
                    onClick={() => navigate(`/view/${projectId}/${report.id}`)}
                    className="neo-btn-primary w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg"
                  >
                    <Play size={12} />View Report
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate || !!editReport} onOpenChange={() => { setShowCreate(false); setEditReport(null); }}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          style={{ background: 'var(--neo-raised)', border: '1px solid oklch(1 0 0 / 0.07)', boxShadow: 'var(--neo-shadow-raised)' }}
        >
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
              {editReport ? 'Edit Report' : 'Create Report'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>REPORT NAME *</label>
                <input className="neo-input w-full px-3 py-2 text-sm rounded-lg" value={formData.displayName} onChange={(e) => setFormData({ ...formData, displayName: e.target.value })} placeholder="Sales Report" autoFocus />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>TABLE *</label>
                <select className="neo-input w-full px-3 py-2 text-sm rounded-lg" value={formData.tableId} onChange={(e) => handleTableChange(e.target.value)}>
                  <option value="">Select table...</option>
                  {projectTables.map((t) => <option key={t.id} value={t.id}>{t.displayName}</option>)}
                </select>
              </div>
            </div>

            {/* Options */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>PAGE SIZE:</label>
                <select className="neo-input px-2 py-1 text-xs rounded" value={formData.pageSize} onChange={(e) => setFormData({ ...formData, pageSize: parseInt(e.target.value) })}>
                  {[10, 25, 50, 100, 250].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              {(['showTotals', 'allowExport', 'allowPrint'] as const).map((key) => (
                <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                  <div
                    className="w-3.5 h-3.5 rounded flex items-center justify-center"
                    style={{ background: formData[key] ? 'var(--amber)' : 'var(--neo-inset)', boxShadow: formData[key] ? '0 0 4px rgba(245,166,35,0.3)' : 'var(--neo-shadow-inset-sm)' }}
                    onClick={() => setFormData({ ...formData, [key]: !formData[key] })}
                  >
                    {formData[key] && <span className="text-[#1e1e2e] text-xs font-bold leading-none">✓</span>}
                  </div>
                  <span className="text-xs capitalize" style={{ color: 'var(--foreground)' }}>
                    {key === 'showTotals' ? 'Show Totals' : key === 'allowExport' ? 'Export' : 'Print'}
                  </span>
                </label>
              ))}
            </div>

            {/* Columns */}
            {columns.length > 0 && (
              <div>
                <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>COLUMNS</label>
                <div className="neo-inset rounded-xl overflow-hidden">
                  <div className="grid text-xs font-semibold uppercase tracking-wider px-3 py-2" style={{ gridTemplateColumns: '24px 1fr 100px 60px', color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', borderBottom: '1px solid oklch(1 0 0 / 0.06)' }}>
                    <span /><span>Field</span><span>Aggregation</span><span>Visible</span>
                  </div>
                  {columns.map((col, idx) => (
                    <div
                      key={col.id}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={() => handleDrop(idx)}
                      onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                      className="grid items-center px-3 py-2 transition-all"
                      style={{ gridTemplateColumns: '24px 1fr 100px 60px', borderBottom: '1px solid oklch(1 0 0 / 0.04)', opacity: dragIdx === idx ? 0.5 : 1, background: dragOverIdx === idx ? 'var(--amber-soft)' : 'transparent' }}
                    >
                      <div className="drag-handle"><GripVertical size={12} /></div>
                      <span className="text-xs truncate" style={{ color: 'var(--foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
                        {getFieldName(col.fieldId)}
                      </span>
                      <select
                        className="neo-input px-1.5 py-1 text-xs rounded"
                        value={col.aggregation}
                        onChange={(e) => updateColumnAgg(col.id, e.target.value as ReportColumnAgg)}
                        style={{ fontSize: '0.7rem' }}
                      >
                        {AGG_OPTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                      </select>
                      <button
                        onClick={() => toggleColumnVisible(col.id)}
                        className="text-xs font-semibold"
                        style={{ color: col.visible ? '#10b981' : 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}
                      >
                        {col.visible ? 'YES' : 'NO'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filters */}
            {formData.tableId && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>FILTERS</label>
                  <button onClick={addFilter} className="text-xs flex items-center gap-1" style={{ color: 'var(--amber)' }}>
                    <Plus size={11} />Add Filter
                  </button>
                </div>
                {filters.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>No filters. All records will be shown.</p>
                ) : (
                  <div className="space-y-2">
                    {filters.map((f) => (
                      <div key={f.id} className="flex items-center gap-2">
                        <select
                          className="neo-input flex-1 px-2 py-1.5 text-xs rounded"
                          value={f.fieldId}
                          onChange={(e) => updateFilter(f.id, { fieldId: e.target.value })}
                        >
                          {getTableFields(formData.tableId).map((tf) => <option key={tf.id} value={tf.id}>{tf.displayName}</option>)}
                        </select>
                        <select
                          className="neo-input w-36 px-2 py-1.5 text-xs rounded"
                          value={f.operator}
                          onChange={(e) => updateFilter(f.id, { operator: e.target.value })}
                        >
                          {FILTER_OPS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                        </select>
                        {!['empty', 'notempty'].includes(f.operator) && (
                          <input
                            className="neo-input flex-1 px-2 py-1.5 text-xs rounded"
                            value={f.value}
                            onChange={(e) => updateFilter(f.id, { value: e.target.value })}
                            placeholder="Value..."
                          />
                        )}
                        <button onClick={() => removeFilter(f.id)} className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ color: 'var(--destructive)', background: 'oklch(1 0 0 / 0.05)' }}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <button onClick={() => { setShowCreate(false); setEditReport(null); }} className="neo-btn px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--muted-foreground)' }}>Cancel</button>
            <button
              onClick={editReport ? handleEdit : handleCreate}
              disabled={!formData.tableId || !formData.displayName.trim()}
              className="neo-btn-primary px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
            >
              {editReport ? 'Save' : 'Create'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent style={{ background: 'var(--neo-raised)', border: '1px solid oklch(1 0 0 / 0.07)' }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>Delete Report</DialogTitle>
          </DialogHeader>
          <p className="text-sm py-2" style={{ color: 'var(--muted-foreground)' }}>Delete report <strong style={{ color: 'var(--foreground)' }}>{confirmDelete?.displayName}</strong>?</p>
          <DialogFooter className="gap-2">
            <button onClick={() => setConfirmDelete(null)} className="neo-btn px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--muted-foreground)' }}>Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 text-sm font-semibold rounded-lg" style={{ background: 'var(--destructive)', color: 'white' }}>Delete</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
