/**
 * ITBudgetCopyYearDialog — copie des lignes budgétaires d'une année vers une autre.
 *
 * Mode « structure seulement » : copie la ligne (catégorie, fournisseur, description,
 * montant annuel, type) SANS la ventilation mensuelle détaillée (it_budget_line_months),
 * en remettant à zéro le statut (→ brouillon), les montants révisés/reforecast et TOUT
 * rapprochement (commandes / factures / NDF). Les regroupements sélectionnés sont
 * recréés sur l'année cible et remappés.
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

export function ITBudgetCopyYearDialog({ targetAnnee, open, onClose, onDone }: Props) {
  const [sourceAnnee, setSourceAnnee] = useState(targetAnnee - 1);
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [lines, setLines] = useState<SrcLine[]>([]);
  const [groupNames, setGroupNames] = useState<Map<string, string>>(new Map());
  const [projLabels, setProjLabels] = useState<Map<string, string>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => { if (open) setSourceAnnee(targetAnnee - 1); }, [open, targetAnnee]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      setLoading(true);
      try {
        const sb = supabase as any;
        const [linesRes, groupsRes, projRes] = await Promise.all([
          sb.from('it_budget_lines').select('*').eq('annee', sourceAnnee).order('categorie'),
          sb.from('it_budget_rapprochement_groups').select('id, nom').eq('exercice', sourceAnnee),
          sb.from('it_projects').select('id, nom_projet, code_projet_digital'),
        ]);
        const l = (linesRes.data ?? []) as SrcLine[];
        setLines(l);
        setSelected(new Set(l.map(x => x.id))); // tout sélectionné par défaut
        setGroupNames(new Map((groupsRes.data ?? []).map((g: any) => [g.id, g.nom])));
        setProjLabels(new Map((projRes.data ?? []).map((p: any) => [p.id, p.code_projet_digital || p.nom_projet || ''])));
      } catch (e: any) {
        toast.error(`Erreur : ${e.message ?? 'chargement'}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, sourceAnnee]);

  // Regroupe l'affichage par regroupement.
  const grouped = useMemo(() => {
    const m = new Map<string, SrcLine[]>();
    for (const l of lines) {
      const key = l.rapprochement_group_id ?? '__none__';
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(l);
    }
    return [...m.entries()];
  }, [lines]);

  const toggle = (id: string) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleGroup = (ids: string[], on: boolean) => setSelected(prev => {
    const n = new Set(prev); ids.forEach(id => on ? n.add(id) : n.delete(id)); return n;
  });

  const runCopy = async () => {
    const sel = lines.filter(l => selected.has(l.id));
    if (sel.length === 0) return;
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
      // 2) Insérer les lignes copiées (structure seulement, reset des champs d'année source).
      const rows = sel.map(l => {
        const row: any = { exercice: targetAnnee, annee: targetAnnee, statut: 'brouillon' };
        for (const f of STRUCT_FIELDS) row[f] = l[f];
        row.rapprochement_group_id = l.rapprochement_group_id ? (groupMap.get(l.rapprochement_group_id) ?? null) : null;
        row.montant_budget_revise = null;
        row.budget_type_revise = null;
        row.mois_budget_revise = null;
        row.is_reforecast = false;
        row.external_key = null;
        return row;
      });
      const { error: insErr } = await sb.from('it_budget_lines').insert(rows);
      if (insErr) throw insErr;

      toast.success(`${rows.length} ligne(s) copiée(s) vers ${targetAnnee}${groupMap.size ? ` · ${groupMap.size} regroupement(s)` : ''}`);
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(`Copie échouée : ${e.message ?? 'inconnue'}`);
    } finally {
      setCopying(false);
    }
  };

  const total = lines.length;
  const nbSel = selected.size;

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
          <span className="ml-auto text-xs text-muted-foreground">{nbSel}/{total} sélectionnée(s)</span>
        </div>

        <div className="flex-1 overflow-y-auto rounded-lg border divide-y min-h-[200px]">
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
                {gLines.map(l => (
                  <label key={l.id} className="flex items-center gap-2 px-3 py-1.5 pl-8 text-sm cursor-pointer hover:bg-muted/30">
                    <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggle(l.id)} />
                    <span className="font-mono text-[11px] text-muted-foreground w-16 shrink-0 truncate">
                      {l.it_project_id ? (projLabels.get(l.it_project_id) ?? '') : ''}
                    </span>
                    <span className="flex-1 truncate">
                      {[l.categorie, l.description || l.fournisseur_prevu].filter(Boolean).join(' · ')}
                    </span>
                    <span className="tabular-nums text-xs text-muted-foreground shrink-0">
                      {eur(l.montant_annuel ?? l.montant_budget)}
                    </span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Copie « structure seulement » : ni ventilation mensuelle, ni statut/révisions, ni rapprochements (commandes, factures, NDF).
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={copying}>Annuler</Button>
          <Button onClick={runCopy} disabled={copying || nbSel === 0}>
            {copying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Copy className="h-4 w-4 mr-2" />}
            Copier {nbSel} ligne(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
