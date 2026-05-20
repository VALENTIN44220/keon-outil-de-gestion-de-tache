import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plus, Trash2, ArrowUp, ArrowDown, ChevronRight, ChevronLeft, Check, GripVertical, Paperclip, Flag, ListChecks, ChevronDown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

// BE process fixe (Bureau d'Études)
const BE_PROCESS_ID = 'bd75a3b0-c918-4b43-befe-739b83f7461a';

interface Profile {
  id: string;
  display_name: string | null;
}

type ValType = 'none' | 'requester' | 'manager' | 'fixed_user';

interface SubActionDraft {
  id: string;
  title: string;
  is_required: boolean;
}

interface StepDraft {
  id: string; // temp id for UI
  title: string;
  duration_days: number;
  val1_type: ValType;
  val1_user_id: string;
  val2_type: ValType;
  val2_user_id: string;
  // Pièces obligatoires
  required_docs_count: number;
  required_docs_description: string;
  // Jalon timeline
  is_milestone: boolean;
  milestone_label: string;
  auto_milestone_delay_days: number | null;
  auto_milestone_label: string;
  // Sous-actions
  sub_actions: SubActionDraft[];
  // UI : expandé pour montrer les options avancées
  expanded: boolean;
}

interface NewPrestationBEWizardProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const BE_CATEGORIES = [
  { value: 'be_reglementaire', label: 'Réglementaire' },
  { value: 'be', label: 'Bureau d\'Études' },
] as const;

const VAL_OPTIONS: { value: ValType; label: string }[] = [
  { value: 'none',       label: 'Aucune' },
  { value: 'requester',  label: 'Demandeur' },
  { value: 'manager',    label: 'Manager du demandeur' },
  { value: 'fixed_user', label: 'Utilisateur fixe' },
];

const VAL1_OPTIONS = VAL_OPTIONS;
const VAL2_OPTIONS = VAL_OPTIONS;

const defaultStep = (): StepDraft => ({
  id: crypto.randomUUID(),
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
  sub_actions: [],
  expanded: false,
});

export function NewPrestationBEWizard({ open, onClose, onSuccess }: NewPrestationBEWizardProps) {
  const { user, profile } = useAuth();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  // Étape 1 — Identité
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [beCategory, setBeCategory] = useState<'be' | 'be_reglementaire'>('be_reglementaire');
  const [dispatchManagerId, setDispatchManagerId] = useState('');

  // Étape 2 — Étapes
  const [steps, setSteps] = useState<StepDraft[]>([defaultStep()]);

  useEffect(() => {
    if (open) {
      fetchProfiles();
      resetForm();
    }
  }, [open]);

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('status', 'active')
      .order('display_name');
    if (data) setProfiles(data);
  };

  const resetForm = () => {
    setStep(0);
    setName('');
    setDescription('');
    setBeCategory('be_reglementaire');
    setDispatchManagerId('');
    setSteps([defaultStep()]);
  };

  // ─── Step 1 helpers ───────────────────────────────────────────
  const step1Valid = name.trim().length > 0 && dispatchManagerId !== '';

  // ─── Step 2 helpers ───────────────────────────────────────────
  const step2Valid = steps.length > 0 && steps.every((s) => s.title.trim().length > 0);

  const updateStep = (id: string, patch: Partial<StepDraft>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const addStep = () => setSteps((prev) => [...prev, defaultStep()]);

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  };

  const moveStep = (id: string, dir: -1 | 1) => {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  // ─── Submit ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      // 1 — Calcul order_index (à la fin des existants pour ce process)
      const { count } = await supabase
        .from('sub_process_templates')
        .select('*', { count: 'exact', head: true })
        .eq('process_template_id', BE_PROCESS_ID);

      // 2 — Créer le sous-processus
      const { data: sp, error: spErr } = await supabase
        .from('sub_process_templates')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          process_template_id: BE_PROCESS_ID,
          be_category: beCategory,
          assignment_type: 'manager_dispatch',
          dispatch_manager_id: dispatchManagerId,
          validation_level_1_type: null,
          validation_level_1_user_id: null,
          validation_level_2_type: null,
          validation_level_2_user_id: null,
          order_index: (count ?? 0) * 10 + 10,
          is_shared: true,
          is_mandatory: false,
          visibility_level: 'public',
          creator_company_id: profile?.company_id ?? null,
          creator_department_id: profile?.department_id ?? null,
          user_id: user.id,
        })
        .select('id')
        .single();

      if (spErr || !sp) throw spErr ?? new Error('Sous-processus non créé');

      // 3 — Créer les task_templates (séquentiel pour récupérer chaque id
      //     et insérer les sub-actions correspondantes)
      const valToDb = (t: ValType): string => t === 'fixed_user' ? 'free' : t;
      for (let idx = 0; idx < steps.length; idx++) {
        const s = steps[idx];
        const { data: inserted, error: tErr } = await (supabase as any)
          .from('task_templates')
          .insert({
            sub_process_template_id: sp.id,
            process_template_id: null,
            title: s.title.trim(),
            description: null,
            priority: 'medium',
            order_index: (idx + 1) * 10,
            default_duration_days: s.duration_days,
            default_duration_unit: 'days',
            validation_level_1: valToDb(s.val1_type),
            validator_level_1_id: s.val1_type === 'fixed_user' && s.val1_user_id ? s.val1_user_id : null,
            validation_level_2: valToDb(s.val2_type),
            validator_level_2_id: s.val2_type === 'fixed_user' && s.val2_user_id ? s.val2_user_id : null,
            required_docs_count: s.required_docs_count,
            required_docs_description: s.required_docs_description.trim() || null,
            is_milestone: s.is_milestone,
            milestone_label: s.is_milestone ? (s.milestone_label.trim() || s.title.trim()) : null,
            auto_milestone_delay_days: s.is_milestone && s.auto_milestone_delay_days ? s.auto_milestone_delay_days : null,
            auto_milestone_label: s.is_milestone && s.auto_milestone_delay_days ? (s.auto_milestone_label.trim() || null) : null,
            visibility_level: 'public',
            is_shared: true,
            creator_company_id: profile?.company_id ?? null,
            creator_department_id: profile?.department_id ?? null,
            user_id: user.id,
          })
          .select('id')
          .single();
        if (tErr) throw tErr;

        const validSubActions = s.sub_actions.filter(sa => sa.title.trim());
        if (validSubActions.length > 0) {
          const { error: saErr } = await (supabase as any)
            .from('task_template_sub_actions')
            .insert(validSubActions.map((sa, j) => ({
              task_template_id: inserted.id,
              title: sa.title.trim(),
              is_required: sa.is_required,
              order_index: (j + 1) * 10,
            })));
          if (saErr) throw saErr;
        }
      }

      toast.success(`Prestation "${name}" créée avec ${steps.length} étape${steps.length > 1 ? 's' : ''}`);
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la création de la prestation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Helpers affichage ────────────────────────────────────────
  const profileName = (id: string) => profiles.find((p) => p.id === id)?.display_name ?? id;

  const STEPS_LABELS = ['Identité', 'Étapes', 'Récapitulatif'];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[680px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle prestation BE</DialogTitle>
        </DialogHeader>

        {/* ── Barre de progression ── */}
        <div className="flex items-center gap-2 my-2">
          {STEPS_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold border-2 transition-colors ${
                  i < step
                    ? 'bg-primary border-primary text-primary-foreground'
                    : i === step
                    ? 'border-primary text-primary'
                    : 'border-muted-foreground/30 text-muted-foreground'
                }`}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={`text-sm ${i === step ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                {label}
              </span>
              {i < STEPS_LABELS.length - 1 && <div className="flex-1 h-px bg-muted mx-1" />}
            </div>
          ))}
        </div>

        {/* ══════════════ ÉTAPE 0 — Identité ══════════════ */}
        {step === 0 && (
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="pname">Nom de la prestation *</Label>
              <Input
                id="pname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex : Expertise acoustique"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pdesc">Description (facultatif)</Label>
              <Textarea
                id="pdesc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Contexte, périmètre, livrables attendus..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Catégorie *</Label>
              <div className="flex gap-3">
                {BE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setBeCategory(cat.value)}
                    className={`flex-1 py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition-colors ${
                      beCategory === cat.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-muted hover:border-muted-foreground/40'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dispatcher (responsable d'affectation) *</Label>
              <Select value={dispatchManagerId || '__none__'} onValueChange={(v) => setDispatchManagerId(v === '__none__' ? '' : v)}>
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
                Ce collaborateur recevra les nouvelles demandes pour les affecter.
              </p>
            </div>
          </div>
        )}

        {/* ══════════════ ÉTAPE 1 — Étapes ══════════════ */}
        {step === 1 && (
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">
              Définissez les étapes dans l'ordre. Chaque étape devient une tâche quand une demande est lancée.
            </p>

            {steps.map((s, idx) => (
              <div
                key={s.id}
                className="border rounded-lg p-3 space-y-3 bg-card"
              >
                {/* Ligne titre + actions */}
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  <Badge variant="outline" className="shrink-0 text-xs w-6 h-6 flex items-center justify-center p-0">
                    {idx + 1}
                  </Badge>
                  <Input
                    value={s.title}
                    onChange={(e) => updateStep(s.id, { title: e.target.value })}
                    placeholder="Titre de l'étape *"
                    className="flex-1"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={idx === 0}
                      onClick={() => moveStep(s.id, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={idx === steps.length - 1}
                      onClick={() => moveStep(s.id, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      disabled={steps.length === 1}
                      onClick={() => removeStep(s.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Durée + validations */}
                <div className="grid grid-cols-3 gap-3 pl-8">
                  {/* Durée */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Durée (jours)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={s.duration_days}
                      onChange={(e) => updateStep(s.id, { duration_days: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="h-8"
                    />
                  </div>

                  {/* Validation 1 */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Validation niv. 1</Label>
                    <Select
                      value={s.val1_type}
                      onValueChange={(v) => updateStep(s.id, { val1_type: v as StepDraft['val1_type'], val1_user_id: '' })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
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
                        onValueChange={(v) => updateStep(s.id, { val1_user_id: v === '__none__' ? '' : v })}
                      >
                        <SelectTrigger className="h-7 text-xs mt-1">
                          <SelectValue placeholder="Choisir…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__" className="text-xs">— Choisir —</SelectItem>
                          {profiles.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="text-xs">
                              {p.display_name ?? 'Sans nom'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Validation 2 */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Validation niv. 2</Label>
                    <Select
                      value={s.val2_type}
                      onValueChange={(v) => updateStep(s.id, { val2_type: v as StepDraft['val2_type'], val2_user_id: '' })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
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
                        onValueChange={(v) => updateStep(s.id, { val2_user_id: v === '__none__' ? '' : v })}
                      >
                        <SelectTrigger className="h-7 text-xs mt-1">
                          <SelectValue placeholder="Choisir…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__" className="text-xs">— Choisir —</SelectItem>
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

                {/* ── Options avancées (docs obligatoires, jalon, sous-actions) ── */}
                <button type="button" onClick={() => updateStep(s.id, { expanded: !s.expanded } as any)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 pl-8">
                  {s.expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  Options avancées
                  {!s.expanded && (s.required_docs_count > 0 || s.is_milestone || s.sub_actions.length > 0) && (
                    <span className="ml-1 text-[10px] text-amber-700">
                      · {[
                        s.required_docs_count > 0 && `${s.required_docs_count} doc${s.required_docs_count > 1 ? 's' : ''}`,
                        s.is_milestone && 'Jalon',
                        s.sub_actions.length > 0 && `${s.sub_actions.length} sous-action${s.sub_actions.length > 1 ? 's' : ''}`,
                      ].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </button>

                {s.expanded && (
                  <div className="pl-8 space-y-3 pt-2 border-t">
                    {/* Pièces obligatoires */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label className="text-xs font-semibold">Pièces obligatoires</Label>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Input type="number" min={0} value={s.required_docs_count}
                          onChange={(e) => updateStep(s.id, { required_docs_count: Math.max(0, parseInt(e.target.value) || 0) } as any)}
                          placeholder="Nb min" className="h-7 text-xs" />
                        <Input value={s.required_docs_description}
                          onChange={(e) => updateStep(s.id, { required_docs_description: e.target.value } as any)}
                          placeholder="Description (ex : PV signé, plans à jour)"
                          className="h-7 text-xs col-span-2" />
                      </div>
                    </div>

                    {/* Jalon */}
                    <div className="space-y-1.5 border-t pt-2">
                      <div className="flex items-center gap-2">
                        <Flag className="h-3.5 w-3.5 text-violet-600" />
                        <Label className="text-xs font-semibold flex-1">Jalon dans la timeline du projet</Label>
                        <Switch checked={s.is_milestone}
                          onCheckedChange={(v) => updateStep(s.id, { is_milestone: v } as any)} />
                      </div>
                      {s.is_milestone && (
                        <div className="space-y-2 pl-1">
                          <Input value={s.milestone_label}
                            onChange={(e) => updateStep(s.id, { milestone_label: e.target.value } as any)}
                            placeholder="Libellé du jalon (ex : Dépôt PC) — vide = titre étape"
                            className="h-7 text-xs" />
                          <div className="grid grid-cols-3 gap-2">
                            <Input type="number" min={1} placeholder="J+ (jours)"
                              value={s.auto_milestone_delay_days ?? ''}
                              onChange={(e) => {
                                const v = parseInt(e.target.value);
                                updateStep(s.id, { auto_milestone_delay_days: isNaN(v) || v < 1 ? null : v } as any);
                              }}
                              className="h-7 text-xs" />
                            <Input value={s.auto_milestone_label}
                              onChange={(e) => updateStep(s.id, { auto_milestone_label: e.target.value } as any)}
                              placeholder="Libellé jalon auto (ex : Fin délai recours)"
                              className="h-7 text-xs col-span-2"
                              disabled={!s.auto_milestone_delay_days} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Sous-actions */}
                    <div className="space-y-1.5 border-t pt-2">
                      <div className="flex items-center gap-2">
                        <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label className="text-xs font-semibold flex-1">
                          Sous-actions ({s.sub_actions.length})
                        </Label>
                        <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] gap-1"
                          onClick={() => updateStep(s.id, {
                            sub_actions: [...s.sub_actions, { id: crypto.randomUUID(), title: '', is_required: false }],
                          } as any)}>
                          <Plus className="h-2.5 w-2.5" /> Ajouter
                        </Button>
                      </div>
                      {s.sub_actions.length > 0 && (
                        <ul className="space-y-1">
                          {s.sub_actions.map((sa) => (
                            <li key={sa.id} className="flex items-center gap-2">
                              <Input value={sa.title}
                                onChange={(e) => updateStep(s.id, {
                                  sub_actions: s.sub_actions.map(x => x.id === sa.id ? { ...x, title: e.target.value } : x),
                                } as any)}
                                placeholder="Sous-action…" className="h-7 text-xs flex-1" />
                              <label className="text-[10px] text-muted-foreground flex items-center gap-1 cursor-pointer">
                                <Switch checked={sa.is_required}
                                  onCheckedChange={(v) => updateStep(s.id, {
                                    sub_actions: s.sub_actions.map(x => x.id === sa.id ? { ...x, is_required: v } : x),
                                  } as any)} />
                                Oblig.
                              </label>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => updateStep(s.id, {
                                  sub_actions: s.sub_actions.filter(x => x.id !== sa.id),
                                } as any)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" onClick={addStep} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Ajouter une étape
            </Button>
          </div>
        )}

        {/* ══════════════ ÉTAPE 2 — Récapitulatif ══════════════ */}
        {step === 2 && (
          <div className="space-y-4 mt-2">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-lg">{name}</p>
                  {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
                </div>
                <Badge variant={beCategory === 'be_reglementaire' ? 'destructive' : 'default'} className="shrink-0">
                  {BE_CATEGORIES.find((c) => c.value === beCategory)?.label}
                </Badge>
              </div>

              <div className="text-sm">
                <span className="text-muted-foreground">Dispatcher : </span>
                <span className="font-medium">{profileName(dispatchManagerId)}</span>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">{steps.length} étape{steps.length > 1 ? 's' : ''}</p>
              <div className="space-y-1.5">
                {steps.map((s, idx) => (
                  <div key={s.id} className="flex items-center gap-3 text-sm py-2 px-3 rounded-md bg-card border">
                    <span className="text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
                    <span className="flex-1 font-medium">{s.title}</span>
                    <span className="text-muted-foreground text-xs shrink-0">{s.duration_days}j</span>
                    {s.val1_type !== 'none' && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        V1 : {s.val1_type === 'requester' ? 'Dem.' : profileName(s.val1_user_id).split(' ')[0]}
                      </Badge>
                    )}
                    {s.val2_type !== 'none' && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        V2 : {s.val2_type === 'requester' ? 'Dem.' : profileName(s.val2_user_id).split(' ')[0]}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Navigation ─── */}
        <div className="flex justify-between mt-6 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
            className="gap-2"
          >
            {step === 0 ? 'Annuler' : <><ChevronLeft className="h-4 w-4" /> Précédent</>}
          </Button>

          {step < 2 ? (
            <Button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 0 ? !step1Valid : !step2Valid}
              className="gap-2"
            >
              Suivant <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? 'Création…' : <><Check className="h-4 w-4" /> Créer la prestation</>}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
