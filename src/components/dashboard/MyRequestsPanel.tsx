/**
 * MyRequestsPanel — suivi des demandes du demandeur courant, présenté en
 * cartes groupées par statut (remplace l'ancienne table dense de /mes-demandes).
 *
 * Utilisé à deux endroits :
 *  - onglet « Mes demandes » du tableau de bord (src/pages/Index.tsx)
 *  - page /mes-demandes (back-compat) qui réutilise ce composant
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/types/task';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, Inbox, Clock, ShieldCheck, CheckCircle2, XCircle, ChevronRight, LayoutGrid, Rows3, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getStatusLabel, TASK_STATUS_COLORS } from '@/services/taskStatusService';

/** Métadonnées d'affichage par module (badge). */
const MODULE_META: Record<string, { label: string; cls: string }> = {
  be: { label: 'BE', cls: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  it: { label: 'IT', cls: 'bg-cyan-100 text-cyan-700 border-cyan-300' },
  rh: { label: 'RH', cls: 'bg-rose-100 text-rose-700 border-rose-300' },
  maintenance: { label: 'Maintenance', cls: 'bg-amber-100 text-amber-700 border-amber-300' },
  logistique: { label: 'Logistique', cls: 'bg-blue-100 text-blue-700 border-blue-300' },
  innovation: { label: 'Innovation', cls: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  smq: { label: 'SMQ', cls: 'bg-red-100 text-red-700 border-red-300' },
  client: { label: 'Client', cls: 'bg-teal-100 text-teal-700 border-teal-300' },
  comm: { label: 'Comm', cls: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300' },
};

/** Regroupement des statuts en sections lisibles. */
const BUCKETS: Array<{ key: string; label: string; icon: typeof Inbox; statuses: string[] }> = [
  { key: 'active', label: 'En cours', icon: Clock, statuses: ['to_assign', 'todo', 'in-progress', 'review'] },
  { key: 'validation', label: 'En validation', icon: ShieldCheck, statuses: ['pending_validation_1', 'pending_validation_2'] },
  { key: 'done', label: 'Clôturées', icon: CheckCircle2, statuses: ['done', 'validated', 'cloturee', 'realisee'] },
  { key: 'refused', label: 'Refusées / Annulées', icon: XCircle, statuses: ['refused', 'cancelled'] },
];

interface MyRequestsPanelProps {
  currentUserId?: string | null;
  className?: string;
}

// Contexte de filtres persistant (BUG-00003) : mémorisé d'une session à
// l'autre → devient le contexte « standard » du demandeur.
const FILTERS_STORAGE_KEY = 'my-requests-filters';
type SavedFilters = { module: string; bucket: string; period: string; compact: boolean };
const DEFAULT_FILTERS: SavedFilters = { module: 'all', bucket: 'all', period: 'all', compact: false };
function loadSavedFilters(): SavedFilters {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;
    return { ...DEFAULT_FILTERS, ...JSON.parse(raw) };
  } catch { return DEFAULT_FILTERS; }
}

const PERIOD_OPTIONS: { value: string; label: string; days: number | null }[] = [
  { value: 'all', label: 'Toutes dates', days: null },
  { value: '30', label: '30 derniers jours', days: 30 },
  { value: '90', label: '90 derniers jours', days: 90 },
  { value: '365', label: '12 derniers mois', days: 365 },
];

export function MyRequestsPanel({ currentUserId, className }: MyRequestsPanelProps) {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Filtres (persistés). Chargés une fois depuis localStorage.
  const [moduleFilter, setModuleFilter] = useState<string>(() => loadSavedFilters().module);
  const [bucketFilter, setBucketFilter] = useState<string>(() => loadSavedFilters().bucket);
  const [periodFilter, setPeriodFilter] = useState<string>(() => loadSavedFilters().period);
  const [compact, setCompact] = useState<boolean>(() => loadSavedFilters().compact);

  // Sauvegarde du contexte à chaque changement → « contexte standard ».
  useEffect(() => {
    try {
      localStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({ module: moduleFilter, bucket: bucketFilter, period: periodFilter, compact }),
      );
    } catch { /* localStorage indisponible */ }
  }, [moduleFilter, bucketFilter, periodFilter, compact]);

  // silent = rafraîchissement en arrière-plan (temps réel) : on NE repasse PAS
  // en état « chargement » pour éviter que tout le panneau soit démonté puis
  // remonté à chaque événement — c'était la cause du clignotement (BUG-00016).
  const fetchRequests = useCallback(async (opts?: { silent?: boolean }) => {
    if (!currentUserId) { setRequests([]); setIsLoading(false); return; }
    if (!opts?.silent) setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('type', 'request')
        .eq('requester_id', currentUserId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRequests((data ?? []) as Task[]);
    } catch (e) {
      console.error('MyRequestsPanel fetch:', e);
    } finally {
      if (!opts?.silent) setIsLoading(false);
    }
  }, [currentUserId]);

  // Chargement initial uniquement : affiche le spinner une seule fois.
  useEffect(() => { void fetchRequests(); }, [fetchRequests]);

  // Mise à jour live des demandes du demandeur. Filtre limité à SES demandes
  // (requester_id) au lieu de tout `type=request` : moins de refetch inutiles.
  // Le refetch est « silencieux » → mise à jour en place, sans clignotement.
  useEffect(() => {
    if (!currentUserId) return;
    const ch = supabase
      .channel(`my-requests-panel-${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `requester_id=eq.${currentUserId}` }, () => {
        void fetchRequests({ silent: true });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentUserId, fetchRequests]);

  // Modules réellement présents dans les demandes du demandeur (pour le filtre).
  const availableModules = useMemo(() => {
    const set = new Set<string>();
    for (const r of requests) {
      const m = (r as any).module_code;
      if (m) set.add(m);
    }
    return Array.from(set).sort();
  }, [requests]);

  const periodCutoff = useMemo(() => {
    const opt = PERIOD_OPTIONS.find((p) => p.value === periodFilter);
    if (!opt?.days) return null;
    return Date.now() - opt.days * 24 * 60 * 60 * 1000;
  }, [periodFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const bucket = BUCKETS.find((b) => b.key === bucketFilter);
    return requests.filter((r) => {
      if (q && !r.title?.toLowerCase().includes(q)) return false;
      if (moduleFilter !== 'all' && (r as any).module_code !== moduleFilter) return false;
      if (bucket && !bucket.statuses.includes(r.status)) return false;
      if (periodCutoff && r.created_at && new Date(r.created_at).getTime() < periodCutoff) return false;
      return true;
    });
  }, [requests, search, moduleFilter, bucketFilter, periodCutoff]);

  const grouped = useMemo(() => {
    return BUCKETS.map((b) => ({
      ...b,
      items: filtered.filter((r) => b.statuses.includes(r.status)),
    })).filter((b) => b.items.length > 0);
  }, [filtered]);

  const hasActiveFilters = moduleFilter !== 'all' || bucketFilter !== 'all' || periodFilter !== 'all' || search.trim() !== '';
  const resetFilters = () => {
    setSearch(''); setModuleFilter('all'); setBucketFilter('all'); setPeriodFilter('all');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className={cn('py-10 text-center text-sm text-muted-foreground border border-dashed rounded-lg', className)}>
        <Inbox className="h-6 w-6 mx-auto mb-2 opacity-50" />
        Tu n'as pas encore créé de demandes.{' '}
        <button className="text-primary underline" onClick={() => navigate('/requests')}>Créer une demande</button>
      </div>
    );
  }

  return (
    <div className={cn('space-y-5', className)}>
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-bold tracking-tight">Suivi de mes demandes</h2>
        <Badge variant="secondary">{filtered.length}{filtered.length !== requests.length ? ` / ${requests.length}` : ''}</Badge>
        <div className="ml-auto relative w-full sm:w-64">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une demande…"
            className="pl-8 h-9"
          />
        </div>
      </div>

      {/* Barre de filtres — contexte mémorisé (BUG-00003) */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="h-8 w-auto min-w-[130px] text-xs"><SelectValue placeholder="Module" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les modules</SelectItem>
            {availableModules.map((m) => (
              <SelectItem key={m} value={m}>{MODULE_META[m]?.label ?? m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={bucketFilter} onValueChange={setBucketFilter}>
          <SelectTrigger className="h-8 w-auto min-w-[130px] text-xs"><SelectValue placeholder="État" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les états</SelectItem>
            {BUCKETS.map((b) => (
              <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="h-8 w-auto min-w-[130px] text-xs"><SelectValue placeholder="Période" /></SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground" onClick={resetFilters}>
            <X className="h-3.5 w-3.5 mr-1" /> Réinitialiser
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 text-xs ml-auto"
          onClick={() => setCompact((c) => !c)}
          title={compact ? 'Vue confortable' : 'Vue compacte'}
        >
          {compact ? <LayoutGrid className="h-3.5 w-3.5 mr-1" /> : <Rows3 className="h-3.5 w-3.5 mr-1" />}
          {compact ? 'Confortable' : 'Compact'}
        </Button>
      </div>

      {grouped.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Aucune demande ne correspond aux filtres.</div>
      ) : (
        grouped.map((b) => {
          const BucketIcon = b.icon;
          return (
            <section key={b.key} className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <BucketIcon className="h-4 w-4" />
                {b.label}
                <Badge variant="outline" className="text-[10px]">{b.items.length}</Badge>
              </div>
              <div className={cn(
                'grid gap-2.5',
                compact
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2'
                  : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
              )}>
                {b.items.map((r) => {
                  const mod = MODULE_META[(r as any).module_code ?? ''];
                  const statusColor = TASK_STATUS_COLORS[r.status as keyof typeof TASK_STATUS_COLORS];
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => navigate(`/demande/${r.id}`)}
                      className={cn(
                        'text-left rounded-xl border bg-card hover:shadow-md hover:border-primary/40 transition-all flex items-start gap-2.5 group',
                        compact ? 'p-2' : 'p-3',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          {mod && <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', mod.cls)}>{mod.label}</Badge>}
                          {statusColor && (
                            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', statusColor.bg, statusColor.text, statusColor.border)}>
                              {getStatusLabel(r.status)}
                            </Badge>
                          )}
                        </div>
                        <p className={cn('font-medium leading-snug', compact ? 'text-[13px] line-clamp-1' : 'text-sm line-clamp-2')}>{r.title}</p>
                        {!compact && (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Créée le {format(new Date(r.created_at), 'dd MMM yyyy', { locale: fr })}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
