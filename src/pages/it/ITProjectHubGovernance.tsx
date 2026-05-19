/**
 * ITProjectHubGovernance — Onglet « Gouvernance & Phasage » d'un projet IT.
 *
 * Concentre :
 *   - Phase 0 : Gouvernance FDR (statut + 4 étapes validation cliquables)
 *   - Phasage projet : stepper détaillé des 5 phases avec progression auto
 *     ou manuelle, tâches associées, jalons rattachés, indicateur retard
 */
import { useState, useEffect, useMemo } from 'react';
import { useITProjectHubCode } from '@/hooks/useITProjectHubCode';
import { Layout } from '@/components/layout/Layout';
import { ITProjectHubHeader } from '@/components/it/ITProjectHubHeader';
import {
  useITProject, useITProjectTasks, useITProjectStats,
  useITProjectMilestones, useITProjectPhaseProgress,
} from '@/hooks/useITProjectHub';
import { useITProjectFDR } from '@/hooks/useITProjectFDR';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Shield, Target, CheckCircle2, Flag, AlertTriangle, Pencil, Settings2, Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  IT_PHASE_BADGE_CONFIG, ITProjectPhase, getActivePhases,
  STATUT_FDR_CONFIG, FDR_ETAPES, StatutFDR, ITProjectFDRValidation,
} from '@/types/itProject';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function ITProjectHubGovernance() {
  const code = useITProjectHubCode();
  const { data: project, isLoading, refetch } = useITProject(code);
  const { data: tasks = [] } = useITProjectTasks(project?.id);
  const { data: milestones = [] } = useITProjectMilestones(project?.id);
  const stats = useITProjectStats(tasks, project);
  const { etapes, initFDRValidation, updateEtape } = useITProjectFDR(project?.id);
  const { data: phaseProgressMap = new Map(), upsertPhaseProgress } = useITProjectPhaseProgress(project?.id);

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

  const currentPhaseIndex = activePhases.findIndex(p => p.value === project.phase_courante);
  const statutFdr = (project.statut_fdr as StatutFDR) || null;
  const fdrConfig = statutFdr ? STATUT_FDR_CONFIG[statutFdr] : null;

  const handleFdrStatutChange = async (value: string) => {
    setSavingFdrStatut(true);
    const { error } = await supabase.from('it_projects').update({ statut_fdr: value }).eq('id', project.id);
    setSavingFdrStatut(false);
    if (error) { toast.error('Erreur'); return; }
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
    a_faire:  'bg-muted border-border text-muted-foreground',
    en_cours: 'bg-blue-100 border-blue-400 text-blue-700',
    valide:   'bg-emerald-100 border-emerald-400 text-emerald-700',
    rejete:   'bg-red-100 border-red-400 text-red-700',
  };

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <ITProjectHubHeader project={project} stats={stats} />

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="max-w-5xl mx-auto space-y-5">

            {/* ─── Phase 0 — Gouvernance FDR ───────────────────── */}
            <Card className="border-violet-200/50 bg-violet-50/30 dark:bg-violet-950/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-violet-600" />
                  Phase 0 — Gouvernance FDR
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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

                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-medium text-muted-foreground">Statut FDR :</span>
                  <Select value={statutFdr || 'non_soumis'} onValueChange={handleFdrStatutChange} disabled={savingFdrStatut}>
                    <SelectTrigger className="h-8 text-xs w-[260px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.entries(STATUT_FDR_CONFIG) as [StatutFDR, typeof STATUT_FDR_CONFIG['non_soumis']][]).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>
                          <span className="flex items-center gap-2"><span>{cfg.icon}</span><span>{cfg.label}</span></span>
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

            {/* ─── Phasage projet ─────────────────────────────── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4 text-violet-600" />
                  Phasage du projet
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-0">
                  {activePhases.map((phase, idx) => {
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
                          {idx < activePhases.length - 1 && (
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
                            <span className={cn('text-sm font-medium', isCurrent && 'text-violet-700 dark:text-violet-400')}>
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
                                  refetch();
                                  toast.success(`Avancement de la phase ${phase.label} mis à jour`);
                                }}
                              />
                            </div>
                            {hasOverdue && (
                              <p className="text-[10px] text-destructive flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Tâches en retard
                              </p>
                            )}
                            {totalPhase > 0 && (
                              <div className="space-y-0.5 mt-1">
                                {phaseTasks.slice(0, 5).map(t => (
                                  <div key={t.id} className="flex items-center gap-1.5 text-[11px] py-0.5">
                                    <span>{['done', 'validated'].includes(t.status) ? '✅' : '◯'}</span>
                                    <span className="truncate flex-1">{t.title}</span>
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-0">
                                      {t.status === 'done' ? 'Terminé' : t.status === 'in-progress' ? 'En cours' : t.status === 'todo' ? 'À faire' : t.status}
                                    </Badge>
                                  </div>
                                ))}
                                {phaseTasks.length > 5 && (
                                  <p className="text-[10px] text-muted-foreground">+{phaseTasks.length - 5} autres…</p>
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
          </div>
        </div>
      </div>

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

// Popover réglage avancement phase (manuel/auto)
function PhaseProgressPopover({
  phase, autoProgress, totalPhase, donePhase, currentRecord, onSave,
}: {
  phase: { value: string; label: string };
  autoProgress: number;
  totalPhase: number;
  donePhase: number;
  currentRecord: { advancement_mode: string; manual_progress: number | null } | null;
  onSave: (mode: 'auto' | 'manual', value?: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'auto' | 'manual'>((currentRecord?.advancement_mode as 'auto' | 'manual') || 'auto');
  const [sliderValue, setSliderValue] = useState(currentRecord?.manual_progress ?? 0);
  const [saving, setSaving] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setMode((currentRecord?.advancement_mode as 'auto' | 'manual') || 'auto');
      setSliderValue(currentRecord?.manual_progress ?? 0);
    }
    setOpen(newOpen);
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
          <RadioGroup value={mode} onValueChange={v => setMode(v as 'auto' | 'manual')}>
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
                <Slider value={[sliderValue]} onValueChange={([v]) => setSliderValue(v)} min={0} max={100} step={5} className="flex-1" />
                <Input type="number" min={0} max={100} value={sliderValue}
                  onChange={e => setSliderValue(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-16 h-7 text-xs text-center px-1" />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Progress value={autoProgress} className="h-1.5 flex-1 bg-muted" />
                <span className="text-xs font-medium">{totalPhase > 0 ? `${donePhase}/${totalPhase}` : '0'} ({autoProgress}%)</span>
              </div>
            </div>
          )}
          <Button size="sm" className="w-full" disabled={saving}
            onClick={async () => {
              setSaving(true);
              try { await onSave(mode, mode === 'manual' ? sliderValue : undefined); setOpen(false); }
              finally { setSaving(false); }
            }}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            Enregistrer
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
