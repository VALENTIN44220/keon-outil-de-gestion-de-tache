/**
 * ITDispatch — vue de dispatch des demandes IT.
 *
 * KPIs + filtres (statut, prestation, demandeur) + tableau extensible.
 * Workflow par boutons : todo -> en_cours -> en_attente_complement /
 * en_attente_retour_externe -> realisee.
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Monitor, Plus, Search, RefreshCw, Loader2, Clock, CheckCircle2, ListChecks, AlertCircle, ChevronRight, ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useITRequests, ITRequest, IT_PRESTATIONS } from '@/hooks/useITRequests';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STATUS_LABELS: Record<string, string> = {
  todo: 'Affectée',
  in_progress: 'En cours',
  'in-progress': 'En cours',
  en_attente_complement_demandeur: 'Attente compléments',
  en_attente_retour_externe: 'Attente tiers',
  realisee: 'Réalisée',
  done: 'Terminée',
  cancelled: 'Annulée',
};

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-blue-100 text-blue-800 border-blue-300',
  in_progress: 'bg-violet-100 text-violet-800 border-violet-300',
  'in-progress': 'bg-violet-100 text-violet-800 border-violet-300',
  en_attente_complement_demandeur: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  en_attente_retour_externe: 'bg-orange-100 text-orange-800 border-orange-300',
  realisee: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  done: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-gray-100 text-gray-700 border-gray-300',
};

export default function ITDispatch() {
  const navigate = useNavigate();
  const { requests, isLoading, refetch } = useITRequests();
  const [activeView, setActiveView] = useState('it-dispatch');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPrestation, setFilterPrestation] = useState('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterPrestation !== 'all' && r.source_process_template_id !== filterPrestation) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!r.title?.toLowerCase().includes(q) &&
            !r.description?.toLowerCase().includes(q) &&
            !(r.module_data?.prestation as string)?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [requests, filterStatus, filterPrestation, search]);

  const kpis = useMemo(() => {
    const actives = requests.filter(r => !['realisee', 'done', 'cancelled'].includes(r.status)).length;
    const enCours = requests.filter(r => ['in_progress', 'in-progress'].includes(r.status)).length;
    const enAttente = requests.filter(r => ['en_attente_complement_demandeur', 'en_attente_retour_externe'].includes(r.status)).length;
    const realiseesMois = requests.filter(r => {
      if (!['realisee', 'done'].includes(r.status)) return false;
      const d = new Date(r.updated_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return { actives, enCours, enAttente, realiseesMois };
  }, [requests]);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      toast.success(`Statut → ${STATUS_LABELS[newStatus] ?? newStatus}`);
      refetch();
    } catch (e: any) {
      toast.error(`Erreur : ${e.message}`);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const KpiCard = ({ icon: Icon, label, value, color }: any) => (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn('p-2 rounded-lg shrink-0', color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Demandes IT" searchQuery="" onSearchChange={() => {}} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/10">
                  <Monitor className="h-6 w-6 text-cyan-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-display font-bold">IT — Demandes</h1>
                  <p className="text-sm text-muted-foreground">
                    7 prestations / auto-affectation à la cible
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={refetch}>
                  <RefreshCw className="h-4 w-4 mr-2" />Actualiser
                </Button>
                <Button onClick={() => navigate('/it/new')}>
                  <Plus className="h-4 w-4 mr-2" />Nouvelle demande
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard icon={ListChecks} label="Actives" value={kpis.actives} color="bg-slate-100 text-slate-700" />
              <KpiCard icon={Clock} label="En cours" value={kpis.enCours} color="bg-violet-100 text-violet-700" />
              <KpiCard icon={AlertCircle} label="En attente" value={kpis.enAttente} color="bg-amber-100 text-amber-700" />
              <KpiCard icon={CheckCircle2} label="Réalisées ce mois" value={kpis.realiseesMois} color="bg-emerald-100 text-emerald-700" />
            </div>

            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="Statut" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous statuts</SelectItem>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterPrestation} onValueChange={setFilterPrestation}>
                    <SelectTrigger className="w-[230px]"><SelectValue placeholder="Prestation" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes prestations</SelectItem>
                      {IT_PRESTATIONS.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Aucune demande IT.{' '}
                    <button className="text-primary underline" onClick={() => navigate('/it/new')}>
                      Créer une demande
                    </button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Demande</TableHead>
                        <TableHead>Prestation</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((r) => (
                        <RequestRow
                          key={r.id}
                          request={r}
                          expanded={expandedIds.has(r.id)}
                          onToggle={() => toggleExpand(r.id)}
                          onStatusChange={updateStatus}
                        />
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

function RequestRow({ request, expanded, onToggle, onStatusChange }: {
  request: ITRequest;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (id: string, newStatus: string) => void;
}) {
  const data = request.module_data ?? {};

  const renderActions = () => {
    switch (request.status) {
      case 'todo':
        return (
          <Button size="sm" onClick={(e) => { e.stopPropagation(); onStatusChange(request.id, 'in-progress'); }}>Démarrer</Button>
        );
      case 'in_progress':
      case 'in-progress':
        return (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onStatusChange(request.id, 'en_attente_complement_demandeur'); }}>Demander complément</Button>
            <Button size="sm" onClick={(e) => { e.stopPropagation(); onStatusChange(request.id, 'realisee'); }}>Réalisée</Button>
          </div>
        );
      case 'en_attente_complement_demandeur':
      case 'en_attente_retour_externe':
        return (
          <Button size="sm" onClick={(e) => { e.stopPropagation(); onStatusChange(request.id, 'in-progress'); }}>Reprendre</Button>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </TableCell>
        <TableCell className="font-medium max-w-[280px] truncate">{request.title}</TableCell>
        <TableCell>
          <Badge variant="outline" className="text-xs">{data.prestation ?? '—'}</Badge>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={cn('text-xs', STATUS_COLORS[request.status])}>
            {STATUS_LABELS[request.status] ?? request.status}
          </Badge>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {format(new Date(request.created_at), 'dd/MM/yyyy', { locale: fr })}
        </TableCell>
        <TableCell className="text-right">
          <div onClick={e => e.stopPropagation()}>
            {renderActions()}
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30 p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="col-span-2">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Description</p>
                <p>{request.description ?? '—'}</p>
              </div>
              {data.nom_dossier_sharepoint && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Dossier SharePoint</p>
                  <p>{data.nom_dossier_sharepoint}</p>
                </div>
              )}
              {data.emails_acces && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Emails accès</p>
                  <p className="text-xs">{data.emails_acces}</p>
                </div>
              )}
              {data.num_ticket_itp && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">N° ticket ITP</p>
                  <p>{data.num_ticket_itp}</p>
                </div>
              )}
              {data.num_ticket_blc && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">N° ticket BLC</p>
                  <p>{data.num_ticket_blc}</p>
                </div>
              )}
              {data.champ_complementaire_cible && (
                <div className="col-span-2">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Précisions cible</p>
                  <p>{data.champ_complementaire_cible}</p>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
