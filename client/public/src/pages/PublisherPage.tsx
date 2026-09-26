/**
 * PublisherPage — Local SaaS Publisher
 * Configure and generate a fully self-contained web app from the current project.
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  Download, Eye, Settings, Palette, Globe, Database,
  FileText, BarChart3, Menu, CheckCircle, AlertCircle,
  Smartphone, Monitor, RefreshCw, Copy, ExternalLink
} from 'lucide-react';
import { useDB } from '@/contexts/DBContext';
import { generateSaasHtml, type SaasAppConfig, type SaasBundle } from '@/lib/saasRuntime';
import { openDataDB, rowGetAll } from '@/lib/db';
import { toast } from 'sonner';

const PRESET_COLORS = [
  { name: 'Amber', value: '#f5a623' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Teal', value: '#14b8a6' },
];

const EMOJI_ICONS = ['🗄️', '📊', '🏢', '🛒', '🏥', '📚', '🎯', '🔧', '💼', '🌐', '📱', '🚀', '⚙️', '🏗️', '📋', '🗂️'];

type Tab = 'config' | 'content' | 'preview';

export default function PublisherPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, navigate] = useLocation();
  const { projects, tables, fields, relationships, forms, reports, menus, loading } = useDB();

  const project = projects.find(p => p.id === projectId);
  const projectTables = tables.filter(t => t.projectId === projectId);
  const projectFields = fields.filter(f => f.projectId === projectId);
  const projectRelationships = relationships.filter(r => r.projectId === projectId);
  const projectForms = forms.filter(f => f.projectId === projectId);
  const projectReports = reports.filter(r => r.projectId === projectId);
  const projectMenus = menus.filter(m => m.projectId === projectId);

  const [tab, setTab] = useState<Tab>('config');
  const [config, setConfig] = useState<SaasAppConfig>({
    appName: project?.name || 'My App',
    appSubtitle: project?.description || 'Powered by DBCreator',
    primaryColor: project?.color || '#f5a623',
    darkMode: true,
    logoEmoji: '🗄️',
    allowDataExport: true,
    allowDataImport: true,
  });

  // Track whether the user has manually changed selections (so we don't override their choices on re-render)
  const [selectionInitialised, setSelectionInitialised] = useState(false);
  const [selectedForms, setSelectedForms] = useState<Set<string>>(new Set<string>());
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set<string>());
  const [selectedMenuId, setSelectedMenuId] = useState<string>('');

  // Once DBContext finishes loading, initialise selections from the real data
  useEffect(() => {
    if (loading) return; // wait until data is ready
    if (selectionInitialised) return; // don't override user changes
    setSelectedForms(new Set(projectForms.map(f => f.id)));
    setSelectedReports(new Set(projectReports.map(r => r.id)));
    setSelectedMenuId(projectMenus.find(m => m.isDefault)?.id || projectMenus[0]?.id || '');
    setSelectionInitialised(true);
  }, [loading, projectId]); // re-run if user navigates to a different project

  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [generating, setGenerating] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (project) {
      setConfig(prev => ({
        ...prev,
        appName: prev.appName === 'My App' ? project.name : prev.appName,
        appSubtitle: prev.appSubtitle === 'Powered by DBCreator' ? (project.description || 'Powered by DBCreator') : prev.appSubtitle,
        primaryColor: prev.primaryColor === '#f5a623' ? project.color : prev.primaryColor,
      }));
    }
  }, [project?.id]);

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--muted-foreground)' }}>
        <div className="text-center">
          <Database size={48} style={{ color: 'var(--muted-foreground)', margin: '0 auto 12px' }} />
          <p>Project not found.</p>
        </div>
      </div>
    );
  }

  const buildBundle = async (): Promise<SaasBundle> => {
    const includedForms = projectForms.filter(f => selectedForms.has(f.id));
    const includedReports = projectReports.filter(r => selectedReports.has(r.id));
    const includedMenus = selectedMenuId
      ? projectMenus.filter(m => m.id === selectedMenuId)
      : projectMenus.filter(m => m.isDefault).slice(0, 1);

    // Collect all forms that need to be included (master forms + their detail forms)
    const allIncludedFormIds = new Set(includedForms.map(f => f.id));
    const allIncludedForms = [...includedForms];
    for (const form of includedForms) {
      let detailIds: string[] = [];
      try { detailIds = form.detailFormIds ? JSON.parse(form.detailFormIds) : []; } catch { detailIds = []; }
      for (const did of detailIds) {
        if (!allIncludedFormIds.has(did)) {
          const detailForm = projectForms.find(f => f.id === did);
          if (detailForm) {
            allIncludedFormIds.add(did);
            allIncludedForms.push(detailForm);
          }
        }
      }
    }

    // Start with tables directly referenced by selected forms/reports
    const usedTableIds = new Set([
      ...allIncludedForms.map(f => f.tableId),
      ...includedReports.map(r => r.tableId),
    ]);

    // Also include tables referenced by foreign key fields (needed for LOV dropdowns)
    // Iterate until no new tables are added (handles chains of FK references)
    let changed = true;
    while (changed) {
      changed = false;
      const fieldsInScope = projectFields.filter(f => usedTableIds.has(f.tableId));
      for (const field of fieldsInScope) {
        if (field.referencedTableId && !usedTableIds.has(field.referencedTableId)) {
          usedTableIds.add(field.referencedTableId);
          changed = true;
        }
      }
    }

    const includedTables = projectTables.filter(t => usedTableIds.has(t.id));
    const includedFields = projectFields.filter(f => usedTableIds.has(f.tableId));
    const includedRelationships = projectRelationships.filter(r =>
      usedTableIds.has(r.fromTableId) && usedTableIds.has(r.toTableId)
    );

    // Read actual row data from the project's data DB
    const data: Record<string, Record<string, unknown>[]> = {};
    if (includedTables.length > 0) {
      try {
        await openDataDB(projectId!, includedTables.map(t => t.id));
        for (const tbl of includedTables) {
          data[tbl.id] = await rowGetAll(projectId!, tbl.id) as Record<string, unknown>[];
        }
      } catch (e) {
        console.warn('Could not read row data for export:', e);
      }
    }

    return {
      project,
      tables: includedTables,
      fields: includedFields,
      relationships: includedRelationships,
      forms: allIncludedForms,
      reports: includedReports,
      menus: includedMenus,
      config,
      data,
    };
  };

  const generatePreview = async () => {
    setGenerating(true);
    try {
      const bundle = await buildBundle();
      const html = generateSaasHtml(bundle);
      setPreviewHtml(html);
      setTab('preview');
      toast.success('Preview generated');
    } catch (err) {
      toast.error('Failed to generate preview: ' + String(err));
    } finally {
      setGenerating(false);
    }
  };

  const downloadApp = async () => {
    try {
      const bundle = await buildBundle();
      const html = generateSaasHtml(bundle);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (config.appName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'app') + '.html';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('App downloaded! Open the HTML file in any browser to run it.');
    } catch (err) {
      toast.error('Download failed: ' + String(err));
    }
  };

  const openInNewTab = async () => {
    try {
      const bundle = await buildBundle();
      const html = generateSaasHtml(bundle);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      toast.error('Failed to open app: ' + String(err));
    }
  };

  const hasContent = projectForms.length > 0 || projectReports.length > 0;

  // ── Styles ─────────────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: 'var(--neo-raised)',
    boxShadow: 'var(--neo-shadow-raised)',
    borderRadius: '14px',
    border: '1px solid oklch(1 0 0 / 0.06)',
  };

  const insetStyle: React.CSSProperties = {
    background: 'var(--neo-inset)',
    boxShadow: 'var(--neo-shadow-inset)',
    borderRadius: '10px',
    border: '1px solid oklch(0 0 0 / 0.15)',
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 18px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: 'Space Grotesk, sans-serif',
    border: 'none',
    cursor: 'pointer',
    transition: 'all .15s',
    background: active ? 'var(--primary)' : 'transparent',
    color: active ? '#fff' : 'var(--muted-foreground)',
  });

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6 animate-slide-in-up">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/designer/${projectId}`)}
              className="flex items-center gap-1.5 text-sm transition-colors duration-150"
              style={{ color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              ← Back
            </button>
            <span style={{ color: 'var(--muted-foreground)' }}>/</span>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
              Publish App
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={generatePreview}
              disabled={generating || !hasContent}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-150"
              style={{
                background: 'var(--neo-raised)',
                boxShadow: 'var(--neo-shadow-raised)',
                color: 'var(--foreground)',
                border: '1px solid oklch(1 0 0 / 0.07)',
                fontFamily: 'Space Grotesk, sans-serif',
                opacity: !hasContent ? 0.5 : 1,
              }}
            >
              <Eye size={15} />
              Preview
            </button>
            <button
              onClick={downloadApp}
              disabled={!hasContent}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-150"
              style={{
                background: hasContent ? 'var(--primary)' : 'var(--muted)',
                color: '#fff',
                border: 'none',
                fontFamily: 'Space Grotesk, sans-serif',
                boxShadow: hasContent ? '0 4px 14px oklch(0 0 0 / 0.3)' : 'none',
                opacity: !hasContent ? 0.5 : 1,
              }}
            >
              <Download size={15} />
              Download App
            </button>
          </div>
        </div>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
          Generate a self-contained HTML app from <strong style={{ color: 'var(--foreground)' }}>{project.name}</strong> — runs in any browser, stores data locally, no server needed.
        </p>
      </div>

      {!hasContent && (
        <div className="mb-6 p-4 rounded-xl flex items-center gap-3" style={{ background: '#f59e0b18', border: '1px solid #f59e0b44' }}>
          <AlertCircle size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <p className="text-sm" style={{ color: 'var(--foreground)', fontFamily: 'Inter, sans-serif' }}>
            This project has no forms or reports yet. <button onClick={() => navigate(`/forms/${projectId}`)} style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Create a form</button> first to publish an app.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl" style={insetStyle}>
        {(['config', 'content', 'preview'] as Tab[]).map(t => (
          <button key={t} style={tabStyle(tab === t)} onClick={() => setTab(t)}>
            {t === 'config' && <><Settings size={13} style={{ display: 'inline', marginRight: 5 }} />App Config</>}
            {t === 'content' && <><FileText size={13} style={{ display: 'inline', marginRight: 5 }} />Content</>}
            {t === 'preview' && <><Eye size={13} style={{ display: 'inline', marginRight: 5 }} />Preview</>}
          </button>
        ))}
      </div>

      {/* ── Config Tab ─────────────────────────────────────────────────────── */}
      {tab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* App Identity */}
          <div style={cardStyle} className="p-6">
            <h2 className="text-base font-bold mb-5 flex items-center gap-2" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
              <Globe size={16} style={{ color: 'var(--primary)' }} /> App Identity
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>APP NAME</label>
                <input
                  className="neo-input w-full px-3 py-2.5 text-sm rounded-lg"
                  value={config.appName}
                  onChange={e => setConfig(c => ({ ...c, appName: e.target.value }))}
                  placeholder="My Application"
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>SUBTITLE</label>
                <input
                  className="neo-input w-full px-3 py-2.5 text-sm rounded-lg"
                  value={config.appSubtitle}
                  onChange={e => setConfig(c => ({ ...c, appSubtitle: e.target.value }))}
                  placeholder="Powered by DBCreator"
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>APP ICON</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_ICONS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setConfig(c => ({ ...c, logoEmoji: emoji }))}
                      className="w-9 h-9 rounded-lg text-lg transition-all duration-120"
                      style={{
                        background: config.logoEmoji === emoji ? 'var(--primary)' : 'var(--neo-inset)',
                        boxShadow: config.logoEmoji === emoji ? '0 0 0 2px var(--primary)' : 'var(--neo-shadow-inset)',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Theme */}
          <div style={cardStyle} className="p-6">
            <h2 className="text-base font-bold mb-5 flex items-center gap-2" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
              <Palette size={16} style={{ color: 'var(--primary)' }} /> Theme
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>PRIMARY COLOR</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {PRESET_COLORS.map(pc => (
                    <button
                      key={pc.value}
                      onClick={() => setConfig(c => ({ ...c, primaryColor: pc.value }))}
                      title={pc.name}
                      className="w-8 h-8 rounded-full transition-all duration-120"
                      style={{
                        background: pc.value,
                        border: config.primaryColor === pc.value ? `3px solid var(--foreground)` : '3px solid transparent',
                        boxShadow: config.primaryColor === pc.value ? `0 0 0 2px ${pc.value}` : '2px 2px 5px rgba(0,0,0,0.3)',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.primaryColor}
                    onChange={e => setConfig(c => ({ ...c, primaryColor: e.target.value }))}
                    className="w-10 h-10 rounded-lg cursor-pointer"
                    style={{ background: 'none', border: '1px solid oklch(1 0 0 / 0.1)', padding: '2px' }}
                  />
                  <input
                    className="neo-input flex-1 px-3 py-2 text-sm rounded-lg"
                    value={config.primaryColor}
                    onChange={e => setConfig(c => ({ ...c, primaryColor: e.target.value }))}
                    placeholder="#f5a623"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>COLOR SCHEME</label>
                <div className="flex gap-2">
                  {[{ label: '🌙 Dark', value: true }, { label: '☀️ Light', value: false }].map(opt => (
                    <button
                      key={String(opt.value)}
                      onClick={() => setConfig(c => ({ ...c, darkMode: opt.value }))}
                      className="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-150"
                      style={{
                        background: config.darkMode === opt.value ? 'var(--primary)' : 'var(--neo-inset)',
                        boxShadow: config.darkMode === opt.value ? '0 4px 12px oklch(0 0 0 / 0.3)' : 'var(--neo-shadow-inset)',
                        color: config.darkMode === opt.value ? '#fff' : 'var(--muted-foreground)',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'Space Grotesk, sans-serif',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Features */}
          <div style={cardStyle} className="p-6">
            <h2 className="text-base font-bold mb-5 flex items-center gap-2" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
              <Settings size={16} style={{ color: 'var(--primary)' }} /> App Features
            </h2>
            <div className="space-y-3">
              {[
                { key: 'allowDataExport' as const, label: 'Data Export', desc: 'Users can export all data as JSON backup' },
                { key: 'allowDataImport' as const, label: 'Data Import', desc: 'Users can import data from a backup file' },
              ].map(feat => (
                <div
                  key={feat.key}
                  className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                  style={insetStyle}
                  onClick={() => setConfig(c => ({ ...c, [feat.key]: !c[feat.key] }))}
                >
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>{feat.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{feat.desc}</div>
                  </div>
                  <div
                    className="w-10 h-5 rounded-full transition-all duration-200 relative flex-shrink-0"
                    style={{ background: config[feat.key] ? 'var(--primary)' : 'oklch(1 0 0 / 0.1)' }}
                  >
                    <div
                      className="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200"
                      style={{
                        background: '#fff',
                        left: config[feat.key] ? '22px' : '2px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* App Preview Card */}
          <div style={cardStyle} className="p-6">
            <h2 className="text-base font-bold mb-5 flex items-center gap-2" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
              <Monitor size={16} style={{ color: 'var(--primary)' }} /> App Preview
            </h2>
            {/* Mini mockup */}
            <div className="rounded-xl overflow-hidden" style={{ border: '2px solid oklch(1 0 0 / 0.1)', background: config.darkMode ? '#1a1a2e' : '#f0f2f5' }}>
              {/* Titlebar */}
              <div className="flex items-center gap-2 px-3 py-2" style={{ background: config.darkMode ? '#0d1b2a' : '#1e293b' }}>
                <span style={{ fontSize: 16 }}>{config.logoEmoji}</span>
                <span className="text-xs font-bold" style={{ color: '#e2e8f0', fontFamily: 'Space Grotesk, sans-serif' }}>{config.appName || 'My App'}</span>
              </div>
              {/* Content area */}
              <div className="p-3 flex gap-2">
                {/* Sidebar */}
                <div className="w-20 rounded-lg p-2 space-y-1.5" style={{ background: config.darkMode ? '#0d1b2a' : '#1e293b' }}>
                  {['🏠 Home', '📝 Form', '📊 Report'].map(item => (
                    <div key={item} className="text-xs rounded px-1.5 py-1" style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif', fontSize: 9 }}>{item}</div>
                  ))}
                </div>
                {/* Main */}
                <div className="flex-1 space-y-2">
                  <div className="h-4 rounded" style={{ background: config.primaryColor + '33', width: '60%' }} />
                  <div className="h-2 rounded" style={{ background: 'oklch(1 0 0 / 0.06)', width: '90%' }} />
                  <div className="h-2 rounded" style={{ background: 'oklch(1 0 0 / 0.06)', width: '75%' }} />
                  <div className="h-6 rounded-md mt-3 flex items-center justify-center" style={{ background: config.primaryColor, width: 60 }}>
                    <span style={{ fontSize: 8, color: '#fff', fontFamily: 'Space Grotesk, sans-serif' }}>+ New</span>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs mt-3 text-center" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
              Click <strong>Preview</strong> above to see the full live preview
            </p>
          </div>
        </div>
      )}

      {/* ── Content Tab ────────────────────────────────────────────────────── */}
      {tab === 'content' && (
        <div className="space-y-6">
          {/* Menu */}
          <div style={cardStyle} className="p-6">
            <h2 className="text-base font-bold mb-4 flex items-center gap-2" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
              <Menu size={16} style={{ color: 'var(--primary)' }} /> Navigation Menu
            </h2>
            {projectMenus.length === 0 ? (
              <div className="text-sm py-4 text-center" style={{ color: 'var(--muted-foreground)' }}>
                No menus defined. <button onClick={() => navigate(`/menus/${projectId}`)} style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>Create a menu →</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[{ id: '', name: 'Auto (show all forms & reports)', isDefault: false }, ...projectMenus].map(m => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-150"
                    style={{
                      ...insetStyle,
                      border: selectedMenuId === m.id ? `1px solid var(--primary)` : '1px solid oklch(0 0 0 / 0.15)',
                    }}
                    onClick={() => setSelectedMenuId(m.id)}
                  >
                    <div
                      className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      style={{ borderColor: selectedMenuId === m.id ? 'var(--primary)' : 'var(--muted-foreground)' }}
                    >
                      {selectedMenuId === m.id && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--primary)' }} />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>{m.name}</div>
                      {m.isDefault && <div className="text-xs" style={{ color: 'var(--primary)' }}>Default menu</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Forms */}
          <div style={cardStyle} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold flex items-center gap-2" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
                <FileText size={16} style={{ color: 'var(--primary)' }} /> Forms
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--primary)', color: '#fff', fontFamily: 'JetBrains Mono, monospace' }}>
                  {selectedForms.size}/{projectForms.length}
                </span>
              </h2>
              <button
                onClick={() => setSelectedForms(selectedForms.size === projectForms.length ? new Set() : new Set(projectForms.map(f => f.id)))}
                className="text-xs"
                style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              >
                {selectedForms.size === projectForms.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            {projectForms.length === 0 ? (
              <div className="text-sm py-4 text-center" style={{ color: 'var(--muted-foreground)' }}>
                No forms. <button onClick={() => navigate(`/forms/${projectId}`)} style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>Create a form →</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {projectForms.map(f => {
                  const tbl = tables.find(t => t.id === f.tableId);
                  const selected = selectedForms.has(f.id);
                  return (
                    <div
                      key={f.id}
                      className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-150"
                      style={{
                        ...insetStyle,
                        border: selected ? `1px solid var(--primary)` : '1px solid oklch(0 0 0 / 0.15)',
                      }}
                      onClick={() => {
                        const next = new Set(selectedForms);
                        if (next.has(f.id)) next.delete(f.id); else next.add(f.id);
                        setSelectedForms(next);
                      }}
                    >
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                        style={{ background: selected ? 'var(--primary)' : 'transparent', border: `2px solid ${selected ? 'var(--primary)' : 'var(--muted-foreground)'}` }}
                      >
                        {selected && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
                      </div>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>{f.displayName || f.name}</div>
                        <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Table: {tbl?.displayName || tbl?.name || f.tableId}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reports */}
          <div style={cardStyle} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold flex items-center gap-2" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
                <BarChart3 size={16} style={{ color: 'var(--primary)' }} /> Reports
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--primary)', color: '#fff', fontFamily: 'JetBrains Mono, monospace' }}>
                  {selectedReports.size}/{projectReports.length}
                </span>
              </h2>
              <button
                onClick={() => setSelectedReports(selectedReports.size === projectReports.length ? new Set() : new Set(projectReports.map(r => r.id)))}
                className="text-xs"
                style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              >
                {selectedReports.size === projectReports.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            {projectReports.length === 0 ? (
              <div className="text-sm py-4 text-center" style={{ color: 'var(--muted-foreground)' }}>
                No reports. <button onClick={() => navigate(`/reports/${projectId}`)} style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>Create a report →</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {projectReports.map(r => {
                  const tbl = tables.find(t => t.id === r.tableId);
                  const selected = selectedReports.has(r.id);
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-150"
                      style={{
                        ...insetStyle,
                        border: selected ? `1px solid var(--primary)` : '1px solid oklch(0 0 0 / 0.15)',
                      }}
                      onClick={() => {
                        const next = new Set(selectedReports);
                        if (next.has(r.id)) next.delete(r.id); else next.add(r.id);
                        setSelectedReports(next);
                      }}
                    >
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                        style={{ background: selected ? 'var(--primary)' : 'transparent', border: `2px solid ${selected ? 'var(--primary)' : 'var(--muted-foreground)'}` }}
                      >
                        {selected && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
                      </div>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>{r.displayName || r.name}</div>
                        <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Table: {tbl?.displayName || tbl?.name || r.tableId}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: 'var(--primary)18', border: '1px solid var(--primary)44' }}>
            <CheckCircle size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 1 }} />
            <div className="text-sm" style={{ color: 'var(--foreground)', fontFamily: 'Inter, sans-serif' }}>
              The published app will include <strong>{selectedForms.size} form{selectedForms.size !== 1 ? 's' : ''}</strong> and <strong>{selectedReports.size} report{selectedReports.size !== 1 ? 's' : ''}</strong>.
              All data will be stored in the browser's IndexedDB on the user's device.
            </div>
          </div>
        </div>
      )}

      {/* ── Preview Tab ─────────────────────────────────────────────────────── */}
      {tab === 'preview' && (
        <div>
          {!previewHtml ? (
            <div className="flex flex-col items-center justify-center py-20" style={{ color: 'var(--muted-foreground)' }}>
              <Eye size={48} style={{ marginBottom: 16, opacity: 0.4 }} />
              <p className="text-base font-semibold mb-2" style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>No preview yet</p>
              <p className="text-sm mb-6">Click the Preview button to generate a live preview of your app.</p>
              <button
                onClick={generatePreview}
                disabled={!hasContent}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg"
                style={{ background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif' }}
              >
                <Eye size={15} /> Generate Preview
              </button>
            </div>
          ) : (
            <div>
              {/* Preview toolbar */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                  {[
                    { id: 'desktop', icon: <Monitor size={14} />, label: 'Desktop' },
                    { id: 'mobile', icon: <Smartphone size={14} />, label: 'Mobile' },
                  ].map(d => (
                    <button
                      key={d.id}
                      onClick={() => setPreviewDevice(d.id as 'desktop' | 'mobile')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150"
                      style={{
                        background: previewDevice === d.id ? 'var(--primary)' : 'var(--neo-raised)',
                        boxShadow: previewDevice === d.id ? 'none' : 'var(--neo-shadow-raised)',
                        color: previewDevice === d.id ? '#fff' : 'var(--muted-foreground)',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'Space Grotesk, sans-serif',
                      }}
                    >
                      {d.icon} {d.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={generatePreview}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg"
                    style={{ background: 'var(--neo-raised)', boxShadow: 'var(--neo-shadow-raised)', color: 'var(--foreground)', border: 'none', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif' }}
                  >
                    <RefreshCw size={12} /> Refresh
                  </button>
                  <button
                    onClick={openInNewTab}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg"
                    style={{ background: 'var(--neo-raised)', boxShadow: 'var(--neo-shadow-raised)', color: 'var(--foreground)', border: 'none', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif' }}
                  >
                    <ExternalLink size={12} /> Open in Tab
                  </button>
                  <button
                    onClick={downloadApp}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg"
                    style={{ background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif' }}
                  >
                    <Download size={12} /> Download
                  </button>
                </div>
              </div>

              {/* iframe container */}
              <div
                className="rounded-xl overflow-hidden mx-auto transition-all duration-300"
                style={{
                  width: previewDevice === 'mobile' ? '390px' : '100%',
                  height: '70vh',
                  border: '2px solid oklch(1 0 0 / 0.1)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                }}
              >
                <iframe
                  ref={iframeRef}
                  srcDoc={previewHtml}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title="App Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                />
              </div>

              <p className="text-xs text-center mt-3" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
                This is a live preview running in an iframe. Data entered here is isolated from your DBCreator data.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
