/**
 * ITPrestationSettings — Édition d'une prestation IT existante.
 *
 * Clone de BEPrestationSettings, avec adaptations IT :
 *  • Identité : nom, description, dispatcher (= cible d'auto-affectation pour IT)
 *  • Cible auto-affectation : enregistrée aussi dans process_templates.settings
 *    .default_assignee_profile_id (consommée par trigger handle_it_request_submission)
 *  • Flag « Requiert CDC en pièce jointe » (Application dédiée par défaut)
 *  • Étapes : titre, durée, validations niv. 1 & 2 — ajoute le type « team »
 *    (équipe IT — peer review) en plus de manager/requester/fixed_user
 *  • Pas de be_category (IT n'a pas de sous-catégorie réglementaire/non-réglementaire)
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatchedRouteParam } from '@/hooks/useMatchedRouteParam';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Save, Plus, Trash2, ArrowUp, ArrowDown, GripVertical,
  Wand2, Loader2, Paperclip, Flag, ChevronDown, ChevronRight, ListChecks, GitBranch,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ValType = 'none' | 'requester' | 'manager' | 'fixed_user' | 'team';

const VAL_OPTIONS_LEVEL1: { value: ValType; label: string }[] = [
  { value: 'none',       label: 'Aucune' },
  { value: 'team',       label: 'Équipe IT (peer review)' },
  { value: 'requester',  label: 'Demandeur' },
  { value: 'manager',    label: 'Manager du demandeur' },
  { value: 'fixed_user', label: 'Utilisateur fixe' },
];

const VAL_OPTIONS_LEVEL2: { value: ValType; label: string }[] = [
  { value: 'none',       label: 'Aucune' },
  { value: 'requester',  label: 'Demandeur' },
  { value: 'team',       label: 'Équipe IT' },
  { value: 'manager',    label: 'Manager du demandeur' },
  { value: 'fixed_user', label: 'Utilisateur fixe' },
];

/** Prestations IT qui exigent un CDC en pièce jointe (cf. useITRequests.ts) */
const IT_PRESTATIONS_REQUIRING_CDC: string[] = [
  '11111111-1111-4111-8111-111111111310', // Application dédiée
];

interface Profile { id: string; display_name: string | null; }

interface SubAction {
  dbId: string | null;
  tempId: string;
  title: string;
  is_required: boolean;
}

type StartMode = 'parallel' | 'after_previous' | 'after_specific';

interface StepDraft {
  dbId: string | null;
  tempId: string;
  title: string;
  duration_days: number;
  val1_type: ValType;
  val1_user_id: string;
  val2_type: ValType;
  val2_user_id: string;
  required_docs_count: number;
  required_docs_description: string;
  is_milestone: boolean;
  milestone_label: string;
  auto_milestone_delay_days: number | null;
  auto_milestone_label: string;
  /** Dépendance de démarrage */
  start_mode: StartMode;
  /** ID (dbId ou tempId) de l'étape à attendre, si start_mode = after_specific */
  depends_on_temp_id: string | null;
  /** Délai (jours) à ajouter après la fin du prédécesseur. 0 = enchaîné immédiatement. */
  delay_after_previous_days: number;
  sub_actions: SubAction[];
  expanded: boolean;
}

const blankStep = (): StepDraft => ({
  dbId: null,
  tempId: crypto.randomUUID(),
  title: '',
  duration_days: 5,
  val1_type: 'none',
  val1_user_id: '',
  val2_type: 'none',
  val2_user_id: '',
  required_docs_count: 0,
  required_docs_description: '',
  is_milestone: false,
  milestone_label: '',
  auto_milestone_delay_days: null,
  auto_milestone_label: '',
  start_mode: 'parallel',
  depends_on_temp_id: null,
  delay_after_previous_days: 0,
  sub_actions: [],
  expanded: false,
});

// Map DB validation_level_X (text) → ValType
function dbToValType(dbValue: string | null, validatorId: string | null): ValType {
  if (!dbValue || dbValue === 'none') return 'none';
  if (dbValue === 'team') return 'team';
  if (dbValue === 'requester') return 'requester';
  if (dbValue === 'manager') return 'manager';
  // 'free' historique + validateur défini = utilisateur fixe
  if (validatorId) return 'fixed_user';
  return 'none';
}

// Map ValType → DB validation_level_X (text)
function valTypeToDb(t: ValType): string {
  if (t === 'fixed_user') return 'free'; // convention legacy
  return t; // 'none' | 'requester' | 'manager' | 'team'
}

export default function ITPrestationSettings() {
  const subProcessId = useMatchedRouteParam('subProcessId', '/templates/it-prestation/:subProcessId');
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [activeView, setActiveView] = useState('templates');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  // Identité (sub_process_template)
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dispatchManagerId, setDispatchManagerId] = useState('');

  // Identité (process_template parent — la prestation elle-même)
  const [processTemplateId, setProcessTemplateId] = useState<string | null>(null);
  const [prestationName, setPrestationName] = useState('');
  const [defaultAssigneeProfileId, setDefaultAssigneeProfileId] = useState('');
  const [requiresCdc, setRequiresCdc] = useState(false);

  // Étapes
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [deletedStepIds, setDeletedStepIds] = useState<string[]>([]);
  const [deletedSubActionIds, setDeletedSubActionIds] = useState<string[]>([]);

  useEffect(() => {
    if (!subProcessId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subProcessId]);

  const load = async () => {
    setIsLoading(true);
    try {
      const { data: sp, error: spErr } = await supabase
        .from('sub_process_templates').select('*').eq('id', subProcessId!).single();
      if (spErr) throw spErr;
      if (!sp) { navigate('/templates'); return; }

      setName(sp.name || '');
      setDescription(sp.description || '');
      setDispatchManagerId(sp.dispatch_manager_id || '');

      // Charge la prestation parente (process_template) pour exposer :
      //  - nom de la prestation (pour le titre)
      //  - cible d'auto-affectation (settings.default_assignee_profile_id)
      //  - flag CDC requis (settings.requires_cdc)
      const { data: pt } = await supabase
        .from('process_templates')
        .select('id, name, settings')
        .eq('id', sp.process_template_id)
        .maybeSingle();
      if (pt) {
        setProcessTemplateId(pt.id);
        setPrestationName(pt.name || '');
        const settings = (pt.settings as Record<string, any>) ?? {};
        setDefaultAssigneeProfileId(settings.default_assignee_profile_id ?? '');
        // requires_cdc : flag explicite OU appartenance à la liste hardcodée legacy
        setRequiresCdc(Boolean(settings.requires_cdc ?? IT_PRESTATIONS_REQUIRING_CDC.includes(pt.id)));
      }

      const { data: canManageData } = await supabase.rpc('can_manage_template', {
        _creator_id: sp.user_id,
      });
      setCanManage(Boolean(canManageData));

      const { data: tasks, error: tasksErr } = await (supabase as any)
        .from('task_templates')
        .select('id, title, default_duration_days, validation_level_1, validator_level_1_id, validation_level_2, validator_level_2_id, order_index, required_docs_count, required_docs_description, is_milestone, milestone_label, auto_milestone_delay_days, auto_milestone_label, start_mode, depends_on_task_template_id, delay_after_previous_days')
        .eq('sub_process_template_id', subProcessId!)
        .order('order_index', { ascending: true });
      if (tasksErr) throw tasksErr;

      const taskIds = (tasks || []).map((t: any) => t.id);
      let subActionsByTask = new Map<string, any[]>();
      if (taskIds.length > 0) {
        const { data: subs } = await (supabase as any)
          .from('task_template_sub_actions')
          .select('*')
          .in('task_template_id', taskIds)
          .order('order_index', { ascending: true });
        for (const sa of (subs || [])) {
          const list = subActionsByTask.get(sa.task_template_id) || [];
          list.push(sa);
          subActionsByTask.set(sa.task_template_id, list);
        }
      }

      // 1er passage : construire les drafts avec tempId
      const drafts: StepDraft[] = (tasks || []).map((t: any) => ({
        dbId: t.id,
        tempId: crypto.randomUUID(),
        title: t.title || '',
        duration_days: t.default_duration_days ?? 5,
        val1_type: dbToValType(t.validation_level_1, t.validator_level_1_id),
        val1_user_id: t.validator_level_1_id || '',
        val2_type: dbToValType(t.validation_level_2, t.validator_level_2_id),
        val2_user_id: t.validator_level_2_id || '',
        required_docs_count: t.required_docs_count ?? 0,
        required_docs_description: t.required_docs_description ?? '',
        is_milestone: t.is_milestone ?? false,
        milestone_label: t.milestone_label ?? '',
        auto_milestone_delay_days: t.auto_milestone_delay_days ?? null,
        auto_milestone_label: t.auto_milestone_label ?? '',
        start_mode: (t.start_mode as StartMode) || 'parallel',
        depends_on_temp_id: null, // résolu juste après
        delay_after_previous_days: t.delay_after_previous_days ?? 0,
        sub_actions: (subActionsByTask.get(t.id) || []).map((sa: any) => ({
          dbId: sa.id,
          tempId: crypto.randomUUID(),
          title: sa.title,
          is_required: sa.is_required ?? false,
        })),
        expanded: false,
      }));
      // 2e passage : résoudre les dépendances explicites (after_specific) → tempId
      const byDbId = new Map(drafts.filter(d => d.dbId).map(d => [d.dbId!, d.tempId]));
      for (let i = 0; i < drafts.length; i++) {
        const raw = (tasks as any[])[i];
        if (drafts[i].start_mode === 'after_specific' && raw.depends_on_task_template_id) {
          drafts[i].depends_on_temp_id = byDbId.get(raw.depends_on_task_template_id) ?? null;
        }
      }
      setSteps(drafts);
      setDeletedStepIds([]);
      setDeletedSubActionIds([]);

      const { data: profs } = await supabase
        .from('profiles').select('id, display_name').eq('status', 'active').order('display_name');
      setProfiles((profs || []) as Profile[]);
    } catch (err) {
      console.error(err);
      toast.error('Erreur de chargement');
      navigate('/templates');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Édition ─────────────────────────────────────────────────
  const updateStep = (tempId: string, patch: Partial<StepDraft>) => {
    setSteps((prev) => prev.map((s) => (s.tempId === tempId ? { ...s, ...patch } : s)));
  };

  const addStep = () => setSteps((prev) => [...prev, { ...blankStep(), expanded: true }]);

  const removeStep = (tempId: string) => {
    setSteps((prev) => {
      const target = prev.find((s) => s.tempId === tempId);
      if (target?.dbId) setDeletedStepIds((ids) => [...ids, target.dbId!]);
      // Marque aussi les sub-actions DB pour suppression
      if (target) {
        const subDbIds = target.sub_actions.filter(sa => sa.dbId).map(sa => sa.dbId!);
        if (subDbIds.length > 0) setDeletedSubActionIds((ids) => [...ids, ...subDbIds]);
      }
      return prev.filter((s) => s.tempId !== tempId);
    });
  };

  const moveStep = (tempId: string, dir: -1 | 1) => {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.tempId === tempId);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const addSubAction = (stepTempId: string) => {
    updateStep(stepTempId, {
      sub_actions: [
        ...(steps.find(s => s.tempId === stepTempId)?.sub_actions || []),
        { dbId: null, tempId: crypto.randomUUID(), title: '', is_required: false },
      ],
    });
  };

  const updateSubAction = (stepTempId: string, subTempId: string, patch: Partial<SubAction>) => {
    const step = steps.find(s => s.tempId === stepTempId);
    if (!step) return;
    updateStep(stepTempId, {
      sub_actions: step.sub_actions.map(sa => sa.tempId === subTempId ? { ...sa, ...patch } : sa),
    });
  };

  const removeSubAction = (stepTempId: string, subTempId: string) => {
    const step = steps.find(s => s.tempId === stepTempId);
    if (!step) return;
    const target = step.sub_actions.find(sa => sa.tempId === subTempId);
    if (target?.dbId) setDeletedSubActionIds((ids) => [...ids, target.dbId!]);
    updateStep(stepTempId, {
      sub_actions: step.sub_actions.filter(sa => sa.tempId !== subTempId),
    });
  };

  // ─── Validation ──────────────────────────────────────────────
  // Étape unique (modèle IT) tolérée : steps vide est OK tant que sub_process_template existe.
  const identityValid = name.trim().length > 0 && dispatchManagerId !== '';
  const stepsValid = steps.every((s) => s.title.trim().length > 0);
  const canSave = identityValid && stepsValid && !isSaving;

  // ─── Save ────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user || !subProcessId || !canSave) return;
    setIsSaving(true);
    try {
      // 1a. Update sub_process_template (cœur de la prestation IT — mono-étape par défaut)
      const firstStep = steps[0];
      const subProcessUpdate: Record<string, any> = {
        name: name.trim(),
        description: description.trim() || null,
        dispatch_manager_id: dispatchManagerId,
      };
      // Si une étape unique existe, on remonte ses validations N1/N2 + durée
      // sur le sub_process_template lui-même (utilisé par useITPendingValidations
      // et IT_REQUEST_STATUS_META pour le routage des validations).
      if (firstStep) {
        subProcessUpdate.validation_level_1_type =
          firstStep.val1_type === 'none' ? null : firstStep.val1_type === 'fixed_user' ? 'fixed_user' : firstStep.val1_type;
        subProcessUpdate.validation_level_1_user_id =
          firstStep.val1_type === 'fixed_user' && firstStep.val1_user_id ? firstStep.val1_user_id : null;
        subProcessUpdate.validation_level_2_type =
          firstStep.val2_type === 'none' ? null : firstStep.val2_type === 'fixed_user' ? 'fixed_user' : firstStep.val2_type;
        subProcessUpdate.validation_level_2_user_id =
          firstStep.val2_type === 'fixed_user' && firstStep.val2_user_id ? firstStep.val2_user_id : null;
        subProcessUpdate.default_duration_hours = (firstStep.duration_days || 0) * 8; // jours → heures (~ journée 8h)
      }
      const { error: spErr } = await supabase
        .from('sub_process_templates')
        .update(subProcessUpdate)
        .eq('id', subProcessId);
      if (spErr) throw spErr;

      // 1b. Update process_template.settings (cible auto-affectation + flag CDC)
      if (processTemplateId) {
        const { data: existing } = await supabase
          .from('process_templates').select('settings').eq('id', processTemplateId).maybeSingle();
        const prevSettings = (existing?.settings as Record<string, any>) ?? {};
        const nextSettings = {
          ...prevSettings,
          default_assignee_profile_id: defaultAssigneeProfileId || null,
          requires_cdc: requiresCdc,
        };
        const { error: ptErr } = await supabase
          .from('process_templates')
          .update({ settings: nextSettings })
          .eq('id', processTemplateId);
        if (ptErr) throw ptErr;
      }

      // 2. Delete removed steps + sub-actions
      if (deletedStepIds.length > 0) {
        await supabase.from('task_templates').delete().in('id', deletedStepIds);
      }
      if (deletedSubActionIds.length > 0) {
        await (supabase as any).from('task_template_sub_actions').delete().in('id', deletedSubActionIds);
      }

      // 3. Update/insert chaque étape (séquentiel pour récupérer l'id)
      // Index temp_id → db_id pour résoudre les dépendances après insert
      const tempToDbId = new Map<string, string>();
      for (const s of steps) {
        if (s.dbId) tempToDbId.set(s.tempId, s.dbId);
      }

      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        const orderIndex = (i + 1) * 10;
        // Résout l'id de la dépendance explicite (si encore inconnu → 2nd passage plus bas)
        const dependsOnDbId = s.start_mode === 'after_specific' && s.depends_on_temp_id
          ? tempToDbId.get(s.depends_on_temp_id) ?? null
          : null;
        const row: any = {
          title: s.title.trim(),
          default_duration_days: s.duration_days,
          default_duration_unit: 'days',
          validation_level_1: valTypeToDb(s.val1_type),
          validator_level_1_id: s.val1_type === 'fixed_user' && s.val1_user_id ? s.val1_user_id : null,
          validation_level_2: valTypeToDb(s.val2_type),
          validator_level_2_id: s.val2_type === 'fixed_user' && s.val2_user_id ? s.val2_user_id : null,
          order_index: orderIndex,
          required_docs_count: s.required_docs_count,
          required_docs_description: s.required_docs_description.trim() || null,
          is_milestone: s.is_milestone,
          milestone_label: s.is_milestone ? (s.milestone_label.trim() || s.title.trim()) : null,
          auto_milestone_delay_days: s.is_milestone && s.auto_milestone_delay_days ? s.auto_milestone_delay_days : null,
          auto_milestone_label: s.is_milestone && s.auto_milestone_delay_days ? (s.auto_milestone_label.trim() || null) : null,
          start_mode: s.start_mode,
          depends_on_task_template_id: dependsOnDbId,
          delay_after_previous_days: s.delay_after_previous_days || 0,
        };

        let taskId: string;
        if (s.dbId) {
          const { error } = await (supabase as any).from('task_templates').update(row).eq('id', s.dbId);
          if (error) throw error;
          taskId = s.dbId;
        } else {
          const { data: inserted, error } = await (supabase as any).from('task_templates').insert({
            ...row,
            sub_process_template_id: subProcessId,
            process_template_id: null,
            priority: 'medium',
            description: null,
            visibility_level: 'public',
            is_shared: true,
            creator_company_id: profile?.company_id ?? null,
            creator_department_id: profile?.department_id ?? null,
            user_id: user.id,
          }).select('id').single();
          if (error) throw error;
          taskId = inserted.id;
          tempToDbId.set(s.tempId, taskId);
        }

        // 4. Sub-actions de cette étape : update existantes + insert nouvelles
        for (let j = 0; j < s.sub_actions.length; j++) {
          const sa = s.sub_actions[j];
          if (!sa.title.trim()) continue;
          const saRow = {
            title: sa.title.trim(),
            is_required: sa.is_required,
            order_index: (j + 1) * 10,
          };
          if (sa.dbId) {
            await (supabase as any).from('task_template_sub_actions').update(saRow).eq('id', sa.dbId);
          } else {
            await (supabase as any).from('task_template_sub_actions').insert({
              ...saRow,
              task_template_id: taskId,
            });
          }
        }
      }

      // 5. 2nd passage : résolution des dépendances vers étapes nouvellement créées
      //    (lors du 1er passage, leur dbId n'existait pas encore)
      for (const s of steps) {
        if (s.start_mode !== 'after_specific' || !s.depends_on_temp_id) continue;
        const myDbId = tempToDbId.get(s.tempId);
        const targetDbId = tempToDbId.get(s.depends_on_temp_id);
        if (!myDbId || !targetDbId) continue;
        await (supabase as any)
          .from('task_templates')
          .update({ depends_on_task_template_id: targetDbId })
          .eq('id', myDbId);
      }

      toast.success('Prestation mise à jour');
      await load();
    } catch (err: any) {
      console.error(err);
      toast.error(`Erreur lors de la sauvegarde : ${err.message ?? err}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar activeView={activeView} onViewChange={setActiveView} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <PageHeader title="Chargement…" />
          <main className="flex-1 overflow-y-auto p-6 space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader
          title={
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Wand2 className="h-5 w-5 text-cyan-500" />
              <span className="truncate">{prestationName || name || 'Prestation IT'}</span>
              <Badge variant="outline" className="text-[10px] bg-cyan-50 text-cyan-700 border-cyan-200">IT</Badge>
              {requiresCdc && (
                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                  📎 CDC requis
                </Badge>
              )}
            </div>
          }
        />

        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-4xl mx-auto space-y-6">

            {!canManage && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 px-4 py-2.5 text-sm">
                Lecture seule — tu n'as pas les droits pour modifier cette prestation.
              </div>
            )}

            {/* ── Identité ─────────────────────────────── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Identité</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom de la prestation *</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Ex : Expertise acoustique" disabled={!canManage} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">Description</Label>
                  <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="Contexte, périmètre, livrables attendus…" rows={2} disabled={!canManage} />
                </div>
                <div className="space-y-2">
                  <Label>Dispatcher (responsable d'affectation) *</Label>
                  <Select value={dispatchManagerId || '__none__'}
                    onValueChange={(v) => setDispatchManagerId(v === '__none__' ? '' : v)} disabled={!canManage}>
                    <SelectTrigger><SelectValue placeholder="Choisir le dispatcher…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Choisir —</SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.display_name ?? 'Sans nom'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* ── Configuration IT ─────────────────────── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Configuration IT</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Comportement à la création d'une demande IT pour cette prestation.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Cible d'auto-affectation</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Profil affecté automatiquement à chaque nouvelle demande de cette prestation
                    (trigger <code>handle_it_request_submission</code>). Si vide, la demande reste
                    en statut <code>affectee</code> sans assignee.
                  </p>
                  <Select value={defaultAssigneeProfileId || '__none__'}
                    onValueChange={(v) => setDefaultAssigneeProfileId(v === '__none__' ? '' : v)} disabled={!canManage}>
                    <SelectTrigger><SelectValue placeholder="— Aucune cible —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Aucune cible (dispatch manuel) —</SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.display_name ?? 'Sans nom'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm">📎 CDC requis en pièce jointe</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Bloque le wizard de création tant que le Cahier des Charges n'est pas joint
                      (Application dédiée par défaut).
                    </p>
                  </div>
                  <Switch checked={requiresCdc} onCheckedChange={setRequiresCdc} disabled={!canManage} />
                </div>
              </CardContent>
            </Card>

            {/* ── Étapes ───────────────────────────────── */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm">Étapes ({steps.length})</CardTitle>
                {canManage && (
                  <Button size="sm" variant="outline" onClick={addStep} className="gap-1">
                    <Plus className="h-4 w-4" /> Ajouter une étape
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {steps.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic text-center py-6">
                    Aucune étape. Ajoute la première étape de cette prestation.
                  </p>
                ) : (
                  steps.map((s, idx) => (
                    <StepEditor
                      key={s.tempId}
                      step={s}
                      index={idx}
                      total={steps.length}
                      canManage={canManage}
                      profiles={profiles}
                      allSteps={steps}
                      onUpdate={(patch) => updateStep(s.tempId, patch)}
                      onMove={(dir) => moveStep(s.tempId, dir)}
                      onRemove={() => removeStep(s.tempId)}
                      onAddSubAction={() => addSubAction(s.tempId)}
                      onUpdateSubAction={(saTempId, patch) => updateSubAction(s.tempId, saTempId, patch)}
                      onRemoveSubAction={(saTempId) => removeSubAction(s.tempId, saTempId)}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            {canManage && (
              <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t -mx-6 px-6 py-3 flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => navigate(-1)}>Annuler</Button>
                <Button onClick={handleSave} disabled={!canSave}
                  className="gap-2 bg-amber-500 hover:bg-amber-600 text-white">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Enregistrer
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Sous-composant : éditeur d'une étape (avec section dépliable « Avancé »)
// ════════════════════════════════════════════════════════════════════════
function StepEditor({
  step, index, total, canManage, profiles, allSteps,
  onUpdate, onMove, onRemove,
  onAddSubAction, onUpdateSubAction, onRemoveSubAction,
}: {
  step: StepDraft;
  index: number;
  total: number;
  canManage: boolean;
  profiles: Profile[];
  allSteps: StepDraft[];
  onUpdate: (patch: Partial<StepDraft>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onAddSubAction: () => void;
  onUpdateSubAction: (tempId: string, patch: Partial<SubAction>) => void;
  onRemoveSubAction: (tempId: string) => void;
}) {
  const advancedSummary: string[] = [];
  if (step.start_mode === 'after_previous') advancedSummary.push('Après précédente');
  else if (step.start_mode === 'after_specific') advancedSummary.push('Dépendance');
  if (step.required_docs_count > 0) advancedSummary.push(`${step.required_docs_count} doc${step.required_docs_count > 1 ? 's' : ''}`);
  if (step.is_milestone) advancedSummary.push('Jalon');
  if (step.sub_actions.length > 0) advancedSummary.push(`${step.sub_actions.length} sous-action${step.sub_actions.length > 1 ? 's' : ''}`);

  // Liste des autres étapes pour le sélecteur de dépendance
  const otherSteps = allSteps.filter(s => s.tempId !== step.tempId);

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-card">
      {/* Ligne titre + actions */}
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        <Badge variant="outline" className="shrink-0 text-xs w-6 h-6 flex items-center justify-center p-0">
          {index + 1}
        </Badge>
        <Input value={step.title} onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Titre de l'étape *" className="flex-1" disabled={!canManage} />
        {canManage && (
          <div className="flex items-center gap-1 shrink-0">
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
              disabled={index === 0} onClick={() => onMove(-1)}>
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
              disabled={index === total - 1} onClick={() => onMove(1)}>
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onRemove}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Durée + validations */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-8">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Durée (jours)</Label>
          <Input type="number" min={1} value={step.duration_days}
            onChange={(e) => onUpdate({ duration_days: Math.max(1, parseInt(e.target.value) || 1) })}
            className="h-8" disabled={!canManage} />
        </div>
        <ValidationField label="Validation niv. 1" type={step.val1_type} userId={step.val1_user_id}
          options={VAL_OPTIONS_LEVEL1} profiles={profiles} disabled={!canManage}
          onTypeChange={(t) => onUpdate({ val1_type: t, val1_user_id: t === 'fixed_user' ? step.val1_user_id : '' })}
          onUserChange={(uid) => onUpdate({ val1_user_id: uid })} />
        <ValidationField label="Validation niv. 2" type={step.val2_type} userId={step.val2_user_id}
          options={VAL_OPTIONS_LEVEL2} profiles={profiles} disabled={!canManage}
          onTypeChange={(t) => onUpdate({ val2_type: t, val2_user_id: t === 'fixed_user' ? step.val2_user_id : '' })}
          onUserChange={(uid) => onUpdate({ val2_user_id: uid })} />
      </div>

      {/* Toggle « Avancé » */}
      <button type="button" onClick={() => onUpdate({ expanded: !step.expanded })}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 pl-8">
        {step.expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Options avancées
        {!step.expanded && advancedSummary.length > 0 && (
          <span className="ml-1 text-[10px] text-amber-700">· {advancedSummary.join(' · ')}</span>
        )}
      </button>

      {step.expanded && (
        <div className="pl-8 space-y-4 pt-2 border-t">
          {/* ── Dépendance entre étapes ────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs font-semibold">Quand cette étape démarre-t-elle ?</Label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <DepModeButton
                active={step.start_mode === 'parallel'}
                disabled={!canManage}
                onClick={() => onUpdate({ start_mode: 'parallel', depends_on_temp_id: null })}
                title="En parallèle"
                desc="Démarre en même temps que les autres étapes"
              />
              <DepModeButton
                active={step.start_mode === 'after_previous'}
                disabled={!canManage || index === 0}
                onClick={() => onUpdate({ start_mode: 'after_previous', depends_on_temp_id: null })}
                title="Après la précédente"
                desc={index === 0 ? 'Indispo : pas d\'étape avant' : 'Attend la fin de l\'étape n°' + index}
              />
              <DepModeButton
                active={step.start_mode === 'after_specific'}
                disabled={!canManage || otherSteps.length === 0}
                onClick={() => onUpdate({ start_mode: 'after_specific' })}
                title="Après une étape précise"
                desc="Choisis laquelle ci-dessous"
              />
            </div>
            {step.start_mode === 'after_specific' && (
              <Select
                value={step.depends_on_temp_id ?? '__none__'}
                onValueChange={(v) => onUpdate({ depends_on_temp_id: v === '__none__' ? null : v })}
                disabled={!canManage || otherSteps.length === 0}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choisir l'étape déclencheur…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Aucune —</SelectItem>
                  {otherSteps.map((other) => {
                    const otherIdx = allSteps.findIndex(s => s.tempId === other.tempId);
                    return (
                      <SelectItem key={other.tempId} value={other.tempId} className="text-xs">
                        n°{otherIdx + 1} — {other.title || '(sans titre)'}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}

            {/* Délai après la précédente — affiché pour after_previous OU after_specific */}
            {(step.start_mode === 'after_previous' || step.start_mode === 'after_specific') && (
              <div className="space-y-1 pt-1">
                <Label className="text-[10px] text-muted-foreground">
                  Délai (jours) à attendre après la fin de l'étape précédente
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={step.delay_after_previous_days}
                  onChange={(e) => onUpdate({
                    delay_after_previous_days: Math.max(0, parseInt(e.target.value) || 0),
                  })}
                  placeholder="0 = enchaîné immédiatement"
                  className="h-8 text-xs w-40"
                  disabled={!canManage}
                />
                {step.delay_after_previous_days > 0 && (
                  <p className="text-[10px] text-muted-foreground italic">
                    Cette étape démarrera <strong>{step.delay_after_previous_days} jour{step.delay_after_previous_days > 1 ? 's' : ''}</strong> après la fin de la précédente.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Pièces obligatoires */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center gap-2">
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs font-semibold">Pièces obligatoires</Label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Nombre minimum</Label>
                <Input type="number" min={0} value={step.required_docs_count}
                  onChange={(e) => onUpdate({ required_docs_count: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="h-8 text-xs" disabled={!canManage} />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-[10px] text-muted-foreground">Description des pièces attendues</Label>
                <Input value={step.required_docs_description}
                  onChange={(e) => onUpdate({ required_docs_description: e.target.value })}
                  placeholder="Ex : PV de réception signé, plans à jour"
                  className="h-8 text-xs" disabled={!canManage} />
              </div>
            </div>
          </div>

          {/* Jalon timeline */}
          <div className={cn(
            'space-y-2 border-t pt-3 -mx-1 px-1 rounded-md transition-colors',
            step.is_milestone && 'bg-violet-50/40',
          )}>
            <label className={cn(
              'flex items-center gap-2 cursor-pointer select-none rounded-md p-1.5 -m-1.5 hover:bg-violet-50 transition-colors',
              !canManage && 'cursor-not-allowed opacity-70'
            )}>
              <Flag className={cn('h-3.5 w-3.5 shrink-0', step.is_milestone ? 'text-violet-600' : 'text-muted-foreground')} />
              <div className="flex-1">
                <span className="text-xs font-semibold">Jalon dans la timeline du projet</span>
                <p className="text-[10px] text-muted-foreground/80 leading-tight">
                  {step.is_milestone
                    ? 'Activé — la complétion de cette étape crée un point sur la timeline du projet'
                    : 'Coche pour faire apparaître cette étape comme une date-clé sur la timeline'}
                </p>
              </div>
              <Switch checked={step.is_milestone}
                onCheckedChange={(v) => onUpdate({ is_milestone: v })} disabled={!canManage} />
            </label>
            {step.is_milestone && (
              <div className="space-y-3 pl-1">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Libellé du jalon (laisser vide = titre de l'étape)</Label>
                  <Input value={step.milestone_label}
                    onChange={(e) => onUpdate({ milestone_label: e.target.value })}
                    placeholder="Ex : Dépôt PC"
                    className="h-8 text-xs" disabled={!canManage} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">+ Jalon auto à J+ (jours)</Label>
                    <Input type="number" min={1} placeholder="ex : 365"
                      value={step.auto_milestone_delay_days ?? ''}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        onUpdate({ auto_milestone_delay_days: isNaN(v) || v < 1 ? null : v });
                      }}
                      className="h-8 text-xs" disabled={!canManage} />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Libellé du jalon différé</Label>
                    <Input value={step.auto_milestone_label}
                      onChange={(e) => onUpdate({ auto_milestone_label: e.target.value })}
                      placeholder="Ex : Fin du délai de recours PC"
                      className="h-8 text-xs" disabled={!canManage || !step.auto_milestone_delay_days} />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  À la complétion : un jalon « {step.milestone_label.trim() || step.title.trim() || '...'} » est ajouté à la
                  timeline projet à la date de complétion.
                  {step.auto_milestone_delay_days && (
                    <> Un second jalon « {step.auto_milestone_label.trim() || '...'} » est créé automatiquement à J+{step.auto_milestone_delay_days}.</>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Sous-actions */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center gap-2">
              <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs font-semibold flex-1">
                Sous-actions ({step.sub_actions.length})
              </Label>
              {canManage && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onAddSubAction}>
                  <Plus className="h-3 w-3" /> Ajouter
                </Button>
              )}
            </div>
            {step.sub_actions.length === 0 ? (
              <p className="text-[10px] text-muted-foreground italic">
                Aucune sous-action. Ajoute des points de checklist additionnels à cocher pendant l'étape.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {step.sub_actions.map((sa) => (
                  <li key={sa.tempId} className="flex items-center gap-2">
                    <Input value={sa.title}
                      onChange={(e) => onUpdateSubAction(sa.tempId, { title: e.target.value })}
                      placeholder="Sous-action…" className="h-7 text-xs flex-1" disabled={!canManage} />
                    <label className="text-[10px] text-muted-foreground flex items-center gap-1 cursor-pointer">
                      <Switch checked={sa.is_required}
                        onCheckedChange={(v) => onUpdateSubAction(sa.tempId, { is_required: v })}
                        disabled={!canManage} />
                      Obligatoire
                    </label>
                    {canManage && (
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => onRemoveSubAction(sa.tempId)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ValidationField({
  label, type, userId, options, profiles, disabled, onTypeChange, onUserChange,
}: {
  label: string;
  type: ValType;
  userId: string;
  options: { value: ValType; label: string }[];
  profiles: Profile[];
  disabled: boolean;
  onTypeChange: (t: ValType) => void;
  onUserChange: (uid: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={type} onValueChange={(v) => onTypeChange(v as ValType)} disabled={disabled}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {type === 'fixed_user' && (
        <Select value={userId || '__none__'} onValueChange={(v) => onUserChange(v === '__none__' ? '' : v)} disabled={disabled}>
          <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Valideur…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Choisir —</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-xs">{p.display_name ?? 'Sans nom'}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function DepModeButton({
  active, disabled, onClick, title, desc,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'p-2 rounded-md border text-left transition-all',
        active
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-border hover:border-primary/40',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <p className={cn('text-xs font-medium', active && 'text-primary')}>{title}</p>
      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{desc}</p>
    </button>
  );
}
