/**
 * DBCreator — Global Database Context
 * Obsidian Forge design: single source of truth for all schema metadata
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { nanoid } from 'nanoid';
import {
  type DataRow,
  type DBField,
  type DBForm,
  type DBMenu,
  type DBRelationship,
  type DBReport,
  type DBTable,
  type Project,
  dbDelete,
  dbGet,
  dbGetAll,
  dbGetByIndex,
  dbPut,
  ensureTableStore,
  openMetaDB,
  openDataDB,
  rowDelete,
  rowGet,
  rowGetAll,
  rowPut,
} from '@/lib/db';

interface DBContextValue {
  // Projects
  projects: Project[];
  activeProject: Project | null;
  setActiveProject: (p: Project | null) => void;
  createProject: (data: Partial<Project>) => Promise<Project>;
  updateProject: (data: Project) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  // Tables
  tables: DBTable[];
  createTable: (data: Partial<DBTable>) => Promise<DBTable>;
  updateTable: (data: DBTable) => Promise<void>;
  deleteTable: (id: string) => Promise<void>;

  // Fields
  fields: DBField[];
  getFieldsForTable: (tableId: string) => DBField[];
  createField: (data: Partial<DBField>) => Promise<DBField>;
  updateField: (data: DBField) => Promise<void>;
  deleteField: (id: string) => Promise<void>;
  reorderFields: (tableId: string, orderedIds: string[]) => Promise<void>;

  // Relationships
  relationships: DBRelationship[];
  createRelationship: (data: Partial<DBRelationship>) => Promise<DBRelationship>;
  updateRelationship: (data: DBRelationship) => Promise<void>;
  deleteRelationship: (id: string) => Promise<void>;

  // Forms
  forms: DBForm[];
  createForm: (data: Partial<DBForm>) => Promise<DBForm>;
  updateForm: (data: DBForm) => Promise<void>;
  deleteForm: (id: string) => Promise<void>;

  // Reports
  reports: DBReport[];
  createReport: (data: Partial<DBReport>) => Promise<DBReport>;
  updateReport: (data: DBReport) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;

  // Menus
  menus: DBMenu[];
  createMenu: (data: Partial<DBMenu>) => Promise<DBMenu>;
  updateMenu: (data: DBMenu) => Promise<void>;
  deleteMenu: (id: string) => Promise<void>;

  // Data rows
  getRows: (tableId: string) => Promise<DataRow[]>;
  getRow: (tableId: string, id: string) => Promise<DataRow | undefined>;
  saveRow: (tableId: string, row: Partial<DataRow>) => Promise<DataRow>;
  deleteRow: (tableId: string, id: string) => Promise<void>;

  // Loading
  loading: boolean;
  refresh: () => Promise<void>;
}

const DBContext = createContext<DBContextValue | null>(null);

export function DBProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProjectState] = useState<Project | null>(null);
  const [tables, setTables] = useState<DBTable[]>([]);
  const [fields, setFields] = useState<DBField[]>([]);
  const [relationships, setRelationships] = useState<DBRelationship[]>([]);
  const [forms, setForms] = useState<DBForm[]>([]);
  const [reports, setReports] = useState<DBReport[]>([]);
  const [menus, setMenus] = useState<DBMenu[]>([]);

  const loadAll = useCallback(async () => {
    await openMetaDB();
    const [ps, ts, fs, rs, fms, rps, ms] = await Promise.all([
      dbGetAll<Project>('projects'),
      dbGetAll<DBTable>('tables'),
      dbGetAll<DBField>('fields'),
      dbGetAll<DBRelationship>('relationships'),
      dbGetAll<DBForm>('forms'),
      dbGetAll<DBReport>('reports'),
      dbGetAll<DBMenu>('menus'),
    ]);
    setProjects(ps.sort((a, b) => b.updatedAt - a.updatedAt));
    setTables(ts.sort((a, b) => a.sortOrder - b.sortOrder));
    setFields(fs.sort((a, b) => a.sortOrder - b.sortOrder));
    setRelationships(rs);
    setForms(fms.sort((a, b) => a.sortOrder - b.sortOrder));
    setReports(rps.sort((a, b) => a.sortOrder - b.sortOrder));
    setMenus(ms);
  }, []);

  useEffect(() => {
    loadAll().finally(() => setLoading(false));
  }, [loadAll]);

  // When active project changes, open its data DB
  useEffect(() => {
    if (!activeProject) return;
    const projectTables = tables.filter((t) => t.projectId === activeProject.id);
    if (projectTables.length > 0) {
      openDataDB(activeProject.id, projectTables.map((t) => t.id)).catch(console.error);
    }
  }, [activeProject, tables]);

  const setActiveProject = useCallback(
    async (p: Project | null) => {
      setActiveProjectState(p);
      if (p) {
        const projectTables = tables.filter((t) => t.projectId === p.id);
        if (projectTables.length > 0) {
          await openDataDB(p.id, projectTables.map((t) => t.id));
        }
      }
    },
    [tables]
  );

  // ─── Projects ──────────────────────────────────────────────────────────────
  const createProject = useCallback(async (data: Partial<Project>): Promise<Project> => {
    const now = Date.now();
    const p: Project = {
      id: nanoid(),
      name: data.name ?? 'New Database',
      description: data.description ?? '',
      createdAt: now,
      updatedAt: now,
      color: data.color ?? '#f5a623',
      icon: data.icon ?? 'database',
    };
    await dbPut('projects', p);
    setProjects((prev) => [p, ...prev]);
    return p;
  }, []);

  const updateProject = useCallback(async (data: Project) => {
    const updated = { ...data, updatedAt: Date.now() };
    await dbPut('projects', updated);
    setProjects((prev) => prev.map((p) => (p.id === data.id ? updated : p)));
    if (activeProject?.id === data.id) setActiveProjectState(updated);
  }, [activeProject]);

  const deleteProject = useCallback(async (id: string) => {
    await dbDelete('projects', id);
    // cascade delete tables, fields, etc.
    const projectTables = await dbGetByIndex<DBTable>('tables', 'projectId', id);
    for (const t of projectTables) {
      const tableFields = await dbGetByIndex<DBField>('fields', 'tableId', t.id);
      for (const f of tableFields) await dbDelete('fields', f.id);
      await dbDelete('tables', t.id);
    }
    const projectForms = await dbGetByIndex<DBForm>('forms', 'projectId', id);
    for (const f of projectForms) await dbDelete('forms', f.id);
    const projectReports = await dbGetByIndex<DBReport>('reports', 'projectId', id);
    for (const r of projectReports) await dbDelete('reports', r.id);
    const projectMenus = await dbGetByIndex<DBMenu>('menus', 'projectId', id);
    for (const m of projectMenus) await dbDelete('menus', m.id);
    await loadAll();
    if (activeProject?.id === id) setActiveProjectState(null);
  }, [loadAll, activeProject]);

  // ─── Tables ────────────────────────────────────────────────────────────────
  const createTable = useCallback(async (data: Partial<DBTable>): Promise<DBTable> => {
    const now = Date.now();
    const projectId = data.projectId ?? activeProject?.id ?? '';
    const existingTables = tables.filter((t) => t.projectId === projectId);
    const t: DBTable = {
      id: nanoid(),
      projectId,
      name: data.name ?? 'new_table',
      displayName: data.displayName ?? 'New Table',
      description: data.description ?? '',
      tableType: data.tableType ?? 'standard',
      color: data.color ?? '#6366f1',
      icon: data.icon ?? 'table',
      createdAt: now,
      updatedAt: now,
      sortOrder: data.sortOrder ?? existingTables.length,
    };
    await dbPut('tables', t);
    // Create default id field
    const idField: DBField = {
      id: nanoid(),
      tableId: t.id,
      projectId,
      name: 'id',
      displayName: 'ID',
      fieldType: 'id',
      required: true,
      unique: true,
      defaultValue: null,
      description: 'Auto-generated unique identifier',
      sortOrder: 0,
    };
    await dbPut('fields', idField);
    // Ensure data store
    await ensureTableStore(projectId, t.id);
    await loadAll();
    return t;
  }, [activeProject, tables, loadAll]);

  const updateTable = useCallback(async (data: DBTable) => {
    const updated = { ...data, updatedAt: Date.now() };
    await dbPut('tables', updated);
    setTables((prev) => prev.map((t) => (t.id === data.id ? updated : t)));
  }, []);

  const deleteTable = useCallback(async (id: string) => {
    // 1. Delete all fields belonging to this table
    const tableFields = await dbGetByIndex<DBField>('fields', 'tableId', id);
    const fieldIds = new Set(tableFields.map((f) => f.id));
    for (const f of tableFields) await dbDelete('fields', f.id);

    // 2. Delete all relationships that reference this table (either side)
    const allRelationships = await dbGetAll<DBRelationship>('relationships');
    for (const rel of allRelationships) {
      if (rel.fromTableId === id || rel.toTableId === id) {
        await dbDelete('relationships', rel.id);
      }
    }

    // 3. Delete all forms bound to this table
    const allForms = await dbGetAll<DBForm>('forms');
    const deletedFormIds = new Set<string>();
    for (const form of allForms) {
      if (form.tableId === id) {
        await dbDelete('forms', form.id);
        deletedFormIds.add(form.id);
      }
    }

    // 4. Delete all reports bound to this table
    const allReports = await dbGetAll<DBReport>('reports');
    const deletedReportIds = new Set<string>();
    for (const report of allReports) {
      if (report.tableId === id) {
        await dbDelete('reports', report.id);
        deletedReportIds.add(report.id);
      }
    }

    // 5. Clean up menu items that reference deleted forms/reports or deleted fields
    const allMenus = await dbGetAll<DBMenu>('menus');
    for (const menu of allMenus) {
      let items: Array<{ id?: string; type?: string; targetId?: string; children?: unknown[] }> = [];
      try { items = menu.items ? JSON.parse(menu.items) : []; } catch { items = []; }
      const filterItems = (arr: typeof items): typeof items =>
        arr
          .filter((item) => !(
            (item.type === 'form' && item.targetId && deletedFormIds.has(item.targetId)) ||
            (item.type === 'report' && item.targetId && deletedReportIds.has(item.targetId))
          ))
          .map((item) => ({
            ...item,
            children: item.children ? filterItems(item.children as typeof items) : [],
          }));
      const filtered = filterItems(items);
      if (JSON.stringify(filtered) !== JSON.stringify(items)) {
        await dbPut('menus', { ...menu, items: JSON.stringify(filtered) });
      }
    }

    // 6a. Scrub deleted form IDs from other forms' detailFormIds (master-detail links)
    const remainingFormsForMD = await dbGetAll<DBForm>('forms');
    for (const form of remainingFormsForMD) {
      if (deletedFormIds.has(form.id)) continue;
      let detailFormIds: string[] = [];
      try { detailFormIds = form.detailFormIds ? JSON.parse(form.detailFormIds) : []; } catch { detailFormIds = []; }
      const cleaned = detailFormIds.filter((fid) => !deletedFormIds.has(fid));
      if (cleaned.length !== detailFormIds.length) {
        await dbPut('forms', { ...form, detailFormIds: JSON.stringify(cleaned) });
      }
    }

    // 6b. Also clear referencedTableId on fields that pointed to the deleted table
    const allRemainingFields = await dbGetAll<DBField>('fields');
    for (const field of allRemainingFields) {
      if (fieldIds.has(field.id)) continue; // already deleted
      if (field.referencedTableId === id) {
        await dbPut('fields', { ...field, referencedTableId: undefined });
      }
    }

    // 6. Remove field references from remaining forms (formFields JSON)
    const remainingForms = await dbGetAll<DBForm>('forms');
    for (const form of remainingForms) {
      if (deletedFormIds.has(form.id)) continue;
      let formFields: Array<{ fieldId?: string }> = [];
      try { formFields = form.formFields ? JSON.parse(form.formFields) : []; } catch { formFields = []; }
      const cleaned = formFields.filter((ff) => !ff.fieldId || !fieldIds.has(ff.fieldId));
      if (cleaned.length !== formFields.length) {
        await dbPut('forms', { ...form, formFields: JSON.stringify(cleaned) });
      }
    }

    // 7. Remove field references from remaining reports (reportColumns JSON)
    const remainingReports = await dbGetAll<DBReport>('reports');
    for (const report of remainingReports) {
      if (deletedReportIds.has(report.id)) continue;
      let reportColumns: Array<{ fieldId?: string }> = [];
      try { reportColumns = report.reportColumns ? JSON.parse(report.reportColumns) : []; } catch { reportColumns = []; }
      const cleaned = reportColumns.filter((rc) => !rc.fieldId || !fieldIds.has(rc.fieldId));
      if (cleaned.length !== reportColumns.length) {
        await dbPut('reports', { ...report, reportColumns: JSON.stringify(cleaned) });
      }
    }

    // 8. Finally delete the table itself
    await dbDelete('tables', id);
    await loadAll();
  }, [loadAll]);

  // ─── Fields ────────────────────────────────────────────────────────────────
  const getFieldsForTable = useCallback(
    (tableId: string) => fields.filter((f) => f.tableId === tableId),
    [fields]
  );

  const createField = useCallback(async (data: Partial<DBField>): Promise<DBField> => {
    const tableId = data.tableId ?? '';
    const tableFields = fields.filter((f) => f.tableId === tableId);
    const f: DBField = {
      id: nanoid(),
      tableId,
      projectId: data.projectId ?? activeProject?.id ?? '',
      name: data.name ?? 'new_field',
      displayName: data.displayName ?? 'New Field',
      fieldType: data.fieldType ?? 'text',
      required: data.required ?? false,
      unique: data.unique ?? false,
      defaultValue: data.defaultValue ?? null,
      description: data.description ?? '',
      sortOrder: data.sortOrder ?? tableFields.length,
      ...data,
    };
    await dbPut('fields', f);
    setFields((prev) => [...prev, f].sort((a, b) => a.sortOrder - b.sortOrder));
    return f;
  }, [activeProject, fields]);

  const updateField = useCallback(async (data: DBField) => {
    await dbPut('fields', data);
    setFields((prev) => prev.map((f) => (f.id === data.id ? data : f)));
  }, []);

  const deleteField = useCallback(async (id: string) => {
    // 1. Delete the field itself
    await dbDelete('fields', id);

    // 2. Delete relationships that reference this field (fromFieldId or toFieldId)
    const allRelationships = await dbGetAll<DBRelationship>('relationships');
    for (const rel of allRelationships) {
      if (rel.fromFieldId === id || rel.toFieldId === id) {
        await dbDelete('relationships', rel.id);
      }
    }

    // 3. Remove this field from all form formFields arrays
    const allForms = await dbGetAll<DBForm>('forms');
    for (const form of allForms) {
      let formFields: Array<{ fieldId?: string }> = [];
      try { formFields = form.formFields ? JSON.parse(form.formFields) : []; } catch { formFields = []; }
      const cleaned = formFields.filter((ff) => ff.fieldId !== id);
      if (cleaned.length !== formFields.length) {
        await dbPut('forms', { ...form, formFields: JSON.stringify(cleaned) });
      }
    }

    // 4. Remove this field from all report reportColumns arrays
    const allReports = await dbGetAll<DBReport>('reports');
    for (const report of allReports) {
      let reportColumns: Array<{ fieldId?: string }> = [];
      try { reportColumns = report.reportColumns ? JSON.parse(report.reportColumns) : []; } catch { reportColumns = []; }
      const cleaned = reportColumns.filter((rc) => rc.fieldId !== id);
      if (cleaned.length !== reportColumns.length) {
        await dbPut('reports', { ...report, reportColumns: JSON.stringify(cleaned) });
      }
    }

    setFields((prev) => prev.filter((f) => f.id !== id));
    // Reload to sync relationships/forms/reports state
    await loadAll();
  }, [loadAll]);

  const reorderFields = useCallback(async (tableId: string, orderedIds: string[]) => {
    const updates = orderedIds.map(async (fid, idx) => {
      const field = fields.find((f) => f.id === fid);
      if (field) {
        const updated = { ...field, sortOrder: idx };
        await dbPut('fields', updated);
        return updated;
      }
      return null;
    });
    await Promise.all(updates);
    await loadAll();
  }, [fields, loadAll]);

  // ─── Relationships ─────────────────────────────────────────────────────────
  const createRelationship = useCallback(
    async (data: Partial<DBRelationship>): Promise<DBRelationship> => {
      const r: DBRelationship = {
        id: nanoid(),
        projectId: data.projectId ?? activeProject?.id ?? '',
        name: data.name ?? 'new_relationship',
        type: data.type ?? 'one_to_many',
        fromTableId: data.fromTableId ?? '',
        fromFieldId: data.fromFieldId ?? '',
        toTableId: data.toTableId ?? '',
        toFieldId: data.toFieldId ?? '',
        cascadeDelete: data.cascadeDelete ?? false,
        description: data.description ?? '',
        createdAt: Date.now(),
      };
      await dbPut('relationships', r);
      setRelationships((prev) => [...prev, r]);
      return r;
    },
    [activeProject]
  );

  const updateRelationship = useCallback(async (data: DBRelationship) => {
    await dbPut('relationships', data);
    setRelationships((prev) => prev.map((r) => (r.id === data.id ? data : r)));
  }, []);

  const deleteRelationship = useCallback(async (id: string) => {
    await dbDelete('relationships', id);
    setRelationships((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // ─── Forms ─────────────────────────────────────────────────────────────────
  const createForm = useCallback(async (data: Partial<DBForm>): Promise<DBForm> => {
    const now = Date.now();
    const projectId = data.projectId ?? activeProject?.id ?? '';
    const existingForms = forms.filter((f) => f.projectId === projectId);
    const f: DBForm = {
      id: nanoid(),
      projectId,
      tableId: data.tableId ?? '',
      name: data.name ?? 'new_form',
      displayName: data.displayName ?? 'New Form',
      description: data.description ?? '',
      formFields: data.formFields ?? '[]',
      columns: data.columns ?? 2,
      showTitle: data.showTitle ?? true,
      allowCreate: data.allowCreate ?? true,
      allowEdit: data.allowEdit ?? true,
      allowDelete: data.allowDelete ?? true,
      allowSearch: data.allowSearch ?? true,
      createdAt: now,
      updatedAt: now,
      sortOrder: data.sortOrder ?? existingForms.length,
      ...data,
    };
    await dbPut('forms', f);
    setForms((prev) => [...prev, f]);
    return f;
  }, [activeProject, forms]);

  const updateForm = useCallback(async (data: DBForm) => {
    const updated = { ...data, updatedAt: Date.now() };
    await dbPut('forms', updated);
    setForms((prev) => prev.map((f) => (f.id === data.id ? updated : f)));
  }, []);

  const deleteForm = useCallback(async (id: string) => {
    await dbDelete('forms', id);
    setForms((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // ─── Reports ───────────────────────────────────────────────────────────────
  const createReport = useCallback(async (data: Partial<DBReport>): Promise<DBReport> => {
    const now = Date.now();
    const projectId = data.projectId ?? activeProject?.id ?? '';
    const existingReports = reports.filter((r) => r.projectId === projectId);
    const r: DBReport = {
      id: nanoid(),
      projectId,
      tableId: data.tableId ?? '',
      name: data.name ?? 'new_report',
      displayName: data.displayName ?? 'New Report',
      description: data.description ?? '',
      reportColumns: data.reportColumns ?? '[]',
      filters: data.filters ?? '[]',
      defaultSort: data.defaultSort ?? '',
      defaultSortDir: data.defaultSortDir ?? 'asc',
      groupBy: data.groupBy ?? '',
      showTotals: data.showTotals ?? false,
      pageSize: data.pageSize ?? 25,
      allowExport: data.allowExport ?? true,
      allowPrint: data.allowPrint ?? true,
      createdAt: now,
      updatedAt: now,
      sortOrder: data.sortOrder ?? existingReports.length,
    };
    await dbPut('reports', r);
    setReports((prev) => [...prev, r]);
    return r;
  }, [activeProject, reports]);

  const updateReport = useCallback(async (data: DBReport) => {
    const updated = { ...data, updatedAt: Date.now() };
    await dbPut('reports', updated);
    setReports((prev) => prev.map((r) => (r.id === data.id ? updated : r)));
  }, []);

  const deleteReport = useCallback(async (id: string) => {
    await dbDelete('reports', id);
    setReports((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // ─── Menus ─────────────────────────────────────────────────────────────────
  const createMenu = useCallback(async (data: Partial<DBMenu>): Promise<DBMenu> => {
    const now = Date.now();
    const m: DBMenu = {
      id: nanoid(),
      projectId: data.projectId ?? activeProject?.id ?? '',
      name: data.name ?? 'new_menu',
      displayName: data.displayName ?? 'New Menu',
      description: data.description ?? '',
      items: data.items ?? '[]',
      isDefault: data.isDefault ?? false,
      sortOrder: data.sortOrder ?? menus.length,
      createdAt: now,
      updatedAt: now,
    };
    await dbPut('menus', m);
    setMenus((prev) => [...prev, m]);
    return m;
  }, [activeProject]);

  const updateMenu = useCallback(async (data: DBMenu) => {
    const updated = { ...data, updatedAt: Date.now() };
    await dbPut('menus', updated);
    setMenus((prev) => prev.map((m) => (m.id === data.id ? updated : m)));
  }, []);

  const deleteMenu = useCallback(async (id: string) => {
    await dbDelete('menus', id);
    setMenus((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // ─── Data rows ─────────────────────────────────────────────────────────────
  const getRows = useCallback(
    async (tableId: string): Promise<DataRow[]> => {
      if (!activeProject) return [];
      return rowGetAll(activeProject.id, tableId);
    },
    [activeProject]
  );

  const getRow = useCallback(
    async (tableId: string, id: string): Promise<DataRow | undefined> => {
      if (!activeProject) return undefined;
      return rowGet(activeProject.id, tableId, id);
    },
    [activeProject]
  );

  const saveRow = useCallback(
    async (tableId: string, row: Partial<DataRow>): Promise<DataRow> => {
      if (!activeProject) throw new Error('No active project');
      const now = Date.now();
      const saved: DataRow = {
        ...row,
        _id: row._id ?? nanoid(),
        _createdAt: row._createdAt ?? now,
        _updatedAt: now,
      } as DataRow;
      await rowPut(activeProject.id, tableId, saved);
      return saved;
    },
    [activeProject]
  );

  const deleteRowFn = useCallback(
    async (tableId: string, id: string): Promise<void> => {
      if (!activeProject) return;
      await rowDelete(activeProject.id, tableId, id);
    },
    [activeProject]
  );

  return (
    <DBContext.Provider
      value={{
        projects,
        activeProject,
        setActiveProject,
        createProject,
        updateProject,
        deleteProject,
        tables,
        createTable,
        updateTable,
        deleteTable,
        fields,
        getFieldsForTable,
        createField,
        updateField,
        deleteField,
        reorderFields,
        relationships,
        createRelationship,
        updateRelationship,
        deleteRelationship,
        forms,
        createForm,
        updateForm,
        deleteForm,
        reports,
        createReport,
        updateReport,
        deleteReport,
        menus,
        createMenu,
        updateMenu,
        deleteMenu,
        getRows,
        getRow,
        saveRow,
        deleteRow: deleteRowFn,
        loading,
        refresh: loadAll,
      }}
    >
      {children}
    </DBContext.Provider>
  );
}

export function useDB(): DBContextValue {
  const ctx = useContext(DBContext);
  if (!ctx) throw new Error('useDB must be used inside DBProvider');
  return ctx;
}
