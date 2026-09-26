/**
 * DBCreator — Core IndexedDB Data Layer
 * Obsidian Forge design: local-first, schema-driven database engine
 *
 * Stores:
 *  - projects: top-level "database" containers
 *  - tables: table definitions (schema)
 *  - fields: field definitions per table
 *  - relationships: FK / master-detail / LOV links between tables
 *  - forms: form definitions
 *  - reports: report definitions
 *  - menus: navigation menu definitions
 *  - data_{tableId}: actual row data per table (dynamic stores)
 */

export type FieldType =
  | 'id'
  | 'text'
  | 'large_text'
  | 'number'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'time'
  | 'image'
  | 'file'
  | 'foreign_key'
  | 'lov'
  | 'email'
  | 'url'
  | 'color'
  | 'json';

export type TableType = 'standard' | 'master' | 'detail' | 'lov';
export type RelationshipType = 'one_to_many' | 'many_to_one' | 'one_to_one' | 'lov';

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  color: string;
  icon: string;
}

export interface DBTable {
  id: string;
  projectId: string;
  name: string;
  displayName: string;
  description: string;
  tableType: TableType;
  color: string;
  icon: string;
  createdAt: number;
  updatedAt: number;
  sortOrder: number;
}

export interface DBField {
  id: string;
  tableId: string;
  projectId: string;
  name: string;
  displayName: string;
  fieldType: FieldType;
  required: boolean;
  unique: boolean;
  defaultValue: string | null;
  description: string;
  sortOrder: number;
  // For foreign_key / lov fields
  referencedTableId?: string;
  referencedFieldId?: string;
  displayFieldId?: string;
  // For text fields
  maxLength?: number;
  minLength?: number;
  // For number fields
  min?: number;
  max?: number;
  // For lov fields
  lovValues?: string; // JSON array of {value, label}
  // Validation
  validationRegex?: string;
  validationMessage?: string;
  // Display
  placeholder?: string;
  helpText?: string;
  isHidden?: boolean;
  isReadOnly?: boolean;
}

export interface DBRelationship {
  id: string;
  projectId: string;
  name: string;
  type: RelationshipType;
  fromTableId: string;
  fromFieldId: string;
  toTableId: string;
  toFieldId: string;
  cascadeDelete: boolean;
  description: string;
  createdAt: number;
}

export type FormFieldWidget =
  | 'input'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'date_picker'
  | 'image_upload'
  | 'file_upload'
  | 'color_picker'
  | 'number_input'
  | 'rich_text'
  | 'lookup';

export interface FormField {
  id: string;
  fieldId: string;
  widget: FormFieldWidget;
  label: string;
  placeholder: string;
  helpText: string;
  colSpan: number; // 1-12 grid columns
  row: number;
  col: number;
  visible: boolean;
  readOnly: boolean;
  required: boolean;
  defaultValue: string;
  styleOverride: string; // JSON
}

export interface DBForm {
  id: string;
  projectId: string;
  tableId: string;
  name: string;
  displayName: string;
  description: string;
  formFields: string; // JSON array of FormField
  columns: number; // grid columns (1-4)
  showTitle: boolean;
  allowCreate: boolean;
  allowEdit: boolean;
  allowDelete: boolean;
  allowSearch: boolean;
  masterFormId?: string; // for detail forms
  masterFieldId?: string;
  detailFormIds?: string; // JSON array
  createdAt: number;
  updatedAt: number;
  sortOrder: number;
}

export type ReportColumnAgg = 'none' | 'sum' | 'avg' | 'count' | 'min' | 'max';

export interface ReportColumn {
  id: string;
  fieldId: string;
  label: string;
  width: number;
  sortable: boolean;
  filterable: boolean;
  aggregation: ReportColumnAgg;
  format: string; // date format, number format, etc.
  visible: boolean;
  sortOrder: number;
}

export interface ReportFilter {
  id: string;
  fieldId: string;
  operator: string;
  value: string;
  label: string;
}

export interface DBReport {
  id: string;
  projectId: string;
  tableId: string;
  name: string;
  displayName: string;
  description: string;
  reportColumns: string; // JSON array of ReportColumn
  filters: string; // JSON array of ReportFilter
  defaultSort: string; // fieldId
  defaultSortDir: 'asc' | 'desc';
  groupBy: string; // fieldId
  showTotals: boolean;
  pageSize: number;
  allowExport: boolean;
  allowPrint: boolean;
  createdAt: number;
  updatedAt: number;
  sortOrder: number;
}

export type MenuItemType = 'form' | 'report' | 'separator' | 'group' | 'link';

export interface MenuItem {
  id: string;
  menuId?: string;
  parentId?: string | null;
  label: string;
  icon?: string;
  type: MenuItemType;
  targetId?: string | null; // formId or reportId
  url?: string | null;
  sortOrder: number;
  badge?: string;
  visible?: boolean;
  children?: MenuItem[];
}

export interface DBMenu {
  id: string;
  projectId: string;
  name: string;
  displayName: string;
  description: string;
  items: string; // JSON array of MenuItem
  isDefault?: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

// ─── IndexedDB Setup ──────────────────────────────────────────────────────────

const DB_NAME = 'dbcreator_meta';
const DB_VERSION = 1;

let _db: IDBDatabase | null = null;

export function openMetaDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('projects')) {
        const ps = db.createObjectStore('projects', { keyPath: 'id' });
        ps.createIndex('name', 'name', { unique: false });
      }
      if (!db.objectStoreNames.contains('tables')) {
        const ts = db.createObjectStore('tables', { keyPath: 'id' });
        ts.createIndex('projectId', 'projectId', { unique: false });
        ts.createIndex('name', 'name', { unique: false });
      }
      if (!db.objectStoreNames.contains('fields')) {
        const fs = db.createObjectStore('fields', { keyPath: 'id' });
        fs.createIndex('tableId', 'tableId', { unique: false });
        fs.createIndex('projectId', 'projectId', { unique: false });
      }
      if (!db.objectStoreNames.contains('relationships')) {
        const rs = db.createObjectStore('relationships', { keyPath: 'id' });
        rs.createIndex('projectId', 'projectId', { unique: false });
        rs.createIndex('fromTableId', 'fromTableId', { unique: false });
        rs.createIndex('toTableId', 'toTableId', { unique: false });
      }
      if (!db.objectStoreNames.contains('forms')) {
        const fms = db.createObjectStore('forms', { keyPath: 'id' });
        fms.createIndex('projectId', 'projectId', { unique: false });
        fms.createIndex('tableId', 'tableId', { unique: false });
      }
      if (!db.objectStoreNames.contains('reports')) {
        const rps = db.createObjectStore('reports', { keyPath: 'id' });
        rps.createIndex('projectId', 'projectId', { unique: false });
        rps.createIndex('tableId', 'tableId', { unique: false });
      }
      if (!db.objectStoreNames.contains('menus')) {
        const ms = db.createObjectStore('menus', { keyPath: 'id' });
        ms.createIndex('projectId', 'projectId', { unique: false });
      }
    };
    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

// ─── Generic CRUD helpers ─────────────────────────────────────────────────────

function tx(
  db: IDBDatabase,
  stores: string | string[],
  mode: IDBTransactionMode = 'readonly'
): IDBTransaction {
  return db.transaction(stores, mode);
}

function promisifyRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function dbGet<T>(store: string, id: string): Promise<T | undefined> {
  const db = await openMetaDB();
  return promisifyRequest<T>(tx(db, store).objectStore(store).get(id));
}

export async function dbGetAll<T>(store: string): Promise<T[]> {
  const db = await openMetaDB();
  return promisifyRequest<T[]>(tx(db, store).objectStore(store).getAll());
}

export async function dbGetByIndex<T>(
  store: string,
  index: string,
  value: string
): Promise<T[]> {
  const db = await openMetaDB();
  return promisifyRequest<T[]>(
    tx(db, store).objectStore(store).index(index).getAll(value)
  );
}

export async function dbPut<T>(store: string, item: T): Promise<void> {
  const db = await openMetaDB();
  await promisifyRequest(tx(db, store, 'readwrite').objectStore(store).put(item));
}

export async function dbDelete(store: string, id: string): Promise<void> {
  const db = await openMetaDB();
  await promisifyRequest(tx(db, store, 'readwrite').objectStore(store).delete(id));
}

// ─── Data store per table ─────────────────────────────────────────────────────

const _dataDBs: Map<string, IDBDatabase> = new Map();

export function getDataDBName(projectId: string): string {
  return `dbcreator_data_${projectId}`;
}

export async function openDataDB(
  projectId: string,
  tableIds: string[]
): Promise<IDBDatabase> {
  const dbName = getDataDBName(projectId);
  if (_dataDBs.has(dbName)) return _dataDBs.get(dbName)!;

  return new Promise((resolve, reject) => {
    // We open with a version that accommodates all table stores
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      for (const tid of tableIds) {
        const storeName = `rows_${tid}`;
        if (!db.objectStoreNames.contains(storeName)) {
          const s = db.createObjectStore(storeName, { keyPath: '_id' });
          s.createIndex('_createdAt', '_createdAt', { unique: false });
        }
      }
    };
    req.onsuccess = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      _dataDBs.set(dbName, db);
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function ensureTableStore(
  projectId: string,
  tableId: string
): Promise<void> {
  const dbName = getDataDBName(projectId);
  const storeName = `rows_${tableId}`;

  // Close existing connection if open
  if (_dataDBs.has(dbName)) {
    const existing = _dataDBs.get(dbName)!;
    if (existing.objectStoreNames.contains(storeName)) return;
    existing.close();
    _dataDBs.delete(dbName);
  }

  // Get current version
  const currentVersion = await new Promise<number>((res, rej) => {
    const r = indexedDB.open(dbName);
    r.onsuccess = (e) => {
      const v = (e.target as IDBOpenDBRequest).result.version;
      (e.target as IDBOpenDBRequest).result.close();
      res(v);
    };
    r.onerror = () => rej(r.error);
  });

  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(dbName, currentVersion + 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(storeName)) {
        const s = db.createObjectStore(storeName, { keyPath: '_id' });
        s.createIndex('_createdAt', '_createdAt', { unique: false });
      }
    };
    req.onsuccess = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      _dataDBs.set(dbName, db);
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getDataDB(projectId: string): Promise<IDBDatabase | null> {
  const dbName = getDataDBName(projectId);
  return _dataDBs.get(dbName) ?? null;
}

// ─── Row CRUD ─────────────────────────────────────────────────────────────────

export type DataRow = Record<string, unknown> & { _id: string; _createdAt: number; _updatedAt: number };

export async function rowGetAll(projectId: string, tableId: string): Promise<DataRow[]> {
  const db = _dataDBs.get(getDataDBName(projectId));
  if (!db) return [];
  const storeName = `rows_${tableId}`;
  if (!db.objectStoreNames.contains(storeName)) return [];
  return promisifyRequest<DataRow[]>(
    tx(db, storeName).objectStore(storeName).getAll()
  );
}

export async function rowGet(
  projectId: string,
  tableId: string,
  id: string
): Promise<DataRow | undefined> {
  const db = _dataDBs.get(getDataDBName(projectId));
  if (!db) return undefined;
  const storeName = `rows_${tableId}`;
  return promisifyRequest<DataRow | undefined>(
    tx(db, storeName).objectStore(storeName).get(id)
  );
}

export async function rowPut(
  projectId: string,
  tableId: string,
  row: DataRow
): Promise<void> {
  const db = _dataDBs.get(getDataDBName(projectId));
  if (!db) throw new Error('Data DB not open');
  const storeName = `rows_${tableId}`;
  await promisifyRequest(
    tx(db, storeName, 'readwrite').objectStore(storeName).put(row)
  );
}

export async function rowDelete(
  projectId: string,
  tableId: string,
  id: string
): Promise<void> {
  const db = _dataDBs.get(getDataDBName(projectId));
  if (!db) throw new Error('Data DB not open');
  const storeName = `rows_${tableId}`;
  await promisifyRequest(
    tx(db, storeName, 'readwrite').objectStore(storeName).delete(id)
  );
}

export async function rowCount(projectId: string, tableId: string): Promise<number> {
  const db = _dataDBs.get(getDataDBName(projectId));
  if (!db) return 0;
  const storeName = `rows_${tableId}`;
  if (!db.objectStoreNames.contains(storeName)) return 0;
  return promisifyRequest<number>(
    tx(db, storeName).objectStore(storeName).count()
  );
}
