/**
 * BEPrestationGroupSettings
 * Page de configuration du flux complet d'une prestation BE.
 * Regroupe toutes les étapes (sub_process_templates) qui partagent le même
 * préfixe de nom avant ' — ' et permet de :
 *  - Visualiser la séquence (étapes parallèles / séquentielles)
 *  - Réordonner les étapes
 *  - Configurer chaque étape : nom, durée, groupe parallèle, dispatcher, validateurs
 *  - Ajouter / supprimer des étapes
 *  - Sauvegarder toutes les modifications en batch
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatchedRouteParam } from '@/hooks/useMatchedRouteParam';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowLeft, Save, Plus, Trash2, ArrowUp, ArrowDown, GitBranch,
  Loader2, ChevronDown, ChevronRight, Link, Unlink, Flag, FileText, Milestone,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const BE_PROCESS_ID = 'bd75a3b0-c918-4b43-befe-739b83f7461a';

// Couleurs pour les groupes parallèles
const PARALLEL_COLORS = [
  { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-700', badge: 'bg-blue-200 text-blue-800' },
  { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-700', badge: 'bg-amber-200 text-amber-800' },
  { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-700', badge: 'bg-green-200 text-green-800' },
  { bg: 'bg-violet-100', border: 'border-violet-400', text: 'text-violet-700', badge: 'bg-violet-200 text-violet-800' },
];

type ValType = 'none' | 'requester' | 'manager' | 'fixed_user';
type StartMode = 'parallel' | 'after_previous' | 'after_specific';

interface Profile { id: string; display_name: string | null; }
interface RequestState { code: string; label: string; state_category: string | null; }

interface StepDraft {
  dbId: string | null;         // null = nouvelle étape
  tempId: string;
  stepLabel: string;           // nom APRES ' — ' (ex: "Réalisation du dossier")
  orderIndex: number;
  parallelGroup: number | null;
  durationDays: number;
  dispatchManagerId: string;
  val1Type: ValType;
  val1UserId: string;
  val2Type: ValType;
  val2UserId: string;
  fixedUserId: string;
  // ── Enchaînement ──
  startMode: StartMode;
  dependsOnTempId: string;      // tempId de l'étape dont celle-ci dépend (après_specifique)
  delayAfterPreviousDays: number;
  // ── Jalon timeline ──
  isMilestone: boolean;
  milestoneLabel: string;
  /** Type de jalon du référentiel (be_milestone_types.code) — pilote la date auto. */
  milestoneTypeCode: string;
  autoMilestoneDelayDays: number | null;
  autoMilestoneLabel: string;
  // ── Documents obligatoires ──
  requiredDocsCount: number;
  requiredDocsDescription: string;
  /** Titres / références des documents requis (texte libre, 1 par ligne) */
  requiredDocsReferences: string;
  // ── État de sortie ──
  outputStateCode: string;
  expanded: boolean;
  isNew: boolean;
  markedForDelete: boolean;
}

const VAL_OPTIONS: { value: ValType; label: string }[] = [
  { value: 'none',       label: 'Aucune' },
  { value: 'requester',  label: 'Demandeur' },
  { value: 'manager',    label: 'Manager du demandeur' },
  { value: 'fixed_user', label: 'Utilisateur fixe' },
];

const START_MODE_OPTIONS: { value: StartMode; label: string }[] = [
  { value: 'parallel',       label: 'En parallèle (dès le départ)' },
  { value: 'after_previous', label: 'Après l\'étape précédente' },
  { value: 'after_specific', label: 'Après une étape précise' },
];

// Couleurs des catégories d'état (cohérent avec le reste de l'app BE)
const STATE_CATEGORY_LABELS: Record<string, string> = {
  SOUMIS: 'Soumis',
  EN_COURS: 'En cours',
  EN_ATTENTE_VALIDATION: 'En attente de validation',
  EN_ATTENTE_RETOUR_ADMIN: 'En attente retour administration',
  TERMINE: 'Terminé',
};

function dbToValType(dbValue: string | null, validatorId: string | null): ValType {
  if (!dbValue) return 'none';
  if (dbValue === 'requester') return 'requester';
  if (dbValue === 'manager') return 'manager';
  if (dbValue === 'fixed_user' || validatorId) return 'fixed_user';
  return 'none';
}

// Contrainte DB : ('manager' | 'fixed_user' | 'requester') ou NULL — 'none' = NULL
function valTypeToDb(t: ValType): string | null {
  if (t === 'none') return null;
  return t; // 'manager' | 'fixed_user' | 'requester'
}

function getParallelColor(group: number | null) {
  if (group === null) return null;
  return PARALLEL_COLORS[(group - 1) % PARALLEL_COLORS.length];
}

// Calcule le numéro d'ordre "logique" (1, 2, 3…) en tenant compte des parallèles
function computeLogicalOrder(steps: StepDraft[]): Map<string, number> {
  const result = new Map<string, number>();
  let logical = 1;
  let prevGroup: number | null | undefined = undefined;
  for (const s of steps) {
    if (s.parallelGroup !== null && s.parallelGroup === prevGroup) {
      // même groupe parallèle : même ordre logique
      result.set(s.tempId, logical - 1);
    } else {
      result.set(s.tempId, logical++);
      prevGroup = s.parallelGroup;
    }
  }
  return result;
}

export default function BEPrestationGroupSettings() {
  const encodedName = useMatchedRouteParam(
    'prestationName',
    '/templates/be-prestation-group/:prestationName',
  );
  const prestationName = encodedName ? decodeURIComponent(encodedName) : '';
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState('templates');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [requestStates, setRequestStates] = useState<RequestState[]>([]);
  const [milestoneTypes, setMilestoneTypes] = useState<{ code: string; label: string; category: string }[]>([]);
  const [beCategory, setBeCategory] = useState<'be' | 'be_reglementaire'>('be');
  const [steps, setSteps] = useState<StepDraft[]>([]);

  // Catégorie d'état dérivée d'un code d'état de sortie
  const categoryOfState = useCallback(
    (code: string): string | null => requestStates.find(s => s.code === code)?.state_category ?? null,
    [requestStates],
  );

  // ── Chargement ───────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [{ data: allData, error: spErr }, { data: profData }, { data: stateData }, { data: typeData }] = await Promise.all([
          supabase
            .from('sub_process_templates')
            .select('*')
            .eq('process_template_id', BE_PROCESS_ID)
            .order('order_index', { ascending: true }),
          supabase.from('profiles').select('id, display_name').order('display_name'),
          (supabase as any)
            .from('request_states')
            .select('code, label, state_category')
            .eq('process_template_id', BE_PROCESS_ID)
            .order('order_index', { ascending: true }),
          (supabase as any)
            .from('be_milestone_types')
            .select('code, label, category')
            .eq('is_active', true)
            .order('ordre'),
        ]);

        if (spErr) throw spErr;
        setProfiles((profData ?? []) as Profile[]);
        setRequestStates((stateData ?? []) as RequestState[]);
        setMilestoneTypes((typeData ?? []) as { code: string; label: string; category: string }[]);

        // Filtrage côté client pour éviter les problèmes d'encodage PostgREST
        const prefix = `${prestationName} — `;
        const rows = ((allData ?? []) as any[]).filter(
          sp => sp.name === prestationName || sp.name.startsWith(prefix)
        );
        if (rows.length > 0) setBeCategory(rows[0].be_category ?? 'be');

        setSteps(rows.map((sp): StepDraft => ({
          dbId: sp.id,
          tempId: sp.id,
          stepLabel: sp.name.includes(' — ') ? sp.name.split(' — ').slice(1).join(' — ') : sp.name,
          orderIndex: sp.order_index ?? 0,
          parallelGroup: sp.parallel_group ?? null,
          // default_duration_hours en base — on affiche en heures
          durationDays: sp.default_duration_hours ?? 0,
          dispatchManagerId: sp.dispatch_manager_id ?? '',
          val1Type: dbToValType(sp.validation_level_1_type, sp.validation_level_1_user_id),
          val1UserId: sp.validation_level_1_user_id ?? '',
          val2Type: dbToValType(sp.validation_level_2_type, sp.validation_level_2_user_id),
          val2UserId: sp.validation_level_2_user_id ?? '',
          fixedUserId: sp.target_assignee_id ?? '',
          // Enchaînement
          startMode: (sp.start_mode as StartMode) ?? 'parallel',
          dependsOnTempId: sp.depends_on_sub_process_template_id ?? '',
          delayAfterPreviousDays: sp.delay_after_previous_days ?? 0,
          // Jalon
          isMilestone: sp.is_milestone ?? false,
          milestoneLabel: sp.milestone_label ?? '',
          milestoneTypeCode: (sp as any).milestone_type_code ?? '',
          autoMilestoneDelayDays: sp.auto_milestone_delay_days ?? null,
          autoMilestoneLabel: sp.auto_milestone_label ?? '',
          // Docs obligatoires
          requiredDocsCount: sp.required_docs_count ?? 0,
          requiredDocsDescription: sp.required_docs_description ?? '',
          requiredDocsReferences: sp.required_docs_references ?? '',
          // État de sortie
          outputStateCode: sp.output_state_code ?? '',
          expanded: false,
          isNew: false,
          markedForDelete: false,
        })));
      } catch (err) {
        console.error(err);
        toast.error('Erreur lors du chargement');
      } finally {
        setIsLoading(false);
      }
    }
    if (prestationName) load();
  }, [prestationName]);

  const visibleSteps = useMemo(() => steps.filter(s => !s.markedForDelete), [steps]);
  const logicalOrder = useMemo(() => computeLogicalOrder(visibleSteps), [visibleSteps]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const updateStep = useCallback((tempId: string, patch: Partial<StepDraft>) => {
    setSteps(prev => prev.map(s => s.tempId === tempId ? { ...s, ...patch } : s));
  }, []);

  const moveStep = (tempId: string, dir: 'up' | 'down') => {
    setSteps(prev => {
      const visible = prev.filter(s => !s.markedForDelete);
      const idx = visible.findIndex(s => s.tempId === tempId);
      if (dir === 'up' && idx <= 0) return prev;
      if (dir === 'down' && idx >= visible.length - 1) return prev;
      const swapWith = dir === 'up' ? visible[idx - 1] : visible[idx + 1];
      // Swap order_index
      const newOrder = swapWith.orderIndex;
      const oldOrder = visible[idx].orderIndex;
      return prev.map(s => {
        if (s.tempId === tempId) return { ...s, orderIndex: newOrder };
        if (s.tempId === swapWith.tempId) return { ...s, orderIndex: oldOrder };
        return s;
      }).sort((a, b) => a.orderIndex - b.orderIndex);
    });
  };

  const addStep = () => {
    const maxOrder = Math.max(0, ...visibleSteps.map(s => s.orderIndex));
    const newStep: StepDraft = {
      dbId: null,
      tempId: crypto.randomUUID(),
      stepLabel: 'Nouvelle étape',
      orderIndex: maxOrder + 10,
      parallelGroup: null,
      durationDays: 1,
      dispatchManagerId: visibleSteps[0]?.dispatchManagerId ?? '',
      val1Type: 'none',
      val1UserId: '',
      val2Type: 'none',
      val2UserId: '',
      fixedUserId: '',
      startMode: 'parallel',
      dependsOnTempId: '',
      delayAfterPreviousDays: 0,
      isMilestone: false,
      milestoneLabel: '',
      milestoneTypeCode: '',
      autoMilestoneDelayDays: null,
      autoMilestoneLabel: '',
      requiredDocsCount: 0,
      requiredDocsDescription: '',
      requiredDocsReferences: '',
      outputStateCode: '',
      expanded: true,
      isNew: true,
      markedForDelete: false,
    };
    setSteps(prev => [...prev, newStep]);
  };

  const deleteStep = (tempId: string) => {
    setSteps(prev => prev.map(s => s.tempId === tempId ? { ...s, markedForDelete: true } : s));
  };

  // ── Sauvegarde ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const toDelete = steps.filter(s => s.markedForDelete && s.dbId);
      const toUpsert = steps.filter(s => !s.markedForDelete);

      // Re-number order_index séquentiellement par pas de 10
      const reordered = toUpsert.map((s, i) => ({ ...s, orderIndex: (i + 1) * 10 }));

      // Supprimer
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('sub_process_templates')
          .delete()
          .in('id', toDelete.map(s => s.dbId!));
        if (error) throw error;
      }

      // Upsert (insert ou update) — on capture tempId → dbId pour résoudre
      // ensuite les dépendances entre étapes (after_specific).
      const tempIdToDbId = new Map<string, string>();
      for (const s of reordered) {
        const payload: any = {
          name: `${prestationName} — ${s.stepLabel}`,
          be_category: beCategory,
          process_template_id: BE_PROCESS_ID,
          order_index: s.orderIndex,
          parallel_group: s.parallelGroup,
          default_duration_hours: s.durationDays || null,   // stocké en heures
          dispatch_manager_id: s.dispatchManagerId || null,
          validation_level_1_type: valTypeToDb(s.val1Type),
          validation_level_1_user_id: s.val1Type === 'fixed_user' ? s.val1UserId || null : null,
          validation_level_2_type: valTypeToDb(s.val2Type),
          validation_level_2_user_id: s.val2Type === 'fixed_user' ? s.val2UserId || null : null,
          target_assignee_id: s.fixedUserId || null,
          // ── Enchaînement (depends_on résolu en 2e passe) ──
          start_mode: s.startMode,
          delay_after_previous_days: s.delayAfterPreviousDays || 0,
          // ── Jalon timeline ──
          is_milestone: s.isMilestone,
          milestone_label: s.isMilestone ? (s.milestoneLabel || null) : null,
          milestone_type_code: s.isMilestone ? (s.milestoneTypeCode || null) : null,
          auto_milestone_delay_days: s.autoMilestoneDelayDays,
          auto_milestone_label: s.autoMilestoneLabel || null,
          // ── Documents obligatoires ──
          required_docs_count: s.requiredDocsCount || 0,
          required_docs_description: s.requiredDocsDescription || null,
          required_docs_references: s.requiredDocsReferences || null,
          // ── État de sortie ──
          output_state_code: s.outputStateCode || null,
          is_shared: true,
        };
        if (s.dbId) {
          const { error } = await supabase
            .from('sub_process_templates')
            .update(payload)
            .eq('id', s.dbId);
          if (error) throw error;
          tempIdToDbId.set(s.tempId, s.dbId);
        } else {
          const { data: inserted, error } = await supabase
            .from('sub_process_templates')
            .insert(payload)
            .select('id')
            .single();
          if (error) throw error;
          if (inserted?.id) tempIdToDbId.set(s.tempId, inserted.id);
        }
      }

      // 2e passe : résolution des dépendances explicites (after_specific)
      for (const s of reordered) {
        const myDbId = tempIdToDbId.get(s.tempId);
        if (!myDbId) continue;
        const dependsDbId =
          s.startMode === 'after_specific' && s.dependsOnTempId
            ? tempIdToDbId.get(s.dependsOnTempId) ?? null
            : null;
        const { error } = await supabase
          .from('sub_process_templates')
          .update({ depends_on_sub_process_template_id: dependsDbId } as any)
          .eq('id', myDbId);
        if (error) throw error;
      }

      toast.success('Prestation sauvegardée');
      // Recharge proprement (ids des nouvelles étapes + dépendances résolues)
      setSteps(prev => prev.filter(s => !s.markedForDelete).map((s, i) => ({
        ...s,
        dbId: tempIdToDbId.get(s.tempId) ?? s.dbId,
        tempId: tempIdToDbId.get(s.tempId) ?? s.tempId,
        orderIndex: (i + 1) * 10,
        isNew: false,
      })));
    } catch (err: any) {
      console.error(err);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar activeView={activeView} onViewChange={setActiveView} />
        <div className="flex-1 p-8 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  const catLabel = beCategory === 'be_reglementaire' ? 'Réglementaire' : "Bureau d'Études";

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader title={prestationName} subtitle={`Flux de la prestation · ${catLabel}`} />

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* ── En-tête actions ── */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/templates')}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Modèles
            </Button>
            <div className="flex-1" />
            <Badge variant="outline" className="text-xs">
              <GitBranch className="w-3 h-3 mr-1" />
              {visibleSteps.length} étape{visibleSteps.length !== 1 ? 's' : ''}
            </Badge>
            <Badge variant="outline" className={cn('text-xs', beCategory === 'be_reglementaire' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700')}>
              {catLabel}
            </Badge>
            <Button size="sm" onClick={addStep} variant="outline">
              <Plus className="w-4 h-4 mr-1" /> Ajouter étape
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Sauvegarder
            </Button>
          </div>

          {/* ── Visualisation du flux ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700">Séquence du flux</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {visibleSteps.map((step, idx) => {
                  const color = getParallelColor(step.parallelGroup);
                  const logical = logicalOrder.get(step.tempId) ?? idx + 1;
                  const isFirstOfGroup = idx === 0 || visibleSteps[idx - 1].parallelGroup !== step.parallelGroup;

                  return (
                    <div
                      key={step.tempId}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all',
                        step.isNew && 'ring-2 ring-green-300',
                        color
                          ? `${color.bg} ${color.border} border-l-4`
                          : 'bg-white border-slate-200',
                        step.expanded && 'ring-1 ring-slate-300',
                      )}
                      onClick={() => updateStep(step.tempId, { expanded: !step.expanded })}
                    >
                      {/* Numéro logique */}
                      <span className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                        color ? `${color.badge}` : 'bg-slate-100 text-slate-600',
                      )}>
                        {logical}
                      </span>

                      {/* Nom */}
                      <span className="flex-1 text-sm font-medium text-slate-700 truncate">
                        {step.stepLabel}
                      </span>

                      {/* Badge parallèle */}
                      {step.parallelGroup !== null && isFirstOfGroup && (
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', color?.badge)}>
                          ‖ Groupe {step.parallelGroup}
                        </Badge>
                      )}

                      {/* Jalon */}
                      {step.isMilestone && (
                        <Flag className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                      )}

                      {/* Docs obligatoires */}
                      {step.requiredDocsCount > 0 && (
                        <span className="text-[10px] text-slate-400 flex-shrink-0 flex items-center gap-0.5">
                          <FileText className="w-3 h-3" />{step.requiredDocsCount}
                        </span>
                      )}

                      {/* Durée */}
                      {step.durationDays > 0 && (
                        <span className="text-xs text-slate-400 flex-shrink-0">{step.durationDays}h</span>
                      )}

                      {/* Contrôles */}
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveStep(step.tempId, 'up')} disabled={idx === 0}>
                          <ArrowUp className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveStep(step.tempId, 'down')} disabled={idx === visibleSteps.length - 1}>
                          <ArrowDown className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={() => deleteStep(step.tempId)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>

                      {/* Expand indicator */}
                      {step.expanded
                        ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                    </div>
                  );
                })}

                {visibleSteps.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    Aucune étape — cliquez sur « Ajouter étape »
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Panneaux d'édition (étapes expandées) ── */}
          {visibleSteps.filter(s => s.expanded).map(step => (
            <Card key={step.tempId} className="border-slate-300">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <span className="text-slate-400 font-normal">{prestationName} —</span>
                  <Input
                    value={step.stepLabel}
                    onChange={e => updateStep(step.tempId, { stepLabel: e.target.value })}
                    className="h-7 text-sm font-semibold border-none shadow-none p-0 focus-visible:ring-0 w-64"
                    placeholder="Nom de l'étape"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {/* Col 1 */}
                  <div className="space-y-4">
                    {/* Durée */}
                    <div>
                      <Label className="text-xs">Durée (heures)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={step.durationDays}
                        onChange={e => updateStep(step.tempId, { durationDays: parseInt(e.target.value) || 0 })}
                        className="h-8 text-sm mt-1"
                      />
                    </div>

                    {/* Groupe parallèle */}
                    <div>
                      <Label className="text-xs">Groupe parallèle</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          min={1}
                          placeholder="null = séquentiel"
                          value={step.parallelGroup ?? ''}
                          onChange={e => {
                            const v = e.target.value ? parseInt(e.target.value) : null;
                            updateStep(step.tempId, { parallelGroup: v });
                          }}
                          className="h-8 text-sm flex-1"
                        />
                        {step.parallelGroup !== null && (
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-slate-400"
                            onClick={() => updateStep(step.tempId, { parallelGroup: null })}
                            title="Rendre séquentiel"
                          >
                            <Unlink className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {step.parallelGroup === null && (
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-blue-400"
                            onClick={() => {
                              const maxGroup = Math.max(0, ...visibleSteps.map(s => s.parallelGroup ?? 0));
                              updateStep(step.tempId, { parallelGroup: maxGroup + 1 });
                            }}
                            title="Rendre parallèle"
                          >
                            <Link className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Les étapes avec le même numéro de groupe s'exécutent en parallèle
                      </p>
                    </div>

                    {/* Utilisateur fixe (assigné automatiquement) */}
                    <div>
                      <Label className="text-xs">Assigné fixe (optionnel)</Label>
                      <Select
                        value={step.fixedUserId || 'none'}
                        onValueChange={v => updateStep(step.tempId, { fixedUserId: v === 'none' ? '' : v })}
                      >
                        <SelectTrigger className="h-8 text-sm mt-1">
                          <SelectValue placeholder="Aucun" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun</SelectItem>
                          {profiles.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.display_name ?? p.id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Col 2 */}
                  <div className="space-y-4">
                    {/* Dispatcher */}
                    <div>
                      <Label className="text-xs">Dispatcher</Label>
                      <Select
                        value={step.dispatchManagerId || 'none'}
                        onValueChange={v => updateStep(step.tempId, { dispatchManagerId: v === 'none' ? '' : v })}
                      >
                        <SelectTrigger className="h-8 text-sm mt-1">
                          <SelectValue placeholder="Aucun" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun</SelectItem>
                          {profiles.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.display_name ?? p.id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Validation L1 */}
                    <div>
                      <Label className="text-xs">Validation niveau 1</Label>
                      <Select
                        value={step.val1Type}
                        onValueChange={v => updateStep(step.tempId, { val1Type: v as ValType })}
                      >
                        <SelectTrigger className="h-8 text-sm mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VAL_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {step.val1Type === 'fixed_user' && (
                        <Select
                          value={step.val1UserId || 'none'}
                          onValueChange={v => updateStep(step.tempId, { val1UserId: v === 'none' ? '' : v })}
                        >
                          <SelectTrigger className="h-8 text-sm mt-1">
                            <SelectValue placeholder="Choisir validateur" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {profiles.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.display_name ?? p.id}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* Validation L2 */}
                    <div>
                      <Label className="text-xs">Validation niveau 2</Label>
                      <Select
                        value={step.val2Type}
                        onValueChange={v => updateStep(step.tempId, { val2Type: v as ValType })}
                      >
                        <SelectTrigger className="h-8 text-sm mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VAL_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {step.val2Type === 'fixed_user' && (
                        <Select
                          value={step.val2UserId || 'none'}
                          onValueChange={v => updateStep(step.tempId, { val2UserId: v === 'none' ? '' : v })}
                        >
                          <SelectTrigger className="h-8 text-sm mt-1">
                            <SelectValue placeholder="Choisir validateur" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {profiles.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.display_name ?? p.id}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </div>

                {/* ════ Enchaînement ════ */}
                <div className="mt-5 pt-4 border-t">
                  <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5" /> Enchaînement
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Démarrage de l'étape</Label>
                      <Select
                        value={step.startMode}
                        onValueChange={v => updateStep(step.tempId, { startMode: v as StartMode })}
                      >
                        <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {START_MODE_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Délai après la précédente (jours)</Label>
                      <Input
                        type="number" min={0}
                        value={step.delayAfterPreviousDays}
                        onChange={e => updateStep(step.tempId, { delayAfterPreviousDays: parseInt(e.target.value) || 0 })}
                        className="h-8 text-sm mt-1"
                      />
                    </div>
                    {step.startMode === 'after_specific' && (
                      <div className="col-span-2">
                        <Label className="text-xs">Dépend de l'étape</Label>
                        <Select
                          value={step.dependsOnTempId || 'none'}
                          onValueChange={v => updateStep(step.tempId, { dependsOnTempId: v === 'none' ? '' : v })}
                        >
                          <SelectTrigger className="h-8 text-sm mt-1">
                            <SelectValue placeholder="Choisir l'étape prérequise" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {visibleSteps
                              .filter(o => o.tempId !== step.tempId)
                              .map(o => (
                                <SelectItem key={o.tempId} value={o.tempId}>
                                  {logicalOrder.get(o.tempId) ?? '?'}. {o.stepLabel}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>

                {/* ════ Jalon timeline ════ */}
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <Flag className="w-3.5 h-3.5" /> Jalon timeline
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={step.isMilestone}
                      onCheckedChange={c => updateStep(step.tempId, { isMilestone: !!c })}
                    />
                    <span className="text-sm text-slate-700">Marquer comme jalon sur la timeline du projet</span>
                  </label>
                  {step.isMilestone && (
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div className="col-span-2">
                        <Label className="text-xs">Type de jalon (référentiel)</Label>
                        <Select
                          value={step.milestoneTypeCode || '__none__'}
                          onValueChange={v => updateStep(step.tempId, { milestoneTypeCode: v === '__none__' ? '' : v })}
                        >
                          <SelectTrigger className="h-8 text-sm mt-1">
                            <SelectValue placeholder="Choisir le type de jalon…" />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            <SelectItem value="__none__">— Aucun (jalon générique) —</SelectItem>
                            {['reglementaire', 'projet'].map(cat => {
                              const list = milestoneTypes.filter(t => t.category === cat);
                              if (list.length === 0) return null;
                              return (
                                <div key={cat}>
                                  <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                                    {cat === 'reglementaire' ? 'Réglementaire' : 'Projet'}
                                  </p>
                                  {list.map(t => <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>)}
                                </div>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          À la validation de l'étape, la date réelle du jalon de ce type est posée automatiquement sur le projet.
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs flex items-center gap-1">
                          <Milestone className="w-3 h-3" /> Jalon différé J+ (jours)
                        </Label>
                        <Input
                          type="number" min={0}
                          value={step.autoMilestoneDelayDays ?? ''}
                          onChange={e => updateStep(step.tempId, {
                            autoMilestoneDelayDays: e.target.value ? parseInt(e.target.value) : null,
                          })}
                          placeholder="Aucun"
                          className="h-8 text-sm mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Libellé jalon différé</Label>
                        <Input
                          value={step.autoMilestoneLabel}
                          onChange={e => updateStep(step.tempId, { autoMilestoneLabel: e.target.value })}
                          placeholder="Optionnel"
                          className="h-8 text-sm mt-1"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* ════ Documents obligatoires ════ */}
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Documents obligatoires
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Nombre de documents requis</Label>
                      <Input
                        type="number" min={0}
                        value={step.requiredDocsCount}
                        onChange={e => updateStep(step.tempId, { requiredDocsCount: parseInt(e.target.value) || 0 })}
                        className="h-8 text-sm mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Description des documents</Label>
                      <Input
                        value={step.requiredDocsDescription}
                        onChange={e => updateStep(step.tempId, { requiredDocsDescription: e.target.value })}
                        placeholder="Ex: Dossier, Plans…"
                        className="h-8 text-sm mt-1"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Références / titres des documents requis</Label>
                      <Textarea
                        value={step.requiredDocsReferences}
                        onChange={e => updateStep(step.tempId, { requiredDocsReferences: e.target.value })}
                        placeholder="Un titre de document par ligne (ex : Plan de masse, Étude d'impact, Récépissé de dépôt…)"
                        rows={3}
                        className="text-sm mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* ════ État de sortie ════ */}
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
                    État de la demande à la complétion de cette étape
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">État en sortie</Label>
                      <Select
                        value={step.outputStateCode || 'none'}
                        onValueChange={v => updateStep(step.tempId, { outputStateCode: v === 'none' ? '' : v })}
                      >
                        <SelectTrigger className="h-8 text-sm mt-1">
                          <SelectValue placeholder="Aucun changement" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun changement</SelectItem>
                          {requestStates.map(st => (
                            <SelectItem key={st.code} value={st.code}>{st.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Catégorie d'état (auto)</Label>
                      <div className="h-8 mt-1 flex items-center">
                        {step.outputStateCode && categoryOfState(step.outputStateCode) ? (
                          <Badge variant="outline" className="text-xs">
                            {STATE_CATEGORY_LABELS[categoryOfState(step.outputStateCode)!] ?? categoryOfState(step.outputStateCode)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400 italic">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
