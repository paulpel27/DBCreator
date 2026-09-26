/**
 * AI Execution Engine — DBCreator
 * Parses structured JSON plans from AI responses and executes them
 * against the DBContext to create tables, fields, relationships, forms, and reports.
 */

import type { FieldType, TableType, RelationshipType } from './db';

// ─── Execution Plan Schema ────────────────────────────────────────────────────
// The AI must embed a JSON block like:
// ```dbcreator-plan
// { ... }
// ```
// inside its response. This schema defines what that JSON must contain.

export interface PlanField {
  name: string;           // snake_case column name
  displayName?: string;   // Human label (optional, derived from name if absent)
  fieldType: FieldType;
  required?: boolean;
  unique?: boolean;
  defaultValue?: string | null;
  description?: string;
  placeholder?: string;
  helpText?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  lovValues?: Array<{ value: string; label: string }>;
  // For foreign_key / lov: reference the table by name (resolved at execution time)
  referencedTableName?: string;
}

export interface PlanTable {
  name: string;           // snake_case table name
  displayName?: string;   // Human label
  description?: string;
  tableType?: TableType;
  color?: string;
  fields: PlanField[];    // Does NOT include the auto-created id field
}

export interface PlanRelationship {
  name?: string;
  type: RelationshipType;
  fromTableName: string;
  fromFieldName: string;
  toTableName: string;
  toFieldName: string;
  cascadeDelete?: boolean;
  description?: string;
}

export interface PlanForm {
  name: string;
  displayName?: string;
  description?: string;
  tableName: string;      // Which table this form is for
  columns?: number;
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  allowSearch?: boolean;
}

export interface PlanMenuItem {
  label: string;
  icon?: string;
  type: 'form' | 'report' | 'separator' | 'group';
  targetName?: string; // form or report name to link
  children?: PlanMenuItem[];
}

export interface PlanMenu {
  name: string;
  displayName?: string;
  description?: string;
  isDefault?: boolean;
  items?: PlanMenuItem[];
}

export interface PlanReport {
  name: string;
  displayName?: string;
  description?: string;
  tableName: string;
  columns?: string[];     // Field names to include (empty = all)
  defaultSort?: string;   // Field name
  defaultSortDir?: 'asc' | 'desc';
  showTotals?: boolean;
  allowExport?: boolean;
}

export interface ExecutionPlan {
  projectName?: string;   // If set, create a new project; otherwise use activeProject
  projectDescription?: string;
  projectColor?: string;
  tables?: PlanTable[];
  relationships?: PlanRelationship[];
  forms?: PlanForm[];
  reports?: PlanReport[];
  menus?: PlanMenu[];
}

// ─── Plan Extraction ──────────────────────────────────────────────────────────

/**
 * Extract an execution plan from an AI message.
 * Looks for a ```dbcreator-plan ... ``` fenced block.
 */
export function extractPlan(content: string): ExecutionPlan | null {
  // Try ```dbcreator-plan block first
  const fenceMatch = content.match(/```dbcreator-plan\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as ExecutionPlan;
    } catch {
      return null;
    }
  }

  // Fallback: look for a JSON block that has "tables" key
  const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1].trim());
      if (parsed && (parsed.tables || parsed.projectName)) {
        return parsed as ExecutionPlan;
      }
    } catch {
      // not a valid plan
    }
  }

  return null;
}

// ─── Plan Summary (for preview dialog) ───────────────────────────────────────

export interface PlanSummaryItem {
  type: 'project' | 'table' | 'field' | 'relationship' | 'form' | 'report' | 'menu';
  label: string;
  detail?: string;
  icon: string;
}

export function summarizePlan(plan: ExecutionPlan): PlanSummaryItem[] {
  const items: PlanSummaryItem[] = [];

  if (plan.projectName) {
    items.push({ type: 'project', label: plan.projectName, detail: plan.projectDescription, icon: '🗄️' });
  }

  for (const tbl of plan.tables ?? []) {
    items.push({
      type: 'table',
      label: tbl.displayName ?? tbl.name,
      detail: `${tbl.fields.length} field${tbl.fields.length !== 1 ? 's' : ''} · ${tbl.tableType ?? 'standard'}`,
      icon: '📋',
    });
    for (const f of tbl.fields) {
      items.push({
        type: 'field',
        label: `  ${f.displayName ?? f.name}`,
        detail: `${f.fieldType}${f.required ? ' · required' : ''}`,
        icon: '◦',
      });
    }
  }

  for (const rel of plan.relationships ?? []) {
    items.push({
      type: 'relationship',
      label: rel.name ?? `${rel.fromTableName} → ${rel.toTableName}`,
      detail: rel.type.replace(/_/g, '-'),
      icon: '🔗',
    });
  }

  for (const form of plan.forms ?? []) {
    items.push({
      type: 'form',
      label: form.displayName ?? form.name,
      detail: `Form for ${form.tableName}`,
      icon: '📝',
    });
  }

  for (const report of plan.reports ?? []) {
    items.push({
      type: 'report',
      label: report.displayName ?? report.name,
      detail: `Report for ${report.tableName}`,
      icon: '📊',
    });
  }

  for (const menu of plan.menus ?? []) {
    items.push({
      type: 'menu',
      label: menu.displayName ?? menu.name,
      detail: `${(menu.items ?? []).length} item${(menu.items ?? []).length !== 1 ? 's' : ''}${menu.isDefault ? ' · default' : ''}`,
      icon: '🗂️',
    });
  }

  return items;
}

// ─── Execution Result ─────────────────────────────────────────────────────────

export interface ExecutionResult {
  success: boolean;
  created: {
    project?: { id: string; name: string };
    tables: Array<{ id: string; name: string; displayName: string }>;
    fields: Array<{ id: string; name: string; tableId: string }>;
    relationships: Array<{ id: string; name: string }>;
    forms: Array<{ id: string; name: string; displayName: string }>;
    reports: Array<{ id: string; name: string; displayName: string }>;
    menus: Array<{ id: string; name: string; displayName: string }>;
  };
  errors: string[];
}

// ─── Execution Engine ─────────────────────────────────────────────────────────

export interface ExecutorContext {
  activeProject: { id: string; name: string } | null;
  createProject: (data: { name: string; description?: string; color?: string }) => Promise<{ id: string; name: string }>;
  setActiveProject: (p: { id: string; name: string } | null) => void;
  createTable: (data: {
    projectId: string;
    name: string;
    displayName?: string;
    description?: string;
    tableType?: TableType;
    color?: string;
  }) => Promise<{ id: string; name: string; displayName: string }>;
  createField: (data: {
    tableId: string;
    projectId: string;
    name: string;
    displayName?: string;
    fieldType: FieldType;
    required?: boolean;
    unique?: boolean;
    defaultValue?: string | null;
    description?: string;
    placeholder?: string;
    helpText?: string;
    maxLength?: number;
    min?: number;
    max?: number;
    lovValues?: string;
    referencedTableId?: string;
    sortOrder?: number;
  }) => Promise<{ id: string; name: string; tableId: string }>;
  createRelationship: (data: {
    projectId: string;
    name: string;
    type: RelationshipType;
    fromTableId: string;
    fromFieldId: string;
    toTableId: string;
    toFieldId: string;
    cascadeDelete?: boolean;
    description?: string;
  }) => Promise<{ id: string; name: string }>;
  createForm: (data: {
    projectId: string;
    tableId: string;
    name: string;
    displayName?: string;
    description?: string;
    formFields?: string;
    columns?: number;
    allowCreate?: boolean;
    allowEdit?: boolean;
    allowDelete?: boolean;
    allowSearch?: boolean;
  }) => Promise<{ id: string; name: string; displayName: string }>;
  createReport: (data: {
    projectId: string;
    tableId: string;
    name: string;
    displayName?: string;
    description?: string;
    reportColumns?: string;
    defaultSort?: string;
    defaultSortDir?: 'asc' | 'desc';
    showTotals?: boolean;
    allowExport?: boolean;
  }) => Promise<{ id: string; name: string; displayName: string }>;
  createMenu: (data: {
    projectId: string;
    name: string;
    displayName?: string;
    description?: string;
    items?: string; // JSON
    isDefault?: boolean;
  }) => Promise<{ id: string; name: string; displayName: string }>;
  // Read existing tables/fields for cross-reference
  existingTables: Array<{ id: string; name: string; projectId: string }>;
  existingFields: Array<{ id: string; name: string; tableId: string }>;
}

export async function executePlan(
  plan: ExecutionPlan,
  ctx: ExecutorContext,
  onProgress?: (msg: string) => void
): Promise<ExecutionResult> {
  const result: ExecutionResult = {
    success: true,
    created: { tables: [], fields: [], relationships: [], forms: [], reports: [], menus: [] },
    errors: [],
  };

  // Map from plan table name → created table id (for cross-references)
  const tableNameToId = new Map<string, string>();
  // Map from "tableName.fieldName" → created field id
  const fieldKeyToId = new Map<string, string>();

  // Pre-populate with existing tables/fields so cross-refs work even without creating new ones
  for (const t of ctx.existingTables) {
    tableNameToId.set(t.name.toLowerCase(), t.id);
  }
  for (const f of ctx.existingFields) {
    const tbl = ctx.existingTables.find((t) => t.id === f.tableId);
    if (tbl) fieldKeyToId.set(`${tbl.name.toLowerCase()}.${f.name.toLowerCase()}`, f.id);
  }

  // ── 1. Project ──────────────────────────────────────────────────────────────
  let projectId = ctx.activeProject?.id ?? '';

  if (plan.projectName) {
    try {
      onProgress?.(`Creating database "${plan.projectName}"…`);
      const proj = await ctx.createProject({
        name: plan.projectName,
        description: plan.projectDescription ?? '',
        color: plan.projectColor ?? '#f5a623',
      });
      projectId = proj.id;
      result.created.project = { id: proj.id, name: proj.name };
      ctx.setActiveProject(proj);
    } catch (e) {
      result.errors.push(`Failed to create project: ${String(e)}`);
      result.success = false;
      return result;
    }
  }

  if (!projectId) {
    result.errors.push('No active project and no projectName specified in plan. Please open a database first or include projectName in the plan.');
    result.success = false;
    return result;
  }

  // ── 2. Tables & Fields ──────────────────────────────────────────────────────
  for (const tblPlan of plan.tables ?? []) {
    try {
      onProgress?.(`Creating table "${tblPlan.displayName ?? tblPlan.name}"…`);
      const tbl = await ctx.createTable({
        projectId,
        name: tblPlan.name,
        displayName: tblPlan.displayName ?? toDisplayName(tblPlan.name),
        description: tblPlan.description ?? '',
        tableType: tblPlan.tableType ?? 'standard',
        color: tblPlan.color ?? randomColor(),
      });
      tableNameToId.set(tblPlan.name.toLowerCase(), tbl.id);
      result.created.tables.push(tbl);

      // Create fields (id field is auto-created by createTable)
      // Register the auto-created id field
      fieldKeyToId.set(`${tblPlan.name.toLowerCase()}.id`, 'auto');

      let fieldSortOrder = 1; // 0 is the auto-created id field
      for (const fPlan of tblPlan.fields) {
        try {
          onProgress?.(`  Adding field "${fPlan.displayName ?? fPlan.name}" to ${tblPlan.name}…`);

          // Resolve referenced table for foreign_key / lov
          let referencedTableId: string | undefined;
          if (fPlan.referencedTableName) {
            referencedTableId = tableNameToId.get(fPlan.referencedTableName.toLowerCase());
            if (!referencedTableId) {
              result.errors.push(`Field "${fPlan.name}": referenced table "${fPlan.referencedTableName}" not found (may not have been created yet)`);
            }
          }

          const field = await ctx.createField({
            tableId: tbl.id,
            projectId,
            name: fPlan.name,
            displayName: fPlan.displayName ?? toDisplayName(fPlan.name),
            fieldType: fPlan.fieldType,
            required: fPlan.required ?? false,
            unique: fPlan.unique ?? false,
            defaultValue: fPlan.defaultValue ?? null,
            description: fPlan.description ?? '',
            placeholder: fPlan.placeholder,
            helpText: fPlan.helpText,
            maxLength: fPlan.maxLength,
            min: fPlan.min,
            max: fPlan.max,
            lovValues: fPlan.lovValues ? JSON.stringify(fPlan.lovValues) : undefined,
            referencedTableId,
            sortOrder: fieldSortOrder++,
          });
          fieldKeyToId.set(`${tblPlan.name.toLowerCase()}.${fPlan.name.toLowerCase()}`, field.id);
          result.created.fields.push(field);
        } catch (e) {
          result.errors.push(`Field "${fPlan.name}" in table "${tblPlan.name}": ${String(e)}`);
        }
      }
    } catch (e) {
      result.errors.push(`Table "${tblPlan.name}": ${String(e)}`);
    }
  }

  // ── 3. Relationships ────────────────────────────────────────────────────────
  for (const relPlan of plan.relationships ?? []) {
    try {
      onProgress?.(`Creating relationship "${relPlan.fromTableName} → ${relPlan.toTableName}"…`);

      const fromTableId = tableNameToId.get(relPlan.fromTableName.toLowerCase());
      const toTableId = tableNameToId.get(relPlan.toTableName.toLowerCase());

      if (!fromTableId) {
        result.errors.push(`Relationship: fromTable "${relPlan.fromTableName}" not found`);
        continue;
      }
      if (!toTableId) {
        result.errors.push(`Relationship: toTable "${relPlan.toTableName}" not found`);
        continue;
      }

      // Resolve field IDs — use 'id' field as fallback for toField
      const fromFieldId = fieldKeyToId.get(`${relPlan.fromTableName.toLowerCase()}.${relPlan.fromFieldName.toLowerCase()}`) ?? '';
      const toFieldId = fieldKeyToId.get(`${relPlan.toTableName.toLowerCase()}.${relPlan.toFieldName.toLowerCase()}`) ?? '';

      const rel = await ctx.createRelationship({
        projectId,
        name: relPlan.name ?? `${relPlan.fromTableName}_${relPlan.toTableName}`,
        type: relPlan.type,
        fromTableId,
        fromFieldId,
        toTableId,
        toFieldId,
        cascadeDelete: relPlan.cascadeDelete ?? false,
        description: relPlan.description ?? '',
      });
      result.created.relationships.push(rel);
    } catch (e) {
      result.errors.push(`Relationship "${relPlan.fromTableName}→${relPlan.toTableName}": ${String(e)}`);
    }
  }

  // ── 4. Forms ────────────────────────────────────────────────────────────────
  for (const formPlan of plan.forms ?? []) {
    try {
      onProgress?.(`Creating form "${formPlan.displayName ?? formPlan.name}"…`);

      const tableId = tableNameToId.get(formPlan.tableName.toLowerCase());
      if (!tableId) {
        result.errors.push(`Form "${formPlan.name}": table "${formPlan.tableName}" not found`);
        continue;
      }

      // Auto-generate form fields from table fields
      const tableFields = Array.from(fieldKeyToId.entries())
        .filter(([key]) => key.startsWith(formPlan.tableName.toLowerCase() + '.'))
        .map(([key, id], idx) => ({
          fieldId: id,
          widget: 'text',
          label: toDisplayName(key.split('.')[1] ?? ''),
          placeholder: '',
          helpText: '',
          colSpan: 1,
          row: Math.floor(idx / 2),
          col: idx % 2,
          visible: true,
          readOnly: false,
          required: false,
          defaultValue: '',
          styleOverride: '',
        }));

      const form = await ctx.createForm({
        projectId,
        tableId,
        name: formPlan.name,
        displayName: formPlan.displayName ?? toDisplayName(formPlan.name),
        description: formPlan.description ?? '',
        formFields: JSON.stringify(tableFields),
        columns: formPlan.columns ?? 2,
        allowCreate: formPlan.allowCreate ?? true,
        allowEdit: formPlan.allowEdit ?? true,
        allowDelete: formPlan.allowDelete ?? true,
        allowSearch: formPlan.allowSearch ?? true,
      });
      result.created.forms.push(form);
    } catch (e) {
      result.errors.push(`Form "${formPlan.name}": ${String(e)}`);
    }
  }

  // ── 5. Reports ──────────────────────────────────────────────────────────────
  for (const reportPlan of plan.reports ?? []) {
    try {
      onProgress?.(`Creating report "${reportPlan.displayName ?? reportPlan.name}"…`);

      const tableId = tableNameToId.get(reportPlan.tableName.toLowerCase());
      if (!tableId) {
        result.errors.push(`Report "${reportPlan.name}": table "${reportPlan.tableName}" not found`);
        continue;
      }

      // Auto-generate report columns from table fields
      const allTableFields = Array.from(fieldKeyToId.entries())
        .filter(([key]) => key.startsWith(reportPlan.tableName.toLowerCase() + '.'));

      const wantedNames = reportPlan.columns?.map((c) => c.toLowerCase()) ?? [];
      const reportColumns = allTableFields
        .filter(([key]) => wantedNames.length === 0 || wantedNames.includes(key.split('.')[1] ?? ''))
        .map(([key, id], idx) => ({
          fieldId: id,
          label: toDisplayName(key.split('.')[1] ?? ''),
          width: 150,
          sortable: true,
          filterable: true,
          aggregation: 'none',
          format: '',
          visible: true,
          sortOrder: idx,
        }));

      // Resolve defaultSort field id
      let defaultSortId = '';
      if (reportPlan.defaultSort) {
        defaultSortId = fieldKeyToId.get(`${reportPlan.tableName.toLowerCase()}.${reportPlan.defaultSort.toLowerCase()}`) ?? '';
      }

      const report = await ctx.createReport({
        projectId,
        tableId,
        name: reportPlan.name,
        displayName: reportPlan.displayName ?? toDisplayName(reportPlan.name),
        description: reportPlan.description ?? '',
        reportColumns: JSON.stringify(reportColumns),
        defaultSort: defaultSortId,
        defaultSortDir: reportPlan.defaultSortDir ?? 'asc',
        showTotals: reportPlan.showTotals ?? false,
        allowExport: reportPlan.allowExport ?? true,
      });
      result.created.reports.push(report);
    } catch (e) {
      result.errors.push(`Report "${reportPlan.name}": ${String(e)}`);
    }
  }

  // ── 6. Menus ────────────────────────────────────────────────────────────────
  // Map from form/report name → id for building menu items
  const formNameToId = new Map<string, string>();
  for (const f of result.created.forms) {
    formNameToId.set(f.name.toLowerCase(), f.id);
  }
  const reportNameToId = new Map<string, string>();
  for (const r of result.created.reports) {
    reportNameToId.set(r.name.toLowerCase(), r.id);
  }

  for (const menuPlan of plan.menus ?? []) {
    try {
      onProgress?.(`Creating menu "${menuPlan.displayName ?? menuPlan.name}"…`);

      // Resolve menu items — link form/report targets to their IDs
      const resolveItems = (items: PlanMenuItem[]): object[] =>
        items.map((item) => {
          const base = {
            id: crypto.randomUUID(),
            label: item.label,
            icon: item.icon ?? (item.type === 'form' ? 'FileText' : item.type === 'report' ? 'BarChart3' : 'Folder'),
            type: item.type,
            targetId: item.targetName
              ? (formNameToId.get(item.targetName.toLowerCase()) ?? reportNameToId.get(item.targetName.toLowerCase()) ?? '')
              : '',
            children: item.children ? resolveItems(item.children) : [],
          };
          return base;
        });

      const resolvedItems = resolveItems(menuPlan.items ?? []);

      const menu = await ctx.createMenu({
        projectId,
        name: menuPlan.name,
        displayName: menuPlan.displayName ?? toDisplayName(menuPlan.name),
        description: menuPlan.description ?? '',
        items: JSON.stringify(resolvedItems),
        isDefault: menuPlan.isDefault ?? false,
      });
      result.created.menus.push(menu);
    } catch (e) {
      result.errors.push(`Menu "${menuPlan.name}": ${String(e)}`);
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDisplayName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const TABLE_COLORS = [
  '#f5a623', '#6366f1', '#10b981', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f59e0b', '#ec4899', '#14b8a6', '#84cc16',
];
let colorIdx = 0;
function randomColor(): string {
  return TABLE_COLORS[colorIdx++ % TABLE_COLORS.length];
}
