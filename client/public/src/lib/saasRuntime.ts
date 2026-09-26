/**
 * SaaS Runtime Engine
 * Generates a fully self-contained single-file HTML application from a DBCreator project.
 * The generated file:
 *  - Stores all data in the browser's IndexedDB (local, no server needed)
 *  - Renders menus, forms, and reports from the embedded schema
 *  - Works offline, installable as PWA
 *  - No external dependencies — pure vanilla JS/CSS
 */

import type { Project, DBTable, DBField, DBRelationship, DBForm, DBReport, DBMenu, MenuItem } from './db';

export interface SaasAppConfig {
  appName: string;
  appSubtitle: string;
  primaryColor: string;
  darkMode: boolean;
  logoEmoji: string;
  allowDataExport: boolean;
  allowDataImport: boolean;
}

export interface SaasBundle {
  project: Project;
  tables: DBTable[];
  fields: DBField[];
  relationships: DBRelationship[];
  forms: DBForm[];
  reports: DBReport[];
  menus: DBMenu[];
  config: SaasAppConfig;
  /** Seed data: tableId → array of row objects. Embedded in the exported HTML and pre-loaded into IndexedDB on first run. */
  data: Record<string, Record<string, unknown>[]>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert flat MenuItem[] (parentId-based) into nested children tree for the runtime */
function nestMenuItems(items: MenuItem[]): MenuItem[] {
  const map = new Map<string, MenuItem>();
  const roots: MenuItem[] = [];
  // Clone items so we don't mutate the originals
  const cloned = items.map(i => ({ ...i, children: [] as MenuItem[] }));
  cloned.forEach(i => map.set(i.id, i));
  cloned.forEach(i => {
    if (i.parentId && map.has(i.parentId)) {
      const parent = map.get(i.parentId)!;
      if (!parent.children) parent.children = [];
      parent.children.push(i);
    } else {
      roots.push(i);
    }
  });
  // Sort by sortOrder at each level
  const sortLevel = (arr: MenuItem[]) => {
    arr.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    arr.forEach(i => i.children && sortLevel(i.children));
  };
  sortLevel(roots);
  return roots;
}

// ─── HTML Generator ───────────────────────────────────────────────────────────

export function generateSaasHtml(bundle: SaasBundle): string {
  const { config } = bundle;

  // Convert flat menu items to nested tree before serialising
  const bundleWithNestedMenus: SaasBundle = {
    ...bundle,
    menus: bundle.menus.map(m => {
      let items: MenuItem[] = [];
      try { items = m.items ? JSON.parse(m.items) : []; } catch { items = []; }
      return { ...m, items: JSON.stringify(nestMenuItems(items)) };
    }),
  };

  const bundleJson = JSON.stringify(bundleWithNestedMenus).replace(/<\/script>/gi, '<\\/script>');

  const primaryHex = config.primaryColor || '#f5a623';
  const darkBg = config.darkMode ? '#1a1a2e' : '#f0f2f5';
  const darkSurface = config.darkMode ? '#16213e' : '#ffffff';
  const darkBorder = config.darkMode ? '#0f3460' : '#e2e8f0';
  const darkText = config.darkMode ? '#e2e8f0' : '#1a202c';
  const darkMuted = config.darkMode ? '#94a3b8' : '#64748b';
  const darkInput = config.darkMode ? '#0d1b2a' : '#f8fafc';
  const sidebarBg = config.darkMode ? '#0d1b2a' : '#1e293b';
  const sidebarText = '#e2e8f0';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escHtml(config.appName)}</title>
<meta name="description" content="${escHtml(config.appSubtitle)}"/>
<link rel="manifest" href="data:application/json,${encodeURIComponent(JSON.stringify({
    name: config.appName,
    short_name: config.appName,
    start_url: '.',
    display: 'standalone',
    background_color: darkBg,
    theme_color: primaryHex,
    icons: []
  }))}"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --primary:${primaryHex};
  --bg:${darkBg};
  --surface:${darkSurface};
  --border:${darkBorder};
  --text:${darkText};
  --muted:${darkMuted};
  --input-bg:${darkInput};
  --sidebar-bg:${sidebarBg};
  --sidebar-text:${sidebarText};
  --radius:8px;
  --shadow:0 2px 8px rgba(0,0,0,0.15);
}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;flex-direction:column}
a{color:var(--primary);text-decoration:none}
button{cursor:pointer;font-family:inherit}
input,select,textarea{font-family:inherit}

/* Layout */
#app{display:flex;min-height:100vh}
#sidebar{width:240px;min-width:240px;background:var(--sidebar-bg);color:var(--sidebar-text);display:flex;flex-direction:column;transition:width .2s}
#sidebar.collapsed{width:56px;min-width:56px}
#sidebar-header{padding:16px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:10px;min-height:60px}
#sidebar-logo{font-size:24px;flex-shrink:0}
#sidebar-title{font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;transition:opacity .2s}
#sidebar.collapsed #sidebar-title{opacity:0;width:0}
#sidebar-nav{flex:1;overflow-y:auto;padding:8px 0}
.nav-group{margin-bottom:4px}
.nav-group-label{padding:8px 16px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.4);white-space:nowrap;overflow:hidden}
#sidebar.collapsed .nav-group-label{opacity:0}
.nav-item{display:flex;align-items:flex-start;gap:10px;padding:9px 16px;cursor:pointer;border-radius:0;transition:background .15s;font-size:14px;color:var(--sidebar-text);border:none;background:none;width:100%;text-align:left}
.nav-item:hover{background:rgba(255,255,255,.07)}
.nav-item.active{background:var(--primary);color:#fff}
.nav-item .nav-icon{font-size:16px;flex-shrink:0;width:20px;text-align:center;padding-top:2px}
.nav-item .nav-label{overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;white-space:normal;flex:1;min-width:0;transition:opacity .2s;line-height:1.3;word-break:break-word}
#sidebar.collapsed .nav-label{opacity:0;width:0}
.nav-sep{height:1px;background:rgba(255,255,255,.08);margin:6px 12px}
#sidebar-toggle{padding:12px 16px;border-top:1px solid rgba(255,255,255,.08);display:flex;justify-content:flex-end}
#sidebar-toggle button{background:none;border:none;color:rgba(255,255,255,.5);font-size:18px;cursor:pointer;padding:4px 8px;border-radius:4px}
#sidebar-toggle button:hover{color:#fff;background:rgba(255,255,255,.1)}

/* Main area */
#main{flex:1;display:flex;flex-direction:column;overflow:hidden}
#topbar{height:56px;background:var(--surface);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 20px;gap:12px;flex-shrink:0;box-shadow:var(--shadow)}
#topbar-title{font-size:16px;font-weight:600;flex:1}
#topbar-actions{display:flex;gap:8px}
#content{flex:1;overflow-y:auto;padding:24px}

/* Cards */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow)}
.card-header{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.card-title{font-size:15px;font-weight:600}
.card-body{padding:20px}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:var(--radius);font-size:14px;font-weight:500;border:none;transition:all .15s;cursor:pointer}
.btn:active{transform:scale(.97)}
.btn-primary{background:var(--primary);color:#fff}
.btn-primary:hover{filter:brightness(1.1)}
.btn-secondary{background:var(--input-bg);color:var(--text);border:1px solid var(--border)}
.btn-secondary:hover{border-color:var(--primary);color:var(--primary)}
.btn-danger{background:#ef4444;color:#fff}
.btn-danger:hover{background:#dc2626}
.btn-sm{padding:5px 10px;font-size:13px}
.btn-icon{padding:6px;border-radius:6px;background:var(--input-bg);border:1px solid var(--border);color:var(--muted)}
.btn-icon:hover{color:var(--primary);border-color:var(--primary)}

/* Form controls */
.form-group{margin-bottom:16px}
.form-label{display:block;font-size:13px;font-weight:500;margin-bottom:6px;color:var(--muted)}
.form-label .required{color:#ef4444;margin-left:2px}
.form-control{width:100%;padding:9px 12px;background:var(--input-bg);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-size:14px;transition:border .15s}
.form-control:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px ${primaryHex}22}
textarea.form-control{min-height:100px;resize:vertical}
.form-control[type=checkbox]{width:auto;margin-right:6px}
.form-hint{font-size:12px;color:var(--muted);margin-top:4px}
.form-error{font-size:12px;color:#ef4444;margin-top:4px}

/* Grid */
.form-grid{display:grid;gap:16px}
.col-1{grid-column:span 1}
.col-2{grid-column:span 2}
.col-3{grid-column:span 3}
.col-4{grid-column:span 4}

/* Table */
.data-table{width:100%;border-collapse:collapse;font-size:14px}
.data-table th{background:var(--input-bg);padding:10px 14px;text-align:left;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);border-bottom:2px solid var(--border)}
.data-table td{padding:10px 14px;border-bottom:1px solid var(--border);vertical-align:middle}
.data-table tr:hover td{background:${primaryHex}0a}
.data-table tr.selected td{background:${primaryHex}18}

/* Badges */
.badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600}
.badge-primary{background:${primaryHex}22;color:var(--primary)}
.badge-success{background:#10b98122;color:#10b981}
.badge-danger{background:#ef444422;color:#ef4444}

/* Pagination */
.pagination{display:flex;align-items:center;gap:6px;margin-top:16px;justify-content:flex-end}
.page-btn{min-width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:6px;border:1px solid var(--border);background:var(--input-bg);color:var(--text);font-size:13px;cursor:pointer}
.page-btn:hover{border-color:var(--primary);color:var(--primary)}
.page-btn.active{background:var(--primary);color:#fff;border-color:var(--primary)}
.page-info{font-size:13px;color:var(--muted)}

/* Modal */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px}
.modal{background:var(--surface);border-radius:var(--radius);box-shadow:0 20px 60px rgba(0,0,0,.3);width:100%;max-width:600px;max-height:90vh;display:flex;flex-direction:column}
.modal-header{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.modal-title{font-size:16px;font-weight:600}
.modal-body{padding:20px;overflow-y:auto;flex:1}
.modal-footer{padding:12px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px;flex-shrink:0}

/* Search bar */
.search-bar{display:flex;align-items:center;gap:8px;margin-bottom:16px}
.search-input{flex:1;padding:8px 12px;background:var(--input-bg);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-size:14px}
.search-input:focus{outline:none;border-color:var(--primary)}

/* Toast */
#toast-container{position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px}
.toast{padding:12px 16px;border-radius:var(--radius);color:#fff;font-size:14px;box-shadow:var(--shadow);animation:slideIn .2s ease;max-width:320px}
.toast-success{background:#10b981}
.toast-error{background:#ef4444}
.toast-info{background:var(--primary)}
@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}

/* Empty state */
.empty-state{text-align:center;padding:48px 20px;color:var(--muted)}
.empty-state-icon{font-size:48px;margin-bottom:12px}
.empty-state-title{font-size:16px;font-weight:600;color:var(--text);margin-bottom:6px}
.empty-state-desc{font-size:14px}

/* Dashboard */
.stat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;margin-bottom:24px}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;display:flex;flex-direction:column;gap:6px}
.stat-value{font-size:28px;font-weight:700;color:var(--primary)}
.stat-label{font-size:13px;color:var(--muted)}

/* Responsive */
@media(max-width:768px){
  #sidebar{position:fixed;left:0;top:0;bottom:0;z-index:100;transform:translateX(-100%);transition:transform .2s}
  #sidebar.mobile-open{transform:translateX(0)}
  #main{width:100%}
  #mobile-menu-btn{display:flex!important}
  .form-grid{grid-template-columns:1fr!important}
}
#mobile-menu-btn{display:none;background:none;border:none;color:var(--text);font-size:20px;cursor:pointer;padding:4px}

/* Scrollbar */
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--muted)}

/* Print */
@media print{#sidebar,#topbar-actions,.btn-primary,.btn-secondary,.btn-danger,.pagination{display:none!important}#content{padding:0}}
</style>
</head>
<body>
<div id="app">
  <div id="sidebar">
    <div id="sidebar-header">
      <span id="sidebar-logo">${escHtml(config.logoEmoji || '🗄️')}</span>
      <span id="sidebar-title">${escHtml(config.appName)}</span>
    </div>
    <nav id="sidebar-nav"></nav>
    <div id="sidebar-toggle"><button onclick="toggleSidebar()" title="Collapse sidebar">◀</button></div>
  </div>
  <div id="main">
    <div id="topbar">
      <button id="mobile-menu-btn" onclick="toggleMobileSidebar()">☰</button>
      <span id="topbar-title">${escHtml(config.appName)}</span>
      <div id="topbar-actions">
        ${config.allowDataExport ? '<button class="btn btn-secondary btn-sm" onclick="exportAllData()">⬇ Export</button>' : ''}
        ${config.allowDataImport ? '<button class="btn btn-secondary btn-sm" onclick="importData()">⬆ Import</button>' : ''}
      </div>
    </div>
    <div id="content"></div>
  </div>
</div>
<div id="toast-container"></div>

<script>
// ─── Bundle ────────────────────────────────────────────────────────────────
const BUNDLE = ${bundleJson};
const { tables, fields, relationships, forms, reports, menus } = BUNDLE;

// ─── IndexedDB ─────────────────────────────────────────────────────────────
const DB_NAME = 'saas_' + ${JSON.stringify(bundle.project.id)};
let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const stores = tables.map(t => t.id);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      stores.forEach(id => {
        if (!db.objectStoreNames.contains('data_' + id)) {
          db.createObjectStore('data_' + id, { keyPath: '_id' });
        }
      });
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

async function getAll(tableId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('data_' + tableId, 'readonly');
    const req = tx.objectStore('data_' + tableId).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function getOne(tableId, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('data_' + tableId, 'readonly');
    const req = tx.objectStore('data_' + tableId).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putRow(tableId, row) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!row._id) row._id = crypto.randomUUID();
    const tx = db.transaction('data_' + tableId, 'readwrite');
    const req = tx.objectStore('data_' + tableId).put(row);
    req.onsuccess = () => resolve(row._id);
    req.onerror = () => reject(req.error);
  });
}

async function deleteRow(tableId, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('data_' + tableId, 'readwrite');
    const req = tx.objectStore('data_' + tableId).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(msg, type='info') {
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
function getTableById(id) { return tables.find(t => t.id === id); }
function getFieldsByTable(tableId) { return fields.filter(f => f.tableId === tableId).sort((a,b) => a.sortOrder - b.sortOrder); }
function getFormById(id) { return forms.find(f => f.id === id); }
function getReportById(id) { return reports.find(r => r.id === id); }
// Cache for FK lookups: tableId -> rows[]
const _fkCache = {};
async function loadFkCache(tableId) {
  if (!_fkCache[tableId]) _fkCache[tableId] = await getAll(tableId);
  return _fkCache[tableId];
}
function clearFkCache() { Object.keys(_fkCache).forEach(k => delete _fkCache[k]); }

function formatValue(field, value) {
  if (value === null || value === undefined || value === '') return '<span style="color:var(--muted)">—</span>';
  if (field.fieldType === 'boolean') return value ? '✓' : '✗';
  if (field.fieldType === 'image') return '<img src="' + esc(value) + '" style="height:32px;border-radius:4px;object-fit:cover"/>';
  if (field.fieldType === 'color') return '<span style="display:inline-block;width:16px;height:16px;border-radius:3px;background:' + esc(value) + ';border:1px solid var(--border)"></span> ' + esc(value);
  if (field.fieldType === 'url') return '<a href="' + esc(value) + '" target="_blank">' + esc(value) + '</a>';
  if (field.fieldType === 'email') return '<a href="mailto:' + esc(value) + '">' + esc(value) + '</a>';
  if (field.fieldType === 'date' || field.fieldType === 'datetime') {
    try { return new Date(value).toLocaleString(); } catch { return esc(value); }
  }
  if (field.fieldType === 'lov') {
    try {
      const opts = typeof field.lovValues === 'string' ? JSON.parse(field.lovValues) : (field.lovValues || []);
      const match = opts.find(o => o.value === value || o.value === String(value));
      if (match) return esc(match.label || match.value);
    } catch {}
  }
  if (field.fieldType === 'foreign_key' && field.referencedTableId) {
    const refRows = _fkCache[field.referencedTableId] || [];
    const refRow = refRows.find(r => r._id === value || r._id === String(value));
    if (refRow) {
      const refFields = getFieldsByTable(field.referencedTableId);
      const displayF = refFields.find(rf => rf.id === field.displayFieldId) || refFields.find(rf => rf.fieldType !== 'foreign_key') || refFields[0];
      if (displayF && refRow[displayF.name] !== undefined) return esc(String(refRow[displayF.name]));
    }
    return esc(String(value));
  }
  return esc(String(value));
}

// ─── Sidebar ───────────────────────────────────────────────────────────────
let sidebarCollapsed = false;
function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  document.getElementById('sidebar').classList.toggle('collapsed', sidebarCollapsed);
  document.querySelector('#sidebar-toggle button').textContent = sidebarCollapsed ? '▶' : '◀';
}
function toggleMobileSidebar() {
  document.getElementById('sidebar').classList.toggle('mobile-open');
}

function buildSidebar() {
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = '';

  // Dashboard link
  const dashBtn = document.createElement('button');
  dashBtn.className = 'nav-item';
  dashBtn.dataset.view = 'dashboard';
  dashBtn.title = 'Dashboard';
  dashBtn.innerHTML = '<span class="nav-icon">🏠</span><span class="nav-label">Dashboard</span>';
  dashBtn.onclick = () => showDashboard();
  nav.appendChild(dashBtn);

  // Menu items
  const defaultMenu = menus.find(m => m.isDefault) || menus[0];
  if (defaultMenu) {
    const items = JSON.parse(defaultMenu.items || '[]');
    renderMenuItems(nav, items);
  } else {
    // Fallback: show all forms and reports
    if (forms.length > 0) {
      const grp = document.createElement('div');
      grp.className = 'nav-group';
      grp.innerHTML = '<div class="nav-group-label">Forms</div>';
      forms.forEach(f => {
        const btn = document.createElement('button');
        btn.className = 'nav-item';
        btn.dataset.view = 'form_' + f.id;
        btn.title = esc(f.displayName || f.name);
        btn.innerHTML = '<span class="nav-icon">📝</span><span class="nav-label">' + esc(f.displayName || f.name) + '</span>';
        btn.onclick = () => showForm(f.id);
        grp.appendChild(btn);
      });
      nav.appendChild(grp);
    }
    if (reports.length > 0) {
      const grp = document.createElement('div');
      grp.className = 'nav-group';
      grp.innerHTML = '<div class="nav-group-label">Reports</div>';
      reports.forEach(r => {
        const btn = document.createElement('button');
        btn.className = 'nav-item';
        btn.dataset.view = 'report_' + r.id;
        btn.title = esc(r.displayName || r.name);
        btn.innerHTML = '<span class="nav-icon">📊</span><span class="nav-label">' + esc(r.displayName || r.name) + '</span>';
        btn.onclick = () => showReport(r.id);
        grp.appendChild(btn);
      });
      nav.appendChild(grp);
    }
  }
  // Reference Data: LOV tables
  const lovTables = tables.filter(t => t.tableType === 'lov');
  if (lovTables.length > 0) {
    const grp = document.createElement('div');
    grp.className = 'nav-group';
    grp.innerHTML = '<div class="nav-group-label">Reference Data</div>';
    lovTables.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'nav-item';
      btn.dataset.view = 'lov_' + t.id;
      const label = t.displayName || t.name;
      btn.title = label;
      btn.innerHTML = '<span class="nav-icon">📌</span><span class="nav-label">' + esc(label) + '</span>';
      btn.onclick = () => showLovManager(t.id);
      grp.appendChild(btn);
    });
    nav.appendChild(grp);
  }
}

function renderMenuItems(container, items, depth=0) {
  items.forEach(item => {
    if (!item.visible && item.visible !== undefined) return;
    if (item.type === 'separator') {
      const sep = document.createElement('div');
      sep.className = 'nav-sep';
      container.appendChild(sep);
      return;
    }
    if (item.type === 'group') {
      const grp = document.createElement('div');
      grp.className = 'nav-group';
      grp.innerHTML = '<div class="nav-group-label">' + esc(item.label) + '</div>';
      if (item.children && item.children.length > 0) renderMenuItems(grp, item.children, depth+1);
      container.appendChild(grp);
      return;
    }
    const btn = document.createElement('button');
    btn.className = 'nav-item';
    const icon = item.icon || (item.type === 'form' ? '📝' : item.type === 'report' ? '📊' : '🔗');
    btn.title = esc(item.label);
    btn.innerHTML = '<span class="nav-icon">' + esc(icon) + '</span><span class="nav-label">' + esc(item.label) + (item.badge ? ' <span class="badge badge-primary">' + esc(item.badge) + '</span>' : '') + '</span>';
    if (item.type === 'form' && item.targetId) {
      btn.dataset.view = 'form_' + item.targetId;
      btn.onclick = () => showForm(item.targetId);
    } else if (item.type === 'report' && item.targetId) {
      btn.dataset.view = 'report_' + item.targetId;
      btn.onclick = () => showReport(item.targetId);
    } else if (item.type === 'link' && item.url) {
      btn.onclick = () => window.open(item.url, '_blank');
    }
    container.appendChild(btn);
  });
}

function setActiveNav(viewId) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const el = document.querySelector('[data-view="' + viewId + '"]');
  if (el) el.classList.add('active');
}

// ─── Dashboard ─────────────────────────────────────────────────────────────
async function showDashboard() {
  setActiveNav('dashboard');
  document.getElementById('topbar-title').textContent = 'Dashboard';
  const content = document.getElementById('content');

  const counts = await Promise.all(tables.map(t => getAll(t.id).then(rows => ({ table: t, count: rows.length }))));

  content.innerHTML = '<div class="stat-grid">' +
    counts.map(c => '<div class="stat-card"><div class="stat-value">' + c.count + '</div><div class="stat-label">' + esc(c.table.displayName || c.table.name) + '</div></div>').join('') +
    '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px">' +
    forms.map(f => '<div class="card" style="cursor:pointer" onclick="showForm(\\'' + f.id + '\\')">' +
      '<div class="card-body"><div style="font-size:24px;margin-bottom:8px">📝</div><div style="font-weight:600;margin-bottom:4px">' + esc(f.displayName || f.name) + '</div><div style="font-size:13px;color:var(--muted)">' + esc(f.description || 'Data entry form') + '</div></div></div>').join('') +
    reports.map(r => '<div class="card" style="cursor:pointer" onclick="showReport(\\'' + r.id + '\\')">' +
      '<div class="card-body"><div style="font-size:24px;margin-bottom:8px">📊</div><div style="font-weight:600;margin-bottom:4px">' + esc(r.displayName || r.name) + '</div><div style="font-size:13px;color:var(--muted)">' + esc(r.description || 'Report') + '</div></div></div>').join('') +
    '</div>';
}

// ─── Form Renderer ─────────────────────────────────────────────────────────
let currentFormId = null;
let currentFormPage = 1;
const PAGE_SIZE_FORM = 20;
let formRows = [];
let formSearch = '';

// Master-detail state
let mdSelectedMasterId = null;
let mdMasterSearch = '';
let mdActiveDetailIdx = 0;

async function showForm(formId) {
  currentFormId = formId;
  currentFormPage = 1;
  formSearch = '';
  const form = getFormById(formId);
  if (!form) { toast('Form not found', 'error'); return; }
  setActiveNav('form_' + formId);
  document.getElementById('topbar-title').textContent = form.displayName || form.name;

  // Check if this is a master-detail form
  let detailFormIds = [];
  try { detailFormIds = form.detailFormIds ? JSON.parse(form.detailFormIds) : []; } catch {}
  const detailForms = detailFormIds.map(id => getFormById(id)).filter(Boolean);

  if (detailForms.length > 0) {
    mdSelectedMasterId = null;
    mdMasterSearch = '';
    mdActiveDetailIdx = 0;
    await renderMasterDetail(form, detailForms);
  } else {
    await renderFormList(form);
  }
}

function currentDetailForms() {
  const form = getFormById(currentFormId);
  if (!form) return [];
  let ids = [];
  try { ids = form.detailFormIds ? JSON.parse(form.detailFormIds) : []; } catch {}
  return ids.map(id => getFormById(id)).filter(Boolean);
}

async function selectMasterRow(id) {
  mdSelectedMasterId = id;
  mdActiveDetailIdx = 0;
  const form = getFormById(currentFormId);
  await renderMasterDetail(form, currentDetailForms());
}

async function deleteDetailRecord(tableId, id) {
  if (!confirm('Delete this record?')) return;
  await deleteRow(tableId, id);
  toast('Record deleted', 'success');
  const form = getFormById(currentFormId);
  await renderMasterDetail(form, currentDetailForms());
}

async function openDetailModal(detailFormId, recordId) {
  const detailForm = getFormById(detailFormId);
  if (!detailForm) return;
  const detailTableFields = getFieldsByTable(detailForm.tableId);
  const masterForm = getFormById(currentFormId);
  const fkField = detailTableFields.find(f => f.referencedTableId === masterForm?.tableId);
  const savedFormId = currentFormId;
  currentFormId = detailFormId;
  await openFormModal(recordId, fkField ? fkField.name : null, mdSelectedMasterId);
  currentFormId = savedFormId;
}

async function renderMasterDetail(masterForm, detailForms) {
  const masterFields = getFieldsByTable(masterForm.tableId);
  const masterFormFieldDefs = JSON.parse(masterForm.formFields || '[]');
  const masterDisplayFields = masterFormFieldDefs
    .filter(ff => ff.visible !== false)
    .slice(0, 3)
    .map(ff => masterFields.find(f => f.id === ff.fieldId))
    .filter(Boolean);

  const allMasterRows = await getAll(masterForm.tableId);
  const filteredMaster = mdMasterSearch
    ? allMasterRows.filter(row => masterDisplayFields.some(f => String(row[f.name] || '').toLowerCase().includes(mdMasterSearch.toLowerCase())))
    : allMasterRows;

  const content = document.getElementById('content');

  const masterListHtml =
    '<div style="display:flex;flex-direction:column;height:100%;overflow:hidden">' +
    '<div style="padding:12px;border-bottom:1px solid var(--border);flex-shrink:0">' +
    '<input class="search-input" style="width:100%;margin:0" placeholder="Search..." value="' + esc(mdMasterSearch) + '" oninput="mdMasterSearch=this.value;renderMasterDetail(getFormById(currentFormId),currentDetailForms())"/>' +
    '</div>' +
    '<div style="flex:1;overflow-y:auto">' +
    (filteredMaster.length === 0
      ? '<div class="empty-state" style="padding:24px 16px"><div class="empty-state-icon" style="font-size:32px">\uD83D\uDCED</div><div class="empty-state-title" style="font-size:14px">No records</div></div>'
      : filteredMaster.map(row => {
          const primaryVal = masterDisplayFields[0] ? String(row[masterDisplayFields[0].name] || '') : row._id;
          const secondaryVal = masterDisplayFields[1] ? String(row[masterDisplayFields[1].name] || '') : '';
          const initials = primaryVal.slice(0, 2).toUpperCase() || '??';
          const isSelected = row._id === mdSelectedMasterId;
          return '<div onclick="selectMasterRow(\\'' + row._id + '\\')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-left:3px solid ' + (isSelected ? 'var(--primary)' : 'transparent') + ';background:' + (isSelected ? 'rgba(var(--primary-rgb,245,166,35),0.1)' : 'transparent') + '">' +
            '<div style="width:36px;height:36px;border-radius:50%;background:rgba(245,166,35,0.15);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">' + esc(initials) + '</div>' +
            '<div style="flex:1;min-width:0">' +
            '<div style="font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(primaryVal) + '</div>' +
            (secondaryVal ? '<div style="font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(secondaryVal) + '</div>' : '') +
            '</div>' +
            '</div>';
        }).join('')
    ) +
    '</div>' +
    '<div style="padding:10px;border-top:1px solid var(--border);flex-shrink:0">' +
    (masterForm.allowCreate !== false
      ? '<button class="btn btn-primary" style="width:100%;justify-content:center" onclick="openFormModal(null,null,null)">+ New ' + esc(masterForm.displayName || masterForm.name) + '</button>'
      : '') +
    '</div>' +
    '</div>';

  let detailHtml = '';
  if (!mdSelectedMasterId) {
    detailHtml =
      '<div class="empty-state" style="padding:80px 20px">' +
      '<div class="empty-state-icon" style="font-size:48px">&larr;</div>' +
      '<div class="empty-state-title">Select a record</div>' +
      '<div class="empty-state-desc">Choose a ' + esc(masterForm.displayName || masterForm.name) + ' from the list to view its details.</div>' +
      '</div>';
  } else {
    const tabsHtml = detailForms.length > 1
      ? '<div style="display:flex;gap:4px;margin-bottom:16px;border-bottom:1px solid var(--border)">' +
        detailForms.map((df, idx) =>
          '<button onclick="mdActiveDetailIdx=' + idx + ';renderMasterDetail(getFormById(currentFormId),currentDetailForms())" style="padding:8px 16px;border:none;background:none;cursor:pointer;font-size:14px;font-weight:600;border-bottom:2px solid ' + (idx === mdActiveDetailIdx ? 'var(--primary)' : 'transparent') + ';color:' + (idx === mdActiveDetailIdx ? 'var(--primary)' : 'var(--muted)') + ';margin-bottom:-1px">' + esc(df.displayName || df.name) + '</button>'
        ).join('') +
        '</div>'
      : '';

    const activeDetail = detailForms[mdActiveDetailIdx] || detailForms[0];
    if (activeDetail) {
      const detailTableFields = getFieldsByTable(activeDetail.tableId);
      const fkField = detailTableFields.find(f => f.referencedTableId === masterForm.tableId);
      const detailFormFieldDefs = JSON.parse(activeDetail.formFields || '[]');
      const detailDisplayFields = detailFormFieldDefs
        .filter(ff => ff.visible !== false)
        .slice(0, 6)
        .map(ff => detailTableFields.find(f => f.id === ff.fieldId))
        .filter(Boolean);

      const allDetailRows = await getAll(activeDetail.tableId);
      const filteredDetail = fkField
        ? allDetailRows.filter(r => r[fkField.name] === mdSelectedMasterId)
        : allDetailRows;

      const detailTableHtml = filteredDetail.length === 0
        ? '<div class="empty-state"><div class="empty-state-icon">\uD83D\uDCED</div><div class="empty-state-title">No ' + esc(activeDetail.displayName || activeDetail.name) + ' yet</div><div class="empty-state-desc">Click "+ New" to add one.</div></div>'
        : '<div style="overflow-x:auto"><table class="data-table"><thead><tr>' +
          detailDisplayFields.map(f => '<th>' + esc(f.displayName || f.name) + '</th>').join('') +
          '<th style="width:80px">Actions</th></tr></thead><tbody>' +
          filteredDetail.map(row =>
            '<tr>' +
            detailDisplayFields.map(f => '<td>' + formatValue(f, row[f.name]) + '</td>').join('') +
            '<td><div style="display:flex;gap:4px">' +
            (activeDetail.allowEdit !== false ? '<button class="btn-icon btn-sm" onclick="openDetailModal(\\'' + activeDetail.id + '\\',\\'' + row._id + '\\')" title="Edit">\u270F\uFE0F</button>' : '') +
            (activeDetail.allowDelete !== false ? '<button class="btn-icon btn-sm" onclick="deleteDetailRecord(\\'' + activeDetail.tableId + '\\',\\'' + row._id + '\\')" title="Delete">\uD83D\uDDD1\uFE0F</button>' : '') +
            '</div></td></tr>'
          ).join('') +
          '</tbody></table></div>';

      detailHtml = tabsHtml +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
        '<span style="font-weight:600;font-size:15px">' + esc(activeDetail.displayName || activeDetail.name) + '</span>' +
        (activeDetail.allowCreate !== false
          ? '<button class="btn btn-primary btn-sm" onclick="openDetailModal(\\'' + activeDetail.id + '\\',null)">+ New</button>'
          : '') +
        '</div>' +
        detailTableHtml;
    }
  }

  content.innerHTML =
    '<div style="display:flex;gap:0;height:calc(100vh - 120px);overflow:hidden;border-radius:8px;border:1px solid var(--border);background:var(--surface)">' +
    '<div style="width:280px;min-width:280px;border-right:1px solid var(--border);overflow:hidden;display:flex;flex-direction:column">' + masterListHtml + '</div>' +
    '<div style="flex:1;overflow-y:auto;padding:20px">' + detailHtml + '</div>' +
    '</div>';
}

async function renderFormList(form) {
  const tbl = getTableById(form.tableId);
  if (!tbl) return;
  const tableFields = getFieldsByTable(form.tableId);
  const formFieldDefs = JSON.parse(form.formFields || '[]');
  const visibleFields = formFieldDefs.filter(ff => ff.visible !== false).slice(0, 6);
  const displayFields = visibleFields.map(ff => tableFields.find(f => f.id === ff.fieldId)).filter(Boolean);

  formRows = await getAll(form.tableId);
  // Pre-load FK caches so formatValue can resolve labels synchronously
  await Promise.all(
    displayFields
      .filter(f => f.fieldType === 'foreign_key' && f.referencedTableId)
      .map(f => loadFkCache(f.referencedTableId))
  );
  const filtered = formSearch
    ? formRows.filter(row => displayFields.some(f => String(row[f.name] ?? '').toLowerCase().includes(formSearch.toLowerCase())))
    : formRows;

  const start = (currentFormPage - 1) * PAGE_SIZE_FORM;
  const pageRows = filtered.slice(start, start + PAGE_SIZE_FORM);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE_FORM);

  const content = document.getElementById('content');
  content.innerHTML = '<div class="card">' +
    '<div class="card-header"><span class="card-title">' + esc(form.displayName || form.name) + '</span>' +
    (form.allowCreate !== false ? '<button class="btn btn-primary btn-sm" onclick="openFormModal(null)">+ New</button>' : '') +
    '</div>' +
    '<div class="card-body">' +
    (form.allowSearch !== false ? '<div class="search-bar"><input class="search-input" placeholder="Search..." value="' + esc(formSearch) + '" oninput="formSearch=this.value;currentFormPage=1;renderFormList(getFormById(currentFormId))"/></div>' : '') +
    (filtered.length === 0
      ? '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">No records yet</div><div class="empty-state-desc">Click "+ New" to add the first record.</div></div>'
      : '<div style="overflow-x:auto"><table class="data-table"><thead><tr>' +
        displayFields.map(f => '<th>' + esc(f.displayName || f.name) + '</th>').join('') +
        '<th style="width:80px">Actions</th></tr></thead><tbody>' +
        pageRows.map(row => '<tr>' +
          displayFields.map(f => '<td>' + formatValue(f, row[f.name]) + '</td>').join('') +
          '<td><div style="display:flex;gap:4px">' +
          (form.allowEdit !== false ? '<button class="btn-icon btn-sm" onclick="openFormModal(\\'' + row._id + '\\')" title="Edit">✏️</button>' : '') +
          (form.allowDelete !== false ? '<button class="btn-icon btn-sm" onclick="deleteRecord(\\'' + form.tableId + '\\',\\'' + row._id + '\\')" title="Delete">🗑️</button>' : '') +
          '</div></td></tr>').join('') +
        '</tbody></table></div>' +
        (totalPages > 1 ? renderPagination(currentFormPage, totalPages, 'formPage') : '')
    ) +
    '</div></div>';
}

function formPage(page) {
  currentFormPage = page;
  renderFormList(getFormById(currentFormId));
}

async function deleteRecord(tableId, id) {
  if (!confirm('Delete this record?')) return;
  clearFkCache();
  await deleteRow(tableId, id);
  toast('Record deleted', 'success');
  await renderFormList(getFormById(currentFormId));
}

// ─── Form Modal ────────────────────────────────────────────────────────────
async function openFormModal(recordId, prefillFieldName, prefillValue) {
  const form = getFormById(currentFormId);
  if (!form) return;
  const tbl = getTableById(form.tableId);
  const tableFields = getFieldsByTable(form.tableId);
  const formFieldDefs = JSON.parse(form.formFields || '[]');
  const cols = form.columns || 2;

  let record = {};
  if (recordId) {
    record = await getOne(form.tableId, recordId) || {};
  }
  // Pre-fill FK field for detail forms
  if (!recordId && prefillFieldName && prefillValue) {
    record[prefillFieldName] = prefillValue;
  }

  // Pre-load LOV options
  const lovCache = {};
  for (const ff of formFieldDefs) {
    const f = tableFields.find(tf => tf.id === ff.fieldId);
    if (!f) continue;
    if (f.fieldType === 'lov' && f.lovValues) {
      try { lovCache[f.id] = JSON.parse(f.lovValues); } catch {}
    }
    if (f.fieldType === 'foreign_key' && f.referencedTableId) {
      const refRows = await getAll(f.referencedTableId);
      const refFields = getFieldsByTable(f.referencedTableId);
      const displayF = refFields.find(rf => rf.id === f.displayFieldId) || refFields[1] || refFields[0];
      lovCache[f.id] = refRows.map(r => ({ value: r._id, label: String(r[displayF?.name] ?? r._id) }));
    }
  }

  const visibleFields = formFieldDefs.filter(ff => ff.visible !== false && !ff.readOnly);

  const fieldsHtml = visibleFields.map(ff => {
    const f = tableFields.find(tf => tf.id === ff.fieldId);
    if (!f) return '';
    const val = record[f.name] ?? ff.defaultValue ?? '';
    const required = ff.required || f.required;
    const label = '<label class="form-label">' + esc(ff.label || f.displayName || f.name) + (required ? '<span class="required">*</span>' : '') + '</label>';
    const hint = (ff.helpText || f.helpText) ? '<div class="form-hint">' + esc(ff.helpText || f.helpText) + '</div>' : '';
    let input = '';

    if (f.fieldType === 'id') {
      input = '<input class="form-control" value="' + esc(val) + '" readonly style="opacity:.6"/>';
    } else if (f.fieldType === 'boolean') {
      input = '<label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" name="' + esc(f.name) + '" ' + (val ? 'checked' : '') + ' style="width:16px;height:16px"/> ' + esc(ff.label || f.displayName || f.name) + '</label>';
      return '<div class="form-group col-' + Math.min(ff.colSpan || 1, cols) + '">' + input + hint + '</div>';
    } else if (f.fieldType === 'large_text') {
      input = '<textarea class="form-control" name="' + esc(f.name) + '" placeholder="' + esc(ff.placeholder || f.placeholder || '') + '"' + (required ? ' required' : '') + '>' + esc(val) + '</textarea>';
    } else if (f.fieldType === 'date') {
      input = '<input type="date" class="form-control" name="' + esc(f.name) + '" value="' + esc(val) + '"' + (required ? ' required' : '') + '/>';
    } else if (f.fieldType === 'datetime') {
      input = '<input type="datetime-local" class="form-control" name="' + esc(f.name) + '" value="' + esc(val) + '"' + (required ? ' required' : '') + '/>';
    } else if (f.fieldType === 'time') {
      input = '<input type="time" class="form-control" name="' + esc(f.name) + '" value="' + esc(val) + '"' + (required ? ' required' : '') + '/>';
    } else if (f.fieldType === 'number' || f.fieldType === 'decimal') {
      input = '<input type="number" class="form-control" name="' + esc(f.name) + '" value="' + esc(val) + '" step="' + (f.fieldType === 'decimal' ? '0.01' : '1') + '"' + (required ? ' required' : '') + '/>';
    } else if (f.fieldType === 'email') {
      input = '<input type="email" class="form-control" name="' + esc(f.name) + '" value="' + esc(val) + '" placeholder="' + esc(ff.placeholder || '') + '"' + (required ? ' required' : '') + '/>';
    } else if (f.fieldType === 'url') {
      input = '<input type="url" class="form-control" name="' + esc(f.name) + '" value="' + esc(val) + '" placeholder="' + esc(ff.placeholder || 'https://') + '"' + (required ? ' required' : '') + '/>';
    } else if (f.fieldType === 'color') {
      input = '<input type="color" class="form-control" name="' + esc(f.name) + '" value="' + esc(val || '#000000') + '" style="height:42px;padding:4px"/>';
    } else if (f.fieldType === 'image') {
      input = '<input type="file" class="form-control" name="' + esc(f.name) + '" accept="image/*" onchange="handleImageUpload(this,\\'' + esc(f.name) + '\\')"/>' +
        (val ? '<img src="' + esc(val) + '" style="margin-top:8px;max-height:120px;border-radius:6px;object-fit:cover"/>' : '');
    } else if (f.fieldType === 'lov' || f.fieldType === 'foreign_key') {
      const opts = lovCache[f.id] || [];
      input = '<select class="form-control" name="' + esc(f.name) + '"' + (required ? ' required' : '') + '>' +
        '<option value="">— Select —</option>' +
        opts.map(o => '<option value="' + esc(o.value) + '"' + (String(val) === String(o.value) ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') +
        '</select>';
    } else if (f.fieldType === 'json') {
      input = '<textarea class="form-control" name="' + esc(f.name) + '" style="font-family:monospace;font-size:12px"' + (required ? ' required' : '') + '>' + esc(typeof val === 'object' ? JSON.stringify(val, null, 2) : val) + '</textarea>';
    } else {
      input = '<input type="text" class="form-control" name="' + esc(f.name) + '" value="' + esc(val) + '" placeholder="' + esc(ff.placeholder || f.placeholder || '') + '"' + (required ? ' required' : '') + (f.maxLength ? ' maxlength="' + f.maxLength + '"' : '') + '/>';
    }
    return '<div class="form-group col-' + Math.min(ff.colSpan || 1, cols) + '">' + label + input + hint + '</div>';
  }).join('');

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'form-modal';
  // Embed the formId and prefill info as data attributes so saveRecord uses the right form
  modal.dataset.formId = form.id;
  if (prefillFieldName && prefillValue) {
    modal.dataset.prefillField = prefillFieldName;
    modal.dataset.prefillValue = prefillValue;
  }
  modal.innerHTML = '<div class="modal">' +
    '<div class="modal-header"><span class="modal-title">' + (recordId ? 'Edit' : 'New') + ' ' + esc(form.displayName || form.name) + '</span>' +
    '<button class="btn-icon" onclick="closeModal()">✕</button></div>' +
    '<div class="modal-body"><form id="record-form" onsubmit="saveRecord(event,\\'' + (recordId || '') + '\\')">' +
    '<div class="form-grid" style="grid-template-columns:repeat(' + cols + ',1fr)">' + fieldsHtml + '</div>' +
    '</form></div>' +
    '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button class="btn btn-primary" onclick="document.getElementById(\\'record-form\\').requestSubmit()">Save</button></div>' +
    '</div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
}

function handleImageUpload(input, fieldName) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    input.dataset.base64 = e.target.result;
  };
  reader.readAsDataURL(file);
}

function closeModal() {
  const m = document.getElementById('form-modal');
  if (m) m.remove();
}

function showModal(title, bodyHtml, footerExtra) {
  closeModal();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'form-modal';
  modal.innerHTML = '<div class="modal">' +
    '<div class="modal-header"><span class="modal-title">' + title + '</span>' +
    '<button class="btn-icon" onclick="closeModal()">\u2715</button></div>' +
    '<div class="modal-body">' + bodyHtml + '</div>' +
    '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
    (footerExtra || '') + '</div></div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
}

async function saveRecord(e, recordId) {
  e.preventDefault();
  // Read formId from modal data attribute (supports detail forms with different formId than currentFormId)
  const modal = document.getElementById('form-modal');
  const activeFormId = (modal && modal.dataset.formId) ? modal.dataset.formId : currentFormId;
  const form = getFormById(activeFormId);
  if (!form) return;
  const tableFields = getFieldsByTable(form.tableId);
  const formEl = document.getElementById('record-form');
  const formData = new FormData(formEl);
  const row = recordId ? (await getOne(form.tableId, recordId) || {}) : {};
  if (recordId) row._id = recordId;
  // Apply prefill FK value for new detail records
  if (!recordId && modal && modal.dataset.prefillField && modal.dataset.prefillValue) {
    row[modal.dataset.prefillField] = modal.dataset.prefillValue;
  }

  tableFields.forEach(f => {
    if (f.fieldType === 'boolean') {
      row[f.name] = formEl.querySelector('[name="' + f.name + '"]')?.checked ?? false;
    } else if (f.fieldType === 'image') {
      const inp = formEl.querySelector('[name="' + f.name + '"]');
      if (inp && inp.dataset.base64) row[f.name] = inp.dataset.base64;
    } else if (f.fieldType === 'number') {
      const v = formData.get(f.name);
      if (v !== null && v !== '') row[f.name] = Number(v);
    } else if (f.fieldType === 'decimal') {
      const v = formData.get(f.name);
      if (v !== null && v !== '') row[f.name] = parseFloat(v);
    } else {
      const v = formData.get(f.name);
      if (v !== null) row[f.name] = v;
    }
  });

  clearFkCache();
  await putRow(form.tableId, row);
  closeModal();
  toast(recordId ? 'Record updated' : 'Record created', 'success');
  // Re-render: if saved form has detail forms → master-detail; if it's a detail sub-form → re-render parent master; else standard list
  let detailFormIds = [];
  try { detailFormIds = form.detailFormIds ? JSON.parse(form.detailFormIds) : []; } catch {}
  const detailForms = detailFormIds.map(id => getFormById(id)).filter(Boolean);
  if (detailForms.length > 0) {
    // Saved the master form itself
    await renderMasterDetail(form, detailForms);
  } else {
    // Check if the saved form is a detail sub-form of the current master
    const masterForm = forms.find(mf => {
      let dids = [];
      try { dids = mf.detailFormIds ? JSON.parse(mf.detailFormIds) : []; } catch {}
      return dids.includes(form.id);
    });
    if (masterForm) {
      // Stay on master-detail view
      currentFormId = masterForm.id;
      const masterDetailForms = (() => {
        let ids = [];
        try { ids = masterForm.detailFormIds ? JSON.parse(masterForm.detailFormIds) : []; } catch {}
        return ids.map(id => getFormById(id)).filter(Boolean);
      })();
      await renderMasterDetail(masterForm, masterDetailForms);
    } else {
      await renderFormList(form);
    }
  }
}

// ─── Report Renderer ────────────────────────────────────────────────────────
let currentReportId = null;
let currentReportPage = 1;
let reportSearch = '';
let reportSortField = null;
let reportSortDir = 'asc';

async function showReport(reportId) {
  currentReportId = reportId;
  currentReportPage = 1;
  reportSearch = '';
  const report = getReportById(reportId);
  if (!report) { toast('Report not found', 'error'); return; }
  reportSortField = report.defaultSort || null;
  reportSortDir = report.defaultSortDir || 'asc';
  setActiveNav('report_' + reportId);
  document.getElementById('topbar-title').textContent = report.displayName || report.name;
  await renderReport(report);
}

async function renderReport(report) {
  const tbl = getTableById(report.tableId);
  if (!tbl) return;
  const tableFields = getFieldsByTable(report.tableId);
  const columns = JSON.parse(report.reportColumns || '[]').filter(c => c.visible !== false);
  const colFields = columns.map(c => ({ col: c, field: tableFields.find(f => f.id === c.fieldId) })).filter(x => x.field);

  let rows = await getAll(report.tableId);

  // Filter
  if (reportSearch) {
    rows = rows.filter(row => colFields.some(({ field }) => String(row[field.name] ?? '').toLowerCase().includes(reportSearch.toLowerCase())));
  }

  // Sort
  if (reportSortField) {
    const sf = tableFields.find(f => f.id === reportSortField);
    if (sf) {
      rows.sort((a, b) => {
        const av = a[sf.name] ?? '';
        const bv = b[sf.name] ?? '';
        return reportSortDir === 'asc' ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0);
      });
    }
  }

  const pageSize = report.pageSize || 25;
  const start = (currentReportPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  const totalPages = Math.ceil(rows.length / pageSize);

  const content = document.getElementById('content');
  content.innerHTML = '<div class="card">' +
    '<div class="card-header"><span class="card-title">' + esc(report.displayName || report.name) + '</span>' +
    '<div style="display:flex;gap:8px">' +
    (report.allowExport !== false ? '<button class="btn btn-secondary btn-sm" onclick="exportReport()">⬇ CSV</button>' : '') +
    (report.allowPrint !== false ? '<button class="btn btn-secondary btn-sm" onclick="window.print()">🖨 Print</button>' : '') +
    '</div></div>' +
    '<div class="card-body">' +
    '<div class="search-bar"><input class="search-input" placeholder="Search..." value="' + esc(reportSearch) + '" oninput="reportSearch=this.value;currentReportPage=1;renderReport(getReportById(currentReportId))"/></div>' +
    (rows.length === 0
      ? '<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">No data</div><div class="empty-state-desc">No records found in this table.</div></div>'
      : '<div style="overflow-x:auto"><table class="data-table"><thead><tr>' +
        colFields.map(({ col, field }) => '<th style="cursor:pointer;user-select:none" onclick="sortReport(\\'' + field.id + '\\')">' +
          esc(col.label || field.displayName || field.name) +
          (reportSortField === field.id ? (reportSortDir === 'asc' ? ' ↑' : ' ↓') : '') + '</th>').join('') +
        '</tr></thead><tbody>' +
        pageRows.map(row => '<tr>' +
          colFields.map(({ col, field }) => '<td>' + formatValue(field, row[field.name]) + '</td>').join('') +
          '</tr>').join('') +
        '</tbody>' +
        (report.showTotals && colFields.some(({ field }) => field.fieldType === 'number' || field.fieldType === 'decimal')
          ? '<tfoot><tr style="font-weight:600;background:var(--input-bg)">' +
            colFields.map(({ col, field }) => {
              if ((field.fieldType === 'number' || field.fieldType === 'decimal') && col.aggregation && col.aggregation !== 'none') {
                const vals = rows.map(r => Number(r[field.name] ?? 0));
                let agg = '';
                if (col.aggregation === 'sum') agg = vals.reduce((a,b) => a+b, 0).toFixed(2);
                else if (col.aggregation === 'avg') agg = (vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(2);
                else if (col.aggregation === 'count') agg = vals.length;
                else if (col.aggregation === 'min') agg = Math.min(...vals);
                else if (col.aggregation === 'max') agg = Math.max(...vals);
                return '<td>' + agg + '</td>';
              }
              return '<td></td>';
            }).join('') + '</tr></tfoot>'
          : '') +
        '</table></div>' +
        (totalPages > 1 ? renderPagination(currentReportPage, totalPages, 'reportPage') : '') +
        '<div class="page-info" style="margin-top:8px">Showing ' + (start+1) + '–' + Math.min(start+pageSize, rows.length) + ' of ' + rows.length + ' records</div>'
    ) +
    '</div></div>';
}

function sortReport(fieldId) {
  if (reportSortField === fieldId) {
    reportSortDir = reportSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    reportSortField = fieldId;
    reportSortDir = 'asc';
  }
  currentReportPage = 1;
  renderReport(getReportById(currentReportId));
}

function reportPage(page) {
  currentReportPage = page;
  renderReport(getReportById(currentReportId));
}

async function exportReport() {
  const report = getReportById(currentReportId);
  if (!report) return;
  const tableFields = getFieldsByTable(report.tableId);
  const columns = JSON.parse(report.reportColumns || '[]').filter(c => c.visible !== false);
  const colFields = columns.map(c => ({ col: c, field: tableFields.find(f => f.id === c.fieldId) })).filter(x => x.field);
  const rows = await getAll(report.tableId);
  const header = colFields.map(({ col, field }) => col.label || field.displayName || field.name).join(',');
  const body = rows.map(row => colFields.map(({ field }) => {
    const v = row[field.name] ?? '';
    return '"' + String(v).replace(/"/g, '""') + '"';
  }).join(',')).join('\\n');
  const blob = new Blob([header + '\\n' + body], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (report.name || 'report') + '.csv';
  a.click();
  toast('CSV exported', 'success');
}

// ─── Pagination ─────────────────────────────────────────────────────────────
function renderPagination(current, total, fnName) {
  let html = '<div class="pagination">';
  html += '<button class="page-btn" onclick="' + fnName + '(' + (current-1) + ')" ' + (current <= 1 ? 'disabled' : '') + '>‹</button>';
  for (let i = Math.max(1, current-2); i <= Math.min(total, current+2); i++) {
    html += '<button class="page-btn' + (i === current ? ' active' : '') + '" onclick="' + fnName + '(' + i + ')">' + i + '</button>';
  }
  html += '<button class="page-btn" onclick="' + fnName + '(' + (current+1) + ')" ' + (current >= total ? 'disabled' : '') + '>›</button>';
  html += '</div>';
  return html;
}

// ─── Import / Export All ───────────────────────────────────────────────────
async function exportAllData() {
  const data = {};
  for (const t of tables) {
    data[t.id] = await getAll(t.id);
  }
  const blob = new Blob([JSON.stringify({ schema: BUNDLE, data }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = ${JSON.stringify(bundle.project.name || 'app')} + '_backup.json';
  a.click();
  toast('Data exported', 'success');
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const { data } = JSON.parse(text);
      for (const tableId of Object.keys(data || {})) {
        for (const row of data[tableId]) {
          await putRow(tableId, row);
        }
      }
      toast('Data imported successfully', 'success');
      showDashboard();
    } catch (err) {
      toast('Import failed: ' + err.message, 'error');
    }
  };
  input.click();
}

// ─── LOV Manager ─────────────────────────────────────────────────────────────
let currentLovTableId = null;
let lovPage = 1;
const LOV_PAGE_SIZE = 30;

async function showLovManager(tableId) {
  currentLovTableId = tableId;
  lovPage = 1;
  setActiveNav('lov_' + tableId);
  const table = getTableById(tableId);
  const topbar = document.getElementById('topbar-title');
  if (topbar) topbar.textContent = (table ? (table.displayName || table.name) : 'Reference Data');
  await renderLovManager();
}

async function renderLovManager() {
  const content = document.getElementById('content');
  const table = getTableById(currentLovTableId);
  if (!table) return;
  const tableFields = getFieldsByTable(currentLovTableId);
  const dataFields = tableFields.filter(f => f.fieldType !== 'id');
  const allRows = await getAll(currentLovTableId);
  const totalPages = Math.max(1, Math.ceil(allRows.length / LOV_PAGE_SIZE));
  if (lovPage > totalPages) lovPage = totalPages;
  const rows = allRows.slice((lovPage - 1) * LOV_PAGE_SIZE, lovPage * LOV_PAGE_SIZE);

  const colHeaders = dataFields.map(f => '<th>' + esc(f.displayName || f.name) + '</th>').join('') + '<th style="width:90px">Actions</th>';
  const rowsHtml = rows.map(row => {
    const cells = dataFields.map(f => '<td>' + esc(String(row[f.name] ?? '')) + '</td>').join('');
    const rid = esc(row._id);
    return '<tr>' + cells + '<td>' +
      '<button class="btn btn-sm" title="Edit" data-lovid="' + rid + '" onclick="openLovEdit(this.dataset.lovid)">✏️</button> ' +
      '<button class="btn btn-sm btn-danger" title="Delete" data-lovid="' + rid + '" onclick="deleteLovRow(this.dataset.lovid)">🗑️</button>' +
      '</td></tr>';
  }).join('');

  content.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<h2 style="margin:0;font-size:18px;font-weight:700">' + esc(table.displayName || table.name) + '</h2>' +
      '<button class="btn btn-primary btn-sm" onclick="openLovCreate()">+ Add Value</button>' +
    '</div>' +
    (allRows.length === 0 ? '<div class="card"><div class="card-body" style="text-align:center;color:var(--muted);padding:40px">No values yet. Click "+ Add Value" to add the first entry.</div></div>' :
      '<div class="card"><div style="overflow-x:auto"><table class="data-table"><thead><tr>' + colHeaders + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div></div>') +
    (totalPages > 1 ? renderPagination(lovPage, totalPages, 'goLovPage') : '');
}

function goLovPage(page) {
  lovPage = page;
  renderLovManager();
}

async function openLovCreate() {
  const table = getTableById(currentLovTableId);
  const tableFields = getFieldsByTable(currentLovTableId);
  const dataFields = tableFields.filter(f => f.fieldType !== 'id');
  const fieldsHtml = dataFields.map(f =>
    '<div class="form-group col-1"><label class="form-label">' + esc(f.displayName || f.name) + (f.required ? '<span class="required">*</span>' : '') + '</label>' +
    '<input class="form-control" name="' + esc(f.name) + '" value="" placeholder="' + esc(f.placeholder || '') + '"' + (f.required ? ' required' : '') + '/></div>'
  ).join('');
  showModal(
    'Add ' + esc(table ? (table.displayName || table.name) : 'Value'),
    '<form id="lov-form" class="form-grid cols-1"><input type="hidden" id="lov-edit-id" value="' + esc(rowId) + '"/>' + fieldsHtml + '</form>',
    '<button class="btn btn-primary" onclick="saveLovCreate()">Save</button>'
  );
}

async function saveLovCreate() {
  const form = document.getElementById('lov-form');
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const tableFields = getFieldsByTable(currentLovTableId);
  const dataFields = tableFields.filter(f => f.fieldType !== 'id');
  const row = { _id: crypto.randomUUID() };
  dataFields.forEach(f => { row[f.name] = form.querySelector('[name="' + f.name + '"]')?.value ?? ''; });
  await putRow(currentLovTableId, row);
  closeModal();
  toast('Value added', 'success');
  await renderLovManager();
}

async function openLovEdit(rowId) {
  const table = getTableById(currentLovTableId);
  const tableFields = getFieldsByTable(currentLovTableId);
  const dataFields = tableFields.filter(f => f.fieldType !== 'id');
  const record = await getOne(currentLovTableId, rowId);
  if (!record) return;
  const fieldsHtml = dataFields.map(f => {
    const val = record[f.name] ?? '';
    return '<div class="form-group col-1"><label class="form-label">' + esc(f.displayName || f.name) + (f.required ? '<span class="required">*</span>' : '') + '</label>' +
      '<input class="form-control" name="' + esc(f.name) + '" value="' + esc(val) + '"' + (f.required ? ' required' : '') + '/></div>';
  }).join('');
  window._lovEditId = rowId;
  showModal(
    'Edit ' + esc(table ? (table.displayName || table.name) : 'Value'),
    '<form id="lov-form" class="form-grid cols-1">' + fieldsHtml + '</form>',
    '<button class="btn btn-primary" onclick="saveLovEdit(window._lovEditId)">Save</button>'
  );
}

async function saveLovEdit(rowId) {
  const form = document.getElementById('lov-form');
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const tableFields = getFieldsByTable(currentLovTableId);
  const dataFields = tableFields.filter(f => f.fieldType !== 'id');
  const existing = await getOne(currentLovTableId, rowId);
  const row = { ...(existing || {}), _id: rowId };
  dataFields.forEach(f => { row[f.name] = form.querySelector('[name="' + f.name + '"]')?.value ?? ''; });
  await putRow(currentLovTableId, row);
  closeModal();
  toast('Value updated', 'success');
  await renderLovManager();
}

async function deleteLovRow(rowId) {
  if (!confirm('Delete this value?')) return;
  await deleteRow(currentLovTableId, rowId);
  toast('Value deleted', 'success');
  await renderLovManager();
}

// ─── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await openDB();
  // Seed embedded row data on first run (only if the store is empty)
  const seedData = BUNDLE.data || {};
  for (const tableId of Object.keys(seedData)) {
    const existing = await getAll(tableId);
    if (existing.length === 0 && seedData[tableId].length > 0) {
      for (const row of seedData[tableId]) {
        await putRow(tableId, row);
      }
    }
  }
  buildSidebar();
  showDashboard();
});
</script>
</body>
</html>`;
}

function escHtml(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
