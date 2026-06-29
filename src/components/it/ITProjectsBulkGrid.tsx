/**
 * ITProjectsBulkGrid — Grille d'édition en masse des projets IT.
 *
 * Mode « édition + sauvegarde groupée » : chaque cellule est éditable, les
 * modifications sont surlignées et bufferisées dans un état local `edits` ;
 * un bouton « Enregistrer N modification(s) » applique tout d'un coup via
 * `updateProject` (hook useITProjects). Colonnes configurables + tri local.
 *
 * Reçoit la liste DÉJÀ filtrée par la page (réutilise les filtres existants).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  ArrowUpDown, Columns3, Save, RotateCcw, Loader2, ExternalLink, Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  ITProject, ITProjectPriority, IT_PROJECT_PRIORITY_CONFIG, IT_PROJECT_PILIER_CONFIG,
  FDR_ANNEE_OPTIONS, FDR_ETAT_CONFIG, type FdrEtat,
} from '@/types/itProject';
import { ACTIVITES_METIER, STATUT_PORTEFEUILLE_CONFIG, type StatutPortefeuille } from '@/types/fdr';
import { useITProjects } from '@/hooks/useITProjects';
import { useFdrProfils } from '@/hooks/useFdrSettings';
import { useITActivites } from '@/hooks/useITActivites';

const LS_COLS = 'it_projects_grid_cols_v1';
const NONE = '__none__';

type Editor = 'text' | 'number' | 'pct' | 'date' | 'switch' | 'select' | 'profil';
type Opt = { value: string; label: string };

interface GridCol {
  key: keyof ITProject;
  label: string;
  editor: Editor;
  defaultVisible: boolean;
  width: number;
  options?: Opt[];
}

const PRIORITE_OPTS: Opt[] = (Object.entries(IT_PROJECT_PRIORITY_CONFIG) as [ITProjectPriority, { label: string }][])
  .map(([k, c]) => ({ value: k, label: c.label }));
const STATUT_OPTS: Opt[] = (Object.keys(STATUT_PORTEFEUILLE_CONFIG) as StatutPortefeuille[])
  .map(k => ({ value: k, label: k }));
const PILIER_OPTS: Opt[] = Object.entries(IT_PROJECT_PILIER_CONFIG).map(([k, c]) => ({ value: k, label: `${k} — ${c.label}` }));
const ACTIVITE_OPTS: Opt[] = ACTIVITES_METIER.map(a => ({ value: a, label: a }));
const CATEGORIE_OPTS: Opt[] = [{ value: 'IA', label: 'IA' }, { value: 'HORS IA', label: 'HORS IA' }];
const FDR_ANNEE_OPTS: Opt[] = FDR_ANNEE_OPTIONS.map(y => ({ value: y, label: y }));
const FDR_ETAT_OPTS: Opt[] = (Object.entries(FDR_ETAT_CONFIG) as [FdrEtat, { label: string }][])
  .map(([k, c]) => ({ value: k, label: c.label }));

const COLUMNS: GridCol[] = [
  { key: 'nom_projet', label: 'Nom', editor: 'text', defaultVisible: true, width: 240 },
  { key: 'statut_portefeuille', label: 'Statut portefeuille', editor: 'select', defaultVisible: true, width: 170, options: STATUT_OPTS },
  { key: 'categorie_fdr', label: 'Catégorie', editor: 'select', defaultVisible: true, width: 120, options: CATEGORIE_OPTS },
  { key: 'activite_metier', label: 'Activité métier', editor: 'select', defaultVisible: true, width: 180, options: ACTIVITE_OPTS },
  { key: 'pilier', label: 'Pilier', editor: 'select', defaultVisible: true, width: 150, options: PILIER_OPTS },
  { key: 'priorite', label: 'Priorité', editor: 'select', defaultVisible: true, width: 120, options: PRIORITE_OPTS },
  { key: 'sur_feuille_de_route', label: 'Sur FDR', editor: 'switch', defaultVisible: true, width: 90 },
  { key: 'date_kickoff', label: 'Kickoff', editor: 'date', defaultVisible: true, width: 150 },
  { key: 'delai_projete_mois', label: 'Délai (mois)', editor: 'number', defaultVisible: true, width: 110 },
  { key: 'date_mep_saisie', label: 'MEP saisie', editor: 'date', defaultVisible: true, width: 150 },
  { key: 'echeance_cible', label: 'Échéance cible', editor: 'date', defaultVisible: true, width: 150 },
  { key: 'suivi_j_mois', label: 'Suivi (j/mois)', editor: 'number', defaultVisible: true, width: 110 },
  { key: 'profil_principal', label: 'Profil principal', editor: 'profil', defaultVisible: true, width: 170 },
  { key: 'externe', label: 'Externe', editor: 'switch', defaultVisible: true, width: 90 },
  { key: 'pct_reduction_si_externe', label: 'Réduction %', editor: 'pct', defaultVisible: true, width: 110 },
  { key: 'budget_externe_eur', label: 'Budget ext. (€)', editor: 'number', defaultVisible: true, width: 130 },
  { key: 'pct_avancement', label: '% Avancement', editor: 'number', defaultVisible: true, width: 110 },
  // Off par défaut
  { key: 'fdr_annee', label: 'Année FDR', editor: 'select', defaultVisible: false, width: 120, options: FDR_ANNEE_OPTS },
  { key: 'fdr_etat', label: 'État FDR', editor: 'select', defaultVisible: false, width: 130, options: FDR_ETAT_OPTS },
  { key: 'budget_previsionnel', label: 'Budget prév. (€)', editor: 'number', defaultVisible: false, width: 130 },
  { key: 'chef_projet_it_id', label: 'Chef IT', editor: 'profil', defaultVisible: false, width: 180 },
  { key: 'chef_projet_metier_id', label: 'Chef métier', editor: 'profil', defaultVisible: false, width: 180 },
];

type EditMap = Record<string, Partial<ITProject>>;

export function ITProjectsBulkGrid({ projects }: { projects: ITProject[] }) {
  const { updateProject } = useITProjects();
  const { data: fdrProfils = [] } = useFdrProfils();
  const { activeLabels: activiteLabels } = useITActivites();
  const activiteOpts: Opt[] = useMemo(() => activiteLabels.map(a => ({ value: a, label: a })), [activiteLabels]);
  const profilOptions: Opt[] = useMemo(
    () => [{ value: NONE, label: '— Aucun —' }, ...fdrProfils.filter(p => p.actif).map(p => ({ value: p.code, label: p.nom }))],
    [fdrProfils],
  );

  // Collaborateurs (pour Chef IT / Chef métier) — chargés une fois
  const [people, setPeople] = useState<Opt[]>([]);
  useEffect(() => {
    supabase.from('profiles').select('id, display_name').eq('status', 'active').order('display_name')
      .then(({ data }) => setPeople([{ value: NONE, label: '— Aucun —' }, ...(data ?? []).map(p => ({ value: p.id, label: p.display_name }))]));
  }, []);

  // Colonnes visibles (persistées)
  const [visible, setVisible] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(LS_COLS);
      if (raw) return new Set(JSON.parse(raw));
    } catch { /* ignore */ }
    return new Set(COLUMNS.filter(c => c.defaultVisible).map(c => c.key as string));
  });
  const toggleCol = (key: string) => setVisible(s => {
    const n = new Set(s);
    n.has(key) ? n.delete(key) : n.add(key);
    localStorage.setItem(LS_COLS, JSON.stringify([...n]));
    return n;
  });
  const cols = COLUMNS
    .filter(c => visible.has(c.key as string))
    .map(c => (c.key === 'activite_metier' ? { ...c, options: activiteOpts } : c));

  // Tri local (sur les valeurs d'origine, pour ne pas faire sauter les lignes en cours d'édition)
  const [sortKey, setSortKey] = useState<keyof ITProject>('code_projet_digital');
  const [sortAsc, setSortAsc] = useState(true);
  const toggleSort = (key: keyof ITProject) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  };
  const sorted = useMemo(() => {
    return [...projects].sort((a, b) => {
      const va = (a[sortKey] ?? '') as any;
      const vb = (b[sortKey] ?? '') as any;
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [projects, sortKey, sortAsc]);

  // Édition bufferisée
  const [edits, setEdits] = useState<EditMap>({});
  const [saving, setSaving] = useState(false);

  const getVal = (p: ITProject, key: keyof ITProject) =>
    (key in (edits[p.id] ?? {}) ? edits[p.id][key] : p[key]);

  const setVal = (p: ITProject, key: keyof ITProject, value: unknown) => {
    setEdits(prev => {
      const row: Partial<ITProject> = { ...prev[p.id] };
      const original = p[key] ?? null;
      const norm = value === '' ? null : value;
      if (norm === original || (norm == null && original == null)) {
        delete (row as any)[key];
      } else {
        (row as any)[key] = norm;
      }
      const next = { ...prev };
      if (Object.keys(row).length === 0) delete next[p.id];
      else next[p.id] = row;
      return next;
    });
  };

  const dirtyIds = Object.keys(edits);
  const isDirty = (p: ITProject, key: keyof ITProject) => edits[p.id] && key in edits[p.id];

  const save = async () => {
    if (dirtyIds.length === 0) return;
    setSaving(true);
    let ok = 0; let ko = 0;
    await Promise.all(dirtyIds.map(async id => {
      const res = await updateProject(id, edits[id]);
      if (res) ok++; else ko++;
    }));
    setSaving(false);
    setEdits({});
    toast({
      title: `${ok} projet${ok > 1 ? 's' : ''} mis à jour`,
      description: ko > 0 ? `${ko} échec(s)` : undefined,
      variant: ko > 0 ? 'destructive' : undefined,
    });
  };

  return (
    <div className="space-y-3">
      {/* Barre d'action */}
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Columns3 className="h-3.5 w-3.5" /> Colonnes ({cols.length})
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 max-h-80 overflow-y-auto p-2" align="start">
            <p className="text-xs font-medium text-muted-foreground px-1 pb-1">Colonnes affichées</p>
            {COLUMNS.map(c => (
              <label key={c.key as string} className="flex items-center gap-2 rounded px-1 py-1 text-xs cursor-pointer hover:bg-muted/50">
                <Checkbox checked={visible.has(c.key as string)} onCheckedChange={() => toggleCol(c.key as string)} />
                {c.label}
              </label>
            ))}
          </PopoverContent>
        </Popover>

        <span className="text-xs text-muted-foreground">{sorted.length} projet{sorted.length > 1 ? 's' : ''}</span>

        <div className="ml-auto flex items-center gap-2">
          {dirtyIds.length > 0 && (
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setEdits({})} disabled={saving}>
              <RotateCcw className="h-3.5 w-3.5" /> Annuler
            </Button>
          )}
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={save} disabled={dirtyIds.length === 0 || saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Enregistrer {dirtyIds.length > 0 ? `${dirtyIds.length} modification${dirtyIds.length > 1 ? 's' : ''}` : ''}
          </Button>
        </div>
      </div>

      {/* Grille */}
      <div className="overflow-auto border rounded-lg max-h-[calc(100vh-280px)]">
        <table className="text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              <th className="text-left px-2 py-2 font-medium text-muted-foreground sticky left-0 bg-muted z-20 min-w-[130px] border-r">
                <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort('code_projet_digital')}>
                  Code <ArrowUpDown className={cn('h-3 w-3', sortKey === 'code_projet_digital' ? 'text-violet-600' : 'opacity-30')} />
                </button>
              </th>
              {cols.map(c => (
                <th key={c.key as string} className="text-left px-2 py-2 font-medium text-muted-foreground whitespace-nowrap" style={{ minWidth: c.width }}>
                  <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(c.key)}>
                    {c.label} <ArrowUpDown className={cn('h-3 w-3', sortKey === c.key ? 'text-violet-600' : 'opacity-30')} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => {
              const rowDirty = !!edits[p.id];
              return (
                <tr key={p.id} className={cn('border-t border-border/40', rowDirty && 'bg-violet-50/40')}>
                  <td className={cn('px-2 py-1 sticky left-0 z-10 border-r', rowDirty ? 'bg-violet-50/60' : 'bg-background')}>
                    <Link to={`/it/projects/${p.code_projet_digital}/overview`}
                      className="font-mono text-violet-600 hover:underline inline-flex items-center gap-1">
                      {p.code_projet_digital}
                      <ExternalLink className="h-3 w-3 opacity-50" />
                    </Link>
                  </td>
                  {cols.map(c => (
                    <td key={c.key as string} className={cn('px-1.5 py-1', isDirty(p, c.key) && 'bg-violet-100/60')}>
                      <CellEditor
                        col={c}
                        value={getVal(p, c.key)}
                        onChange={(v) => setVal(p, c.key, v)}
                        profilOptions={profilOptions}
                        people={people}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={cols.length + 1} className="text-center py-10 text-muted-foreground">Aucun projet ne correspond aux filtres.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        <Pencil className="h-3 w-3" /> Modifiez les cellules puis « Enregistrer ». Les lignes modifiées sont surlignées.
      </p>
    </div>
  );
}

// ── Éditeur de cellule ──────────────────────────────────────────────────────

function CellEditor({
  col, value, onChange, profilOptions, people,
}: {
  col: GridCol;
  value: unknown;
  onChange: (v: unknown) => void;
  profilOptions: Opt[];
  people: Opt[];
}) {
  switch (col.editor) {
    case 'text':
      return <Input value={(value as string) ?? ''} onChange={e => onChange(e.target.value)} className="h-7 text-xs min-w-[200px]" />;
    case 'number':
      return (
        <Input type="number" value={value == null ? '' : String(value)} onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
          className="h-7 text-xs w-24 text-right tabular-nums" />
      );
    case 'pct':
      return (
        <Input type="number" min={0} max={100} step={5}
          value={value == null ? '' : String(Math.round((value as number) * 100))}
          onChange={e => onChange(e.target.value === '' ? null : (Number(e.target.value) || 0) / 100)}
          className="h-7 text-xs w-20 text-right tabular-nums" />
      );
    case 'date':
      return (
        <Input type="date" value={value ? String(value).slice(0, 10) : ''} onChange={e => onChange(e.target.value || null)}
          className="h-7 text-xs w-[140px]" />
      );
    case 'switch':
      return <Switch checked={!!value} onCheckedChange={v => onChange(v)} />;
    case 'select': {
      const opts = col.options ?? [];
      return (
        <Select value={(value as string) || NONE} onValueChange={v => onChange(v === NONE ? null : v)}>
          <SelectTrigger className="h-7 text-xs" style={{ minWidth: col.width - 20 }}><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value={NONE}>— Non défini —</SelectItem>
            {opts.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    case 'profil': {
      const opts = col.key === 'profil_principal' ? profilOptions : people;
      return (
        <SearchableSelect
          value={(value as string) || NONE}
          onValueChange={v => onChange(v === NONE ? null : v)}
          options={opts}
          placeholder="—"
          searchPlaceholder="Rechercher…"
          triggerClassName="h-7 text-xs"
        />
      );
    }
    default:
      return <span className="text-muted-foreground">—</span>;
  }
}
