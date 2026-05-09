/**
 * BudgetLineNdfPanel — rapprochement entre une ligne budgetaire IT et des NDF Lucca.
 *
 * Pour chaque mois (1..12), permet d'associer une ou plusieurs NDF Lucca
 * (table lucca_notes_frais) declarees dans le mois. Le total NDF rapproche
 * apparait par mois.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface NdfRow {
  id: string;
  numero: string | null;
  date_depense: string;
  montant_ht: number | null;
  display_name_extracted: string | null;
  libelle_ecriture: string | null;
}

interface MonthLink {
  id: string;          // it_budget_line_months.id
  mois: number;
  lucca_ndf_id: string | null;
  ndf?: NdfRow | null;
}

interface Props {
  budgetLineId: string | null;
  annee: number;
}

const MOIS_LABELS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export function BudgetLineNdfPanel({ budgetLineId, annee }: Props) {
  const [rows, setRows] = useState<MonthLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchByMonth, setSearchByMonth] = useState<Record<number, string>>({});
  const [candidatesByMonth, setCandidatesByMonth] = useState<Record<number, NdfRow[]>>({});

  // Charge les it_budget_line_months avec leur eventuelle NDF rapprochee
  useEffect(() => {
    if (!budgetLineId) return;
    setIsLoading(true);
    void supabase
      .from('it_budget_line_months')
      .select('id, mois, lucca_ndf_id')
      .eq('budget_line_id', budgetLineId)
      .order('mois')
      .then(async ({ data }) => {
        const months: MonthLink[] = (data ?? []) as any;
        // Resolve attached NDFs
        const ndfIds = months.map(m => m.lucca_ndf_id).filter(Boolean) as string[];
        let ndfMap = new Map<string, NdfRow>();
        if (ndfIds.length > 0) {
          const { data: ndfs } = await supabase
            .from('lucca_notes_frais')
            .select('id, numero, date_depense, montant_ht, display_name_extracted, libelle_ecriture')
            .in('id', ndfIds);
          for (const n of (ndfs ?? []) as NdfRow[]) ndfMap.set(n.id, n);
        }
        // Si certains mois manquent (1..12), on les complete (pas encore inseres en DB)
        const byMois = new Map<number, MonthLink>();
        for (const m of months) byMois.set(m.mois, { ...m, ndf: m.lucca_ndf_id ? ndfMap.get(m.lucca_ndf_id) ?? null : null });
        const full: MonthLink[] = Array.from({ length: 12 }, (_, i) => {
          const mois = i + 1;
          return byMois.get(mois) ?? { id: '', mois, lucca_ndf_id: null, ndf: null };
        });
        setRows(full);
        setIsLoading(false);
      });
  }, [budgetLineId]);

  // Recherche les candidats NDF pour un mois donne
  const fetchCandidates = async (mois: number, query: string) => {
    if (!query || query.trim().length < 2) {
      setCandidatesByMonth(prev => ({ ...prev, [mois]: [] }));
      return;
    }
    const startDate = `${annee}-${String(mois).padStart(2, '0')}-01`;
    const endDay = new Date(annee, mois, 0).getDate();
    const endDate = `${annee}-${String(mois).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    let req = supabase
      .from('lucca_notes_frais')
      .select('id, numero, date_depense, montant_ht, display_name_extracted, libelle_ecriture')
      .gte('date_depense', startDate)
      .lte('date_depense', endDate)
      .limit(20);

    const q = query.trim();
    if (/^\d+$/.test(q)) {
      // Recherche numerique : filtre par montant
      req = req.gte('montant_ht', Number(q) - 1).lte('montant_ht', Number(q) + 1);
    } else {
      req = req.or(`libelle_ecriture.ilike.%${q}%,display_name_extracted.ilike.%${q}%,numero.ilike.%${q}%`);
    }
    const { data } = await req;
    setCandidatesByMonth(prev => ({ ...prev, [mois]: (data ?? []) as NdfRow[] }));
  };

  const linkNdf = async (mois: number, ndf: NdfRow) => {
    if (!budgetLineId) return;
    // Upsert le mois (cree la ligne it_budget_line_months si elle n'existe pas)
    const { data, error } = await supabase
      .from('it_budget_line_months')
      .upsert(
        { budget_line_id: budgetLineId, mois, lucca_ndf_id: ndf.id, montant_budget: 0 },
        { onConflict: 'budget_line_id,mois' }
      )
      .select('id')
      .single();
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    setRows(prev => prev.map(r => r.mois === mois ? { ...r, id: (data as any).id, lucca_ndf_id: ndf.id, ndf } : r));
    setSearchByMonth(prev => ({ ...prev, [mois]: '' }));
    setCandidatesByMonth(prev => ({ ...prev, [mois]: [] }));
    toast({ title: 'NDF rapprochée' });
  };

  const unlinkNdf = async (mois: number) => {
    if (!budgetLineId) return;
    const { error } = await supabase
      .from('it_budget_line_months')
      .update({ lucca_ndf_id: null })
      .eq('budget_line_id', budgetLineId)
      .eq('mois', mois);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    setRows(prev => prev.map(r => r.mois === mois ? { ...r, lucca_ndf_id: null, ndf: null } : r));
    toast({ title: 'NDF détachée' });
  };

  const totalRapproche = useMemo(
    () => rows.reduce((acc, r) => acc + (Number(r.ndf?.montant_ht) || 0), 0),
    [rows]
  );

  if (!budgetLineId) {
    return <p className="text-sm text-muted-foreground py-4">Enregistre d'abord la ligne pour pouvoir rapprocher les NDF.</p>;
  }
  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Rapprochement avec les notes de frais Lucca déclarées dans la période.
        </p>
        <Badge variant="outline" className="text-xs">
          Total rapproché : {totalRapproche.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </Badge>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/30">
            <tr className="border-b">
              <th className="text-left p-2 w-32">Mois</th>
              <th className="text-left p-2">NDF rapprochée</th>
              <th className="text-right p-2 w-28">Montant HT</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.mois}>
                <td className="p-2 font-medium">{MOIS_LABELS[row.mois - 1]}</td>
                <td className="p-2">
                  {row.ndf ? (
                    <div>
                      <div className="text-sm">
                        {row.ndf.numero ?? '—'} · {row.ndf.libelle_ecriture ?? '—'}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {row.ndf.display_name_extracted ?? '—'} · {row.ndf.date_depense ? format(parseISO(row.ndf.date_depense), 'dd/MM/yyyy', { locale: fr }) : '—'}
                      </div>
                    </div>
                  ) : (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="outline" className="h-7">+ Rapprocher une NDF</Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[480px] p-2" side="left">
                        <div className="space-y-2">
                          <Input
                            placeholder="Recherche : libellé, demandeur, n°… ou montant"
                            value={searchByMonth[row.mois] ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSearchByMonth(prev => ({ ...prev, [row.mois]: v }));
                              void fetchCandidates(row.mois, v);
                            }}
                            className="h-8"
                          />
                          <div className="max-h-[280px] overflow-y-auto space-y-1">
                            {(candidatesByMonth[row.mois] ?? []).length === 0 && (searchByMonth[row.mois]?.length ?? 0) >= 2 && (
                              <p className="text-xs text-muted-foreground p-2">Aucune NDF trouvée pour ce mois.</p>
                            )}
                            {(candidatesByMonth[row.mois] ?? []).map((n) => (
                              <button
                                key={n.id}
                                onClick={() => linkNdf(row.mois, n)}
                                className="w-full text-left p-2 rounded hover:bg-accent text-xs border"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="font-medium truncate">{n.libelle_ecriture ?? n.numero ?? '—'}</div>
                                    <div className="text-[10px] text-muted-foreground">
                                      {n.display_name_extracted ?? '—'} · {n.date_depense ? format(parseISO(n.date_depense), 'dd/MM/yyyy', { locale: fr }) : '—'}
                                    </div>
                                  </div>
                                  <span className="font-mono text-xs whitespace-nowrap">
                                    {(Number(n.montant_ht) || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </td>
                <td className="p-2 text-right font-mono">
                  {row.ndf ? (Number(row.ndf.montant_ht) || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) : '—'}
                </td>
                <td className="p-2 text-right">
                  {row.ndf && (
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => unlinkNdf(row.mois)} title="Détacher">
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
