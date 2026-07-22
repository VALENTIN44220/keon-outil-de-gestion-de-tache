/**
 * ITBudgetCopyYearDialog — copie des lignes budgétaires d'une année vers une autre.
 *
 * Options à la copie :
 *  - « structure seulement » (défaut) : ligne + montant annuel, sans ventilation
 *    mensuelle détaillée ; ou avec ventilation mensuelle si l'option est cochée
 *    (copie it_budget_line_months : montant prévu par mois, SANS les rapprochements
 *    réels — commandes / factures / NDF).
 *  - anti-doublon : ignore les lignes déjà présentes sur l'année cible (même projet
 *    + catégorie + sous-catégorie + description + fournisseur).
 *
 * Dans tous les cas : statut remis à « brouillon », montants révisés/reforecast
 * et rapprochements NON repris. Les regroupements sélectionnés sont recréés + remappés.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Copy, Layers } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  targetAnnee: number;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

interface SrcLine {
  id: string;
  it_project_id: string | null;
  categorie: string | null;
  sous_categorie: string | null;
  description: string | null;
  fournisseur_prevu: string | null;
  montant_annuel: number | null;
  montant_budget: number | null;
  rapprochement_group_id: string | null;
  [k: string]: any;
}

const eur = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

// Champs de structure recopiés (le reste est remis à zéro).
const STRUCT_FIELDS = [
  'it_project_id', 'categorie', 'sous_categorie', 'fournisseur_prevu', 'type_depense',
  'nature_depense', 'description', 'mois_budget', 'montant_budget', 'montant_annuel',
  'mode_saisie', 'commentaire', 'entite', 'budget_type', 'source_depense',
  'mois_applicables', 'version', 'paiement_via_ndf',
];

/** Signature d'unicité pour l'anti-doublon. */
const sig = (l: Partial<SrcLine>) =>
  [l.it_project_id, l.categorie, l.sous_categorie, l.description, l.fournisseur_prevu]
    .map(x => (x ?? '').toString().trim().toLowerCase()).join('|');

export function ITBudgetCopyYearDialog({ targetAnnee, open, onClose, onDone }: Props) {
  const [sourceAnnee, setSourceAnnee] = useState(targetAnnee - 1);
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [lines, setLines] = useState<SrcLine[]>([]);
  const [groupNames, setGroupNames] = useState<Map<string, string>>(new Map());
  const [projLabels, setProjLabels] = useState<Map<string, string>>(new Map());
  const [existingSigs, setExistingSigs] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copyMonths, setCopyMonths] = useState(false);
  const [skipExisting, setSkipExisting] = useState(true);

  useEffect(() => { if (open) setSourceAnnee(targetAnnee - 1); }, [open, targetAnnee]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      setLoading(true);
      try {
        const sb = supabase as any;
        const [linesRes, groupsRes, projRes, targetRes] = await Promise.all([
          sb.from('it_budget_lines').select('*').eq('annee', sourceAnnee).order('categorie'),
          sb.from('it_budget_rapprochement_groups').select('id, nom').eq('exercice', sourceAnnee),
          sb.from('it_projects').select('id, nom_projet, code_projet_digital'),
          sb.from('it_budget_lines')
            .select('it_project_id, categorie, sous_categorie, description, fournisseur_prevu')
            .eq('annee', targetAnnee),
        ]);
        const l = (linesRes.data ?? []) as SrcLine[];
        setLines(l);
        setGroupNames(new Map((groupsRes.data ?? []).map((g: any) => [g.id, g.nom])));
        setProjLabels(new Map((projRes.data ?? []).map((p: any) => [p.id, p.code_projet_digital || p.nom_projet || ''])));
        const sigs = new Set<string>((targetRes.data ?? []).map((t: any) => sig(t)));
        setExistingSigs(sigs);
        // Par défaut : tout sélectionné SAUF les lignes déjà présentes sur l'année cible.
        setSelected(new Set(l.filter(x => !sigs.has(sig(x))).map(x => x.id)));
      } catch (e: any) {
        toast.error(`Erreur : ${e.message ?? 'chargement'}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, sourceAnnee, targetAnnee]);

  const grouped = useMemo(() => {
    const m = new Map<string, SrcLine[]>();
    for (const l of lines) {
      const key = l.rapprochement_group_id ?? '__none__';
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(l);
    }
    return [...m.entries()];
  }, [lines]);

  const isExisting = (l: SrcLine) => existingSigs.has(sig(l));

  const toggle = (id: string) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleGroup = (ids: string[], on: boolean) => setSelected(prev => {
    const n = new Set(prev); ids.forEach(id => on ? n.add(id) : n.delete(id)); return n;
  });

  const nbExisting = useMemo(() => lines.filter(isExisting).length, [lines, existingSigs]);

  const runCopy = async () => {
    let sel = lines.filter(l => selected.has(l.id));
    if (skipExisting) sel = sel.filter(l => !isExisting(l));
    if (sel.length === 0) { toast.error('Aucune ligne à copier'); return; }
    setCopying(true);
    try {
      const sb = supabase as any;
      // 1) Recréer les regroupements concernés sur l'année cible.
      const groupIds = [...new Set(sel.map(l => l.rapprochement_group_id).filter(Boolean))] as string[];
      const groupMap = new Map<string, string>();
      if (groupIds.length > 0) {
        const { data: srcGroups } = await sb.from('it_budget_rapprochement_groups')
          .select('id, nom, description, entite').in('id', groupIds);
        for (const g of (srcGroups ?? [])) {
          const { data: ins, error } = await sb.from('it_budget_rapprochement_groups')
            .insert({ nom: g.nom, description: g.description, entite: g.entite, exercice: targetAnnee })
            .select('id').single();
          if (error) throw error;
          groupMap.set(g.id, ins.id);
        }
      }
      // 2) Construire les lignes copiées.
      const buildRow = (l: SrcLine) => {
        const row: any = { exercice: targetAnnee, annee: targetAnnee, statut: 'brouillon' };
        for (const f of STRUCT_FIELDS) row[f] = l[f];
        row.rapprochement_group_id = l.rapprochement_group_id ? (groupMap.get(l.rapprochement_group_id) ?? null) : null;
        row.montant_budget_revise = null;
        row.budget_type_revise = null;
        row.mois_budget_revise = null;
        row.is_reforecast = false;
        row.external_key = null;
        return row;
      };

      let insertedCount = 0;
      let monthsCount = 0;

      if (copyMonths) {
        // Insert ligne par ligne pour pairer la ventilation mensuelle.
        for (const l of sel) {
          const { data: newLine, error } = await sb.from('it_budget_lines')
            .insert(buildRow(l)).select('id').single();
          if (error) throw error;
          insertedCount++;
          const { data: srcMonths } = await sb.from('it_budget_line_months')
            .select('mois, montant_budget, commentaire').eq('budget_line_id', l.id);
          if (srcMonths && srcMonths.length > 0) {
            const mrows = srcMonths.map((m: any) => ({
              budget_line_id: newLine.id, mois: m.mois,
              montant_budget: m.montant_budget, commentaire: m.commentaire,
              // rapprochements réels NON repris (ref commande/facture, NDF, pdf, statut, révisé)
            }));
            const { error: mErr } = await sb.from('it_budget_line_months').insert(mrows);
            if (mErr) throw mErr;
            monthsCount += mrows.length;
          }
        }
      } else {
        // Structure seulement : insert en lot.
        const rows = sel.map(buildRow);
        const { error } = await sb.from('it_budget_lines').insert(rows);
        if (error) throw error;
        insertedCount = rows.length;
      }

      toast.success(
        `${insertedCount} ligne(s) copiée(s) vers ${targetAnnee}`
        + (groupMap.size ? ` · ${groupMap.size} regroupement(s)` : '')
        + (copyMonths ? ` · ${monthsCount} mois` : ''),
      );
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(`Copie échouée : ${e.message ?? 'inconnue'}`);
    } finally {
      setCopying(false);
    }
  };

  const total = lines.length;
  const nbSelEffective = skipExisting
    ? lines.filter(l => selected.has(l.id) && !isExisting(l)).length
    : selected.size;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !copying) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-sky-600" /> Copier des lignes budgétaires vers {targetAnnee}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">Année source :</span>
          <select
            value={sourceAnnee}
            onChange={(e) => setSourceAnnee(Number(e.target.value))}
            className="h-8 border rounded-md bg-background px-2 text-sm"
          >
            {[targetAnnee - 1, targetAnnee - 2, targetAnnee + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <span className="ml-auto text-xs text-muted-foreground">{nbSelEffective}/{total} à copier</span>
        </div>

        {/* Options */}
        <div className="flex flex-wrap items-center gap-4 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={copyMonths} onCheckedChange={(c) => setCopyMonths(c === true)} />
            Copier aussi la ventilation mensuelle
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={skipExisting} onCheckedChange={(c) => setSkipExisting(c === true)} />
            Ignorer les lignes déjà présentes sur {targetAnnee}
            {nbExisting > 0 && <span className="text-xs text-amber-600">({nbExisting} détectée{nbExisting > 1 ? 's' : ''})</span>}
          </label>
        </div>

        <div className="flex-1 overflow-y-auto rounded-lg border divide-y min-h-[180px]">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : total === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Aucune ligne en {sourceAnnee}.</p>
          ) : grouped.map(([gid, gLines]) => {
            const ids = gLines.map(l => l.id);
            const allOn = ids.every(id => selected.has(id));
            return (
              <div key={gid}>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 sticky top-0">
                  <Checkbox checked={allOn} onCheckedChange={(c) => toggleGroup(ids, c === true)} />
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold">
                    {gid === '__none__' ? 'Sans regroupement' : (groupNames.get(gid) ?? 'Regroupement')}
                  </span>
                  <span className="text-[11px] text-muted-foreground">({gLines.length})</span>
                </div>
                {gLines.map(l => {
                  const exists = isExisting(l);
                  const dimmed = exists && skipExisting;
                  return (
                    <label key={l.id} className={`flex items-center gap-2 px-3 py-1.5 pl-8 text-sm cursor-pointer hover:bg-muted/30 ${dimmed ? 'opacity-50' : ''}`}>
                      <Checkbox checked={selected.has(l.id) && !dimmed} disabled={dimmed} onCheckedChange={() => toggle(l.id)} />
                      <span className="font-mono text-[11px] text-muted-foreground w-16 shrink-0 truncate">
                        {l.it_project_id ? (projLabels.get(l.it_project_id) ?? '') : ''}
                      </span>
                      <span className="flex-1 truncate">
                        {[l.categorie, l.description || l.fournisseur_prevu].filter(Boolean).join(' · ')}
                      </span>
                      {exists && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">déjà en {targetAnnee}</span>
                      )}
                      <span className="tabular-nums text-xs text-muted-foreground shrink-0">
                        {eur(l.montant_annuel ?? l.montant_budget)}
                      </span>
                    </label>
                  );
                })}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={copying}>Annuler</Button>
          <Button onClick={runCopy} disabled={copying || nbSelEffective === 0}>
            {copying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Copy className="h-4 w-4 mr-2" />}
            Copier {nbSelEffective} ligne(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
