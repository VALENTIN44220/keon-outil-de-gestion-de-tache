import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CalendarClock, Plus, Trash2, Users, FileText,
  Pencil, Loader2, ListChecks, Search, History,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import {
  useCGISessions, useCreateCGISession, useUpdateCGISession, useDeleteCGISession,
  useAllCGIActions, useCreateCGIAction, useUpdateCGIAction, useDeleteCGIAction,
  useCGIChanges, type CGIActionChange,
} from '@/hooks/useCGI';
import { CGI_FONCTIONS, type CGISession, type CGIParticipant } from '@/types/cgi';
import type { Task, TaskStatus } from '@/types/task';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  todo: { label: 'À faire', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  'in-progress': { label: 'En cours', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  done: { label: 'Fait', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
};

const CHANGE_LABELS: Record<string, { label: string; color: string }> = {
  created: { label: 'Ajoutée', color: 'bg-green-100 text-green-700' },
  status_changed: { label: 'Statut modifié', color: 'bg-blue-100 text-blue-700' },
  updated: { label: 'Modifiée', color: 'bg-amber-100 text-amber-700' },
  deleted: { label: 'Supprimée', color: 'bg-red-100 text-red-700' },
};

const NONE = '__none__';

function fmtDate(d?: string | null) {
  if (!d) return '—';
  try { return format(new Date(d), 'dd/MM/yyyy', { locale: fr }); } catch { return d; }
}

function trimLabel(t: string) {
  const q = Math.ceil((new Date(t).getMonth() + 1) / 3);
  return `${new Date(t).getFullYear()}-T${q}`;
}

export default function ITComiteGI() {
  const { isAdmin } = useUserRole();
  const { data: sessions = [], isLoading: sessionsLoading } = useCGISessions();
  const createSession = useCreateCGISession();
  const updateSession = useUpdateCGISession();
  const deleteSession = useDeleteCGISession();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewSession, setShowNewSession] = useState(false);
  const [editingSession, setEditingSession] = useState<CGISession | null>(null);

  const selected = useMemo(
    () => sessions.find((s) => s.id === selectedId) ?? null,
    [sessions, selectedId],
  );

  return (
    <Layout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b bg-background/95 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-500 text-white shadow-lg">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Comité de Gestion de l'Information</h1>
              <p className="text-sm text-muted-foreground">
                Suivi transversal des actions du GT GInfo
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="actions" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-3 border-b">
            <TabsList className="h-9">
              <TabsTrigger value="actions" className="gap-1.5 text-xs">
                <ListChecks className="h-3.5 w-3.5" /> Plan d'actions
              </TabsTrigger>
              <TabsTrigger value="seances" className="gap-1.5 text-xs">
                <CalendarClock className="h-3.5 w-3.5" /> Séances
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── Tab: Plan d'actions (transversal) ── */}
          <TabsContent value="actions" className="flex-1 overflow-y-auto p-6 mt-0">
            <ActionsTableView isAdmin={isAdmin} sessions={sessions} contextSessionId={null} />
          </TabsContent>

          {/* ── Tab: Séances ── */}
          <TabsContent value="seances" className="flex-1 overflow-hidden flex mt-0">
            {/* Left panel — sessions */}
            <div className="w-80 border-r overflow-y-auto p-4 space-y-2 shrink-0">
              {isAdmin && (
                <Button onClick={() => setShowNewSession(true)} className="gap-2 w-full mb-3" size="sm" variant="outline">
                  <Plus className="h-4 w-4" /> Nouvelle séance
                </Button>
              )}
              {sessionsLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)
              ) : sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucune séance.</p>
              ) : (
                sessions.map((s) => (
                  <Card
                    key={s.id}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-muted/40',
                      s.id === selectedId && 'ring-2 ring-sky-500/40 bg-sky-50/30',
                    )}
                    onClick={() => setSelectedId(s.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px] font-mono">{s.trimestre}</Badge>
                        <span className="text-[10px] text-muted-foreground">{fmtDate(s.date_seance)}</span>
                      </div>
                      {s.ordre_du_jour && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{s.ordre_du_jour}</p>
                      )}
                      <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {(s.participants as CGIParticipant[]).length} participant(s)
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Right panel — session detail + full action plan */}
            <div className="flex-1 overflow-y-auto p-6">
              {selected ? (
                <SessionDetail
                  session={selected}
                  sessions={sessions}
                  isAdmin={isAdmin}
                  onEdit={() => setEditingSession(selected)}
                  onDelete={() => {
                    if (confirm(`Supprimer la séance ${selected.trimestre} ?`)) {
                      deleteSession.mutate(selected.id);
                      setSelectedId(null);
                    }
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  {sessionsLoading ? 'Chargement…' : 'Sélectionnez une séance à gauche'}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <SessionFormDialog
        open={showNewSession}
        onOpenChange={setShowNewSession}
        onSubmit={async (data) => {
          await createSession.mutateAsync(data);
          setShowNewSession(false);
        }}
        isSubmitting={createSession.isPending}
      />

      {editingSession && (
        <SessionFormDialog
          open
          onOpenChange={() => setEditingSession(null)}
          initial={editingSession}
          onSubmit={async (data) => {
            await updateSession.mutateAsync({ id: editingSession.id, ...data });
            setEditingSession(null);
          }}
          isSubmitting={updateSession.isPending}
        />
      )}
    </Layout>
  );
}

// ─── Actions Table View (shared between tabs) ───────────────────

function ActionsTableView({
  isAdmin,
  sessions,
  contextSessionId,
}: {
  isAdmin: boolean;
  sessions: CGISession[];
  contextSessionId: string | null;
}) {
  const { data: actions = [], isLoading } = useAllCGIActions();
  const updateAction = useUpdateCGIAction();
  const deleteAction = useDeleteCGIAction();
  const createAction = useCreateCGIAction();
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    let list = actions;
    if (statusFilter !== 'all') {
      list = list.filter((a) => a.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => {
        const md = (a as any).module_data as Record<string, any> | null;
        return (
          a.title?.toLowerCase().includes(q) ||
          a.description?.toLowerCase().includes(q) ||
          md?.responsable_fonction?.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [actions, statusFilter, search]);

  const stats = useMemo(() => {
    const s = { todo: 0, 'in-progress': 0, done: 0 };
    actions.forEach((a) => { if (a.status in s) s[a.status as keyof typeof s]++; });
    return s;
  }, [actions]);

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Stats */}
      <div className="flex gap-3">
        {Object.entries(STATUS_MAP).map(([k, v]) => (
          <Card key={k} className="flex-1">
            <CardContent className="p-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{v.label}</span>
              <Badge className={cn(v.color, 'border text-sm font-semibold')}>{stats[k as keyof typeof stats]}</Badge>
            </CardContent>
          </Card>
        ))}
        <Card className="flex-1">
          <CardContent className="p-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total</span>
            <Badge variant="outline" className="text-sm font-semibold">{actions.length}</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 text-xs w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAdmin && (
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs ml-auto" onClick={() => setShowNew(true)}>
            <Plus className="h-3.5 w-3.5" /> Action
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="px-0 pb-0 pt-0">
          {isLoading ? (
            <div className="p-4"><Skeleton className="h-12" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Aucune action trouvée.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="text-left px-3 py-2 font-medium">Action</th>
                    <th className="text-left px-3 py-2 font-medium w-[160px]">Thème</th>
                    <th className="text-left px-3 py-2 font-medium w-[140px]">Responsable</th>
                    <th className="text-left px-3 py-2 font-medium w-[100px]">Échéance</th>
                    <th className="text-left px-3 py-2 font-medium w-[110px]">Statut</th>
                    {isAdmin && <th className="w-[60px]" />}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => {
                    const md = (a as any).module_data as Record<string, any> | null;
                    const fonction = md?.responsable_fonction ?? '—';
                    const sc = STATUS_MAP[a.status] ?? STATUS_MAP.todo;
                    return (
                      <tr key={a.id} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2.5">
                          <div className="font-medium">{a.title}</div>
                          {a.description && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{a.description}</p>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant="secondary" className="text-[10px]">{fonction}</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          {a.assignee_id ? <ProfileName profileId={a.assignee_id} /> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{fmtDate(a.due_date)}</td>
                        <td className="px-3 py-2.5">
                          <Select
                            value={a.status}
                            onValueChange={(v) =>
                              updateAction.mutate({ id: a.id, contextSessionId: contextSessionId ?? undefined, status: v as TaskStatus })
                            }
                          >
                            <SelectTrigger className="h-7 text-[11px] w-[100px]">
                              <Badge className={cn(sc.color, 'border text-[10px]')}>{sc.label}</Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(STATUS_MAP).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        {isAdmin && (
                          <td className="px-2 py-2.5 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                if (confirm('Supprimer cette action ?')) {
                                  deleteAction.mutate({ id: a.id, contextSessionId: contextSessionId ?? undefined });
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {sessions.length > 0 && (
        <ActionFormDialog
          open={showNew}
          onOpenChange={setShowNew}
          sessionId={sessions[0].id}
          sessions={sessions}
          contextSessionId={contextSessionId}
          onSubmit={async (data) => {
            await createAction.mutateAsync(data);
            setShowNew(false);
          }}
          isSubmitting={createAction.isPending}
        />
      )}
    </div>
  );
}

// ─── Session Detail ──────────────────────────────────────────────

function SessionDetail({
  session,
  sessions,
  isAdmin,
  onEdit,
  onDelete,
}: {
  session: CGISession;
  sessions: CGISession[];
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const participants = session.participants as CGIParticipant[];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{session.trimestre}</h2>
            <Badge variant="outline" className="text-xs">{fmtDate(session.date_seance)}</Badge>
          </div>
          {session.ordre_du_jour && (
            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{session.ordre_du_jour}</p>
          )}
        </div>
        {isAdmin && (
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" /> Modifier
            </Button>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Supprimer
            </Button>
          </div>
        )}
      </div>

      {/* Participants */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Participants
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {participants.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun participant défini.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {participants.map((p, i) => (
                <Badge key={i} variant="secondary" className="text-xs gap-1">
                  {p.fonction}
                  {p.profile_id && <> (<ProfileName profileId={p.profile_id} />)</>}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compte-rendu */}
      {session.compte_rendu && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Compte-rendu
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-sm whitespace-pre-wrap">{session.compte_rendu}</p>
          </CardContent>
        </Card>
      )}

      {/* Journal des modifications */}
      <ChangeLog sessionId={session.id} />

      {/* Plan d'actions complet (éditable dans le contexte de cette séance) */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-sky-500" />
          Plan d'actions — revue lors de cette séance
        </h3>
        <ActionsTableView isAdmin={isAdmin} sessions={sessions} contextSessionId={session.id} />
      </div>
    </div>
  );
}

// ─── Change Log ─────────────────────────────────────────────────

function ChangeLog({ sessionId }: { sessionId: string }) {
  const { data: changes = [], isLoading } = useCGIChanges(sessionId);

  if (isLoading) return <Skeleton className="h-20" />;
  if (changes.length === 0) {
    return (
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" /> Journal des modifications
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <p className="text-xs text-muted-foreground">Aucune modification enregistrée pour cette séance.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" /> Journal des modifications
          <Badge variant="outline" className="ml-1 text-[10px]">{changes.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="space-y-2">
          {changes.map((c) => (
            <ChangeRow key={c.id} change={c} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ChangeRow({ change }: { change: CGIActionChange }) {
  const cl = CHANGE_LABELS[change.change_type] ?? CHANGE_LABELS.updated;
  const title = change.new_values?.title ?? change.old_values?.title ?? '—';

  const details: string[] = [];
  if (change.change_type === 'status_changed') {
    const oldS = STATUS_MAP[change.old_values?.status]?.label ?? change.old_values?.status;
    const newS = STATUS_MAP[change.new_values?.status]?.label ?? change.new_values?.status;
    if (oldS && newS) details.push(`${oldS} → ${newS}`);
  } else if (change.change_type === 'updated' && change.old_values && change.new_values) {
    for (const key of Object.keys(change.new_values)) {
      if (key === 'status') {
        const oldS = STATUS_MAP[change.old_values[key]]?.label ?? change.old_values[key];
        const newS = STATUS_MAP[change.new_values[key]]?.label ?? change.new_values[key];
        details.push(`Statut : ${oldS} → ${newS}`);
      } else if (key === 'due_date') {
        details.push(`Échéance : ${fmtDate(change.old_values[key])} → ${fmtDate(change.new_values[key])}`);
      } else if (key === 'title') {
        details.push(`Titre modifié`);
      } else {
        details.push(`${key} modifié`);
      }
    }
  } else if (change.change_type === 'created') {
    details.push(`Nouvelle action créée`);
  } else if (change.change_type === 'deleted') {
    details.push(`Action supprimée`);
  }

  return (
    <div className="flex items-start gap-2 text-xs">
      <Badge className={cn(cl.color, 'text-[10px] shrink-0 mt-0.5')}>{cl.label}</Badge>
      <div className="flex-1 min-w-0">
        <span className="font-medium">{title}</span>
        {details.length > 0 && (
          <span className="text-muted-foreground ml-1.5">— {details.join(' · ')}</span>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground shrink-0">
        {change.changed_by && <ProfileName profileId={change.changed_by} />}
      </span>
    </div>
  );
}

// ─── Session Form Dialog ─────────────────────────────────────────

function SessionFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: CGISession;
  onSubmit: (data: any) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [dateSeance, setDateSeance] = useState(initial?.date_seance ?? '');
  const [trimestre, setTrimestre] = useState(initial?.trimestre ?? '');
  const [ordreJour, setOrdreJour] = useState(initial?.ordre_du_jour ?? '');
  const [compteRendu, setCompteRendu] = useState(initial?.compte_rendu ?? '');
  const [participants, setParticipants] = useState<CGIParticipant[]>(
    (initial?.participants as CGIParticipant[]) ?? CGI_FONCTIONS.map((f) => ({ fonction: f, profile_id: null })),
  );
  const [profiles, setProfiles] = useState<{ id: string; display_name: string }[]>([]);

  useEffect(() => {
    supabase.from('profiles').select('id, display_name').eq('status', 'active').order('display_name')
      .then(({ data }) => setProfiles(data ?? []));
  }, []);

  useEffect(() => {
    if (dateSeance && !initial) {
      setTrimestre(trimLabel(dateSeance));
    }
  }, [dateSeance, initial]);

  const updateParticipant = (idx: number, profileId: string | null) => {
    setParticipants((prev) => prev.map((p, i) => (i === idx ? { ...p, profile_id: profileId } : p)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4 text-sky-500" />
            {initial ? 'Modifier la séance' : 'Nouvelle séance'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Date de séance</Label>
              <Input type="date" value={dateSeance} onChange={(e) => setDateSeance(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Trimestre</Label>
              <Input value={trimestre} onChange={(e) => setTrimestre(e.target.value)} placeholder="2026-T3" className="h-8 text-xs" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Ordre du jour</Label>
            <Textarea value={ordreJour} onChange={(e) => setOrdreJour(e.target.value)} rows={3} className="text-xs" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Compte-rendu</Label>
            <Textarea value={compteRendu} onChange={(e) => setCompteRendu(e.target.value)} rows={3} className="text-xs" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Participants par fonction</Label>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {participants.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] w-[140px] justify-center shrink-0">{p.fonction}</Badge>
                  <Select
                    value={p.profile_id ?? NONE}
                    onValueChange={(v) => updateParticipant(i, v === NONE ? null : v)}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <span className="truncate">
                        {p.profile_id
                          ? profiles.find((pr) => pr.id === p.profile_id)?.display_name ?? '—'
                          : '— Non assigné —'}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— Non assigné —</SelectItem>
                      {profiles.map((pr) => (
                        <SelectItem key={pr.id} value={pr.id}>{pr.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button
              size="sm"
              disabled={isSubmitting || !dateSeance || !trimestre}
              onClick={() => void onSubmit({
                date_seance: dateSeance,
                trimestre,
                ordre_du_jour: ordreJour || null,
                compte_rendu: compteRendu || null,
                participants,
              })}
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {initial ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Action Form Dialog ──────────────────────────────────────────

function ActionFormDialog({
  open,
  onOpenChange,
  sessionId,
  sessions,
  contextSessionId,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  sessions?: CGISession[];
  contextSessionId?: string | null;
  onSubmit: (data: any) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [title, setTitle] = useState('');
  const [fonction, setFonction] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [selectedSession, setSelectedSession] = useState(sessionId);
  const [profiles, setProfiles] = useState<{ id: string; display_name: string }[]>([]);

  useEffect(() => {
    supabase.from('profiles').select('id, display_name').eq('status', 'active').order('display_name')
      .then(({ data }) => setProfiles(data ?? []));
  }, []);

  useEffect(() => { setSelectedSession(sessionId); }, [sessionId]);

  const reset = () => {
    setTitle('');
    setFonction('');
    setAssigneeId(null);
    setDueDate('');
    setSelectedSession(sessionId);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-sky-500" /> Nouvelle action
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Libellé de l'action</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-xs" placeholder="Ex: Arbitrer le budget cloud 2027" />
          </div>

          {sessions && sessions.length > 1 && (
            <div className="space-y-1">
              <Label className="text-xs">Séance d'origine</Label>
              <Select value={selectedSession} onValueChange={setSelectedSession}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.trimestre} — {fmtDate(s.date_seance)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Thème</Label>
              <Input value={fonction} onChange={(e) => setFonction(e.target.value)} className="h-8 text-xs" placeholder="Ex: SECURITE" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Échéance</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Assigné à (optionnel)</Label>
            <Select value={assigneeId ?? NONE} onValueChange={(v) => setAssigneeId(v === NONE ? null : v)}>
              <SelectTrigger className="h-8 text-xs">
                <span className="truncate">
                  {assigneeId ? profiles.find((p) => p.id === assigneeId)?.display_name ?? '—' : '— Non assigné —'}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Non assigné —</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button
              size="sm"
              disabled={isSubmitting || !title.trim()}
              onClick={() => void onSubmit({
                sessionId: selectedSession,
                contextSessionId: contextSessionId ?? undefined,
                title: title.trim(),
                responsable_fonction: fonction || 'Divers',
                assignee_id: assigneeId,
                due_date: dueDate || null,
              })}
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Créer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Profile Name (lazy loaded) ──────────────────────────────────

function ProfileName({ profileId }: { profileId: string }) {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    supabase.from('profiles').select('display_name').eq('id', profileId).maybeSingle()
      .then(({ data }) => setName(data?.display_name ?? null));
  }, [profileId]);
  if (!name) return null;
  return <span>{name}</span>;
}
