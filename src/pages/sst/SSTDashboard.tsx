/**
 * SSTDashboard — registre « REMONTEES DES SITUATIONS A RISQUES » (COPIL SST).
 * Liste filtrable + édition du traitement (état, arbre des causes, action,
 * validation CODIR). Création via /sst/new.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldAlert, Plus, Search, Loader2, Trash2, ListChecks, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import {
  useSituationsRisque, useUpdateSituationRisque, useDeleteSituationRisque,
} from '@/hooks/useSituationsRisque';
import {
  SST_TYPES, SST_ETATS, SST_ARBRE_CAUSES, SST_TYPE_COLORS, SST_ETAT_COLORS, type SituationRisque,
} from '@/types/sst';

export default function SSTDashboard() {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const [activeView, setActiveView] = useState('sst');
  const [fType, setFType] = useState<string>('all');
  const [fEtat, setFEtat] = useState<string>('all');
  const [search, setSearch] = useState('');
  const filters = useMemo(() => ({
    type: fType === 'all' ? undefined : fType,
    etat: fEtat === 'all' ? undefined : fEtat,
    search: search || undefined,
  }), [fType, fEtat, search]);

  const { items, isLoading, refetch } = useSituationsRisque(filters);
  const updateSituation = useUpdateSituationRisque();
  const deleteSituation = useDeleteSituationRisque();

  const [profilesMap, setProfilesMap] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('profiles').select('id, display_name');
      const m = new Map<string, string>();
      for (const p of data ?? []) m.set(p.id, p.display_name ?? '—');
      setProfilesMap(m);
    })();
  }, []);

  const [editItem, setEditItem] = useState<SituationRisque | null>(null);
  const [edit, setEdit] = useState<Partial<SituationRisque>>({});
  const [busy, setBusy] = useState(false);

  const openEdit = (it: SituationRisque) => {
    setEditItem(it);
    setEdit({ etat_avancement: it.etat_avancement, arbre_causes: it.arbre_causes ?? '', action: it.action ?? '', validation_codir: it.validation_codir ?? '' });
  };

  const saveEdit = async () => {
    if (!editItem) return;
    setBusy(true);
    const ok = await updateSituation(editItem.id, {
      etat_avancement: edit.etat_avancement,
      arbre_causes: (edit.arbre_causes as string) || null,
      action: (edit.action as string) || null,
      validation_codir: (edit.validation_codir as string) || null,
    });
    setBusy(false);
    if (ok) { setEditItem(null); refetch(); }
  };

  const handleDelete = async (it: SituationRisque) => {
    if (!confirm('Supprimer définitivement cette remontée ?')) return;
    if (await deleteSituation(it.id)) refetch();
  };

  const kpis = useMemo(() => ({
    total: items.length,
    aTraiter: items.filter((i) => i.etat_avancement === 'A TRAITER').length,
    enCours: items.filter((i) => i.etat_avancement === 'EN COURS').length,
    valide: items.filter((i) => i.etat_avancement === 'VALIDE').length,
  }), [items]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Situations à risque" searchQuery="" onSearchChange={() => {}} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="p-2 rounded-xl bg-orange-500/10"><ShieldAlert className="h-6 w-6 text-orange-600" /></div>
            <div className="mr-auto">
              <h1 className="text-2xl font-display font-bold">Remontées des situations à risque</h1>
              <p className="text-sm text-muted-foreground">COPIL SST</p>
            </div>
            <Button onClick={() => navigate('/sst/new')} className="gap-2">
              <Plus className="h-4 w-4" /> Nouvelle remontée
            </Button>
          </div>

          {/* KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: ListChecks, label: 'Total', value: kpis.total, color: 'bg-slate-100 text-slate-700' },
              { icon: AlertTriangle, label: 'À traiter', value: kpis.aTraiter, color: 'bg-red-100 text-red-700' },
              { icon: Clock, label: 'En cours', value: kpis.enCours, color: 'bg-amber-100 text-amber-700' },
              { icon: CheckCircle2, label: 'Validées', value: kpis.valide, color: 'bg-emerald-100 text-emerald-700' },
            ].map((k) => {
              const Icon = k.icon;
              return (
                <Card key={k.label}><CardContent className="p-3 flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg', k.color)}><Icon className="h-4 w-4" /></div>
                  <div><p className="text-xl font-bold">{k.value}</p><p className="text-xs text-muted-foreground">{k.label}</p></div>
                </CardContent></Card>
              );
            })}
          </div>

          {/* Filtres */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full sm:w-56">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="pl-8 h-9" />
            </div>
            <Select value={fType} onValueChange={setFType}>
              <SelectTrigger className="w-52 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {SST_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fEtat} onValueChange={setFEtat}>
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les états</SelectItem>
                {SST_ETATS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Liste */}
          <Card><CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Aucune remontée.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Titre</TableHead>
                    <TableHead>Société</TableHead><TableHead>Service</TableHead><TableHead>État</TableHead>
                    {isAdmin && <TableHead></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={it.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openEdit(it)}>
                      <TableCell className="text-xs whitespace-nowrap">{format(new Date(it.date_evenement), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                      <TableCell><Badge variant="outline" className={cn('text-[10px]', SST_TYPE_COLORS[it.type_situation])}>{it.type_situation}</Badge></TableCell>
                      <TableCell className="font-medium max-w-[260px] truncate">{it.titre ?? '—'}</TableCell>
                      <TableCell className="text-xs">{it.societe ?? '—'}</TableCell>
                      <TableCell className="text-xs">{it.service ?? '—'}</TableCell>
                      <TableCell><Badge variant="outline" className={cn('text-[10px]', SST_ETAT_COLORS[it.etat_avancement])}>{it.etat_avancement}</Badge></TableCell>
                      {isAdmin && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => handleDelete(it)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </main>
      </div>

      {/* Dialog d'édition / traitement */}
      <Dialog open={!!editItem} onOpenChange={(o) => { if (!o) setEditItem(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editItem && <Badge variant="outline" className={cn('text-[10px]', SST_TYPE_COLORS[editItem.type_situation])}>{editItem.type_situation}</Badge>}
              {editItem?.titre ?? 'Remontée'}
            </DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div><span className="text-muted-foreground">Date : </span>{format(new Date(editItem.date_evenement), 'dd/MM/yyyy', { locale: fr })}</div>
                <div><span className="text-muted-foreground">Société : </span>{editItem.societe ?? '—'}</div>
                <div><span className="text-muted-foreground">Service : </span>{editItem.service ?? '—'}</div>
                <div><span className="text-muted-foreground">Lieu : </span>{editItem.lieu_environnement ?? '—'}</div>
                <div><span className="text-muted-foreground">Projet : </span>{editItem.projet ?? '—'}</div>
                <div><span className="text-muted-foreground">Victime KEON : </span>{editItem.victime_keon_id ? (profilesMap.get(editItem.victime_keon_id) ?? '—') : (editItem.victime_externe ?? '—')}</div>
                <div><span className="text-muted-foreground">Témoin : </span>{editItem.temoin_id ? (profilesMap.get(editItem.temoin_id) ?? '—') : '—'}</div>
              </div>
              {editItem.circonstances && <div><p className="text-xs text-muted-foreground">Circonstances</p><p className="whitespace-pre-wrap">{editItem.circonstances}</p></div>}
              {editItem.lesions && <div><p className="text-xs text-muted-foreground">Lésions</p><p className="whitespace-pre-wrap">{editItem.lesions}</p></div>}

              <div className="pt-2 border-t space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>État d'avancement</Label>
                    <Select value={edit.etat_avancement ?? ''} onValueChange={(val) => setEdit((p) => ({ ...p, etat_avancement: val }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{SST_ETATS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Arbre des causes</Label>
                    <Select value={(edit.arbre_causes as string) ?? ''} onValueChange={(val) => setEdit((p) => ({ ...p, arbre_causes: val }))}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{SST_ARBRE_CAUSES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Action</Label>
                  <Textarea rows={2} value={(edit.action as string) ?? ''} onChange={(e) => setEdit((p) => ({ ...p, action: e.target.value }))} />
                </div>
                <div>
                  <Label>Validation CODIR</Label>
                  <Textarea rows={2} value={(edit.validation_codir as string) ?? ''} onChange={(e) => setEdit((p) => ({ ...p, validation_codir: e.target.value }))} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)} disabled={busy}>Fermer</Button>
            <Button onClick={saveEdit} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
