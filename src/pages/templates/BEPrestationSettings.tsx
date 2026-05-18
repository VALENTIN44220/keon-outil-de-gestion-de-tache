/**
 * BEPrestationSettings — Édition d'une prestation BE existante.
 *
 * Mirroir exact des champs du wizard « Nouvelle prestation BE » :
 *  • Identité : nom, description, catégorie (be / be_reglementaire), dispatcher
 *  • Étapes : par tâche → titre, durée (jours), validations niv. 1 et 2
 *
 * Tous les autres réglages legacy (assignment fallback, workflow personnalisé,
 * watchers complexes, etc.) restent gérés via SubProcessSettings pour les
 * sous-processus non-BE.
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Save, Plus, Trash2, ArrowUp, ArrowDown, GripVertical,
  Wand2, Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const BE_CATEGORIES = [
  { value: 'be_reglementaire', label: 'Réglementaire' },
  { value: 'be',               label: "Bureau d'Études" },
] as const;

const VAL1_OPTIONS = [
  { value: 'none',       label: 'Aucune' },
  { value: 'fixed_user', label: 'Utilisateur fixe' },
] as const;

const VAL2_OPTIONS = [
  { value: 'none',       label: 'Aucune' },
  { value: 'requester',  label: 'Demandeur' },
  { value: 'fixed_user', label: 'Utilisateur fixe' },
] as const;

interface Profile { id: string; display_name: string | null; }

interface StepDraft {
  // id existant en base (null pour les nouvelles étapes ajoutées en local)
  dbId: string | null;
  // id temporaire stable pour React keys
  tempId: string;
  title: string;
  duration_days: number;
  val1_type: 'none' | 'fixed_user';
  val1_user_id: string;
  val2_type: 'none' | 'requester' | 'fixed_user';
  val2_user_id: string;
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
});

export default function BEPrestationSettings() {
  const subProcessId = useMatchedRouteParam('subProcessId', '/templates/be-prestation/:subProcessId');
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [activeView, setActiveView] = useState('templates');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  // Identité
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [beCategory, setBeCategory] = useState<'be' | 'be_reglementaire'>('be_reglementaire');
  const [dispatchManagerId, setDispatchManagerId] = useState('');

  // Étapes
  const [steps, setSteps] = useState<StepDraft[]>([]);
  // IDs d'étapes supprimées localement (à supprimer en base au save)
  const [deletedStepIds, setDeletedStepIds] = useState<string[]>([]);

  // ─── Chargement ───────────────────────────────────────────────
  useEffect(() => {
    if (!subProcessId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subProcessId]);

  const load = async () => {
    setIsLoading(true);
    try {
      const { data: sp, error: spErr } = await supabase
        .from('sub_process_templates')
        .select('*')
        .eq('id', subProcessId!)
        .single();
      if (spErr) throw spErr;
      if (!sp) { navigate('/templates'); return; }

      setName(sp.name || '');
      setDescription(sp.description || '');
      setBeCategory((sp.be_category as 'be' | 'be_reglementaire') || 'be_reglementaire');
      setDispatchManagerId(sp.dispatch_manager_id || '');

      // Permissions
      const { data: canManageData } = await supabase.rpc('can_manage_template', {
        _creator_id: sp.user_id,
      });
      setCanManage(Boolean(canManageData));

      // Étapes
      const { data: tasks, error: tasksErr } = await supabase
        .from('task_templates')
        .select('id, title, default_duration_days, validation_level_1, validator_level_1_id, validation_level_2, validator_level_2_id, order_index')
        .eq('sub_process_template_id', subProcessId!)
        .order('order_index', { ascending: true });
      if (tasksErr) throw tasksErr;

      setSteps(
        (tasks || []).map((t: any) => ({
          dbId: t.id,
          tempId: crypto.randomUUID(),
          title: t.title || '',
          duration_days: t.default_duration_days ?? 5,
          val1_type: t.validation_level_1 && t.validation_level_1 !== 'none' ? 'fixed_user' : 'none',
          val1_user_id: t.validator_level_1_id || '',
          val2_type: t.validation_level_2 === 'requester'
            ? 'requester'
            : t.validation_level_2 && t.validation_level_2 !== 'none'
              ? 'fixed_user'
              : 'none',
          val2_user_id: t.validator_level_2_id || '',
        })),
      );
      setDeletedStepIds([]);

      // Profiles
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('status', 'active')
        .order('display_name');
      setProfiles((profs || []) as Profile[]);
    } catch (err) {
      console.error(err);
      toast.error('Erreur de chargement');
      navigate('/templates');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Édition des étapes ───────────────────────────────────────
  const updateStep = (tempId: string, patch: Partial<StepDraft>) => {
    setSteps((prev) => prev.map((s) => (s.tempId === tempId ? { ...s, ...patch } : s)));
  };

  const addStep = () => setSteps((prev) => [...prev, blankStep()]);

  const removeStep = (tempId: string) => {
    setSteps((prev) => {
      const target = prev.find((s) => s.tempId === tempId);
      if (target?.dbId) setDeletedStepIds((ids) => [...ids, target.dbId!]);
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

  // ─── Validation ───────────────────────────────────────────────
  const identityValid = name.trim().length > 0 && dispatchManagerId !== '';
  const stepsValid = steps.length > 0 && steps.every((s) => s.title.trim().length > 0);
  const canSave = identityValid && stepsValid && !isSaving;

  // ─── Save ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user || !subProcessId || !canSave) return;
    setIsSaving(true);
    try {
      // 1. Update sub_process_template
      const { error: spErr } = await supabase
        .from('sub_process_templates')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          be_category: beCategory,
          dispatch_manager_id: dispatchManagerId,
        })
        .eq('id', subProcessId);
      if (spErr) throw spErr;

      // 2. Supprimer les étapes retirées
      if (deletedStepIds.length > 0) {
        const { error: delErr } = await supabase
          .from('task_templates')
          .delete()
          .in('id', deletedStepIds);
        if (delErr) throw delErr;
      }

      // 3. Update existantes + insert nouvelles
      const updates = steps.filter((s) => s.dbId);
      const inserts = steps.filter((s) => !s.dbId);

      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        const orderIndex = (i + 1) * 10;
        const row = {
          title: s.title.trim(),
          default_duration_days: s.duration_days,
          default_duration_unit: 'days' as const,
          validation_level_1: s.val1_type === 'fixed_user' ? 'free' : 'none',
          validator_level_1_id: s.val1_type === 'fixed_user' && s.val1_user_id ? s.val1_user_id : null,
          validation_level_2:
            s.val2_type === 'none'
              ? 'none'
              : s.val2_type === 'requester'
                ? 'requester'
                : 'free',
          validator_level_2_id: s.val2_type === 'fixed_user' && s.val2_user_id ? s.val2_user_id : null,
          order_index: orderIndex,
        };
        if (s.dbId) {
          const { error } = await supabase.from('task_templates').update(row).eq('id', s.dbId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('task_templates').insert({
            ...row,
            sub_process_template_id: subProcessId,
            process_template_id: null,
            priority: 'medium' as const,
            description: null,
            visibility_level: 'public' as const,
            is_shared: true,
            creator_company_id: profile?.company_id ?? null,
            creator_department_id: profile?.department_id ?? null,
            user_id: user.id,
          });
          if (error) throw error;
        }
      }
      void updates; void inserts; // (mentionné pour la lecture, non utilisé directement)

      toast.success('Prestation mise à jour');
      // Recharger pour récupérer les dbId des nouvelles étapes
      await load();
    } catch (err: any) {
      console.error(err);
      toast.error(`Erreur lors de la sauvegarde : ${err.message ?? err}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Rendu ────────────────────────────────────────────────────
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
              <Wand2 className="h-5 w-5 text-amber-500" />
              <span className="truncate">{name || 'Prestation BE'}</span>
              <Badge variant="outline" className="text-[10px]">
                {beCategory === 'be_reglementaire' ? 'Réglementaire' : "BE"}
              </Badge>
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
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex : Expertise acoustique"
                    disabled={!canManage}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="desc">Description</Label>
                  <Textarea
                    id="desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Contexte, périmètre, livrables attendus…"
                    rows={2}
                    disabled={!canManage}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Catégorie *</Label>
                  <div className="flex gap-3">
                    {BE_CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => canManage && setBeCategory(cat.value)}
                        disabled={!canManage}
                        className={`flex-1 py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition-colors ${
                          beCategory === cat.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-muted hover:border-muted-foreground/40'
                        } ${!canManage ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Dispatcher (responsable d'affectation) *</Label>
                  <Select
                    value={dispatchManagerId || '__none__'}
                    onValueChange={(v) => setDispatchManagerId(v === '__none__' ? '' : v)}
                    disabled={!canManage}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir le dispatcher…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Choisir —</SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.display_name ?? 'Sans nom'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Ce collaborateur reçoit les nouvelles demandes pour les affecter.
                  </p>
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
                    <div key={s.tempId} className="border rounded-lg p-3 space-y-3 bg-card">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                        <Badge variant="outline" className="shrink-0 text-xs w-6 h-6 flex items-center justify-center p-0">
                          {idx + 1}
                        </Badge>
                        <Input
                          value={s.title}
                          onChange={(e) => updateStep(s.tempId, { title: e.target.value })}
                          placeholder="Titre de l'étape *"
                          className="flex-1"
                          disabled={!canManage}
                        />
                        {canManage && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                              disabled={idx === 0} onClick={() => moveStep(s.tempId, -1)}>
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                              disabled={idx === steps.length - 1} onClick={() => moveStep(s.tempId, 1)}>
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => removeStep(s.tempId)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-8">
                        {/* Durée */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Durée (jours)</Label>
                          <Input
                            type="number"
                            min={1}
                            value={s.duration_days}
                            onChange={(e) => updateStep(s.tempId, {
                              duration_days: Math.max(1, parseInt(e.target.value) || 1),
                            })}
                            className="h-8"
                            disabled={!canManage}
                          />
                        </div>

                        {/* Validation niv. 1 */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Validation niv. 1</Label>
                          <Select
                            value={s.val1_type}
                            onValueChange={(v) => updateStep(s.tempId, {
                              val1_type: v as StepDraft['val1_type'],
                              val1_user_id: v === 'fixed_user' ? s.val1_user_id : '',
                            })}
                            disabled={!canManage}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {VAL1_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value} className="text-xs">
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {s.val1_type === 'fixed_user' && (
                            <Select
                              value={s.val1_user_id || '__none__'}
                              onValueChange={(v) => updateStep(s.tempId, { val1_user_id: v === '__none__' ? '' : v })}
                              disabled={!canManage}
                            >
                              <SelectTrigger className="h-8 text-xs mt-1">
                                <SelectValue placeholder="Valideur…" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— Choisir —</SelectItem>
                                {profiles.map((p) => (
                                  <SelectItem key={p.id} value={p.id} className="text-xs">
                                    {p.display_name ?? 'Sans nom'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>

                        {/* Validation niv. 2 */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Validation niv. 2</Label>
                          <Select
                            value={s.val2_type}
                            onValueChange={(v) => updateStep(s.tempId, {
                              val2_type: v as StepDraft['val2_type'],
                              val2_user_id: v === 'fixed_user' ? s.val2_user_id : '',
                            })}
                            disabled={!canManage}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {VAL2_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value} className="text-xs">
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {s.val2_type === 'fixed_user' && (
                            <Select
                              value={s.val2_user_id || '__none__'}
                              onValueChange={(v) => updateStep(s.tempId, { val2_user_id: v === '__none__' ? '' : v })}
                              disabled={!canManage}
                            >
                              <SelectTrigger className="h-8 text-xs mt-1">
                                <SelectValue placeholder="Valideur…" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— Choisir —</SelectItem>
                                {profiles.map((p) => (
                                  <SelectItem key={p.id} value={p.id} className="text-xs">
                                    {p.display_name ?? 'Sans nom'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* ── Save bar ─────────────────────────────── */}
            {canManage && (
              <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t -mx-6 px-6 py-3 flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => navigate(-1)}>Annuler</Button>
                <Button onClick={handleSave} disabled={!canSave} className="gap-2 bg-amber-500 hover:bg-amber-600 text-white">
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
