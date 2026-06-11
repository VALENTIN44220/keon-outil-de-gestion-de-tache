import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { History } from 'lucide-react';
import type { FdrChangelogAction } from '@/types/fdr';

interface ChangelogRow {
  id: string;
  action: FdrChangelogAction;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  project: { code_projet_digital: string; nom_projet: string } | null;
  user: { display_name: string } | null;
}

const ACTION_LABEL: Record<string, { label: string; className: string }> = {
  move:          { label: 'Décalage',     className: 'bg-violet-100 text-violet-700 border-violet-300' },
  resize:        { label: 'Durée',        className: 'bg-blue-100 text-blue-700 border-blue-300' },
  remove_fdr:    { label: 'Retrait FDR',  className: 'bg-red-100 text-red-700 border-red-300' },
  restore_fdr:   { label: 'Restauration', className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  change_status: { label: 'Statut',       className: 'bg-amber-100 text-amber-700 border-amber-300' },
  change_priority: { label: 'Priorité',   className: 'bg-amber-100 text-amber-700 border-amber-300' },
  shift_months:  { label: 'Décalage',     className: 'bg-violet-100 text-violet-700 border-violet-300' },
};

const FIELD_LABEL: Record<string, string> = {
  date_kickoff: 'Kickoff',
  date_mep_saisie: 'MEP saisie',
  echeance_cible: 'Échéance',
  delai_projete_mois: 'Délai (mois)',
  statut_portefeuille: 'Statut',
  sur_feuille_de_route: 'Sur FDR',
};

function useFdrChangelog(enabled: boolean) {
  return useQuery<ChangelogRow[]>({
    queryKey: ['fdr-changelog'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fdr_changelog')
        .select(`
          id, action, field_changed, old_value, new_value, created_at,
          project:it_projects(code_projet_digital, nom_projet),
          user:profiles(display_name)
        `)
        .order('created_at', { ascending: false })
        .limit(150);
      if (error) throw error;
      return (data ?? []) as unknown as ChangelogRow[];
    },
    staleTime: 15_000,
  });
}

function fmtValue(field: string, v: string | null): string {
  if (v == null || v === '') return '—';
  if (field === 'sur_feuille_de_route') return v === 'true' ? 'Oui' : 'Non';
  return v;
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

/** Panneau latéral : journal des arbitrages de la feuille de route (fdr_changelog). */
export function FdrHistorySheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: rows = [], isLoading } = useFdrChangelog(open);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <History className="h-3.5 w-3.5" />Historique
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[440px] sm:max-w-[440px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-violet-600" />
            Journal des arbitrages
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Toutes les modifications de la feuille de route : qui a déplacé quoi, quand.
            Utile pour tracer les décisions CODIR.
          </p>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          {!isLoading && rows.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">Aucune modification enregistrée.</p>
          )}
          {rows.map(r => {
            const a = ACTION_LABEL[r.action] ?? { label: r.action, className: 'bg-slate-100 text-slate-600 border-slate-300' };
            return (
              <div key={r.id} className="rounded-lg border border-border/50 p-2.5 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className={`border text-[9px] px-1.5 ${a.className}`}>{a.label}</Badge>
                  <span className="font-mono text-[10px] text-muted-foreground">{r.project?.code_projet_digital}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">{fmtDateTime(r.created_at)}</span>
                </div>
                <p className="font-medium truncate" title={r.project?.nom_projet ?? ''}>{r.project?.nom_projet ?? '—'}</p>
                <p className="text-muted-foreground">
                  {FIELD_LABEL[r.field_changed] ?? r.field_changed} :{' '}
                  <span className="line-through opacity-60">{fmtValue(r.field_changed, r.old_value)}</span>
                  {' → '}
                  <span className="font-semibold text-foreground">{fmtValue(r.field_changed, r.new_value)}</span>
                </p>
                {r.user?.display_name && (
                  <p className="text-[10px] text-muted-foreground">par {r.user.display_name}</p>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
