/**
 * ITProjectHubOverview — Page synthèse d'un projet IT.
 *
 * Contenu (dans l'ordre) :
 *  1. Carte « Synthèse d'avancement » (taux global + répartition tâches + budget)
 *  2. Phase courante du projet
 *  3. Planning (dates clés + jalons)
 *  4. Phase 0 — Gouvernance FDR (statut + stepper 4 étapes éditables)
 *  Sidebar : Fiche projet, liens Microsoft 365 (Loop / Teams)
 */
import { useState, useMemo, useEffect } from 'react';
import { useITProjectHubCode } from '@/hooks/useITProjectHubCode';
import { Layout } from '@/components/layout/Layout';
import { ITProjectHubHeader } from '@/components/it/ITProjectHubHeader';
import {
  useITProject, useITProjectTasks, useITProjectStats,
  useITProjectMilestones, useITProjectPhaseProgress,
} from '@/hooks/useITProjectHub';
import { useITProjectSync } from '@/hooks/useITProjectSync';
import { useITProjectFDR } from '@/hooks/useITProjectFDR';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Monitor, Calendar, TrendingUp, Target, Euro, Flag, CalendarRange,
  MessageSquareText, Link2, ExternalLink, Shield, Pencil,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  IT_PROJECT_TYPE_CONFIG, IT_PHASE_BADGE_CONFIG, ITProjectPhase, getActivePhases,
  STATUT_FDR_CONFIG, FDR_ETAPES, StatutFDR, ITProjectFDRValidation,
} from '@/types/itProject';
import { ITProjectFormDialog } from '@/components/it/ITProjectFormDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function ITProjectHubOverview() {
  const code = useITProjectHubCode();
  const { data: project, isLoading, refetch } = useITProject(code);
  const { data: tasks = [] } = useITProjectTasks(project?.id);
  const { data: milestones = [] } = useITProjectMilestones(project?.id);
  const stats = useITProjectStats(tasks, project);
  const { openTeams, openLoop, hasTeams, hasLoop } = useITProjectSync(project);
  const { etapes, initFDRValidation, updateEtape } = useITProjectFDR(project?.id);
  const { data: phaseProgressMap = new Map() } = useITProjectPhaseProgress(project?.id);

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingEtape, setEditingEtape] = useState<ITProjectFDRValidation | null>(null);
  const [etapeForm, setEtapeForm] = useState({ statut: 'a_faire', date_validation: '', valideur_id: '', commentaire: '' });
  const [allProfiles, setAllProfiles] = useState<{ id: string; display_name: string }[]>([]);
  const [savingFdrStatut, setSavingFdrStatut] = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('id, display_name').eq('status', 'active').order('display_name')
      .then(({ data }) => setAllProfiles(data || []));
  }, []);

  const activePhases = useMemo(
    () => getActivePhases(project?.phases_actives as ITProjectPhase[] | null | undefined),
    [project?.phases_actives],
  );

  const phaseProgressValues = useMemo(() => {
    const values: Record<string, number> = {};
    for (const phase of activePhases) {
      const record = phaseProgressMap.get(phase.value);
      if (record && record.advancement_mode === 'manual' && record.manual_progress != null) {
        values[phase.value] = record.manual_progress;
      } else {
        const phaseTasks = tasks.filter(t => t.it_project_phase === phase.value);
        const total = phaseTasks.length;
        const done = phaseTasks.filter(t => ['done', 'validated', 'closed'].includes(t.status)).length;
        values[phase.value] = total > 0 ? Math.round((done / total) * 100) : 0;
      }
    }
    return values;
  }, [tasks, phaseProgressMap, activePhases]);

  const globalProgress = useMemo(() => {
    if (activePhases.length === 0) return 0;
    const sum = activePhases.reduce((acc, p) => acc + (phaseProgressValues[p.value] || 0), 0);
    return Math.round(sum / activePhases.length);
  }, [phaseProgressValues, activePhases]);

  const sortedMilestones = useMemo(
    () => [...milestones].sort((a, b) => {
      if (!a.date_prevue) return 1;
      if (!b.date_prevue) return -1;
      return new Date(a.date_prevue).getTime() - new Date(b.date_prevue).getTime();
    }),
    [milestones],
  );

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Projet non trouvé
        </div>
      </Layout>
    );
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dDay = project.date_fin_prevue
    ? differenceInDays(parseISO(project.date_fin_prevue as unknown as string), today)
    : null;

  const currentPhase = activePhases.find(p => p.value === project.phase_courante);
  const currentPhaseProgress = currentPhase ? phaseProgressValues[currentPhase.value] ?? 0 : 0;
  const phaseBadge = currentPhase ? IT_PHASE_BADGE_CONFIG[currentPhase.value as ITProjectPhase] : null;
  const typeConfig = project.type_projet ? IT_PROJECT_TYPE_CONFIG[project.type_projet] : null;
  const statutFdr = (project.statut_fdr as StatutFDR) || null;
  const fdrConfig = statutFdr ? STATUT_FDR_CONFIG[statutFdr] : null;

  const handleFdrStatutChange = async (value: string) => {
    setSavingFdrStatut(true);
    const { error } = await supabase.from('it_projects').update({ statut_fdr: value }).eq('id', project.id);
    setSavingFdrStatut(false);
    if (error) { toast.error('Erreur lors de la mise à jour'); return; }
    toast.success('Statut FDR mis à jour');
    refetch();
  };

  const openEtapeDialog = (etape: ITProjectFDRValidation) => {
    setEditingEtape(etape);
    setEtapeForm({
      statut: etape.statut,
      date_validation: etape.date_validation || '',
      valideur_id: etape.valideur_id || '',
      commentaire: etape.commentaire || '',
    });
  };

  const saveEtape = async () => {
    if (!editingEtape) return;
    await updateEtape(editingEtape.id, {
      statut: etapeForm.statut as any,
      date_validation: etapeForm.date_validation || null,
      valideur_id: etapeForm.valideur_id || null,
      commentaire: etapeForm.commentaire || null,
    });
    toast.success('Étape mise à jour');
    setEditingEtape(null);
  };

  const ETAPE_COLORS: Record<string, string> = {
    a_faire: 'bg-muted border-border text-muted-foreground',
    en_cours: 'bg-blue-100 border-blue-400 text-blue-700',
    valide: 'bg-emerald-100 border-emerald-400 text-emerald-700',
    rejete: 'bg-red-100 border-red-400 text-red-700',
  };

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <ITProjectHubHeader
          project={project}
          stats={stats}
          onEditProject={() => setShowEditDialog(true)}
        />

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">

            {/* ───────── Colonne principale (2/3) ───────── */}
            <div className="lg:col-span-2 space-y-4">

              {/* 1. Synthèse d'avancement */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-violet-600" />
                    Synthèse d'avancement
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Avancement global
                      </span>
                      <span className="text-3xl font-bold text-violet-600 tabular-nums">
                        {globalProgress}%
                      </span>
                    </div>
                    <Progress value={globalProgress} className="h-3" />
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      Moyenne pondérée sur {activePhases.length} phase{activePhases.length > 1 ? 's' : ''} active{activePhases.length > 1 ? 's' : ''}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-950/30 border">
                      <p className="text-2xl font-bold">{stats.openTasks}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">À faire</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100">
                      <p className="text-2xl font-bold text-blue-600">
                        {stats.totalTasks - stats.openTasks - stats.doneTasks}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">En cours</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100">
                      <p className="text-2xl font-bold text-emerald-600">{stats.doneTasks}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Terminées</p>
                    </div>
                  </div>

                  {project.budget_previsionnel && (
                    <div className="pt-3 border-t">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Euro className="h-3.5 w-3.5" /> Budget consommé
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                          {(project.budget_consomme || 0).toLocaleString('fr-FR')} €
                          <span className="text-muted-foreground font-normal">
                            {' / '}{project.budget_previsionnel.toLocaleString('fr-FR')} €
                          </span>
                        </span>
                      </div>
                      <Progress
                        value={stats.budgetRatio || 0}
                        className={cn('h-2', stats.budgetRatio && stats.budgetRatio > 90 ? 'text-red-500' : '')}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Phase en cours + Gouvernance FDR → déplacés dans l'onglet
                  « Gouvernance & Phasage » pour avoir le détail du phasage
                  cliquable + le stepper FDR ensemble. */}

              {/* 2. Planning */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <CalendarRange className="h-4 w-4 text-violet-600" />
                    Planning
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <DateTile label="Début" date={project.date_debut as unknown as string | null} />
                    <DateTile label="Fin prévue" date={project.date_fin_prevue as unknown as string | null} />
                    <div className="rounded-lg border bg-violet-50/40 dark:bg-violet-950/20 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Délai restant</p>
                      <p className="text-sm font-semibold mt-1">
                        {dDay === null ? '—' : dDay < 0 ? (
                          <span className="text-red-600">+{Math.abs(dDay)} j de retard</span>
                        ) : dDay === 0 ? (
                          <span className="text-amber-600">Aujourd'hui</span>
                        ) : (
                          <span className="text-violet-700">J–{dDay}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Flag className="h-3 w-3" /> Jalons ({sortedMilestones.length})
                    </h4>
                    {sortedMilestones.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Aucun jalon défini.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {sortedMilestones.map((m) => {
                          const statusMap: Record<string, { label: string; cls: string }> = {
                            a_venir:  { label: 'À venir',  cls: 'bg-slate-100 text-slate-700' },
                            en_cours: { label: 'En cours', cls: 'bg-blue-100 text-blue-700' },
                            termine:  { label: 'Terminé',  cls: 'bg-emerald-100 text-emerald-700' },
                            retarde:  { label: 'En retard',cls: 'bg-red-100 text-red-700' },
                          };
                          const s = statusMap[m.statut] || statusMap.a_venir;
                          return (
                            <li key={m.id} className="flex items-center gap-2 text-sm">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="flex-1 truncate">{m.titre}</span>
                              {m.date_prevue && (
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {format(new Date(m.date_prevue), 'dd MMM yyyy', { locale: fr })}
                                </span>
                              )}
                              <Badge className={cn('text-[10px] border-0', s.cls)}>{s.label}</Badge>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Gouvernance FDR déplacée dans l'onglet « Gouvernance & Phasage » */}
            </div>

            {/* ───────── Sidebar (1/3) ───────── */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-violet-600" />
                    Fiche projet
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setShowEditDialog(true)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <InfoRow label="Code Digital" value={
                    <span className="font-mono font-bold text-violet-600">{project.code_projet_digital}</span>
                  } />
                  {typeConfig && <InfoRow label="Type" value={`${typeConfig.icon} ${typeConfig.label}`} />}
                  {project.date_debut && <InfoRow label="Début" value={format(new Date(project.date_debut), 'dd/MM/yyyy')} />}
                  {project.date_fin_prevue && <InfoRow label="Fin prévue" value={format(new Date(project.date_fin_prevue), 'dd/MM/yyyy')} />}
                  {project.responsable_it && <InfoRow label="Responsable IT" value={project.responsable_it.display_name} />}
                  {project.chef_projet && <InfoRow label="Chef de projet" value={project.chef_projet.display_name} />}
                  {project.sponsor && <InfoRow label="Sponsor" value={project.sponsor.display_name} />}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MessageSquareText className="h-4 w-4 text-blue-600" />
                    Microsoft 365
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant={hasLoop ? 'outline' : 'ghost'}
                    size="sm"
                    className={cn('w-full justify-start gap-2 h-9',
                      hasLoop ? 'border-violet-200 text-violet-700 hover:bg-violet-50' : 'text-muted-foreground cursor-default')}
                    onClick={hasLoop ? openLoop : undefined}
                    disabled={!hasLoop}
                  >
                    <Link2 className="h-4 w-4" />
                    {hasLoop ? 'Ouvrir Microsoft Loop' : 'Loop non configuré'}
                    {hasLoop && <ExternalLink className="h-3 w-3 ml-auto opacity-50" />}
                  </Button>
                  <Button
                    variant={hasTeams ? 'outline' : 'ghost'}
                    size="sm"
                    className={cn('w-full justify-start gap-2 h-9',
                      hasTeams ? 'border-blue-200 text-blue-700 hover:bg-blue-50' : 'text-muted-foreground cursor-default')}
                    onClick={hasTeams ? openTeams : undefined}
                    disabled={!hasTeams}
                  >
                    <MessageSquareText className="h-4 w-4" />
                    {hasTeams ? 'Ouvrir Microsoft Teams' : 'Teams non configuré'}
                    {hasTeams && <ExternalLink className="h-3 w-3 ml-auto opacity-50" />}
                  </Button>
                  {!hasLoop && !hasTeams && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      Configurez les liens dans l'onglet Teams / Loop
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <ITProjectFormDialog
        open={showEditDialog}
        project={project}
        onClose={() => setShowEditDialog(false)}
        onSaved={refetch}
      />

      {/* Dialog modification étape FDR */}
      <Dialog open={!!editingEtape} onOpenChange={() => setEditingEtape(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editingEtape && FDR_ETAPES.find(e => e.numero === editingEtape.etape)?.icon}{' '}
              Étape {editingEtape?.etape} — {editingEtape?.etape_label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs">Statut</Label>
              <Select value={etapeForm.statut} onValueChange={v => setEtapeForm(f => ({ ...f, statut: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_faire">⬜ À faire</SelectItem>
                  <SelectItem value="en_cours">🔵 En cours</SelectItem>
                  <SelectItem value="valide">✅ Validé</SelectItem>
                  <SelectItem value="rejete">❌ Rejeté</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Date de validation</Label>
              <Input type="date" className="h-8 text-xs" value={etapeForm.date_validation}
                onChange={e => setEtapeForm(f => ({ ...f, date_validation: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Valideur</Label>
              <Select value={etapeForm.valideur_id || '__none__'}
                onValueChange={v => setEtapeForm(f => ({ ...f, valideur_id: v === '__none__' ? '' : v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Aucun —</SelectItem>
                  {allProfiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Commentaire</Label>
              <Textarea className="text-xs" rows={2} value={etapeForm.commentaire}
                onChange={e => setEtapeForm(f => ({ ...f, commentaire: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setEditingEtape(null)}>Annuler</Button>
              <Button size="sm" onClick={saveEtape}>Enregistrer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function DateTile({ label, date }: { label: string; date: string | null | undefined }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold mt-1 tabular-nums">
        {date ? format(new Date(date), 'dd MMM yyyy', { locale: fr }) : '—'}
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-muted-foreground text-xs flex-shrink-0">{label}</span>
      <span className="text-right font-medium text-xs">{value}</span>
    </div>
  );
}
