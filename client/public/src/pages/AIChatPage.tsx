/**
 * AI Chat Page — Context-aware assistant for DBCreator
 * Calls AI provider directly from browser (no backend needed).
 * Supports Execute button to build schemas from AI plans.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useDB } from '@/contexts/DBContext';
import { getActiveProfile, callAI, type AIProviderProfile, type ChatMessage } from '@/lib/aiProvider';
import {
  extractPlan,
  summarizePlan,
  executePlan,
  type ExecutionPlan,
  type ExecutionResult,
  type PlanSummaryItem,
} from '@/lib/aiExecutor';
import {
  Bot, Send, Trash2, Settings, Loader2, User, Copy,
  Database, Table2, FileText, BarChart3, Sparkles,
  Play, CheckCircle2, XCircle, ChevronRight, AlertTriangle,
  Link2, LayoutTemplate, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLocation } from 'wouter';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  streaming?: boolean;
  plan?: ExecutionPlan | null;
}

const SUGGESTED_PROMPTS = [
  {
    icon: '🗄️',
    label: 'Design a CRM database',
    prompt: 'Design a complete CRM database with tables for customers, contacts, deals, activities, and notes. Include all necessary fields and relationships. Generate an executable plan.',
  },
  {
    icon: '📦',
    label: 'Inventory management app',
    prompt: 'Create a full inventory management application with products, categories, suppliers, purchase orders, and stock movements. Generate an executable plan.',
  },
  {
    icon: '📋',
    label: 'Project tracker schema',
    prompt: 'Build a project management database with projects, tasks, milestones, team members, and time tracking. Generate an executable plan.',
  },
  {
    icon: '🏥',
    label: 'Medical records system',
    prompt: 'Design a medical records database with patients, doctors, appointments, diagnoses, and prescriptions. Generate an executable plan.',
  },
  {
    icon: '🔗',
    label: 'Master-detail example',
    prompt: 'Show me a master-detail relationship between an Orders table and an Order Items table, with a Products LOV. Generate an executable plan.',
  },
  {
    icon: '📊',
    label: 'Sales tracking with reports',
    prompt: 'Create a sales tracking database with customers, products, sales orders, and line items. Include forms and reports. Generate an executable plan.',
  },
];

function buildSystemPrompt(
  projects: ReturnType<typeof useDB>['projects'],
  tables: ReturnType<typeof useDB>['tables'],
  fields: ReturnType<typeof useDB>['fields'],
  relationships: ReturnType<typeof useDB>['relationships'],
  forms: ReturnType<typeof useDB>['forms'],
  reports: ReturnType<typeof useDB>['reports'],
): string {
  const schemaLines: string[] = [];
  for (const proj of projects) {
    const projTables = tables.filter((t) => t.projectId === proj.id);
    schemaLines.push(`Database: "${proj.name}" (${projTables.length} tables)`);
    for (const tbl of projTables) {
      const tblFields = fields.filter((f) => f.tableId === tbl.id);
      schemaLines.push(`  Table: ${tbl.name} (${tblFields.length} fields)`);
      for (const f of tblFields) {
        schemaLines.push(`    - ${f.name}: ${f.fieldType}${f.required ? ' [required]' : ''}`);
      }
    }
  }

  return `You are DBCreator AI — an expert database design assistant embedded in the DBCreator app.

DBCreator is a local-first PWA where users build databases stored in IndexedDB. It supports:
- Table Designer: field types: id, text, large_text, number, decimal, boolean, date, datetime, time, email, phone, url, image, file, json, foreign_key, lov, color
- Table types: standard, master, detail, lov
- Relationships: one_to_many, many_to_one, one_to_one, lov
- LOV (List of Values): dropdown fields linked to another table
- Foreign Keys: reference fields linking to another table's primary key
- Form Designer: data entry forms per table
- Report Engine: filterable, sortable, exportable reports
- Menu Creator: hierarchical navigation menus

CURRENT USER SCHEMA:
${schemaLines.length > 0 ? schemaLines.join('\n') : '(No databases created yet)'}

TOTAL: ${projects.length} databases, ${tables.length} tables, ${forms.length} forms, ${reports.length} reports

IMPORTANT — EXECUTABLE PLANS:
When the user asks you to design, create, or build something, you MUST:
1. First give a clear human-readable explanation of the design
2. Then append an executable JSON plan in a fenced code block tagged \`\`\`dbcreator-plan

The plan format is:
\`\`\`dbcreator-plan
{
  "projectName": "My App",          // optional: creates a new database
  "projectDescription": "...",       // optional
  "projectColor": "#f5a623",         // optional hex color
  "tables": [
    {
      "name": "customers",           // snake_case, no spaces
      "displayName": "Customers",    // human label
      "description": "...",
      "tableType": "standard",       // standard | master | detail | lov
      "color": "#6366f1",
      "fields": [
        // Do NOT include the id field — it is auto-created
        {
          "name": "full_name",
          "displayName": "Full Name",
          "fieldType": "text",       // see field types above
          "required": true,
          "description": "...",
          "placeholder": "Enter name"
        },
        {
          "name": "category_id",
          "fieldType": "foreign_key",
          "referencedTableName": "categories",  // must match another table's name
          "required": false
        },
        {
          "name": "status",
          "fieldType": "lov",
          "lovValues": [
            {"value": "active", "label": "Active"},
            {"value": "inactive", "label": "Inactive"}
          ]
        }
      ]
    }
  ],
  "relationships": [
    {
      "type": "one_to_many",         // one_to_many | many_to_one | one_to_one | lov
      "fromTableName": "customers",
      "fromFieldName": "id",
      "toTableName": "orders",
      "toFieldName": "customer_id",
      "cascadeDelete": true
    }
  ],
  "forms": [
    {
      "name": "customer_form",
      "displayName": "Customer Form",
      "tableName": "customers",
      "columns": 2,
      "allowCreate": true,
      "allowEdit": true,
      "allowDelete": true,
      "allowSearch": true
    }
  ],
  "reports": [
    {
      "name": "customer_report",
      "displayName": "Customer Report",
      "tableName": "customers",
      "columns": ["full_name", "email", "status"],
      "defaultSort": "full_name",
      "defaultSortDir": "asc",
      "showTotals": false,
      "allowExport": true
    }
  ],
  "menus": [
    {
      "name": "main_menu",
      "displayName": "Main Menu",
      "isDefault": true,
      "items": [
        {
          "label": "Customers",
          "icon": "Users",
          "type": "form",
          "targetName": "customer_form"
        },
        {
          "label": "Reports",
          "icon": "BarChart3",
          "type": "group",
          "children": [
            {
              "label": "Customer Report",
              "icon": "BarChart3",
              "type": "report",
              "targetName": "customer_report"
            }
          ]
        }
      ]
    }
  ]
}
\`\`\`

Rules for the plan:
- table names must be snake_case, unique, no spaces
- field names must be snake_case, unique within a table
- do NOT include the "id" field — it is always auto-created
- for foreign_key or lov fields referencing another table, use "referencedTableName" with the exact table name from this plan
- for lov fields with fixed values (not from a table), use "lovValues" array instead
- only include tables, relationships, forms, reports, menus you actually want to create
- if the user already has a database open, omit "projectName" to add to the current database
- menu item type must be one of: form | report | separator | group
- menu item targetName must match a form or report name from this plan
- always include a menus section with a main navigation menu linking to all forms and reports

Always include the dbcreator-plan block when designing schemas. The user can click "Build This in DBCreator" to create everything automatically.`;
}

// ─── Execute Preview Dialog ────────────────────────────────────────────────────

interface ExecuteDialogProps {
  plan: ExecutionPlan;
  onConfirm: () => void;
  onCancel: () => void;
  executing: boolean;
  progress: string[];
  result: ExecutionResult | null;
  navigate: (to: string) => void;
}

function ExecuteDialog({ plan, onConfirm, onCancel, executing, progress, result, navigate }: ExecuteDialogProps) {
  const items = summarizePlan(plan);
  const neoSurface = { background: 'var(--neo-raised)', boxShadow: 'var(--neo-shadow-raised)' };
  const neoInset = { background: 'var(--neo-inset)', boxShadow: 'var(--neo-shadow-inset)' };

  const iconForType = (type: PlanSummaryItem['type']) => {
    switch (type) {
      case 'project': return <Database size={13} style={{ color: 'var(--amber)' }} />;
      case 'table': return <Table2 size={13} style={{ color: '#6366f1' }} />;
      case 'field': return <ChevronRight size={11} style={{ color: 'var(--muted-foreground)' }} />;
      case 'relationship': return <Link2 size={13} style={{ color: '#10b981' }} />;
      case 'form': return <LayoutTemplate size={13} style={{ color: '#ec4899' }} />;
      case 'report': return <BarChart3 size={13} style={{ color: '#06b6d4' }} />;
      case 'menu': return <FileText size={13} style={{ color: '#34d399' }} />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ ...neoSurface, border: '1px solid oklch(1 0 0 / 0.08)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: 'oklch(1 0 0 / 0.07)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'oklch(0.75 0.18 85 / 0.15)' }}>
            <Play size={16} style={{ color: 'var(--amber)' }} />
          </div>
          <div>
            <h2 className="text-sm font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
              Execute Plan
            </h2>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
              Review what will be created, then confirm
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!result ? (
            <>
              {/* Plan preview */}
              <div className="rounded-xl p-3 mb-4 space-y-1" style={neoInset}>
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 py-0.5">
                    <span className="flex-shrink-0">{iconForType(item.type)}</span>
                    <span
                      className="text-xs font-medium flex-1"
                      style={{
                        color: item.type === 'field' ? 'var(--muted-foreground)' : 'var(--foreground)',
                        fontFamily: item.type === 'field' ? 'JetBrains Mono, monospace' : 'Inter, sans-serif',
                        paddingLeft: item.type === 'field' ? '1rem' : '0',
                      }}
                    >
                      {item.label}
                    </span>
                    {item.detail && (
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>
                        {item.detail}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Progress */}
              {executing && progress.length > 0 && (
                <div className="rounded-xl p-3 mb-4 space-y-1" style={{ background: 'oklch(0.75 0.18 85 / 0.08)', border: '1px solid oklch(0.75 0.18 85 / 0.2)' }}>
                  {progress.map((msg, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {i === progress.length - 1 && executing
                        ? <Loader2 size={11} className="animate-spin flex-shrink-0" style={{ color: 'var(--amber)' }} />
                        : <CheckCircle2 size={11} className="flex-shrink-0" style={{ color: '#10b981' }} />
                      }
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>{msg}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: 'oklch(0.65 0.15 85 / 0.08)', border: '1px solid oklch(0.65 0.15 85 / 0.2)' }}>
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--amber)' }} />
                <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
                  This will create the items listed above in your local database. Existing data will not be affected. You can delete any created items manually.
                </p>
              </div>
            </>
          ) : (
            /* Result */
            <div className="space-y-4">
              {result.success ? (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'oklch(0.55 0.15 160 / 0.15)', border: '1px solid oklch(0.55 0.15 160 / 0.3)' }}>
                  <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0 }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>Plan executed successfully!</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      {result.created.tables.length} tables · {result.created.fields.length} fields · {result.created.relationships.length} relationships · {result.created.forms.length} forms · {result.created.reports.length} reports{result.created.menus.length > 0 ? ` · ${result.created.menus.length} menus` : ''}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'oklch(0.55 0.2 25 / 0.15)', border: '1px solid oklch(0.55 0.2 25 / 0.3)' }}>
                  <XCircle size={18} style={{ color: 'var(--destructive)', flexShrink: 0 }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>Execution completed with errors</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Some items may have been created. See errors below.</p>
                  </div>
                </div>
              )}

              {/* Created items */}
              {(result.created.tables.length > 0 || result.created.forms.length > 0 || result.created.reports.length > 0) && (
                <div className="rounded-xl p-3 space-y-1" style={neoInset}>
                  {result.created.project && (
                    <div className="flex items-center gap-2 py-0.5">
                      <Database size={12} style={{ color: 'var(--amber)' }} />
                      <span className="text-xs" style={{ color: 'var(--foreground)', fontFamily: 'Inter, sans-serif' }}>Database: {result.created.project.name}</span>
                    </div>
                  )}
                  {result.created.tables.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 py-0.5">
                      <Table2 size={12} style={{ color: '#6366f1' }} />
                      <button
                        onClick={() => { onCancel(); navigate(`/designer/${result.created.project?.id ?? ''}/table/${t.id}`); }}
                        className="text-xs flex items-center gap-1 hover:underline"
                        style={{ color: '#6366f1', fontFamily: 'Inter, sans-serif', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        Table: {t.displayName} <ExternalLink size={9} />
                      </button>
                    </div>
                  ))}
                  {result.created.relationships.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 py-0.5">
                      <Link2 size={12} style={{ color: '#10b981' }} />
                      <span className="text-xs" style={{ color: 'var(--foreground)', fontFamily: 'Inter, sans-serif' }}>Relationship: {r.name}</span>
                    </div>
                  ))}
                  {result.created.forms.map((f) => (
                    <div key={f.id} className="flex items-center gap-2 py-0.5">
                      <LayoutTemplate size={12} style={{ color: '#ec4899' }} />
                      <button
                        onClick={() => { onCancel(); navigate(`/forms/${result.created.project?.id ?? ''}/run/${f.id}`); }}
                        className="text-xs flex items-center gap-1 hover:underline"
                        style={{ color: '#ec4899', fontFamily: 'Inter, sans-serif', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        Form: {f.displayName} <ExternalLink size={9} />
                      </button>
                    </div>
                  ))}
                  {result.created.reports.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 py-0.5">
                      <BarChart3 size={12} style={{ color: '#06b6d4' }} />
                      <button
                        onClick={() => { onCancel(); navigate(`/reports/${result.created.project?.id ?? ''}/view/${r.id}`); }}
                        className="text-xs flex items-center gap-1 hover:underline"
                        style={{ color: '#06b6d4', fontFamily: 'Inter, sans-serif', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        Report: {r.displayName} <ExternalLink size={9} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="rounded-xl p-3 space-y-1" style={{ background: 'oklch(0.55 0.2 25 / 0.1)', border: '1px solid oklch(0.55 0.2 25 / 0.2)' }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--destructive)', fontFamily: 'JetBrains Mono, monospace' }}>ERRORS</p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>• {e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex items-center justify-end gap-3" style={{ borderColor: 'oklch(1 0 0 / 0.07)' }}>
          <button
            onClick={onCancel}
            disabled={executing}
            className="px-4 py-2 text-sm rounded-xl transition-all duration-150 active:scale-95 disabled:opacity-50"
            style={{ ...neoSurface, color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={onConfirm}
              disabled={executing}
              className="px-5 py-2 text-sm font-semibold rounded-xl transition-all duration-150 active:scale-95 disabled:opacity-50 flex items-center gap-2"
              style={{ background: 'var(--amber)', color: '#1a1a1a', boxShadow: '3px 3px 8px rgba(0,0,0,0.4)', fontFamily: 'Space Grotesk, sans-serif' }}
            >
              {executing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {executing ? 'Building…' : 'Execute'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Message Renderer ─────────────────────────────────────────────────────────

function MessageContent({ content }: { content: string }) {
  // Render message content with basic markdown-like formatting
  // Hide the dbcreator-plan block (show a plan badge instead)
  const withoutPlan = content.replace(/```dbcreator-plan[\s\S]*?```/g, '').trim();

  // Simple rendering: bold, code, line breaks
  const lines = withoutPlan.split('\n');
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', lineHeight: '1.65', fontSize: '0.875rem', color: 'var(--foreground)' }}>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <h3 key={i} style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '0.95rem', marginTop: '0.75rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>{line.slice(4)}</h3>;
        if (line.startsWith('## ')) return <h2 key={i} style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '1rem', marginTop: '0.75rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>{line.slice(3)}</h2>;
        if (line.startsWith('# ')) return <h1 key={i} style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '1.1rem', marginTop: '0.75rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>{line.slice(2)}</h1>;
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.15rem' }}>
              <span style={{ color: 'var(--amber)', flexShrink: 0 }}>•</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          );
        }
        if (line.match(/^\d+\. /)) {
          const num = line.match(/^(\d+)\. /)?.[1];
          return (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.15rem' }}>
              <span style={{ color: 'var(--amber)', flexShrink: 0, minWidth: '1.2rem' }}>{num}.</span>
              <span>{renderInline(line.replace(/^\d+\. /, ''))}</span>
            </div>
          );
        }
        if (line.startsWith('```') || line === '```') return null; // skip code fence markers
        if (line === '') return <div key={i} style={{ height: '0.5rem' }} />;
        return <p key={i} style={{ marginBottom: '0.2rem' }}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 700, color: 'var(--foreground)' }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8em', background: 'oklch(1 0 0 / 0.08)', padding: '0.1em 0.35em', borderRadius: '4px', color: 'var(--amber)' }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AIChatPage() {
  const db = useDB();
  const { projects, tables, fields, relationships, forms, reports } = db;
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [activeProfile, setActiveProfileState] = useState<AIProviderProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Execute dialog state
  const [executingPlan, setExecutingPlan] = useState<ExecutionPlan | null>(null);
  const [executing, setExecuting] = useState(false);
  const [execProgress, setExecProgress] = useState<string[]>([]);
  const [execResult, setExecResult] = useState<ExecutionResult | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getActiveProfile().then((p) => {
      setActiveProfileState(p);
      setLoadingProfile(false);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const systemPrompt = buildSystemPrompt(projects, tables, fields, relationships, forms, reports);

  const send = useCallback(async (userText?: string) => {
    const text = (userText ?? input).trim();
    if (!text || sending) return;
    if (!activeProfile) {
      toast.error('No AI provider configured. Go to AI Settings first.');
      return;
    }

    setInput('');
    setShowSuggestions(false);
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now() };
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', timestamp: Date.now(), streaming: true, plan: null };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setSending(true);

    const history: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-20).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: text },
    ];

    let fullContent = '';
    try {
      await callAI(activeProfile, history, (delta) => {
        fullContent += delta;
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: fullContent } : m)
        );
      });
      // After streaming completes, extract plan
      const plan = extractPlan(fullContent);
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, streaming: false, plan } : m)
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, content: 'Error: ' + errMsg, streaming: false, plan: null } : m)
      );
      toast.error('AI request failed: ' + errMsg.slice(0, 80));
    }
    setSending(false);
  }, [input, sending, activeProfile, messages, systemPrompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setShowSuggestions(true);
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard');
  };

  const openExecuteDialog = (plan: ExecutionPlan) => {
    setExecutingPlan(plan);
    setExecProgress([]);
    setExecResult(null);
  };

  const closeExecuteDialog = () => {
    setExecutingPlan(null);
    setExecProgress([]);
    setExecResult(null);
    setExecuting(false);
  };

  const runExecution = async () => {
    if (!executingPlan) return;
    setExecuting(true);
    setExecProgress([]);

    try {
      const result = await executePlan(executingPlan, {
        activeProject: db.activeProject,
        createProject: db.createProject,
        setActiveProject: (p) => db.setActiveProject(p as Parameters<typeof db.setActiveProject>[0]),
        createTable: db.createTable,
        createField: db.createField,
        createRelationship: db.createRelationship,
        createForm: db.createForm,
        createReport: db.createReport,
        createMenu: db.createMenu,
        existingTables: tables,
        existingFields: fields,
      }, (msg) => {
        setExecProgress((prev) => [...prev, msg]);
      });

      setExecResult(result);
      if (result.success) {
        const parts = [
          result.created.tables.length > 0 && `${result.created.tables.length} table${result.created.tables.length !== 1 ? 's' : ''}`,
          result.created.forms.length > 0 && `${result.created.forms.length} form${result.created.forms.length !== 1 ? 's' : ''}`,
          result.created.reports.length > 0 && `${result.created.reports.length} report${result.created.reports.length !== 1 ? 's' : ''}`,
          result.created.menus.length > 0 && `${result.created.menus.length} menu${result.created.menus.length !== 1 ? 's' : ''}`,
        ].filter(Boolean).join(', ');
        toast.success(`Built successfully: ${parts || 'schema created'}`);
      } else {
        toast.error(`Execution completed with ${result.errors.length} error(s)`);
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setExecResult({
        success: false,
        created: { tables: [], fields: [], relationships: [], forms: [], reports: [], menus: [] },
        errors: [errMsg],
      });
      toast.error('Execution failed: ' + errMsg.slice(0, 80));
    }
    setExecuting(false);
  };

  const neoSurface = { background: 'var(--neo-raised)', boxShadow: 'var(--neo-shadow-raised)' };
  const neoInset = { background: 'var(--neo-inset)', boxShadow: 'var(--neo-shadow-inset)' };

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ height: '100%' }}>
      {/* Execute Dialog */}
      {executingPlan && (
        <ExecuteDialog
          plan={executingPlan}
          onConfirm={runExecution}
          onCancel={closeExecuteDialog}
          executing={executing}
          progress={execProgress}
          result={execResult}
          navigate={navigate}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0" style={{ borderColor: 'oklch(1 0 0 / 0.07)', background: 'var(--neo-base)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'oklch(0.75 0.18 85 / 0.15)', boxShadow: 'var(--neo-shadow-raised)' }}>
            <Sparkles size={16} style={{ color: 'var(--amber)' }} />
          </div>
          <div>
            <h1 className="text-sm font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>AI Assistant</h1>
            {loadingProfile ? (
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Loading…</p>
            ) : activeProfile ? (
              <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>
                {activeProfile.name} · {activeProfile.model}
              </p>
            ) : (
              <p className="text-xs" style={{ color: 'var(--destructive)' }}>No provider configured</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs" style={{ ...neoInset, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: 'var(--muted-foreground)' }}>
            <span className="flex items-center gap-1"><Database size={10} />{projects.length}</span>
            <span className="flex items-center gap-1"><Table2 size={10} />{tables.length}</span>
            <span className="flex items-center gap-1"><FileText size={10} />{forms.length}</span>
            <span className="flex items-center gap-1"><BarChart3 size={10} />{reports.length}</span>
          </div>
          {messages.length > 0 && (
            <button onClick={clearChat} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-95" style={{ ...neoSurface, color: 'var(--muted-foreground)' }} title="Clear chat">
              <Trash2 size={14} />
            </button>
          )}
          <button onClick={() => navigate('/ai-settings')} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-95" style={{ ...neoSurface, color: 'var(--amber)' }} title="AI Settings">
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* No provider warning */}
      {!loadingProfile && !activeProfile && (
        <div className="mx-5 mt-4 p-4 rounded-xl flex items-center gap-3" style={{ background: 'oklch(0.55 0.2 25 / 0.15)', border: '1px solid oklch(0.55 0.2 25 / 0.3)' }}>
          <Bot size={18} style={{ color: 'var(--destructive)', flexShrink: 0 }} />
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>No AI provider configured</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Add an OpenAI, Groq, Ollama, or other provider in AI Settings to start chatting.</p>
          </div>
          <button onClick={() => navigate('/ai-settings')} className="neo-btn-primary px-3 py-1.5 text-xs font-semibold rounded-lg flex-shrink-0">Configure</button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && showSuggestions && (
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center pt-4 pb-2">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'oklch(0.75 0.18 85 / 0.12)', boxShadow: 'var(--neo-shadow-raised)' }}>
                <Sparkles size={24} style={{ color: 'var(--amber)' }} />
              </div>
              <h2 className="text-lg font-bold mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>DBCreator AI Assistant</h2>
              <p className="text-sm max-w-md" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
                Describe what you want to build. The AI will design your schema and generate an <strong style={{ color: 'var(--amber)' }}>executable plan</strong> you can run with one click.
              </p>
              {projects.length > 0 && (
                <div className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs" style={{ ...neoInset, color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>
                  <Database size={11} style={{ color: 'var(--amber)' }} />
                  Context loaded: {projects.length} databases, {tables.length} tables
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-bold mb-3 tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>SUGGESTED PROMPTS</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTED_PROMPTS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => send(s.prompt)}
                    disabled={!activeProfile || sending}
                    className="text-left rounded-xl p-3 transition-all duration-150 active:scale-98 disabled:opacity-40"
                    style={neoSurface}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{s.icon}</span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>{s.label}</span>
                    </div>
                    <p className="text-xs line-clamp-2" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>{s.prompt}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={msg.role === 'user'
                ? { background: 'oklch(0.75 0.18 85 / 0.15)', boxShadow: 'var(--neo-shadow-raised)' }
                : { background: 'oklch(0.6 0.15 260 / 0.15)', boxShadow: 'var(--neo-shadow-raised)' }
              }
            >
              {msg.role === 'user'
                ? <User size={14} style={{ color: 'var(--amber)' }} />
                : <Bot size={14} style={{ color: '#6366f1' }} />
              }
            </div>

            {/* Bubble */}
            <div className={`max-w-[82%] group relative flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className="rounded-2xl px-4 py-3"
                style={msg.role === 'user'
                  ? { background: 'oklch(0.75 0.18 85 / 0.12)', boxShadow: 'var(--neo-shadow-raised)', color: 'var(--foreground)', fontFamily: 'Inter, sans-serif', lineHeight: '1.6', fontSize: '0.875rem' }
                  : { ...neoSurface, color: 'var(--foreground)' }
                }
              >
                {msg.role === 'user' ? (
                  <span style={{ fontFamily: 'Inter, sans-serif', lineHeight: '1.6', fontSize: '0.875rem' }}>{msg.content}</span>
                ) : (
                  <MessageContent content={msg.content} />
                )}
                {msg.streaming && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 rounded-sm animate-pulse" style={{ background: 'var(--amber)', verticalAlign: 'middle' }} />
                )}
              </div>

              {/* Build This card — shown when AI response contains an executable plan */}
              {!msg.streaming && msg.plan && (
                <div
                  className="mt-3 w-full rounded-2xl overflow-hidden"
                  style={{ border: '1px solid oklch(0.75 0.18 85 / 0.35)', background: 'oklch(0.75 0.18 85 / 0.06)', maxWidth: '100%' }}
                >
                  {/* Card header */}
                  <div className="flex items-center gap-2.5 px-4 py-2.5 border-b" style={{ borderColor: 'oklch(0.75 0.18 85 / 0.2)', background: 'oklch(0.75 0.18 85 / 0.1)' }}>
                    <Sparkles size={13} style={{ color: 'var(--amber)', flexShrink: 0 }} />
                    <span className="text-xs font-bold tracking-widest" style={{ color: 'var(--amber)', fontFamily: 'JetBrains Mono, monospace' }}>EXECUTABLE PLAN</span>
                    <span className="ml-auto text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>
                      {[msg.plan.projectName && '1 db', (msg.plan.tables?.length ?? 0) > 0 && `${msg.plan.tables!.length} table${msg.plan.tables!.length !== 1 ? 's' : ''}`, (msg.plan.forms?.length ?? 0) > 0 && `${msg.plan.forms!.length} form${msg.plan.forms!.length !== 1 ? 's' : ''}`, (msg.plan.reports?.length ?? 0) > 0 && `${msg.plan.reports!.length} report${msg.plan.reports!.length !== 1 ? 's' : ''}`, (msg.plan.menus?.length ?? 0) > 0 && `${msg.plan.menus!.length} menu${msg.plan.menus!.length !== 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
                    </span>
                  </div>

                  {/* Summary chips */}
                  <div className="px-4 py-3 flex flex-wrap gap-2">
                    {msg.plan.projectName && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs" style={{ background: 'oklch(0.75 0.18 85 / 0.12)', border: '1px solid oklch(0.75 0.18 85 / 0.25)', color: 'var(--amber)', fontFamily: 'Inter, sans-serif' }}>
                        <Database size={11} />
                        {msg.plan.projectName}
                      </div>
                    )}
                    {(msg.plan.tables?.length ?? 0) > 0 && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs" style={{ background: 'oklch(0.6 0.15 260 / 0.12)', border: '1px solid oklch(0.6 0.15 260 / 0.3)', color: '#818cf8', fontFamily: 'Inter, sans-serif' }}>
                        <Table2 size={11} />
                        {msg.plan.tables!.length} Table{msg.plan.tables!.length !== 1 ? 's' : ''}
                      </div>
                    )}
                    {(msg.plan.forms?.length ?? 0) > 0 && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs" style={{ background: 'oklch(0.6 0.2 330 / 0.12)', border: '1px solid oklch(0.6 0.2 330 / 0.3)', color: '#f472b6', fontFamily: 'Inter, sans-serif' }}>
                        <LayoutTemplate size={11} />
                        {msg.plan.forms!.length} Form{msg.plan.forms!.length !== 1 ? 's' : ''}
                      </div>
                    )}
                    {(msg.plan.reports?.length ?? 0) > 0 && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs" style={{ background: 'oklch(0.6 0.15 200 / 0.12)', border: '1px solid oklch(0.6 0.15 200 / 0.3)', color: '#22d3ee', fontFamily: 'Inter, sans-serif' }}>
                        <BarChart3 size={11} />
                        {msg.plan.reports!.length} Report{msg.plan.reports!.length !== 1 ? 's' : ''}
                      </div>
                    )}
                    {(msg.plan.menus?.length ?? 0) > 0 && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs" style={{ background: 'oklch(0.6 0.15 150 / 0.12)', border: '1px solid oklch(0.6 0.15 150 / 0.3)', color: '#34d399', fontFamily: 'Inter, sans-serif' }}>
                        <FileText size={11} />
                        {msg.plan.menus!.length} Menu{msg.plan.menus!.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>

                  {/* Build button */}
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => openExecuteDialog(msg.plan!)}
                      className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-bold transition-all duration-150 active:scale-[0.98]"
                      style={{ background: 'var(--amber)', color: '#1a1a1a', boxShadow: '0 4px 14px rgba(245,166,35,0.4)', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.01em' }}
                    >
                      <Play size={15} fill="#1a1a1a" />
                      Build This in DBCreator
                    </button>
                  </div>
                </div>
              )}

              {/* Copy button */}
              {!msg.streaming && msg.content && (
                <button
                  onClick={() => copyMessage(msg.content)}
                  className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1 text-xs px-2 py-0.5 rounded-md"
                  style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}
                >
                  <Copy size={10} /> Copy
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-5 py-4 border-t" style={{ borderColor: 'oklch(1 0 0 / 0.07)', background: 'var(--neo-base)' }}>
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder={activeProfile ? 'Describe what you want to build… (Enter to send, Shift+Enter for newline)' : 'Configure an AI provider first…'}
              disabled={!activeProfile || sending}
              rows={1}
              className="neo-input w-full px-4 py-3 text-sm rounded-xl resize-none disabled:opacity-50"
              style={{ fontFamily: 'Inter, sans-serif', lineHeight: '1.5', minHeight: '44px', maxHeight: '160px' }}
            />
          </div>
          <button
            onClick={() => send()}
            disabled={!input.trim() || !activeProfile || sending}
            className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-40 flex-shrink-0"
            style={{ background: 'var(--amber)', boxShadow: '3px 3px 8px rgba(0,0,0,0.4), -1px -1px 4px rgba(255,255,255,0.05)', color: '#1a1a1a' }}
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <p className="mt-2 text-xs text-center" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
          AI will generate an executable plan — click <strong style={{ color: 'var(--amber)' }}>Execute</strong> on any response to build it automatically.
        </p>
      </div>
    </div>
  );
}
