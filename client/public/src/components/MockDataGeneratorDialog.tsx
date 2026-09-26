/**
 * MockDataGeneratorDialog
 * AI-powered mock data generator for any table.
 * Uses the user's configured AI provider (same as AIChatPage) to generate
 * realistic sample rows, previews them in a table, then seeds via rowPut.
 */
import { useState, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { Sparkles, Loader2, CheckCircle2, XCircle, RefreshCw, Database, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getActiveProfile, callAI } from '@/lib/aiProvider';
import { ensureTableStore, rowPut } from '@/lib/db';
import type { DBTable, DBField } from '@/lib/db';

interface MockDataGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  table: DBTable;
  fields: DBField[];
  onSeeded: (count: number) => void;
}

type GeneratedRow = Record<string, string | number | boolean | null>;

export function MockDataGeneratorDialog({
  open,
  onOpenChange,
  projectId,
  table,
  fields,
  onSeeded,
}: MockDataGeneratorDialogProps) {
  const [rowCount, setRowCount] = useState(10);
  const [context, setContext] = useState('');
  const [generating, setGenerating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [generatedRows, setGeneratedRows] = useState<GeneratedRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  // Columns to display (skip id, createdAt, updatedAt)
  const displayFields = fields.filter(
    (f) => !['id', 'createdAt', 'updatedAt', 'created_at', 'updated_at'].includes(f.name)
  );

  const buildPrompt = useCallback(() => {
    const fieldDescriptions = displayFields.map((f) => {
      let desc = `  - ${f.name} (${f.fieldType})`;
      if (f.required) desc += ' [required]';
      if (f.lovValues) {
        try {
          const parsed: {value: string}[] = JSON.parse(f.lovValues);
          const vals = parsed.map(v => v.value).join(', ');
          if (vals) desc += ` [allowed values: ${vals}]`;
        } catch { /* ignore */ }
      }
      if (f.referencedTableId) desc += ` [foreign key — use realistic IDs like "fk-1", "fk-2", "fk-3"]`;
      return desc;
    }).join('\n');

    return `You are a database mock data generator. Generate exactly ${rowCount} realistic, varied rows for a database table.

Table name: ${table.name}
${table.description ? `Table description: ${table.description}` : ''}
${context ? `Additional context: ${context}` : ''}

Fields:
${fieldDescriptions}

Rules:
- Return ONLY a valid JSON array of objects, no markdown, no explanation
- Each object must have ALL the listed fields as keys
- Use realistic, varied data (not "test1", "test2" etc.)
- For date fields use ISO format: YYYY-MM-DD
- For datetime fields use: YYYY-MM-DDTHH:MM:SS
- For boolean fields use true or false
- For number/integer/decimal fields use numbers (not strings)
- For foreign key fields use short IDs like "fk-1", "fk-2" etc.
- For email fields use realistic email addresses
- For phone fields use realistic phone numbers with country codes
- For LOV fields only use the allowed values listed
- Make data coherent and internally consistent across rows
- Use Dutch names, addresses, and context where appropriate (this is a Dutch application)

Return ONLY the JSON array:`;
  }, [rowCount, context, table, displayFields]);

  const handleGenerate = async () => {
    setError(null);
    setGenerating(true);
    setGeneratedRows([]);

    try {
      const profile = await getActiveProfile();
      if (!profile) {
        throw new Error('No AI provider configured. Please set up an AI provider in AI Settings first.');
      }

      const prompt = buildPrompt();
      const response = await callAI(profile, [
        { role: 'system', content: 'You are a database mock data generator. Always return valid JSON arrays only.' },
        { role: 'user', content: prompt },
      ]);

      // Extract JSON from response (strip markdown if present)
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('AI did not return a valid JSON array. Try again or adjust the row count.');
      }

      const rows: GeneratedRow[] = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error('AI returned an empty or invalid array.');
      }

      setGeneratedRows(rows);
      setShowPreview(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error('Generation failed', { description: msg.slice(0, 120) });
    } finally {
      setGenerating(false);
    }
  };

  const handleSeed = async () => {
    if (generatedRows.length === 0) return;
    setSeeding(true);
    try {
      // Ensure the IndexedDB object store exists for this table
      await ensureTableStore(projectId, table.id);

      let seeded = 0;
      for (const row of generatedRows) {
        const record = { _id: nanoid(), _createdAt: Date.now(), _updatedAt: Date.now(), ...row };
        await rowPut(projectId, table.id, record);
        seeded++;
      }

      toast.success(`${seeded} rows added to "${table.name}"`, {
        description: 'Mock data seeded successfully.',
      });
      onSeeded(seeded);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Seeding failed', { description: msg.slice(0, 120) });
    } finally {
      setSeeding(false);
    }
  };

  const handleClose = () => {
    if (!generating && !seeding) {
      setGeneratedRows([]);
      setError(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            Generate Mock Data
            <Badge variant="outline" className="ml-1 text-xs font-normal">
              {table.name}
            </Badge>
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            AI will generate realistic sample rows for this table using your configured AI provider.
          </p>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Config row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Number of rows</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={rowCount}
                onChange={(e) => setRowCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 10)))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Fields to generate</Label>
              <div className="h-9 flex items-center gap-1 flex-wrap overflow-hidden">
                {displayFields.slice(0, 5).map((f) => (
                  <Badge key={f.id} variant="secondary" className="text-xs py-0 px-1.5">
                    {f.name}
                  </Badge>
                ))}
                {displayFields.length > 5 && (
                  <Badge variant="outline" className="text-xs py-0 px-1.5">
                    +{displayFields.length - 5} more
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Context hint */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Context hint <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              placeholder="e.g. 'Dutch hospital in Amsterdam, cardiology department' or 'Small tech startup in Rotterdam'"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="h-16 resize-none text-sm"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Preview */}
          {generatedRows.length > 0 && (
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-medium"
                onClick={() => setShowPreview((v) => !v)}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>{generatedRows.length} rows generated — preview</span>
                </div>
                {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showPreview && (
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/20">
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground w-8">#</th>
                        {displayFields.map((f) => (
                          <th key={f.id} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                            {f.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {generatedRows.map((row, i) => (
                        <tr key={i} className="border-b border-border/30 hover:bg-muted/10">
                          <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                          {displayFields.map((f) => (
                            <td key={f.id} className="px-3 py-1.5 max-w-[180px] truncate" title={String(row[f.name] ?? '')}>
                              {row[f.name] === null || row[f.name] === undefined
                                ? <span className="text-muted-foreground/50 italic">null</span>
                                : String(row[f.name])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border/50 flex items-center gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={generating || seeding} className="mr-auto">
            Cancel
          </Button>

          {generatedRows.length > 0 && (
            <Button
              variant="outline"
              onClick={handleGenerate}
              disabled={generating || seeding}
              className="gap-2"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Regenerate
            </Button>
          )}

          {generatedRows.length === 0 ? (
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate {rowCount} Rows
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleSeed}
              disabled={seeding}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              {seeding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding rows…
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  Add {generatedRows.length} Rows to Table
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
