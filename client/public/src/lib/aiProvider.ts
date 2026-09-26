/**
 * AI Provider Configuration Library
 * Fully client-side — stores config in IndexedDB, calls AI APIs directly from the browser.
 * Supports any OpenAI-compatible provider (OpenAI, Groq, Ollama, OpenRouter, Mistral, etc.)
 */

export type AIProviderPreset = 'openai' | 'groq' | 'ollama' | 'openrouter' | 'anthropic' | 'mistral' | 'custom';

export interface AIProviderProfile {
  id: string;
  name: string;
  preset: AIProviderPreset;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AITestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

export const PRESET_DEFAULTS: Record<AIProviderPreset, { baseUrl: string; models: string[] }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'] },
  ollama: { baseUrl: 'http://localhost:11434/v1', models: ['llama3.2', 'llama3.1', 'mistral', 'codellama', 'phi3'] },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', models: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.3-70b-instruct', 'google/gemini-flash-1.5'] },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'] },
  mistral: { baseUrl: 'https://api.mistral.ai/v1', models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'] },
  custom: { baseUrl: '', models: [] },
};

const AI_DB_NAME = 'dbcreator-ai';
const AI_DB_VERSION = 1;
const PROFILES_STORE = 'ai_profiles';

function openAIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(AI_DB_NAME, AI_DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PROFILES_STORE)) {
        db.createObjectStore(PROFILES_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveProfile(profile: AIProviderProfile): Promise<void> {
  const db = await openAIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROFILES_STORE, 'readwrite');
    tx.objectStore(PROFILES_STORE).put(profile);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadProfiles(): Promise<AIProviderProfile[]> {
  const db = await openAIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROFILES_STORE, 'readonly');
    const req = tx.objectStore(PROFILES_STORE).getAll();
    req.onsuccess = () => resolve((req.result as AIProviderProfile[]).sort((a, b) => b.updatedAt - a.updatedAt));
    req.onerror = () => reject(req.error);
  });
}

export async function deleteProfile(id: string): Promise<void> {
  const db = await openAIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROFILES_STORE, 'readwrite');
    tx.objectStore(PROFILES_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getActiveProfile(): Promise<AIProviderProfile | null> {
  const profiles = await loadProfiles();
  return profiles.find((p) => p.isActive) ?? profiles[0] ?? null;
}

export async function setActiveProfile(id: string): Promise<void> {
  const profiles = await loadProfiles();
  for (const p of profiles) {
    p.isActive = p.id === id;
    await saveProfile(p);
  }
}

export async function callAI(
  profile: AIProviderProfile,
  messages: ChatMessage[],
  onChunk?: (delta: string) => void
): Promise<string> {
  const url = `${profile.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (profile.preset === 'anthropic') {
    headers['x-api-key'] = profile.apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else if (profile.apiKey) {
    headers['Authorization'] = `Bearer ${profile.apiKey}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: profile.model,
      messages,
      temperature: profile.temperature,
      max_tokens: profile.maxTokens,
      stream: !!onChunk,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error');
    throw new Error(`AI API error ${response.status}: ${errText}`);
  }

  if (onChunk) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    const decoder = new TextDecoder();
    let fullText = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n').filter((l) => l.startsWith('data: '))) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const delta = JSON.parse(data).choices?.[0]?.delta?.content ?? '';
          if (delta) { fullText += delta; onChunk(delta); }
        } catch { /* ignore */ }
      }
    }
    return fullText;
  } else {
    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? '';
  }
}

export async function testConnection(profile: AIProviderProfile): Promise<AITestResult> {
  const start = Date.now();
  try {
    const result = await callAI({ ...profile, maxTokens: 16 }, [{ role: 'user', content: 'Reply with exactly: OK' }]);
    return { success: true, message: `Connected! Response: "${result.trim().slice(0, 80)}"`, latencyMs: Date.now() - start };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - start };
  }
}

export async function fetchAvailableModels(profile: AIProviderProfile): Promise<string[]> {
  try {
    const url = `${profile.baseUrl.replace(/\/$/, '')}/models`;
    const headers: Record<string, string> = {};
    if (profile.preset === 'anthropic') { headers['x-api-key'] = profile.apiKey; headers['anthropic-version'] = '2023-06-01'; }
    else if (profile.apiKey) { headers['Authorization'] = `Bearer ${profile.apiKey}`; }
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data ?? data.models ?? []).map((m: { id?: string; name?: string }) => m.id ?? m.name ?? '').filter(Boolean).sort();
  } catch { return []; }
}

export function newProfile(partial?: Partial<AIProviderProfile>): AIProviderProfile {
  const preset: AIProviderPreset = partial?.preset ?? 'openai';
  return {
    id: crypto.randomUUID(),
    name: 'New Provider',
    preset,
    baseUrl: PRESET_DEFAULTS[preset].baseUrl,
    apiKey: '',
    model: PRESET_DEFAULTS[preset].models[0] ?? '',
    temperature: 0.7,
    maxTokens: 2048,
    isActive: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...partial,
  };
}
