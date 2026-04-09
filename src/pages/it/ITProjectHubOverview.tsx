import { useState, useMemo } from 'react';
import { useITProjectHubCode } from '@/hooks/useITProjectHubCode';
import { Layout } from '@/components/layout/Layout';
import { ITProjectHubHeader } from '@/components/it/ITProjectHubHeader';
import { useITProject, useITProjectTasks, useITProjectStats, useITProjectMilestones } from '@/hooks/useITProjectHub';
import { useITProjectPhaseProgress } from '@/hooks/useITProjectHub';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Monitor, Calendar, Users, TrendingUp, Target, Euro,
  CheckCircle2, Clock, AlertTriangle, MessageSquareText,
  Link2, Pencil, Flag, ExternalLink, Shield, Loader2, Settings2
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  IT_PROJECT_TYPE_CONFIG, IT_PROJECT_PHASES, IT_PROJECT_STATUS_CONFIG,
  STATUT_FDR_CONFIG, FDR_ETAPES, StatutFDR, ITProjectFDRValidation,
  IT_PHASE_BADGE_CONFIG, ITProjectPhase
} from '@/types/itProject';
import { ITProjectFormDialog } from '@/components/it/ITProjectFormDialog';
import { ITPhaseAssignDialog } from '@/components/it/ITPhaseAssignDialog';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function ITProjectHubOverview() {
  const code = useITProjectHubCode();
  const { data: project, isLoading, refetch } = useITProject(code);
  const { data: tasks = [] } = useITProjectTasks(project?.id);
  const { data: milestones = [] } = useITProjectMilestones(project?.id);
  const stats = useITProjectStats(tasks, project);
  const { openTeams, openLoop, hasTeams, hasLoop } = useITProjectSync(project);
  const { etapes, isLoading: fdrLoading, initFDRValidation, updateEtape, etapeCourante } = useITProjectFDR(project?.id);
  const { data: phaseProgressMap = new Map(), upsertPhaseProgress } = useITProjectPhaseProgress(project?.id);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingEtape, setEditingEtape] = useState<ITProjectFDRValidation | null>(null);
  const [etapeForm, setEtapeForm] = useState({ statut: 'a_faire', date_validation: '', valideur_id: '', commentaire: '' });
  const [allProfiles, setAllProfiles] = useState<{ id: string; display_name: string }[]>([]);
  const [savingFdrStatut, setSavingFdrStatut] = useState(false);
  const [phaseAssignTarget, setPhaseAssignTarget] = useState<ITProjectPhase | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.from('profiles').select('id, display_name').eq('status', 'active').order('display_name').then(({ data }) => setAllProfiles(data || []));
  }, []);

  // Compute effective progress per phase (auto or manual)
  const phaseProgressValues = useMemo(() => {
    const values: Record<string, number> = {};
    for (const phase of IT_PROJECT_PHASES) {
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
  }, [tasks, phaseProgressMap]);

  // Weighted global progress (equal weight per phase)
  const globalProgress = useMemo(() => {
    const sum = IT_PROJECT_PHASES.reduce((acc, p) => acc + (phaseProgressValues[p.value] || 0), 0);
    return Math.round(sum / IT_PROJECT_PHASES.length);
  }, [phaseProgressValues]);

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

  const typeConfig = project.type_projet ? IT_PROJECT_TYPE_CONFIG[project.type_projet] : null;
  const currentPhaseIndex = IT_PROJECT_PHASES.findIndex(p => p.value === project.phase_courante);
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

        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1 & 2: Main content */}
            <div className="lg:col-span-2 space-y-6">

              {/* PHASE 0 — FEUILLE DE ROUTE DIGITALE */}
              <Card className="border-violet-200/50 bg-violet-50/30 dark:bg-violet-950/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-violet-600" />
                    Phase 0 — Gouvernance FDR
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Banner statut */}
                  {statutFdr === 'fdr_2027' && (
                    <div className="rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 px-4 py-2 text-sm font-medium">
                      ✅ Projet validé et intégré à la Feuille de Route 2027
                    </div>
                  )}
                  {statutFdr === 'fdr_2030' && (
                    <div className="rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 px-4 py-2 text-sm font-medium">
                      ✅ Projet validé et intégré à la Feuille de Route 2030
                    </div>
                  )}
                  {statutFdr === 'abandonne' && (
                    <div className="rounded-lg bg-red-100 border border-red-300 text-red-800 px-4 py-2 text-sm font-medium">
                      ❌ Projet abandonné
                    </div>
                  )}
                  {statutFdr === 'stand_by' && (
                    <div className="rounded-lg bg-amber-100 border border-amber-300 text-amber-800 px-4 py-2 text-sm font-medium">
                      ⏸️ Projet mis en stand-by
                    </div>
                  )}

                  {/* Statut FDR inline select */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-muted-foreground">Statut FDR :</span>
                    <Select value={statutFdr || 'non_soumis'} onValueChange={handleFdrStatutChange} disabled={savingFdrStatut}>
                      <SelectTrigger className="h-8 text-xs w-[260px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(STATUT_FDR_CONFIG) as [StatutFDR, typeof STATUT_FDR_CONFIG['non_soumis']][]).map(([key, cfg]) => (
                          <SelectItem key={key} value={key}>
                            <span className="flex items-center gap-2">
                              <span>{cfg.icon}</span>
                              <span>{cfg.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fdrConfig && (
                      <Badge className={cn(fdrConfig.className, 'border text-[10px]')}>
                        {fdrConfig.icon} {fdrConfig.label}
                      </Badge>
                    )}
                  </div>

                  {/* Stepper horizontal */}
                  {etapes.length > 0 ? (
                    <div className="flex items-start justify-between gap-2">
                      {etapes.map((etape, idx) => {
                        const fdrEtape = FDR_ETAPES.find(e => e.numero === etape.etape);
                        return (
                          <div key={etape.id} className="flex-1 flex flex-col items-center">
                            <button
                              onClick={() => openEtapeDialog(etape)}
                              className={cn(
                                'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all hover:scale-110 cursor-pointer',
                                ETAPE_COLORS[etape.statut]
                              )}
                            >
                              {etape.statut === 'valide' ? '✓' : etape.statut === 'rejete' ? '✗' : etape.etape}
                            </button>
                            {idx < etapes.length - 1 && (
                              <div className={cn('h-0.5 w-full mt-5 -mb-5', etape.statut === 'valide' ? 'bg-emerald-400' : 'bg-border')} />
                            )}
                            <p className="text-[10px] font-medium text-center mt-2 leading-tight max-w-[90px]">
                              {fdrEtape?.icon} {fdrEtape?.label || etape.etape_label}
                            </p>
                            {etape.date_validation && (
                              <p className="text-[9px] text-muted-foreground mt-0.5">
                                {format(new Date(etape.date_validation), 'dd/MM/yy')}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-xs text-muted-foreground mb-2">Aucune étape de validation FDR initialisée</p>
                      <Button size="sm" variant="outline" onClick={initFDRValidation} className="gap-2">
                        <Shield className="h-3.5 w-3.5" /> Initialiser les 4 étapes
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Phase Stepper Dashboard */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Target className="h-4 w-4 text-violet-600" />
                    Phases du projet
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-0">
                    {IT_PROJECT_PHASES.map((phase, idx) => {
                      const milestone = milestones.find(m => m.phase === phase.value);
                      const phaseTasks = tasks.filter(t => t.it_project_phase === phase.value);
                      const totalPhase = phaseTasks.length;
                      const donePhase = phaseTasks.filter(t => ['done', 'validated', 'closed'].includes(t.status)).length;
                      const autoProgress = totalPhase > 0 ? Math.round((donePhase / totalPhase) * 100) : 0;
                      const phaseRecord = phaseProgressMap.get(phase.value);
                      const isManual = phaseRecord?.advancement_mode === 'manual';
                      const effectiveProgress = phaseProgressValues[phase.value] || 0;
                      const isCurrent = phase.value === project.phase_courante;
                      const isDone = currentPhaseIndex >= 0 && idx < currentPhaseIndex;
                      const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
                      const hasOverdue = phaseTasks.some(t => {
                        if (!t.due_date) return false;
                        if (['done', 'validated', 'closed', 'cancelled'].includes(t.status)) return false;
                        return new Date(t.due_date) < todayDate;
                      });

                      let indicator = '⬜';
                      if (totalPhase > 0 && donePhase === totalPhase) indicator = '✅';
                      else if (hasOverdue) indicator = '⚠️';
                      else if (donePhase > 0 || isCurrent) indicator = '🔵';

                      const milestoneStatusMap: Record<string, { text: string; variant: 'default' | 'info' | 'success' | 'destructive' }> = {
                        a_venir: { text: 'À venir', variant: 'default' },
                        en_cours: { text: 'En cours', variant: 'info' },
                        termine: { text: 'Terminé', variant: 'success' },
                        retarde: { text: 'En retard', variant: 'destructive' },
                      };
                      const mStatus = milestone ? milestoneStatusMap[milestone.statut] || milestoneStatusMap.a_venir : null;

                      return (
                        <div key={phase.value} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0 z-10',
                              isDone && 'bg-violet-600 border-violet-600 text-white',
                              isCurrent && 'bg-white border-violet-600 text-violet-600 ring-2 ring-violet-200',
                              !isDone && !isCurrent && 'bg-muted border-border text-muted-foreground'
                            )}>
                              {isDone ? <CheckCircle2 className="h-4 w-4" /> : phase.order}
                            </div>
                            {idx < IT_PROJECT_PHASES.length - 1 && (
                              <div className={cn(
                                'w-0.5 flex-1 min-h-[24px]',
                                idx < currentPhaseIndex ? 'bg-violet-600' : 'bg-border'
                              )} />
                            )}
                          </div>

                          <div className={cn(
                            'flex-1 pb-5 rounded-lg group',
                            isCurrent && 'bg-violet-50/50 dark:bg-violet-950/20 -mx-2 px-3 py-2 border border-violet-200/50'
                          )}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm">{indicator}</span>
                              <span className={cn(
                                'text-sm font-medium',
                                isCurrent && 'text-violet-700 dark:text-violet-400'
                              )}>
                                {phase.label}
                              </span>
                              {totalPhase > 0 && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {totalPhase} tâche{totalPhase > 1 ? 's' : ''}
                                </Badge>
                              )}
                              {donePhase > 0 && (
                                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 border text-[10px] px-1.5 py-0">
                                  {donePhase} ✅
                                </Badge>
                              )}
                              {mStatus && (
                                <Badge variant={mStatus.variant} className="text-[10px] px-1.5 py-0">
                                  {mStatus.text}
                                </Badge>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground ml-auto"
                                onClick={() => setPhaseAssignTarget(phase.value)}
                              >
                                + Ajouter
                              </Button>
                            </div>

                            {milestone && (
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                <Flag className="h-3 w-3" />
                                {milestone.titre}
                                {milestone.date_prevue && (
                                  <span className="ml-1">
                                    — {format(new Date(milestone.date_prevue), 'dd MMM yyyy', { locale: fr })}
                                  </span>
                                )}
                              </p>
                            )}

                            {/* Progress bar with edit control */}
                            <div className="mt-2 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <Progress value={effectiveProgress} className="h-1.5 flex-1 bg-muted" />
                                <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1 w-auto text-right whitespace-nowrap">
                                  {isManual ? (
                                    <>
                                      {effectiveProgress}%
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Pencil className="h-3 w-3 text-amber-500" />
                                          </TooltipTrigger>
                                          <TooltipContent>Avancement manuel</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </>
                                  ) : (
                                    <>{totalPhase > 0 ? `${donePhase}/${totalPhase} (${effectiveProgress}%)` : '0%'}</>
                                  )}
                                </span>
                                <PhaseProgressPopover
                                  phase={phase}
                                  autoProgress={autoProgress}
                                  totalPhase={totalPhase}
                                  donePhase={donePhase}
                                  currentRecord={phaseRecord || null}
                                  onSave={async (mode, value) => {
                                    await upsertPhaseProgress(phase.value, mode, value);
                                    // Update global project progress
                                    const newValues = { ...phaseProgressValues, [phase.value]: mode === 'manual' ? (value ?? 0) : autoProgress };
                                    const sum = IT_PROJECT_PHASES.reduce((acc, p) => acc + (newValues[p.value] || 0), 0);
                                    const newGlobal = Math.round(sum / IT_PROJECT_PHASES.length);
                                    await supabase.from('it_projects').update({ progress: newGlobal }).eq('id', project.id);
                                    refetch();
                                    toast.success(`Avancement de la phase ${phase.label} mis à jour (${mode === 'manual' ? value : autoProgress}%)`);
                                  }}
                                />
                              </div>
                              {hasOverdue && (
                                <p className="text-[10px] text-destructive flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Tâches en retard
                                </p>
                              )}
                              {/* Task list for this phase */}
                              {totalPhase > 0 && (
                                <div className="space-y-0.5 mt-1">
                                  {phaseTasks.slice(0, 5).map(t => {
                                    const isRequest = t.type === 'request' || (!t.parent_request_id && (t as any).source_process_template_id);
                                    const stConf: Record<string, string> = {
                                      'to_assign': 'bg-slate-500/10 text-slate-600',
                                      'todo': 'bg-blue-500/10 text-blue-600',
                                      'in-progress': 'bg-amber-500/10 text-amber-600',
                                      'done': 'bg-emerald-500/10 text-emerald-600',
                                      'validated': 'bg-green-500/10 text-green-600',
                                    };
                                    return (
                                      <div key={t.id} className="flex items-center gap-1.5 text-[11px] py-0.5">
                                        <span>{isRequest ? '📥' : '✅'}</span>
                                        <span className="truncate flex-1">{t.title}</span>
                                        <Badge className={cn(stConf[t.status] || 'bg-muted', 'text-[9px] px-1 py-0 border-0')}>
                                          {t.status === 'done' ? 'Terminé' : t.status === 'in-progress' ? 'En cours' : t.status === 'todo' ? 'À faire' : t.status}
                                        </Badge>
                                      </div>
                                    );
                                  })}
                                  {phaseTasks.length > 5 && (
                                    <p className="text-[10px] text-muted-foreground">+{phaseTasks.length - 5} autres...</p>
                                  )}
                                </div>
                              )}
                              {totalPhase === 0 && !isManual && (
                                <p className="text-[10px] text-muted-foreground mt-1">Aucune tâche</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Avancement global */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-violet-600" />
                    Synthèse d'avancement
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-sm text-muted-foreground">Avancement global</span>
                      <span className="text-sm font-bold text-violet-600">{globalProgress}%</span>
                    </div>
                    <Progress value={globalProgress} className="h-3 bg-muted" />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-950/30 border">
                      <p className="text-xl font-bold">{stats.openTasks}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">À faire</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100">
                      <p className="text-xl font-bold text-blue-600">{stats.totalTasks - stats.openTasks - stats.doneTasks}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">En cours</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100">
                      <p className="text-xl font-bold text-emerald-600">{stats.doneTasks}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Terminées</p>
                    </div>
                  </div>

                  {project.budget_previsionnel && (
                    <div className="pt-2 border-t">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Euro className="h-3.5 w-3.5" /> Budget consommé
                        </span>
                        <span className="text-sm font-bold">
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
            </div>

            {/* Column 3: Sidebar */}
            <div className="space-y-4">
              {/* Fiche projet */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-violet-600" />
                    Fiche projet
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <InfoRow label="Code Digital" value={
                    <span className="font-mono font-bold text-violet-600">{project.code_projet_digital}</span>
                  } />
                  {typeConfig && (
                    <InfoRow label="Type" value={`${typeConfig.icon} ${typeConfig.label}`} />
                  )}
                  {project.date_debut && (
                    <InfoRow label="Début" value={format(new Date(project.date_debut), 'dd/MM/yyyy')} />
                  )}
                  {project.date_fin_prevue && (
                    <InfoRow label="Fin prévue" value={format(new Date(project.date_fin_prevue), 'dd/MM/yyyy')} />
                  )}
                  {project.responsable_it && (
                    <InfoRow label="Responsable IT" value={project.responsable_it.display_name} />
                  )}
                  {project.chef_projet && (
                    <InfoRow label="Chef de projet" value={project.chef_projet.display_name} />
                  )}
                  {project.sponsor && (
                    <InfoRow label="Sponsor" value={project.sponsor.display_name} />
                  )}
                </CardContent>
              </Card>

              {/* Microsoft Teams & Loop */}
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
                    className={cn(
                      'w-full justify-start gap-2 h-9',
                      hasLoop
                        ? 'border-violet-200 text-violet-700 hover:bg-violet-50'
                        : 'text-muted-foreground cursor-default'
                    )}
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
                    className={cn(
                      'w-full justify-start gap-2 h-9',
                      hasTeams
                        ? 'border-blue-200 text-blue-700 hover:bg-blue-50'
                        : 'text-muted-foreground cursor-default'
                    )}
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
              <Input type="date" className="h-8 text-xs" value={etapeForm.date_validation} onChange={e => setEtapeForm(f => ({ ...f, date_validation: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Valideur</Label>
              <Select value={etapeForm.valideur_id || '__none__'} onValueChange={v => setEtapeForm(f => ({ ...f, valideur_id: v === '__none__' ? '' : v }))}>
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
              <Textarea className="text-xs" rows={2} value={etapeForm.commentaire} onChange={e => setEtapeForm(f => ({ ...f, commentaire: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setEditingEtape(null)}>Annuler</Button>
              <Button size="sm" onClick={saveEtape}>Enregistrer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Phase assign dialog */}
      {phaseAssignTarget && (
        <ITPhaseAssignDialog
          open={!!phaseAssignTarget}
          onOpenChange={(open) => { if (!open) setPhaseAssignTarget(null); }}
          phase={phaseAssignTarget}
          projectTasks={tasks}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: ['it-project-tasks'] });
            refetch();
          }}
        />
      )}
    </Layout>
  );
}

// ============= Phase Progress Popover =============
function PhaseProgressPopover({
  phase,
  autoProgress,
  totalPhase,
  donePhase,
  currentRecord,
  onSave,
}: {
  phase: { value: string; label: string };
  autoProgress: number;
  totalPhase: number;
  donePhase: number;
  currentRecord: { advancement_mode: string; manual_progress: number | null } | null;
  onSave: (mode: 'auto' | 'manual', value?: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'auto' | 'manual'>(
    (currentRecord?.advancement_mode as 'auto' | 'manual') || 'auto'
  );
  const [sliderValue, setSliderValue] = useState(currentRecord?.manual_progress ?? 0);
  const [saving, setSaving] = useState(false);

  // Reset state when popover opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setMode((currentRecord?.advancement_mode as 'auto' | 'manual') || 'auto');
      setSliderValue(currentRecord?.manual_progress ?? 0);
    }
    setOpen(newOpen);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(mode, mode === 'manual' ? sliderValue : undefined);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted">
          <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
          <p className="text-xs font-semibold">{phase.label}</p>

          <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'auto' | 'manual')}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="auto" id={`auto-${phase.value}`} />
              <Label htmlFor={`auto-${phase.value}`} className="text-xs cursor-pointer">Auto (tâches)</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="manual" id={`manual-${phase.value}`} />
              <Label htmlFor={`manual-${phase.value}`} className="text-xs cursor-pointer">Manuel</Label>
            </div>
          </RadioGroup>

          {mode === 'manual' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Slider
                  value={[sliderValue]}
                  onValueChange={([v]) => setSliderValue(v)}
                  min={0}
                  max={100}
                  step={5}
                  className="flex-1"
                />
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={sliderValue}
                  onChange={(e) => {
                    const v = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                    setSliderValue(v);
                  }}
                  className="w-16 h-7 text-xs text-center px-1"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                L'avancement manuel remplace le calcul automatique des tâches
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Progress value={autoProgress} className="h-1.5 flex-1 bg-muted" />
                <span className="text-xs font-medium">{totalPhase > 0 ? `${donePhase}/${totalPhase}` : '0'} ({autoProgress}%)</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                L'avancement est calculé automatiquement depuis les tâches liées à cette phase
              </p>
            </div>
          )}

          <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            Enregistrer
          </Button>
        </div>
      </PopoverContent>
    </Popover>
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
