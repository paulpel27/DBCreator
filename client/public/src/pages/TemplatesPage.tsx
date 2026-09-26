/**
 * TemplatesPage — Browse and install complete application templates
 * 6 ready-made app blueprints: CRM, Inventory, Project Tracker, School, Restaurant, HR
 * Obsidian Forge design: neomorphic cards, amber accents, preview modal with schema tree
 */
import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useDB } from '@/contexts/DBContext';
import { APP_TEMPLATES, type AppTemplate } from '@/lib/templates';
import { nanoid } from 'nanoid';
import { rowPut, ensureTableStore } from '@/lib/db';
import { toast } from 'sonner';
import {
  X,
  Zap,
  Table2,
  FileText,
  BarChart3,
  Menu,
  ChevronRight,
  Loader2,
  Check,
  Database,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ─── Install Engine ──────────────────────────────────────────────────────────

async function installTemplate(
  template: AppTemplate,
  ctx: ReturnType<typeof useDB>,
  onProgress: (msg: string) => void
): Promise<string> {
  const {
    createProject, setActiveProject,
    createTable, createField,
    createRelationship,
    createForm, updateForm,
    createReport,
    createMenu,
    saveRow,
  } = ctx;

  // Track seeded row IDs for FK cross-reference resolution
  const seededIds: Record<string, string[]> = {};

  onProgress('Creating database…');
  const project = await createProject({
    name: template.name,
    description: template.description,
  });
  await setActiveProject(project);

  // Map: template table name → real table ID
  const tableIdMap: Record<string, string> = {};
  // Map: template field name within table → real field ID
  const fieldIdMap: Record<string, Record<string, string>> = {};

  // 1. Create tables + fields
  for (const tDef of template.tables) {
    onProgress(`Creating table: ${tDef.displayName}…`);
    const table = await createTable({
      projectId: project.id,
      name: tDef.name,
      displayName: tDef.displayName,
      description: tDef.description || '',
      tableType: (tDef.tableType || 'standard') as any,
      color: tDef.color || '#6366f1',
    });
    tableIdMap[tDef.name] = table.id;
    fieldIdMap[tDef.name] = {};

    for (let i = 0; i < tDef.fields.length; i++) {
      const fDef = tDef.fields[i];
      const field = await createField({
        tableId: table.id,
        projectId: project.id,
        name: fDef.name,
        displayName: fDef.label,
        fieldType: (fDef.type as any) || 'text',
        required: fDef.required || false,
        defaultValue: fDef.defaultValue || '',
        lovValues: fDef.lovValues || '',
        sortOrder: i,
        description: fDef.description || '',
        unique: false,
      });
      fieldIdMap[tDef.name][fDef.name] = field.id;
    }
  }

  // 2. Resolve FK referencedTableId now that all tables exist
  for (const tDef of template.tables) {
    for (const fDef of tDef.fields) {
      if (fDef.type === 'foreign_key' && fDef.referencedTableName) {
        const refTableId = tableIdMap[fDef.referencedTableName];
        if (refTableId) {
          const fieldId = fieldIdMap[tDef.name][fDef.name];
          // We need to update the field with the resolved referencedTableId
          // Get the field from context and update it
          const allFields = ctx.fields;
          const field = allFields.find(f => f.id === fieldId);
          if (field) {
            await ctx.updateField({ ...field, referencedTableId: refTableId });
          }
        }
      }
    }
  }

  // 3. Create relationships
  for (const rDef of template.relationships) {
    const masterTableId = tableIdMap[rDef.masterTableName];
    const detailTableId = tableIdMap[rDef.detailTableName];
    const fkFieldId = fieldIdMap[rDef.detailTableName]?.[rDef.foreignKeyFieldName];
    if (masterTableId && detailTableId && fkFieldId) {
      onProgress(`Creating relationship: ${rDef.masterTableName} → ${rDef.detailTableName}…`);
      await createRelationship({
        projectId: project.id,
        fromTableId: masterTableId,
        fromFieldId: fkFieldId,
        toTableId: detailTableId,
        toFieldId: '',
        type: 'one_to_many' as any,
        name: `${rDef.masterTableName}_${rDef.detailTableName}`,
        cascadeDelete: rDef.cascadeDelete ?? true,
        description: '',
      });
    }
  }

  // Map: template form name → real form ID
  const formIdMap: Record<string, string> = {};

  // 4. Create forms (first pass — without detailFormIds)
  for (const fmDef of template.forms) {
    const tableId = tableIdMap[fmDef.tableName];
    if (!tableId) continue;
    onProgress(`Creating form: ${fmDef.displayName}…`);

    // Build formFields JSON — must match the FormField interface exactly
    // (visible:true is critical; without it the form runner filters out all fields)
    const formFields = fmDef.formFields.map((ff, idx) => {
      const fieldId = fieldIdMap[fmDef.tableName]?.[ff.fieldName];
      return {
        id: nanoid(),
        fieldId: fieldId || '',
        widget: 'input' as const,
        label: ff.label || ff.fieldName,
        placeholder: '',
        helpText: '',
        colSpan: 6,
        row: Math.floor(idx / 2),
        col: idx % 2,
        visible: !ff.hidden,
        readOnly: false,
        required: ff.required || false,
        defaultValue: '',
        styleOverride: '{}',
      };
    });

    const form = await createForm({
      projectId: project.id,
      tableId,
      name: fmDef.name,
      displayName: fmDef.displayName,
      description: fmDef.description || '',
      formFields: JSON.stringify(formFields),
      detailFormIds: '[]',
    });
    formIdMap[fmDef.name] = form.id;
  }

  // 5. Second pass — resolve detailFormIds
  for (const fmDef of template.forms) {
    if (!fmDef.detailFormNames?.length) continue;
    const formId = formIdMap[fmDef.name];
    if (!formId) continue;

    const detailIds = fmDef.detailFormNames
      .map((n) => formIdMap[n])
      .filter(Boolean);

    const form = ctx.forms.find(f => f.id === formId);
    if (form && detailIds.length > 0) {
      await updateForm({ ...form, detailFormIds: JSON.stringify(detailIds) });
    }
  }

  // Map: template report name → real report ID
  const reportIdMap: Record<string, string> = {};

  // 6. Create reports
  for (const rDef of template.reports) {
    const tableId = tableIdMap[rDef.tableName];
    if (!tableId) continue;
    onProgress(`Creating report: ${rDef.displayName}…`);

    const columns = rDef.columns.map((col, i) => {
      const fieldId = fieldIdMap[rDef.tableName]?.[col.fieldName];
      return {
        fieldId: fieldId || '',
        fieldName: col.fieldName,
        label: col.label || col.fieldName,
        sortable: col.sortable || false,
        filterable: col.filterable || false,
        order: i,
      };
    });

      const report = await createReport({
        projectId: project.id,
        tableId,
        name: rDef.name,
        displayName: rDef.displayName,
        description: rDef.description || '',
        reportColumns: JSON.stringify(columns),
        defaultSort: rDef.defaultSortField || '',
        defaultSortDir: rDef.defaultSortDir || 'asc',
        filters: '[]',
        groupBy: '',
        showTotals: false,
        pageSize: 25,
        allowExport: true,
        allowPrint: true,
      });
    reportIdMap[rDef.name] = report.id;
  }

  // 7. Create menus
  for (const mDef of template.menus) {
    onProgress(`Creating menu: ${mDef.displayName}…`);
    const items = mDef.items.map((item) => {
      let targetId = '';
      if (item.type === 'form' && item.targetName) targetId = formIdMap[item.targetName] || '';
      if (item.type === 'report' && item.targetName) targetId = reportIdMap[item.targetName] || '';
      return {
        id: nanoid(),
        label: item.label,
        icon: item.icon || '',
        type: item.type,
        targetId,
        order: item.order,
        parentId: null,
      };
    });

    await createMenu({
      projectId: project.id,
      name: mDef.name,
      displayName: mDef.displayName,
      description: mDef.description || '',
      items: JSON.stringify(items),
    });
  }

  // 8. Seed mock data rows — use rowPut directly to avoid React state timing issues
  // (saveRow depends on activeProject state which may not have updated yet)
  if (template.mockData) {
    onProgress('Ensuring table stores exist for seeding…');
    // Ensure each table's IndexedDB object store exists before writing rows.
    // ensureTableStore handles version-bumping correctly for new tables.
    for (const tableId of Object.values(tableIdMap)) {
      await ensureTableStore(project.id, tableId);
    }

    for (const [tableName, rows] of Object.entries(template.mockData)) {
      const tableId = tableIdMap[tableName];
      if (!tableId) continue;

      onProgress(`Seeding ${rows.length} rows into ${tableName}…`);
      for (const row of rows) {
        // Resolve any FK references: if a value is a string like '@customers[0]',
        // replace it with the real seeded row ID
        const resolvedRow: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) {
          if (typeof v === 'string' && v.startsWith('@')) {
            // Format: @tableName[index]
            const match = v.match(/^@(\w+)\[(\d+)\]$/);
            if (match) {
              const refTable = match[1];
              const refIdx = parseInt(match[2]);
              resolvedRow[k] = seededIds[refTable]?.[refIdx] || v;
            } else {
              resolvedRow[k] = v;
            }
          } else {
            resolvedRow[k] = v;
          }
        }

        const now = Date.now();
        const seededRow = {
          ...resolvedRow,
          _id: nanoid(),
          _createdAt: now,
          _updatedAt: now,
        };
        await rowPut(project.id, tableId, seededRow as any);
        if (!seededIds[tableName]) seededIds[tableName] = [];
        seededIds[tableName].push(seededRow._id as string);
      }
    }
  }

  onProgress('Done!');
  return project.id;
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

function PreviewModal({
  template,
  onClose,
  onInstall,
  installing,
  progress,
}: {
  template: AppTemplate;
  onClose: () => void;
  onInstall: () => void;
  installing: boolean;
  progress: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl flex flex-col"
        style={{
          background: 'var(--neo-inset)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px oklch(1 0 0 / 0.08)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-start gap-4 p-6 flex-shrink-0"
          style={{ borderBottom: '1px solid oklch(1 0 0 / 0.07)' }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
            style={{ background: 'oklch(1 0 0 / 0.05)', border: '1px solid oklch(1 0 0 / 0.08)' }}
          >
            {template.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>
                {template.name}
              </h2>
              <Badge
                className="text-xs px-2 py-0.5"
                style={{ background: template.accentColor + '22', color: template.accentColor, border: `1px solid ${template.accentColor}44` }}
              >
                {template.category}
              </Badge>
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--amber)', fontFamily: 'Space Grotesk, sans-serif' }}>
              {template.tagline}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
              {template.description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-150"
            style={{ color: 'var(--muted-foreground)', background: 'oklch(1 0 0 / 0.05)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 p-5" style={{ borderBottom: '1px solid oklch(1 0 0 / 0.07)' }}>
          {[
            { icon: <Table2 size={14} />, label: 'Tables', value: template.tableCount, color: '#6366f1' },
            { icon: <FileText size={14} />, label: 'Forms', value: template.formCount, color: '#10b981' },
            { icon: <BarChart3 size={14} />, label: 'Reports', value: template.reportCount, color: '#f59e0b' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl p-3 flex items-center gap-3"
              style={{ background: 'oklch(1 0 0 / 0.04)', border: '1px solid oklch(1 0 0 / 0.06)' }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: stat.color + '22', color: stat.color }}
              >
                {stat.icon}
              </div>
              <div>
                <div className="text-lg font-bold leading-none" style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>
                  {stat.value}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}>
                  {stat.label.toUpperCase()}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Schema tree */}
        <div className="p-5 flex-1">
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}>
            SCHEMA PREVIEW
          </h3>
          <div className="space-y-3">
            {template.tables.map((table) => (
              <div
                key={table.name}
                className="rounded-xl overflow-hidden"
                style={{ border: '1px solid oklch(1 0 0 / 0.07)' }}
              >
                <div
                  className="flex items-center gap-2 px-3 py-2"
                  style={{ background: 'oklch(1 0 0 / 0.04)', borderBottom: '1px solid oklch(1 0 0 / 0.06)' }}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: table.color || '#6366f1', boxShadow: `0 0 6px ${table.color || '#6366f1'}66` }}
                  />
                  <span className="text-sm font-semibold" style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>
                    {table.displayName}
                  </span>
                  <span className="text-xs ml-auto" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}>
                    {table.fields.length} fields
                  </span>
                  {table.tableType && table.tableType !== 'standard' && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: (table.color || '#6366f1') + '22', color: table.color || '#6366f1', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem' }}
                    >
                      {table.tableType.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="px-3 py-2 flex flex-wrap gap-1.5">
                  {table.fields.filter(f => !f.isPrimary).slice(0, 8).map((field) => (
                    <span
                      key={field.name}
                      className="text-xs px-2 py-0.5 rounded-md"
                      style={{
                        background: 'oklch(1 0 0 / 0.04)',
                        color: field.type === 'foreignkey' ? '#f59e0b' : 'var(--muted-foreground)',
                        border: `1px solid ${field.type === 'foreignkey' ? 'rgba(245,166,35,0.2)' : 'oklch(1 0 0 / 0.06)'}`,
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '0.6rem',
                      }}
                    >
                      {field.label}
                      {field.type === 'foreignkey' && ' →'}
                    </span>
                  ))}
                  {table.fields.filter(f => !f.isPrimary).length > 8 && (
                    <span className="text-xs px-2 py-0.5 rounded-md" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}>
                      +{table.fields.filter(f => !f.isPrimary).length - 8} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer / install */}
        <div
          className="p-5 flex items-center gap-3 flex-shrink-0"
          style={{ borderTop: '1px solid oklch(1 0 0 / 0.07)' }}
        >
          {installing && (
            <div className="flex-1 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" style={{ color: 'var(--amber)' }} />
              <span className="text-sm" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
                {progress}
              </span>
            </div>
          )}
          {!installing && (
            <p className="flex-1 text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
              Creates a new database with all tables, forms, reports, and menus pre-configured.
            </p>
          )}
          <Button
            onClick={onInstall}
            disabled={installing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all duration-150"
            style={{
              background: installing ? 'oklch(1 0 0 / 0.05)' : 'var(--amber)',
              color: installing ? 'var(--muted-foreground)' : '#1e1e2e',
              boxShadow: installing ? 'none' : '0 0 20px rgba(245,166,35,0.3)',
              fontFamily: 'Space Grotesk, sans-serif',
            }}
          >
            {installing ? (
              <><Loader2 size={14} className="animate-spin" /> Installing…</>
            ) : (
              <><Zap size={14} /> Install Template</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Dialog ──────────────────────────────────────────────────

function DeleteConfirmDialog({
  template,
  onClose,
  onConfirm,
  deleting,
}: {
  template: AppTemplate;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !deleting) onClose(); }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: 'var(--neo-inset)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(239,68,68,0.3)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 p-5"
          style={{ borderBottom: '1px solid rgba(239,68,68,0.15)' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            <AlertTriangle size={18} style={{ color: '#ef4444' }} />
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>
              Delete Template Data
            </h2>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
              {template.name}
            </p>
          </div>
          {!deleting && (
            <button
              onClick={onClose}
              className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ color: 'var(--muted-foreground)', background: 'oklch(1 0 0 / 0.05)' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)', fontFamily: 'Inter, sans-serif' }}>
            Are you <strong>absolutely sure</strong> you want to delete the{' '}
            <span style={{ color: '#f5a623', fontWeight: 600 }}>{template.name}</span>{' '}
            database and all its data?
          </p>
          <div
            className="rounded-xl p-3 space-y-1"
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}
          >
            <p className="text-xs font-semibold" style={{ color: '#ef4444', fontFamily: 'Space Grotesk, sans-serif' }}>
              This will permanently delete:
            </p>
            {[
              `All ${template.tableCount} tables and their data`,
              `All ${template.formCount} forms`,
              `All ${template.reportCount} reports`,
              'All menus and navigation',
              'Every record you have entered',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#ef4444' }} />
                <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>{item}</p>
              </div>
            ))}
          </div>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
            This action <strong style={{ color: 'var(--foreground)' }}>cannot be undone</strong>. There is no backup.
          </p>

          {/* Confirmation checkbox */}
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={deleting}
              className="mt-0.5 w-4 h-4 rounded accent-red-500 cursor-pointer"
            />
            <span className="text-xs leading-relaxed" style={{ color: 'var(--foreground)', fontFamily: 'Inter, sans-serif' }}>
              I understand this will permanently delete all data for{' '}
              <strong>{template.name}</strong> and this cannot be undone.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-3 p-5"
          style={{ borderTop: '1px solid oklch(1 0 0 / 0.07)' }}
        >
          <Button
            variant="outline"
            onClick={onClose}
            disabled={deleting}
            className="flex-1"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!confirmed || deleting}
            className="flex-1 flex items-center justify-center gap-2"
            style={{
              background: confirmed && !deleting ? '#ef4444' : 'oklch(1 0 0 / 0.05)',
              color: confirmed && !deleting ? '#fff' : 'var(--muted-foreground)',
              boxShadow: confirmed && !deleting ? '0 0 16px rgba(239,68,68,0.3)' : 'none',
              fontFamily: 'Space Grotesk, sans-serif',
              transition: 'all 200ms ease',
            }}
          >
            {deleting ? (
              <><Loader2 size={13} className="animate-spin" /> Deleting…</>
            ) : (
              <><Trash2 size={13} /> Yes, Delete Everything</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onPreview,
  onInstall,
  onDelete,
  installing,
  isInstalled,
}: {
  template: AppTemplate;
  onPreview: () => void;
  onInstall: () => void;
  onDelete: () => void;
  installing: boolean;
  isInstalled: boolean;
}) {
  return (
    <div
      className="group relative rounded-2xl overflow-hidden flex flex-col cursor-pointer transition-all duration-200"
      style={{
        background: 'var(--neo-inset)',
        boxShadow: '4px 4px 12px rgba(0,0,0,0.4), -2px -2px 6px rgba(255,255,255,0.03), inset 0 0 0 1px oklch(1 0 0 / 0.07)',
      }}
      onClick={onPreview}
    >
      {/* Gradient header */}
      <div
        className="relative h-28 flex items-end p-4"
        style={{ background: template.color }}
      >
        {/* Subtle grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(255,255,255,0.05) 20px, rgba(255,255,255,0.05) 21px), repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(255,255,255,0.05) 20px, rgba(255,255,255,0.05) 21px)`,
          }}
        />
        <div className="relative flex items-end justify-between w-full">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
            style={{
              background: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            {template.icon}
          </div>
          <Badge
            className="text-xs px-2 py-0.5"
            style={{
              background: 'rgba(0,0,0,0.4)',
              color: 'rgba(255,255,255,0.8)',
              border: '1px solid rgba(255,255,255,0.15)',
              backdropFilter: 'blur(4px)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.6rem',
            }}
          >
            {template.category}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        <h3
          className="text-base font-bold mb-0.5"
          style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}
        >
          {template.name}
        </h3>
        <p
          className="text-xs font-medium mb-2"
          style={{ color: 'var(--amber)', fontFamily: 'Space Grotesk, sans-serif' }}
        >
          {template.tagline}
        </p>
        <p
          className="text-xs leading-relaxed flex-1 mb-4"
          style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}
        >
          {template.description.length > 100
            ? template.description.slice(0, 100) + '…'
            : template.description}
        </p>

        {/* Stats chips */}
        <div className="flex items-center gap-2 mb-4">
          {[
            { icon: <Table2 size={10} />, value: template.tableCount, label: 'tables' },
            { icon: <FileText size={10} />, value: template.formCount, label: 'forms' },
            { icon: <BarChart3 size={10} />, value: template.reportCount, label: 'reports' },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-1 px-2 py-1 rounded-lg"
              style={{
                background: 'oklch(1 0 0 / 0.04)',
                border: '1px solid oklch(1 0 0 / 0.06)',
                color: 'var(--muted-foreground)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.6rem',
              }}
            >
              {s.icon}
              <span>{s.value} {s.label}</span>
            </div>
          ))}
        </div>

        {/* Action row */}
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onPreview(); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all duration-150"
            style={{
              background: 'oklch(1 0 0 / 0.05)',
              color: 'var(--muted-foreground)',
              border: '1px solid oklch(1 0 0 / 0.08)',
              fontFamily: 'Space Grotesk, sans-serif',
            }}
          >
            Preview
            <ChevronRight size={12} />
          </button>

          {isInstalled ? (
            /* Delete button — shown when this template has been installed */
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-95"
              style={{
                background: 'rgba(239,68,68,0.1)',
                color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.25)',
                fontFamily: 'Space Grotesk, sans-serif',
              }}
            >
              <Trash2 size={11} /> Delete Data
            </button>
          ) : (
            /* Install button */
            <button
              onClick={(e) => { e.stopPropagation(); onInstall(); }}
              disabled={installing}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-95"
              style={{
                background: installing ? 'oklch(1 0 0 / 0.05)' : 'var(--amber)',
                color: installing ? 'var(--muted-foreground)' : '#1e1e2e',
                boxShadow: installing ? 'none' : '0 0 12px rgba(245,166,35,0.25)',
                fontFamily: 'Space Grotesk, sans-serif',
              }}
            >
              {installing ? (
                <><Loader2 size={11} className="animate-spin" /> Installing…</>
              ) : (
                <><Zap size={11} /> Install</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// localStorage key for persisting template→project mapping
const LS_KEY = 'dbcreator_template_projects';

function loadTemplateProjects(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}

function saveTemplateProjects(map: Record<string, string>) {
  localStorage.setItem(LS_KEY, JSON.stringify(map));
}

export default function TemplatesPage() {
  const [, navigate] = useLocation();
  const ctx = useDB();
  const { deleteProject } = ctx;

  const [previewTemplate, setPreviewTemplate] = useState<AppTemplate | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  // templateId → projectId, persisted in localStorage
  const [templateProjects, setTemplateProjects] = useState<Record<string, string>>(loadTemplateProjects);

  // Sync to localStorage whenever the map changes
  useEffect(() => { saveTemplateProjects(templateProjects); }, [templateProjects]);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<AppTemplate | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleInstall = useCallback(async (template: AppTemplate) => {
    if (installingId) return;
    setInstallingId(template.id);
    setProgress('Starting…');
    try {
      const projectId = await installTemplate(template, ctx, setProgress);
      setTemplateProjects((prev) => ({ ...prev, [template.id]: projectId }));
      toast.success(`${template.name} installed!`, {
        description: 'Your new database is ready. Opening designer…',
      });
      setPreviewTemplate(null);
      setTimeout(() => navigate(`/designer/${projectId}`), 600);
    } catch (err) {
      console.error('Template install error:', err);
      toast.error('Installation failed', { description: String(err) });
    } finally {
      setInstallingId(null);
      setProgress('');
    }
  }, [installingId, ctx, navigate]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const projectId = templateProjects[deleteTarget.id];
    if (!projectId) return;
    setDeletingId(deleteTarget.id);
    try {
      await deleteProject(projectId);
      setTemplateProjects((prev) => {
        const next = { ...prev };
        delete next[deleteTarget.id];
        return next;
      });
      toast.success(`${deleteTarget.name} deleted`, {
        description: 'All tables, forms, reports, and menus have been removed.',
      });
      setDeleteTarget(null);
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Delete failed', { description: String(err) });
    } finally {
      setDeletingId(null);
    }
  }, [deleteTarget, templateProjects, deleteProject]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header */}
      <div
        className="flex-shrink-0 px-8 py-6"
        style={{ borderBottom: '1px solid oklch(1 0 0 / 0.07)' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                  background: 'var(--amber-soft)',
                  boxShadow: '0 0 12px rgba(245,166,35,0.2)',
                  border: '1px solid oklch(0.75 0.18 65 / 0.2)',
                }}
              >
                <Database size={16} style={{ color: 'var(--amber)' }} />
              </div>
              <h1
                className="text-2xl font-bold"
                style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.02em' }}
              >
                App Templates
              </h1>
            </div>
            <p
              className="text-sm"
              style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif', paddingLeft: '48px' }}
            >
              Start with a complete application — tables, forms, reports, and menus pre-configured.
            </p>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{
              background: 'oklch(1 0 0 / 0.04)',
              border: '1px solid oklch(1 0 0 / 0.07)',
              color: 'var(--muted-foreground)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.65rem',
            }}
          >
            <Zap size={11} style={{ color: 'var(--amber)' }} />
            {APP_TEMPLATES.length} templates available
          </div>
        </div>
      </div>

      {/* Template grid */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 max-w-6xl">
          {APP_TEMPLATES.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onPreview={() => setPreviewTemplate(template)}
              onInstall={() => handleInstall(template)}
              onDelete={() => setDeleteTarget(template)}
              installing={installingId === template.id}
              isInstalled={!!templateProjects[template.id]}
            />
          ))}
        </div>

        {/* Bottom note */}
        <div className="mt-8 max-w-6xl">
          <div
            className="rounded-xl p-4 flex items-start gap-3"
            style={{ background: 'oklch(1 0 0 / 0.03)', border: '1px solid oklch(1 0 0 / 0.06)' }}
          >
            <Check size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#10b981' }} />
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
              All templates create a fully independent database. You can customise every table, field, form, and report after installation — templates are just a starting point. Your data is always stored locally on this device.
            </p>
          </div>
        </div>
      </div>

      {/* Preview modal */}
      {previewTemplate && (
        <PreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onInstall={() => handleInstall(previewTemplate)}
          installing={installingId === previewTemplate.id}
          progress={progress}
        />
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <DeleteConfirmDialog
          template={deleteTarget}
          onClose={() => { if (!deletingId) setDeleteTarget(null); }}
          onConfirm={handleDeleteConfirm}
          deleting={deletingId === deleteTarget.id}
        />
      )}
    </div>
  );
}
