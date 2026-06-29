import { useMemo, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Bug, Plus, Search } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/hooks/useUserRole';
import { useBugReports } from '@/hooks/useBugReports';
import { BugReportForm } from '@/components/bugs/BugReportForm';
import { BugReportDetail } from '@/components/bugs/BugReportDetail';
import {
  BUG_TYPE_CONFIG, BUG_STATUS_CONFIG, BUG_PRIORITY_CONFIG,
  BUG_STATUS_OPTIONS, BUG_PRIORITY_OPTIONS, BUG_TYPE_OPTIONS,
  type BugReport,
} from '@/types/bugReport';

const ALL = 'all';

export default function BugTracker() {
  const { isAdmin } = useUserRole();
  const { data: bugs = [], isLoading } = useBugReports();

  const [search, setSearch] = useState('');
  const [fType, setFType] = useState(ALL);
  const [fStatus, setFStatus] = useState(ALL);
  const [fPriority, setFPriority] = useState(ALL);
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<BugReport | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bugs.filter((b) => {
      if (fType !== ALL && b.type !== fType) return false;
      if (fStatus !== ALL && b.status !== fStatus) return false;
      if (fPriority !== ALL && b.priority !== fPriority) return false;
      if (q) {
        const hay = [b.ref, b.title, b.description, b.reporter?.display_name].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [bugs, search, fType, fStatus, fPriority]);

  // garde la sélection synchronisée avec les données rafraîchies (realtime)
  const selectedLive = selected ? bugs.find((b) => b.id === selected.id) ?? selected : null;

  const openCount = bugs.filter((b) => !['resolu', 'ferme', 'rejete'].includes(b.status)).length;

  return (
    <Layout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b bg-background/95 backdrop-blur">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-lg">
                <Bug className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Bugs & améliorations</h1>
                <p className="text-sm text-muted-foreground">
                  {bugs.length} ticket(s) · {openCount} en cours de traitement
                </p>
              </div>
            </div>
            <Button onClick={() => setShowNew(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Nouveau signalement
            </Button>
          </div>

          {/* Filtres */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-xs w-[220px] pl-8" />
            </div>
            <Select value={fType} onValueChange={setFType}>
              <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous types</SelectItem>
                {BUG_TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{BUG_TYPE_CONFIG[t].label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous statuts</SelectItem>
                {BUG_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{BUG_STATUS_CONFIG[s].label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fPriority} onValueChange={setFPriority}>
              <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue placeholder="Priorité" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Toutes priorités</SelectItem>
                {BUG_PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{BUG_PRIORITY_CONFIG[p].label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                        <th className="text-left px-3 py-2 font-medium">Réf.</th>
                        <th className="text-left px-3 py-2 font-medium">Titre</th>
                        <th className="text-left px-3 py-2 font-medium">Type</th>
                        <th className="text-left px-3 py-2 font-medium">Priorité</th>
                        <th className="text-left px-3 py-2 font-medium">Statut</th>
                        <th className="text-left px-3 py-2 font-medium">Demandeur</th>
                        <th className="text-left px-3 py-2 font-medium">Assigné</th>
                        <th className="text-left px-3 py-2 font-medium">Créé le</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((b) => {
                        const tc = BUG_TYPE_CONFIG[b.type];
                        const sc = BUG_STATUS_CONFIG[b.status];
                        const pc = BUG_PRIORITY_CONFIG[b.priority];
                        return (
                          <tr key={b.id} onClick={() => setSelected(b)}
                            className="border-b hover:bg-muted/30 cursor-pointer transition-colors">
                            <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{b.ref}</td>
                            <td className="px-3 py-2.5 font-medium max-w-[320px] truncate">{b.title}</td>
                            <td className="px-3 py-2.5"><Badge className={cn(tc.className, 'border text-[10px]')}>{tc.icon} {tc.label}</Badge></td>
                            <td className="px-3 py-2.5"><Badge className={cn(pc.className, 'border text-[10px]')}>{pc.label}</Badge></td>
                            <td className="px-3 py-2.5"><Badge className={cn(sc.className, 'border text-[10px]')}>{sc.label}</Badge></td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground truncate max-w-[140px]">{b.reporter?.display_name ?? '—'}</td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground truncate max-w-[140px]">{b.assignee?.display_name ?? '—'}</td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground">{b.created_at ? format(new Date(b.created_at), 'dd/MM/yy', { locale: fr }) : '—'}</td>
                          </tr>
                        );
                      })}
                      {filtered.length === 0 && (
                        <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Aucun ticket ne correspond aux filtres.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Nouveau signalement */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Bug className="h-4 w-4 text-red-500" /> Nouveau signalement
            </DialogTitle>
          </DialogHeader>
          <BugReportForm onCreated={() => setShowNew(false)} onCancel={() => setShowNew(false)} />
        </DialogContent>
      </Dialog>

      {/* Détail */}
      <BugReportDetail bug={selectedLive} open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }} isAdmin={isAdmin} />
    </Layout>
  );
}
