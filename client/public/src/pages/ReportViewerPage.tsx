/**
 * ReportViewerPage — Runtime report viewer
 * Obsidian Forge: sortable/filterable data grid, CSV export, print
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation } from 'wouter';
import { ChevronLeft, ChevronUp, ChevronDown, Download, Printer, Search, RefreshCw } from 'lucide-react';
import { useDB } from '@/contexts/DBContext';
import type { DataRow, ReportColumn, ReportFilter } from '@/lib/db';
import { toast } from 'sonner';

export default function ReportViewerPage() {
  const { projectId, reportId } = useParams<{ projectId: string; reportId: string }>();
  const [, navigate] = useLocation();
  const { projects, tables, fields, reports, getRows } = useDB();

  const project = projects.find((p) => p.id === projectId);
  const report = reports.find((r) => r.id === reportId);
  const table = report ? tables.find((t) => t.id === report.tableId) : undefined;
  const tableFields = table ? fields.filter((f) => f.tableId === table.id) : [];

  let reportColumns: ReportColumn[] = [];
  try { reportColumns = report ? JSON.parse(report.reportColumns) : []; } catch {}
  let reportFilters: ReportFilter[] = [];
  try { reportFilters = report ? JSON.parse(report.filters) : []; } catch {}

  const visibleColumns = reportColumns.filter((c) => c.visible);

  const [rows, setRows] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState(report?.defaultSort ?? '');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(report?.defaultSortDir ?? 'asc');
  const [page, setPage] = useState(1);

  const pageSize = report?.pageSize ?? 25;

  const loadRows = useCallback(async () => {
    if (!table) return;
    setLoading(true);
    const data = await getRows(table.id);
    setRows(data);
    setLoading(false);
  }, [table, getRows]);

  useEffect(() => { loadRows(); }, [loadRows]);

  const getField = (fieldId: string) => tableFields.find((f) => f.id === fieldId);

  const getDisplayValue = (row: DataRow, fieldId: string): string => {
    const field = getField(fieldId);
    if (!field) return '';
    const val = row[field.name];
    if (val === undefined || val === null) return '';
    if (field.fieldType === 'boolean') return val ? 'Yes' : 'No';
    if (field.fieldType === 'image' || field.fieldType === 'file') return '[Binary]';
    if (field.fieldType === 'date') {
      try { return new Date(String(val)).toLocaleDateString(); } catch { return String(val); }
    }
    if (field.fieldType === 'datetime') {
      try { return new Date(String(val)).toLocaleString(); } catch { return String(val); }
    }
    return String(val);
  };

  const applyFilters = (data: DataRow[]): DataRow[] => {
    return data.filter((row) => {
      for (const filter of reportFilters) {
        const field = getField(filter.fieldId);
        if (!field) continue;
        const val = String(row[field.name] ?? '').toLowerCase();
        const fv = filter.value.toLowerCase();
        switch (filter.operator) {
          case 'eq': if (val !== fv) return false; break;
          case 'neq': if (val === fv) return false; break;
          case 'gt': if (parseFloat(val) <= parseFloat(fv)) return false; break;
          case 'gte': if (parseFloat(val) < parseFloat(fv)) return false; break;
          case 'lt': if (parseFloat(val) >= parseFloat(fv)) return false; break;
          case 'lte': if (parseFloat(val) > parseFloat(fv)) return false; break;
          case 'contains': if (!val.includes(fv)) return false; break;
          case 'starts': if (!val.startsWith(fv)) return false; break;
          case 'empty': if (val !== '') return false; break;
          case 'notempty': if (val === '') return false; break;
        }
      }
      return true;
    });
  };

  const applySearch = (data: DataRow[]): DataRow[] => {
    if (!search.trim()) return data;
    const s = search.toLowerCase();
    return data.filter((row) =>
      visibleColumns.some((col) => getDisplayValue(row, col.fieldId).toLowerCase().includes(s))
    );
  };

  const applySort = (data: DataRow[]): DataRow[] => {
    if (!sortField) return data;
    const field = getField(sortField);
    if (!field) return data;
    return [...data].sort((a, b) => {
      const av = a[field.name];
      const bv = b[field.name];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  };

  const processedRows = applySort(applySearch(applyFilters(rows)));
  const totalPages = Math.max(1, Math.ceil(processedRows.length / pageSize));
  const pagedRows = processedRows.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (fieldId: string) => {
    if (sortField === fieldId) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(fieldId);
      setSortDir('asc');
    }
    setPage(1);
  };

  const computeAgg = (col: ReportColumn): string => {
    if (col.aggregation === 'none') return '';
    const field = getField(col.fieldId);
    if (!field) return '';
    const vals = processedRows.map((r) => parseFloat(String(r[field.name] ?? 0))).filter((v) => !isNaN(v));
    if (vals.length === 0) return '';
    switch (col.aggregation) {
      case 'count': return String(processedRows.length);
      case 'sum': return vals.reduce((a, b) => a + b, 0).toFixed(2);
      case 'avg': return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
      case 'min': return String(Math.min(...vals));
      case 'max': return String(Math.max(...vals));
      default: return '';
    }
  };

  const exportCSV = () => {
    const headers = visibleColumns.map((c) => getField(c.fieldId)?.displayName ?? c.fieldId).join(',');
    const csvRows = processedRows.map((row) =>
      visibleColumns.map((c) => `"${getDisplayValue(row, c.fieldId).replace(/"/g, '""')}"`).join(',')
    );
    const csv = [headers, ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report?.name ?? 'report'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const handlePrint = () => window.print();

  if (!report || !table) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p style={{ color: 'var(--muted-foreground)' }}>Report not found.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid oklch(1 0 0 / 0.06)', background: 'var(--neo-inset)' }}>
        <button onClick={() => navigate(`/reports/${projectId}`)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--neo-raised)', boxShadow: 'var(--neo-shadow-raised-sm)', color: 'var(--muted-foreground)' }}>
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>{report.displayName}</h1>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>
            {table.displayName} · {processedRows.length} records
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
            <input
              className="neo-input pl-8 pr-3 py-2 text-sm rounded-lg w-44"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search..."
            />
          </div>
          <button onClick={loadRows} className="neo-btn w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: 'var(--muted-foreground)' }}>
            <RefreshCw size={14} />
          </button>
          {report.allowExport && (
            <button onClick={exportCSV} className="neo-btn flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg" style={{ color: 'var(--muted-foreground)' }}>
              <Download size={13} />CSV
            </button>
          )}
          {report.allowPrint && (
            <button onClick={handlePrint} className="neo-btn flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg" style={{ color: 'var(--muted-foreground)' }}>
              <Printer size={13} />Print
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
        ) : (
          <div className="neo-inset rounded-xl overflow-hidden">
            {/* Column headers */}
            <div
              className="flex items-center px-4 py-2.5 sticky top-0"
              style={{ background: 'oklch(1 0 0 / 0.03)', borderBottom: '1px solid oklch(1 0 0 / 0.06)' }}
            >
              {visibleColumns.map((col) => {
                const field = getField(col.fieldId);
                const isSorted = sortField === col.fieldId;
                return (
                  <div
                    key={col.id}
                    className="flex-1 min-w-0 px-1 flex items-center gap-1 cursor-pointer select-none"
                    style={{ minWidth: col.width ?? 100, maxWidth: col.width ?? 200 }}
                    onClick={() => col.sortable && field && handleSort(col.fieldId)}
                  >
                    <span
                      className="text-xs font-semibold uppercase tracking-wider truncate"
                      style={{
                        color: isSorted ? 'var(--amber)' : 'var(--muted-foreground)',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '0.65rem',
                      }}
                    >
                      {col.label || field?.displayName}
                    </span>
                    {col.sortable && isSorted && (
                      sortDir === 'asc'
                        ? <ChevronUp size={11} style={{ color: 'var(--amber)', flexShrink: 0 }} />
                        : <ChevronDown size={11} style={{ color: 'var(--amber)', flexShrink: 0 }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Rows */}
            {pagedRows.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No records match the current filters.</p>
              </div>
            ) : (
              pagedRows.map((row, rowIdx) => (
                <div
                  key={row._id}
                  className="flex items-center px-4 py-3 transition-all duration-120"
                  style={{
                    borderBottom: '1px solid oklch(1 0 0 / 0.04)',
                    background: rowIdx % 2 === 0 ? 'transparent' : 'oklch(1 0 0 / 0.01)',
                  }}
                >
                  {visibleColumns.map((col) => (
                    <div
                      key={col.id}
                      className="flex-1 min-w-0 px-1"
                      style={{ minWidth: col.width ?? 100, maxWidth: col.width ?? 200 }}
                    >
                      <span
                        className="text-sm truncate block"
                        style={{ color: 'var(--foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}
                      >
                        {getDisplayValue(row, col.fieldId) || '—'}
                      </span>
                    </div>
                  ))}
                </div>
              ))
            )}

            {/* Totals row */}
            {report.showTotals && visibleColumns.some((c) => c.aggregation !== 'none') && (
              <div
                className="flex items-center px-4 py-2.5"
                style={{ borderTop: '1px solid oklch(1 0 0 / 0.08)', background: 'var(--amber-soft)' }}
              >
                {visibleColumns.map((col) => {
                  const agg = computeAgg(col);
                  return (
                    <div key={col.id} className="flex-1 min-w-0 px-1" style={{ minWidth: col.width ?? 100, maxWidth: col.width ?? 200 }}>
                      {agg && (
                        <span
                          className="text-xs font-bold"
                          style={{ color: 'var(--amber)', fontFamily: 'JetBrains Mono, monospace' }}
                        >
                          {col.aggregation.toUpperCase()}: {agg}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-between px-6 py-3 flex-shrink-0"
          style={{ borderTop: '1px solid oklch(1 0 0 / 0.06)', background: 'var(--neo-inset)' }}
        >
          <span className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
            Page {page} of {totalPages} · {processedRows.length} records
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="neo-btn px-3 py-1.5 text-xs rounded-lg disabled:opacity-40"
              style={{ color: 'var(--muted-foreground)' }}
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="neo-btn px-3 py-1.5 text-xs rounded-lg disabled:opacity-40"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
