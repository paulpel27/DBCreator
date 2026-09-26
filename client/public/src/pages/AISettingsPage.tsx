/**
 * AI Provider Settings Page
 * Configure AI providers, API keys, models — all stored locally in IndexedDB.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  type AIProviderProfile,
  type AIProviderPreset,
  PRESET_DEFAULTS,
  loadProfiles,
  saveProfile,
  deleteProfile,
  setActiveProfile,
  testConnection,
  fetchAvailableModels,
  newProfile,
} from '@/lib/aiProvider';
import {
  Bot, Plus, Trash2, CheckCircle2, XCircle, Loader2, ChevronDown,
  RefreshCw, Star, StarOff, Eye, EyeOff, Zap, Settings2, Copy,
} from 'lucide-react';
import { toast } from 'sonner';

const PRESETS: { value: AIProviderPreset; label: string; color: string }[] = [
  { value: 'openai', label: 'OpenAI', color: '#10a37f' },
  { value: 'groq', label: 'Groq', color: '#f55036' },
  { value: 'ollama', label: 'Ollama (Local)', color: '#6366f1' },
  { value: 'openrouter', label: 'OpenRouter', color: '#8b5cf6' },
  { value: 'anthropic', label: 'Anthropic', color: '#d97706' },
  { value: 'mistral', label: 'Mistral AI', color: '#06b6d4' },
  { value: 'custom', label: 'Custom / Other', color: '#f5a623' },
];

function getPresetColor(preset: AIProviderPreset) {
  return PRESETS.find((p) => p.value === preset)?.color ?? '#f5a623';
}

export default function AISettingsPage() {
  const [profiles, setProfiles] = useState<AIProviderProfile[]>([]);
  const [selected, setSelected] = useState<AIProviderProfile | null>(null);
  const [form, setForm] = useState<AIProviderProfile | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [dirty, setDirty] = useState(false);

  const reload = useCallback(async () => {
    const ps = await loadProfiles();
    setProfiles(ps);
    return ps;
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const selectProfile = (p: AIProviderProfile) => {
    setSelected(p);
    setForm({ ...p });
    setDirty(false);
    setTestResult(null);
    setAvailableModels([]);
    setShowKey(false);
  };

  const handleNew = async () => {
    const p = newProfile({ name: 'New Provider', isActive: profiles.length === 0 });
    await saveProfile(p);
    const ps = await reload();
    const fresh = ps.find((x) => x.id === p.id) ?? p;
    selectProfile(fresh);
    toast.success('New provider created');
  };

  const handleChange = <K extends keyof AIProviderProfile>(key: K, value: AIProviderProfile[K]) => {
    if (!form) return;
    const updated = { ...form, [key]: value, updatedAt: Date.now() };
    if (key === 'preset') {
      const preset = value as AIProviderPreset;
      updated.baseUrl = PRESET_DEFAULTS[preset].baseUrl;
      updated.model = PRESET_DEFAULTS[preset].models[0] ?? '';
    }
    setForm(updated);
    setDirty(true);
    setTestResult(null);
  };

  const handleSave = async () => {
    if (!form) return;
    await saveProfile({ ...form, updatedAt: Date.now() });
    await reload();
    setSelected(form);
    setDirty(false);
    toast.success('Provider saved');
  };

  const handleDelete = async (id: string) => {
    await deleteProfile(id);
    const ps = await reload();
    if (selected?.id === id) {
      setSelected(ps[0] ?? null);
      setForm(ps[0] ? { ...ps[0] } : null);
    }
    toast.success('Provider deleted');
  };

  const handleSetActive = async (id: string) => {
    await setActiveProfile(id);
    await reload();
    if (form?.id === id) setForm((f) => f ? { ...f, isActive: true } : f);
    toast.success('Active provider updated');
  };

  const handleTest = async () => {
    if (!form) return;
    setTesting(true);
    setTestResult(null);
    const result = await testConnection(form);
    setTestResult(result);
    setTesting(false);
    if (result.success) toast.success('Connection OK (' + result.latencyMs + 'ms)');
    else toast.error('Connection failed');
  };

  const handleFetchModels = async () => {
    if (!form) return;
    setLoadingModels(true);
    const models = await fetchAvailableModels(form);
    setAvailableModels(models);
    setLoadingModels(false);
    if (models.length > 0) toast.success('Found ' + models.length + ' models');
    else toast.error('Could not fetch models — check URL and API key');
  };

  const neoSurface = { background: 'var(--neo-raised)', boxShadow: 'var(--neo-shadow-raised)' };
  const neoInset = { background: 'var(--neo-inset)', boxShadow: 'var(--neo-shadow-inset)' };

  return (
    <div className="flex-1 flex overflow-hidden" style={{ height: '100%' }}>
      {/* Left: Profile List */}
      <div className="w-64 flex-shrink-0 flex flex-col border-r" style={{ borderColor: 'oklch(1 0 0 / 0.07)', background: 'var(--neo-base)' }}>
        <div className="p-4 border-b" style={{ borderColor: 'oklch(1 0 0 / 0.07)' }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Bot size={16} style={{ color: 'var(--amber)' }} />
              <span className="text-sm font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>AI Providers</span>
            </div>
            <button onClick={handleNew} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-95" style={{ ...neoSurface, color: 'var(--amber)' }} title="Add provider">
              <Plus size={14} />
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>{profiles.length} provider{profiles.length !== 1 ? 's' : ''} configured</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {profiles.length === 0 && (
            <div className="text-center py-8">
              <Bot size={28} style={{ color: 'var(--muted-foreground)', margin: '0 auto 8px' }} />
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>No providers yet</p>
              <button onClick={handleNew} className="mt-3 px-3 py-1.5 text-xs font-semibold rounded-lg neo-btn-primary">Add First Provider</button>
            </div>
          )}
          {profiles.map((p) => {
            const color = getPresetColor(p.preset);
            const isSel = selected?.id === p.id;
            return (
              <div key={p.id} onClick={() => selectProfile(p)} className="rounded-xl p-3 cursor-pointer transition-all duration-150" style={isSel ? { ...neoInset, borderLeft: '3px solid ' + color } : neoSurface}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color, boxShadow: '0 0 6px ' + color + '88' }} />
                    <span className="text-sm font-semibold truncate" style={{ color: isSel ? 'var(--foreground)' : 'var(--muted-foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>{p.name}</span>
                  </div>
                  {p.isActive && <span className="text-xs px-1.5 py-0.5 rounded-md flex-shrink-0" style={{ background: color + '22', color, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}>ACTIVE</span>}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>{PRESETS.find((x) => x.value === p.preset)?.label ?? p.preset}</span>
                  <span className="text-xs" style={{ color: 'oklch(1 0 0 / 0.2)' }}>·</span>
                  <span className="text-xs truncate" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>{p.model || 'no model'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Editor */}
      <div className="flex-1 overflow-y-auto p-6">
        {!form ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="rounded-2xl p-10 flex flex-col items-center text-center max-w-sm" style={neoInset}>
              <Settings2 size={40} style={{ color: 'var(--amber)', marginBottom: '12px' }} />
              <h2 className="text-lg font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>Configure AI Providers</h2>
              <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>Add providers like OpenAI, Groq, Ollama, or any OpenAI-compatible API. All settings are stored locally on your device.</p>
              <button onClick={handleNew} className="neo-btn-primary px-4 py-2 text-sm font-semibold rounded-lg flex items-center gap-2"><Plus size={14} /> Add Provider</button>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>{form.name}</h1>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>ID: {form.id.slice(0, 8)}…</p>
              </div>
              <div className="flex items-center gap-2">
                {!form.isActive && (
                  <button onClick={() => handleSetActive(form.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 active:scale-95" style={{ ...neoSurface, color: 'var(--amber)' }}>
                    <Star size={12} /> Set Active
                  </button>
                )}
                {form.isActive && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg" style={{ background: 'oklch(0.75 0.18 85 / 0.15)', color: 'var(--amber)' }}>
                    <StarOff size={12} /> Active Provider
                  </span>
                )}
                <button onClick={() => handleDelete(form.id)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-95" style={{ ...neoSurface, color: 'var(--destructive)' }} title="Delete provider">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Preset */}
            <div className="rounded-2xl p-5 space-y-4" style={neoSurface}>
              <h3 className="text-xs font-bold tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>PROVIDER TYPE</h3>
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map((preset) => (
                  <button key={preset.value} onClick={() => handleChange('preset', preset.value)} className="rounded-xl p-2.5 text-xs font-semibold transition-all duration-150 active:scale-95 text-center"
                    style={form.preset === preset.value ? { background: preset.color + '22', color: preset.color, boxShadow: 'inset 2px 2px 6px rgba(0,0,0,0.3), 0 0 0 1px ' + preset.color + '44' } : { ...neoInset, color: 'var(--muted-foreground)' }}>
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Connection */}
            <div className="rounded-2xl p-5 space-y-4" style={neoSurface}>
              <h3 className="text-xs font-bold tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>CONNECTION SETTINGS</h3>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>DISPLAY NAME</label>
                <input className="neo-input w-full px-3 py-2.5 text-sm rounded-lg" value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="My AI Provider" />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>BASE URL</label>
                <input className="neo-input w-full px-3 py-2.5 text-sm rounded-lg" value={form.baseUrl} onChange={(e) => handleChange('baseUrl', e.target.value)} placeholder="https://api.openai.com/v1" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }} />
                {form.preset !== 'custom' && (
                  <button onClick={() => handleChange('baseUrl', PRESET_DEFAULTS[form.preset].baseUrl)} className="mt-1 text-xs flex items-center gap-1" style={{ color: 'var(--amber)' }}>
                    <RefreshCw size={10} /> Reset to default
                  </button>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
                  API KEY {form.preset === 'ollama' && <span style={{ fontWeight: 400 }}>(not required for local Ollama)</span>}
                </label>
                <div className="relative">
                  <input className="neo-input w-full px-3 py-2.5 text-sm rounded-lg pr-20" type={showKey ? 'text' : 'password'} value={form.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} placeholder={form.preset === 'ollama' ? 'ollama (or leave blank)' : 'sk-...'} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }} />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <button onClick={() => setShowKey(!showKey)} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ color: 'var(--muted-foreground)' }} title={showKey ? 'Hide' : 'Show'}>
                      {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                    {form.apiKey && (
                      <button onClick={() => { navigator.clipboard.writeText(form.apiKey); toast.success('Copied'); }} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ color: 'var(--muted-foreground)' }} title="Copy">
                        <Copy size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>Stored locally in IndexedDB — never sent to any server except the AI provider.</p>
              </div>
            </div>

            {/* Model */}
            <div className="rounded-2xl p-5 space-y-4" style={neoSurface}>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>MODEL</h3>
                <button onClick={handleFetchModels} disabled={loadingModels} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all duration-150 active:scale-95" style={{ ...neoInset, color: 'var(--amber)' }}>
                  {loadingModels ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Fetch from API
                </button>
              </div>
              <div className="relative">
                <input className="neo-input w-full px-3 py-2.5 text-sm rounded-lg pr-8" value={form.model} onChange={(e) => handleChange('model', e.target.value)} placeholder="e.g. gpt-4o" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }} onFocus={() => setShowModelDropdown(true)} onBlur={() => setTimeout(() => setShowModelDropdown(false), 150)} />
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
                {showModelDropdown && (
                  <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl overflow-hidden" style={{ ...neoSurface, maxHeight: '200px', overflowY: 'auto' }}>
                    {(availableModels.length > 0 ? availableModels : PRESET_DEFAULTS[form.preset].models).map((m) => (
                      <button key={m} onMouseDown={() => handleChange('model', m)} className="w-full text-left px-3 py-2 text-xs transition-colors duration-100 hover:bg-white/5" style={{ color: 'var(--foreground)', fontFamily: 'JetBrains Mono, monospace' }}>{m}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Parameters */}
            <div className="rounded-2xl p-5 space-y-4" style={neoSurface}>
              <h3 className="text-xs font-bold tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>GENERATION PARAMETERS</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold mb-1.5 flex items-center justify-between" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
                    <span>TEMPERATURE</span><span style={{ color: 'var(--amber)' }}>{form.temperature.toFixed(1)}</span>
                  </label>
                  <input type="range" min="0" max="2" step="0.1" value={form.temperature} onChange={(e) => handleChange('temperature', parseFloat(e.target.value))} className="w-full" style={{ accentColor: 'var(--amber)' }} />
                  <div className="flex justify-between text-xs mt-0.5" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}><span>Precise</span><span>Creative</span></div>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 flex items-center justify-between" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
                    <span>MAX TOKENS</span><span style={{ color: 'var(--amber)' }}>{form.maxTokens.toLocaleString()}</span>
                  </label>
                  <input type="range" min="256" max="8192" step="256" value={form.maxTokens} onChange={(e) => handleChange('maxTokens', parseInt(e.target.value))} className="w-full" style={{ accentColor: 'var(--amber)' }} />
                  <div className="flex justify-between text-xs mt-0.5" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}><span>256</span><span>8192</span></div>
                </div>
              </div>
            </div>

            {/* Test */}
            <div className="rounded-2xl p-5 space-y-3" style={neoSurface}>
              <h3 className="text-xs font-bold tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>CONNECTION TEST</h3>
              <div className="flex items-center gap-3">
                <button onClick={handleTest} disabled={testing || !form.baseUrl || !form.model} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-150 active:scale-95 disabled:opacity-50" style={{ ...neoInset, color: 'var(--amber)' }}>
                  {testing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                  {testing ? 'Testing…' : 'Test Connection'}
                </button>
                {testResult && (
                  <div className="flex items-center gap-2">
                    {testResult.success ? <CheckCircle2 size={16} style={{ color: '#10b981' }} /> : <XCircle size={16} style={{ color: 'var(--destructive)' }} />}
                    <span className="text-xs" style={{ color: testResult.success ? '#10b981' : 'var(--destructive)', fontFamily: 'Inter, sans-serif' }}>
                      {testResult.success ? 'OK · ' + testResult.latencyMs + 'ms' : 'Failed'}
                    </span>
                  </div>
                )}
              </div>
              {testResult && (
                <div className="rounded-lg p-3 text-xs" style={{ ...neoInset, color: testResult.success ? '#10b981' : 'var(--destructive)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', wordBreak: 'break-all' }}>
                  {testResult.message}
                </div>
              )}
            </div>

            {/* Save */}
            <div className="flex items-center justify-end gap-3 pb-4">
              {dirty && (
                <button onClick={() => { setForm({ ...selected! }); setDirty(false); }} className="px-4 py-2 text-sm rounded-lg transition-all duration-150 active:scale-95" style={{ ...neoSurface, color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>Discard</button>
              )}
              <button onClick={handleSave} disabled={!dirty} className="neo-btn-primary px-5 py-2 text-sm font-semibold rounded-lg disabled:opacity-40 transition-all duration-150 active:scale-95" style={{ fontFamily: 'Inter, sans-serif' }}>Save Provider</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
