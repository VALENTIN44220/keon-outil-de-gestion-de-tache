/**
 * SMQDashboard — Page principale du module SMQ (Non-Conformités)
 *
 * Affiche : KPI cards + liste filtrable + bouton "Déclarer une NC".
 * Accessible à TOUS (Q2 user : tous peuvent déclarer + tous peuvent voir).
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, FileText, Clock, CheckCircle2, AlertTriangle, TrendingUp,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useNCDeclarations } from '@/hooks/useNCDeclarations';
import {
  NC_STATUS_META,
  NC_IDENTIFICATION_LABELS,
  NC_PROCESSUS,
  NC_SOCIETES,
  type NCStatus,
} from '@/types/smqNC';

export default function SMQDashboard() {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('smq');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<NCStatus | 'all'>('all');
  const [societeFilter, setSocieteFilter] = useState<string>('all');
  const [processusFilter, setProcessusFilter] = useState<string>('all');

  const { items, isLoading } = useNCDeclarations({
    status: statusFilter,
    societe: societeFilter === 'all' ? undefined : societeFilter,
    processus: processusFilter === 'all' ? undefined : processusFilter,
    search: search || undefined,
  });

  // KPI calculés sur la liste filtrée
  const kpi = useMemo(() => {
    const total = items.length;
    const ouvertes = items.filter(n => n.status !== 'cloturee').length;
    const enCours  = items.filter(n => n.status === 'en_cours').length;
    const clo      = items.filter(n => n.status === 'cloturee').length;

    const cloItems = items.filter(n => n.status === 'cloturee' && n.cloturee_at);
    const delaiMoyen = cloItems.length === 0 ? 0
      : Math.round(cloItems.reduce((sum, n) => sum + differenceInDays(parseISO(n.cloturee_at!), parseISO(n.created_at)), 0) / cloItems.length);

    return { total, ouvertes, enCours, clo, delaiMoyen };
  }, [items]);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="SMQ — Non-Conformités"
          searchQuery={search}
          onSearchChange={setSearch}
          onAddTask={() => navigate('/smq/new')}
          addButtonLabel="Déclarer une NC"
        />

        <main className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4">

          {/* ── KPI cards ────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <KPI icon={FileText}    label="Total"        value={kpi.total}     color="bg-slate-100 text-slate-700" />
            <KPI icon={AlertTriangle} label="Ouvertes"   value={kpi.ouvertes}  color="bg-amber-100 text-amber-700" />
            <KPI icon={Clock}       label="En cours"     value={kpi.enCours}   color="bg-indigo-100 text-indigo-700" />
            <KPI icon={CheckCircle2} label="Clôturées"   value={kpi.clo}       color="bg-emerald-100 text-emerald-700" />
            <KPI icon={TrendingUp}  label="Délai moyen"  value={kpi.delaiMoyen ? `${kpi.delaiMoyen} j` : '—'} color="bg-violet-100 text-violet-700" />
          </div>

          {/* ── Filtres ──────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 bg-card rounded-xl border p-3">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as NCStatus | 'all')}>
              <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                {(Object.entries(NC_STATUS_META) as [NCStatus, typeof NC_STATUS_META.nouvelle][]).map(([k, m]) => (
                  <SelectItem key={k} value={k}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={societeFilter} onValueChange={setSocieteFilter}>
              <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="Société" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes sociétés</SelectItem>
                {NC_SOCIETES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={processusFilter} onValueChange={setProcessusFilter}>
              <SelectTrigger className="w-72 h-9 text-sm"><SelectValue placeholder="Processus" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous processus</SelectItem>
                {NC_PROCESSUS.map(p => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="ml-auto text-sm text-muted-foreground">{items.length} NC</span>
          </div>

          {/* ── Liste ─────────────────────────────────────────────────── */}
          <div className="bg-card rounded-xl border divide-y">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Chargement…</div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucune NC trouvée</p>
                <Button size="sm" className="mt-3 gap-2" onClick={() => navigate('/smq/new')}>
                  <Plus className="h-4 w-4" />
                  Déclarer la première NC
                </Button>
              </div>
            ) : items.map((nc) => {
              const meta = NC_STATUS_META[nc.status];
              return (
                <button
                  key={nc.id}
                  onClick={() => navigate(`/smq/${nc.id}`)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors text-left"
                >
                  <Badge variant="outline" className="font-mono text-[10px] shrink-0">{nc.nc_number ?? '—'}</Badge>
                  <Badge variant="outline" className={cn('text-[10px] shrink-0', meta.color)}>{meta.label}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{nc.title}</p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                      {nc.identification && <span>{NC_IDENTIFICATION_LABELS[nc.identification]}</span>}
                      {nc.societe_code && <span>· {nc.societe_code}</span>}
                      {nc.processus_code && <span>· {nc.processus_code}</span>}
                      <span>· créée le {format(parseISO(nc.created_at), 'dd MMM yyyy', { locale: fr })}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number | string; color: string }) {
  return (
    <div className="bg-card rounded-xl border p-3 flex items-center gap-3">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xl font-bold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}
