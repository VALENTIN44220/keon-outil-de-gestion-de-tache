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
import { Loader2, Search, Inbox, Clock, ShieldCheck, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
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

export function MyRequestsPanel({ currentUserId, className }: MyRequestsPanelProps) {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchRequests = useCallback(async () => {
    if (!currentUserId) { setRequests([]); setIsLoading(false); return; }
    setIsLoading(true);
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
      setIsLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => { void fetchRequests(); }, [fetchRequests]);

  // Mise à jour live du statut des demandes du demandeur.
  useEffect(() => {
    if (!currentUserId) return;
    const ch = supabase
      .channel(`my-requests-panel-${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: 'type=eq.request' }, () => {
        void fetchRequests();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentUserId, fetchRequests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) => r.title?.toLowerCase().includes(q));
  }, [requests, search]);

  const grouped = useMemo(() => {
    return BUCKETS.map((b) => ({
      ...b,
      items: filtered.filter((r) => b.statuses.includes(r.status)),
    })).filter((b) => b.items.length > 0);
  }, [filtered]);

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

      {grouped.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Aucune demande ne correspond à la recherche.</div>
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
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {b.items.map((r) => {
                  const mod = MODULE_META[(r as any).module_code ?? ''];
                  const statusColor = TASK_STATUS_COLORS[r.status as keyof typeof TASK_STATUS_COLORS];
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => navigate(`/demande/${r.id}`)}
                      className="text-left rounded-xl border bg-card hover:shadow-md hover:border-primary/40 transition-all p-3 flex items-start gap-2.5 group"
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
                        <p className="font-medium text-sm leading-snug line-clamp-2">{r.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Créée le {format(new Date(r.created_at), 'dd MMM yyyy', { locale: fr })}
                        </p>
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
