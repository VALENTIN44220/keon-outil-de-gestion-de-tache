/**
 * ImportJalonsDialog — import en masse des jalons projets depuis le modèle Excel
 * IMPORT_JALONS_BE.xlsx (feuille « Import jalons »).
 *
 * Colonnes : Code projet | Nom projet | Régime ICPE | <1 colonne par type de jalon>.
 * Une date renseignée = jalon réalisé (date_reelle) → upsert be_project_milestones
 * (par projet × type_code, sans écraser les jalons auto-générés is_auto_delayed).
 * Le Régime ICPE renseigné met à jour be_projects.regime_icpe.
 */
import { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

interface ParsedCell { projectId: string; typeCode: string; date: string; }
interface Preview {
  cells: ParsedCell[];
  regimes: { projectId: string; regime: string }[];
  knownProjects: number;
  unknownCodes: string[];
}

const SHEET = 'Import jalons';

/** Normalise une valeur de cellule date (Date, série Excel, ou 'JJ/MM/AAAA') en 'yyyy-mm-dd'. */
function toISODate(v: any): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (m) {
    const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yyyy}-${m[2]}-${m[1]}`;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

export function ImportJalonsDialog({ open, onClose, onImported }: Props) {
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [labelToType, setLabelToType] = useState<Map<string, { code: string; ordre: number; label: string }>>(new Map());

  const reset = () => { setPreview(null); setFileName(''); };

  const handleFile = async (file: File) => {
    setParsing(true);
    setPreview(null);
    setFileName(file.name);
    try {
      // Référentiels : types (label -> code) et projets (code -> id).
      const sb = supabase as any;
      const [typesRes, projRes] = await Promise.all([
        sb.from('be_milestone_types').select('code,label,ordre'),
        sb.from('be_projects').select('id,code_projet'),
      ]);
      const l2t = new Map<string, { code: string; ordre: number; label: string }>();
      for (const t of (typesRes.data ?? [])) l2t.set(String(t.label).trim(), { code: t.code, ordre: t.ordre, label: t.label });
      setLabelToType(l2t);
      const codeToId = new Map<string, string>();
      for (const p of (projRes.data ?? [])) if (p.code_projet) codeToId.set(String(p.code_projet).trim().toUpperCase(), p.id);

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[SHEET] ?? wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
      if (rows.length < 2) throw new Error('Feuille vide ou en-tête manquant');

      const header = rows[0].map((h) => String(h ?? '').trim());
      const codeCol = header.findIndex(h => h.toLowerCase().startsWith('code projet'));
      const regimeCol = header.findIndex(h => h.toLowerCase().startsWith('régime') || h.toLowerCase().startsWith('regime'));
      // Colonnes de jalons : header correspondant à un libellé du référentiel.
      const typeCols: { col: number; code: string }[] = [];
      header.forEach((h, i) => { const t = l2t.get(h); if (t) typeCols.push({ col: i, code: t.code }); });
      if (codeCol < 0) throw new Error('Colonne « Code projet » introuvable');

      const cells: ParsedCell[] = [];
      const regimes: { projectId: string; regime: string }[] = [];
      const unknown = new Set<string>();
      let known = 0;
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r]; if (!row) continue;
        const code = String(row[codeCol] ?? '').trim();
        if (!code) continue;
        const pid = codeToId.get(code.toUpperCase());
        if (!pid) { unknown.add(code); continue; }
        known++;
        if (regimeCol >= 0) {
          const reg = String(row[regimeCol] ?? '').trim();
          if (reg) regimes.push({ projectId: pid, regime: reg });
        }
        for (const tc of typeCols) {
          const iso = toISODate(row[tc.col]);
          if (iso) cells.push({ projectId: pid, typeCode: tc.code, date: iso });
        }
      }
      setPreview({ cells, regimes, knownProjects: known, unknownCodes: [...unknown] });
    } catch (e: any) {
      toast.error(`Lecture échouée : ${e.message ?? 'format inattendu'}`);
      reset();
    } finally {
      setParsing(false);
    }
  };

  const runImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const sb = supabase as any;
      const projectIds = [...new Set(preview.cells.map(c => c.projectId))];

      // Jalons existants (non auto-différés) pour ces projets → index par projet::type.
      const existing = new Map<string, { id: string; date: string | null }>();
      if (projectIds.length > 0) {
        const { data } = await sb.from('be_project_milestones')
          .select('id,be_project_id,type_code,date_reelle')
          .in('be_project_id', projectIds).eq('is_auto_delayed', false);
        for (const m of (data ?? [])) {
          if (m.type_code) existing.set(`${m.be_project_id}::${m.type_code}`, { id: m.id, date: m.date_reelle });
        }
      }

      const inserts: any[] = [];
      const updates: { id: string; date: string }[] = [];
      for (const c of preview.cells) {
        const key = `${c.projectId}::${c.typeCode}`;
        const ex = existing.get(key);
        if (ex) {
          if (ex.date !== c.date) updates.push({ id: ex.id, date: c.date });
        } else {
          const meta = [...labelToType.values()].find(t => t.code === c.typeCode);
          inserts.push({
            be_project_id: c.projectId, type_code: c.typeCode,
            titre: meta?.label ?? c.typeCode, date_reelle: c.date,
            statut: 'termine', source_task_id: null, is_auto_delayed: false, ordre: meta?.ordre ?? null,
          });
          existing.set(key, { id: 'pending', date: c.date }); // évite les doublons dans le même fichier
        }
      }

      if (inserts.length > 0) {
        const { error } = await sb.from('be_project_milestones').insert(inserts);
        if (error) throw error;
      }
      // Updates par lots (peu fréquents).
      for (const u of updates) {
        const { error } = await sb.from('be_project_milestones')
          .update({ date_reelle: u.date, statut: 'termine', updated_at: new Date().toISOString() })
          .eq('id', u.id);
        if (error) throw error;
      }
      // Régimes ICPE (best-effort : une éventuelle restriction RLS sur be_projects
      // ne doit pas faire échouer l'import des jalons).
      const seenReg = new Set<string>();
      let regimeFailed = 0;
      for (const rg of preview.regimes) {
        if (seenReg.has(rg.projectId)) continue;
        seenReg.add(rg.projectId);
        const { error } = await sb.from('be_projects').update({ regime_icpe: rg.regime }).eq('id', rg.projectId);
        if (error) regimeFailed++;
      }

      toast.success(
        `Import terminé : ${inserts.length} jalon(s) créé(s), ${updates.length} mis à jour, ${seenReg.size - regimeFailed} régime(s)`
        + (regimeFailed ? ` — ${regimeFailed} régime(s) non enregistré(s) (droits)` : ''),
      );
      onImported();
      reset();
      onClose();
    } catch (e: any) {
      toast.error(`Import échoué : ${e.message ?? 'inconnue'}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !importing) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" /> Importer des jalons (Excel)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Fichier attendu : <span className="font-medium">IMPORT_JALONS_BE.xlsx</span> (feuille « {SHEET} »).
            Une date renseignée = jalon réalisé. Les jalons auto-générés ne sont pas écrasés.
          </p>

          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg py-8 cursor-pointer hover:bg-muted/40">
            <input
              type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
              disabled={parsing || importing}
            />
            {parsing ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
            <span className="text-sm text-muted-foreground">
              {fileName || 'Cliquer pour choisir le fichier .xlsx'}
            </span>
          </label>

          {preview && (
            <div className="rounded-lg border p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                {preview.knownProjects} projet(s) reconnu(s) · {preview.cells.length} date(s) de jalon · {new Set(preview.regimes.map(r => r.projectId)).size} régime(s)
              </div>
              {preview.unknownCodes.length > 0 && (
                <div className="flex items-start gap-2 text-amber-700">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    {preview.unknownCodes.length} code(s) projet inconnu(s), ignoré(s) :{' '}
                    <span className="font-mono text-xs">{preview.unknownCodes.slice(0, 12).join(', ')}{preview.unknownCodes.length > 12 ? '…' : ''}</span>
                  </span>
                </div>
              )}
              {preview.cells.length === 0 && (
                <p className="text-muted-foreground">Aucune date à importer (colonnes de jalons vides ?).</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={importing}>Fermer</Button>
          <Button onClick={runImport} disabled={importing || !preview || preview.cells.length === 0}>
            {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Importer {preview ? `(${preview.cells.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
