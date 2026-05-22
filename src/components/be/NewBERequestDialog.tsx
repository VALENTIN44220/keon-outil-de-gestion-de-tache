/**
 * NewBERequestDialog — Wizard 4 étapes pour créer une demande Bureau d'Études.
 *
 * Étape 1 : Sélection projet BE + affaire optionnelle
 * Étape 2 : Multi-sélection des PRESTATIONS (groupées par catégorie)
 *           → une prestation = toutes ses sous-étapes (ex: "ICPE Déclaration" = 6 étapes)
 * Étape 3 : Niveau d'urgence
 * Étape 4 : Récapitulatif + soumission
 *
 * Crée : 1 tâche parent (type='request') + N tâches enfant (type='task',
 *        une par SOUS-ÉTAPE des prestations sélectionnées).
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  ChevronRight,
  ChevronLeft,
  Check,
  Building,
  Zap,
  AlertTriangle,
  FileText,
  Loader2,
  FolderOpen,
  ClipboardList,
  Layers,
  Plus,
  X,
  Link as LinkIcon,
  Paperclip,
  FileText as FileIcon,
  Info,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { toast } from 'sonner';
import type { BEProject } from '@/types/beProject';
import type { BEAffaire } from '@/types/beAffaire';
import {
  CommonFieldsConfig,
  DEFAULT_COMMON_FIELDS_CONFIG,
  mergeCommonFieldsConfig,
} from '@/types/commonFieldsConfig';

// ─── Constantes ─────────────────────────────────────────────────────────────

const BE_PROCESS_TEMPLATE_ID = 'bd75a3b0-c918-4b43-befe-739b83f7461a';

// Étape numérotation absolue :
//   0 = Projet & Affaire   (full flow seulement)
//   1 = Prestations
//   2 = Détails            (description + affaire si short flow + liens)
//   3 = Urgence
//   4 = Récapitulatif
const STEPS_FULL  = ['Projet & Affaire', 'Prestations', 'Détails', 'Urgence', 'Récapitulatif'] as const;
const STEPS_SHORT = ['Prestations', 'Détails', 'Urgence', 'Récapitulatif'] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

/** Une sous-étape individuelle dans sub_process_templates */
interface SubStep {
  id: string;
  name: string;
  description: string | null;
  be_category: 'be' | 'be_reglementaire' | null;
  order_index: number | null;
  /** Manager qui dispatche (cas Cible = rôle générique) */
  dispatch_manager_id: string | null;
  /** Audit : créateur du template (legacy) */
  user_id: string | null;
  /** Type d'affectation : 'fixed_user' (cible = personne précise) | 'manager_dispatch' | ... */
  assignment_type: string | null;
  /** Personne pré-affectée si assignment_type='fixed_user' (Cible = personne précise) */
  target_assignee_id: string | null;
  /** Durée prévue par défaut (heures) — héritée par tasks.duration_hours */
  default_duration_hours: number | null;
}

/**
 * Un groupe de sous-étapes correspondant à une prestation complète.
 * Exemple : "ICPE Déclaration" avec ses 6 étapes.
 */
interface PrestationGroup {
  /** Nom de la prestation (partie avant " — ") */
  groupName: string;
  be_category: 'be' | 'be_reglementaire' | null;
  steps: SubStep[];
}

type BEUrgency = 'normal' | 'urgent' | 'critique';

// ─── Props ───────────────────────────────────────────────────────────────────

interface NewBERequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string;
  defaultAffaireId?: string;
  onCreated?: (requestId: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sb = supabase as any;

/** Extrait le nom de la prestation depuis "Prestation — Sous-étape" */
function extractGroupName(name: string): string {
  const sep = name.indexOf(' — ');
  return sep !== -1 ? name.slice(0, sep).trim() : name.trim();
}

function categoryLabel(cat: string | null) {
  return cat === 'be_reglementaire' ? 'Réglementaire' : "Bureau d'Études";
}

const URGENCY_OPTIONS = [
  {
    value: 'normal' as BEUrgency,
    label: 'Normal',
    desc: 'Traitement selon le planning habituel',
    textColor: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-800',
  },
  {
    value: 'urgent' as BEUrgency,
    label: 'Urgent',
    desc: 'Traitement prioritaire demandé',
    textColor: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-900/30',
  },
  {
    value: 'critique' as BEUrgency,
    label: 'Critique',
    desc: 'Bloquant — délai maximal 48 h',
    textColor: 'text-red-600',
    bg: 'bg-red-50 dark:bg-red-900/30',
  },
] as const;

// ─── Component ───────────────────────────────────────────────────────────────

export function NewBERequestDialog({
  open,
  onOpenChange,
  defaultProjectId,
  defaultAffaireId,
  onCreated,
}: NewBERequestDialogProps) {
  const { user, profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  // En simulation, on raisonne avec le profil simulé pour que la demande
  // créée soit attribuée à l'utilisateur incarné (ex: Germain), pas à l'admin.
  // user.id (auth) reste celui de l'admin réel — c'est lui qui INSERT (RLS).
  const profile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;

  /** Si le projet est pré-connu (contexte hub), on saute l'étape 0. */
  const hasDefaultProject = !!defaultProjectId;

  // ── Navigation ────────────────────────────────────────────────────────────
  const [step, setStep] = useState(hasDefaultProject ? 1 : 0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Étape 0 : Projet (affiché uniquement si pas de defaultProjectId) ───────
  const [projects, setProjects] = useState<Pick<BEProject, 'id' | 'code_projet' | 'nom_projet'>[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(defaultProjectId ?? null);
  /** Projet sélectionné — chargé séparément quand defaultProjectId est fourni */
  const [defaultProject, setDefaultProject] = useState<Pick<BEProject, 'id' | 'code_projet' | 'nom_projet'> | null>(null);

  const [affaires, setAffaires] = useState<(Pick<BEAffaire, 'id' | 'code_affaire' | 'libelle' | 'status'> & { commandes?: string[] })[]>([]);
  const [selectedAffaireId, setSelectedAffaireId] = useState<string | null>(defaultAffaireId ?? null);
  const [description, setDescription] = useState('');

  // ── Étape 1 : Prestations ─────────────────────────────────────────────────
  /** Toutes les sous-étapes brutes depuis Supabase */
  const [allSteps, setAllSteps] = useState<SubStep[]>([]);
  const [stepsLoading, setStepsLoading] = useState(false);
  /** Noms des prestations sélectionnées (ex: "ICPE Déclaration") */
  const [selectedGroupNames, setSelectedGroupNames] = useState<Set<string>>(new Set());

  // ── Étape 3 : Urgence ─────────────────────────────────────────────────────
  const [urgency, setUrgency] = useState<BEUrgency>('normal');
  /** Date de rendu attendue par le demandeur (renseigne tasks.due_date sur la demande). */
  const [expectedDate, setExpectedDate] = useState<string>('');

  // ── Liens externes ────────────────────────────────────────────────────────
  const [links, setLinks] = useState<{ url: string; label: string }[]>([]);
  const [files, setFiles] = useState<{ name: string; url: string; path: string; size: number }[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  // ── Configuration admin "Champs du formulaire de demande" ────────────────
  // Lue depuis process_templates.settings.common_fields_config du processus BE.
  // Contrôle visibilité, éditabilité et valeur par défaut des champs.
  const [fieldsConfig, setFieldsConfig] = useState<CommonFieldsConfig>(DEFAULT_COMMON_FIELDS_CONFIG);

  useEffect(() => {
    if (!open) return;
    sb.from('process_templates')
      .select('settings')
      .eq('id', BE_PROCESS_TEMPLATE_ID)
      .single()
      .then(({ data }: any) => {
        const cfg = mergeCommonFieldsConfig(data?.settings?.common_fields_config ?? null);
        setFieldsConfig(cfg);

        // Applique les valeurs par défaut imposées par l'admin
        if (cfg.be_urgency?.default_value && !defaultProjectId) {
          setUrgency(cfg.be_urgency.default_value as BEUrgency);
        }
        if (cfg.be_project?.default_value && !defaultProjectId) {
          setSelectedProjectId(cfg.be_project.default_value);
        }
        if (cfg.be_affaire?.default_value && !defaultAffaireId) {
          setSelectedAffaireId(cfg.be_affaire.default_value);
        }
        if (cfg.description?.default_value) {
          setDescription(cfg.description.default_value);
        }
        if (cfg.due_date?.default_value) {
          setExpectedDate(cfg.due_date.default_value);
        }
      });
  }, [open, defaultProjectId, defaultAffaireId]);

  // ── Reset sur ouverture ───────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setStep(hasDefaultProject ? 1 : 0);
      setSelectedProjectId(defaultProjectId ?? null);
      setSelectedAffaireId(defaultAffaireId ?? null);
      setSelectedGroupNames(new Set());
      setUrgency('normal');
      setExpectedDate('');
      setDescription('');
      setLinks([]);
      setFiles([]);
      setProjectSearch('');
    }
  }, [open, defaultProjectId, defaultAffaireId, hasDefaultProject]);

  // ── Chargement du projet par défaut (pour affichage) ─────────────────────
  useEffect(() => {
    if (!defaultProjectId || !open) { setDefaultProject(null); return; }
    sb.from('be_projects')
      .select('id,code_projet,nom_projet')
      .eq('id', defaultProjectId)
      .single()
      .then(({ data }: any) => setDefaultProject(data ?? null));
  }, [defaultProjectId, open]);

  // ── Chargement projets ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setProjectsLoading(true);
    let q = sb
      .from('be_projects')
      .select('id,code_projet,nom_projet')
      .in('status', ['active', 'actif'])
      .order('nom_projet');
    if (projectSearch.trim()) {
      q = q.or(`nom_projet.ilike.%${projectSearch.trim()}%,code_projet.ilike.%${projectSearch.trim()}%`);
    }
    q.then(({ data }: any) => {
      setProjects(data ?? []);
      setProjectsLoading(false);
    });
  }, [open, projectSearch]);

  // ── Chargement affaires (+ n° commande/devis client CCN/DCN) ──────────────
  useEffect(() => {
    if (!selectedProjectId) { setAffaires([]); return; }
    let cancelled = false;
    (async () => {
      const { data: rows } = await sb
        .from('be_affaires')
        .select('id,code_affaire,libelle,status')
        .eq('be_project_id', selectedProjectId)
        .in('status', ['ouverte', 'en_cours'])
        .order('code_affaire');

      const baseAffaires = (rows ?? []) as any[];
      if (cancelled) return;

      // Enrichissement : numéros de commande (CCN) / devis (DCN) client
      // depuis les mouvements Divalto, regroupés par code_affaire.
      const codes = baseAffaires.map(a => a.code_affaire).filter(Boolean);
      const cmdMap = new Map<string, Set<string>>();
      if (codes.length > 0) {
        const { data: mvts } = await sb
          .from('be_divalto_mouvements')
          .select('code_affaire,numero_piece')
          .in('code_affaire', codes)
          .or('numero_piece.ilike.CCN%,numero_piece.ilike.DCN%');
        for (const m of (mvts ?? []) as any[]) {
          if (!m.code_affaire || !m.numero_piece) continue;
          if (!cmdMap.has(m.code_affaire)) cmdMap.set(m.code_affaire, new Set());
          cmdMap.get(m.code_affaire)!.add(String(m.numero_piece).trim());
        }
      }

      if (cancelled) return;
      setAffaires(
        baseAffaires.map(a => ({
          ...a,
          commandes: Array.from(cmdMap.get(a.code_affaire) ?? []).sort(),
        })),
      );
    })();
    return () => { cancelled = true; };
  }, [selectedProjectId]);

  // ── Chargement sous-étapes (à l'entrée sur l'étape 1 ou si projet par défaut) ──
  useEffect(() => {
    if (step !== 1 && !(hasDefaultProject && step === 1)) return;
    setStepsLoading(true);
    sb.from('sub_process_templates')
      .select('id,name,description,be_category,order_index,dispatch_manager_id,user_id,assignment_type,target_assignee_id,default_duration_hours')
      .eq('process_template_id', BE_PROCESS_TEMPLATE_ID)
      .eq('is_shared', true)
      .order('be_category')
      .order('order_index')
      .then(({ data, error }: any) => {
        if (error) {
          console.error('[NewBERequestDialog] sub_process_templates fetch error:', error);
        }
        setAllSteps(data ?? []);
        setStepsLoading(false);
      });
  }, [step]);

  // ── Groupement des sous-étapes par prestation ─────────────────────────────
  /**
   * Groups : Map<groupName, PrestationGroup>
   * Chaque groupe = une prestation visible dans la liste (une checkbox).
   * Les sous-étapes sont conservées pour la création des tâches.
   */
  const prestationGroups = useMemo((): PrestationGroup[] => {
    const map = new Map<string, PrestationGroup>();
    for (const step of allSteps) {
      const gName = extractGroupName(step.name);
      if (!map.has(gName)) {
        map.set(gName, {
          groupName: gName,
          be_category: step.be_category,
          steps: [],
        });
      }
      map.get(gName)!.steps.push(step);
    }
    return Array.from(map.values());
  }, [allSteps]);

  const groupsByCategory = useMemo(() => {
    const cats: Record<string, PrestationGroup[]> = {};
    for (const g of prestationGroups) {
      const key = g.be_category ?? 'be';
      if (!cats[key]) cats[key] = [];
      cats[key].push(g);
    }
    return cats;
  }, [prestationGroups]);

  // ── Données dérivées ──────────────────────────────────────────────────────
  const selectedProject = defaultProject ?? projects.find(p => p.id === selectedProjectId);
  const selectedAffaire = affaires.find(a => a.id === selectedAffaireId);
  const selectedGroups = prestationGroups.filter(g => selectedGroupNames.has(g.groupName));
  /** Toutes les sous-étapes à créer (toutes les étapes des groupes sélectionnés) */
  const allSelectedSteps = selectedGroups.flatMap(g => g.steps);

  // ── Navigation ────────────────────────────────────────────────────────────
  const STEPS = hasDefaultProject ? STEPS_SHORT : STEPS_FULL;
  /** Index visuel dans le tableau STEPS affiché */
  const displayStep = hasDefaultProject ? step - 1 : step;
  const lastStep = STEPS.length - 1;

  const canNext = () => {
    if (step === 0) return !!selectedProjectId;
    if (step === 1) return selectedGroupNames.size > 0;
    return true;
  };

  // ── Soumission ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!user || !profile || !selectedProjectId) return;
    setIsSubmitting(true);

    try {
      const titleSuffix = selectedAffaire?.code_affaire ?? 'Sans affaire';
      const title = selectedProject
        ? `BE — ${selectedProject.code_projet} — ${titleSuffix}`
        : 'Demande BE';

      // 1. Tâche parente (request)
      const { data: request, error: reqError } = await sb
        .from('tasks')
        .insert({
          title,
          description: description.trim() || null,
          type: 'request',
          status: 'in-progress',
          be_project_id: selectedProjectId,
          be_affaire_id: selectedAffaireId || null,
          be_urgency: urgency,
          be_status: 'soumise',
          // Date de rendu attendue par le demandeur — alimente tasks.due_date
          // de la demande parente (héritée par les tâches enfants si null sur celles-ci).
          due_date: expectedDate || null,
          user_id: user.id,
          requester_id: profile.id,
          source_process_template_id: BE_PROCESS_TEMPLATE_ID,
          process_template_id: BE_PROCESS_TEMPLATE_ID,
        })
        .select()
        .single();

      if (reqError) throw reqError;

      // 2. Charge tous les task_templates (= étapes) des prestations sélectionnées.
      //    On crée UNE TÂCHE PAR ÉTAPE (pas une seule par prestation) — chaque
      //    étape a son propre assigné, ses validateurs, son statut.
      const selectedSubProcessIds = allSelectedSteps.map(s => s.id);
      let allTaskTemplates: any[] = [];
      if (selectedSubProcessIds.length > 0) {
        const { data: tplRows, error: tplErr } = await (sb as any)
          .from('task_templates')
          .select('id, sub_process_template_id, title, default_duration_days, order_index, validation_level_1, validator_level_1_id, validation_level_2, validator_level_2_id, is_milestone, milestone_label, auto_milestone_delay_days, auto_milestone_label, required_docs_count, required_docs_description, start_mode, depends_on_task_template_id, delay_after_previous_days')
          .in('sub_process_template_id', selectedSubProcessIds)
          .order('order_index', { ascending: true });
        if (tplErr) throw tplErr;
        allTaskTemplates = tplRows ?? [];
      }

      // 3. Construit la liste des tâches enfant à créer (1 par task_template)
      const subProcessById = new Map(allSelectedSteps.map(s => [s.id, s]));
      const childInserts = allTaskTemplates.map((tpl, idx) => {
        const sub = subProcessById.get(tpl.sub_process_template_id);
        // Assigné initial : validator_level_1 si défini, sinon dispatch_manager du sub-process
        const initialAssignee = tpl.validator_level_1_id
          ? null  // validateur ≠ assigné → laisser le dispatcher décider qui exécute
          : (sub?.target_assignee_id ?? sub?.dispatch_manager_id ?? null);
        const initialBeStatus = initialAssignee ? 'affectee' : 'soumise';
        return {
          // Convention de titre : « titre demande — nom prestation — titre étape »
          // (le sous-processus regroupera ces tâches dans l'UI)
          title: `${title} — ${sub?.name ?? 'Prestation'} — ${tpl.title}`,
          type: 'task',
          status: 'todo',
          be_project_id: selectedProjectId,
          be_affaire_id: selectedAffaireId || null,
          be_urgency: urgency,
          be_status: initialBeStatus,
          user_id: user.id,
          requester_id: profile.id,
          parent_request_id: request.id,
          sub_process_template_id: tpl.sub_process_template_id,
          source_task_template_id: tpl.id,
          assignee_id: initialAssignee,
          duration_hours: (tpl.default_duration_days ?? 1) * 8,
          source_process_template_id: BE_PROCESS_TEMPLATE_ID,
          process_template_id: BE_PROCESS_TEMPLATE_ID,
          // Validateurs (recopiés depuis le template)
          validator_level_1_id: tpl.validator_level_1_id ?? null,
          validator_level_2_id: tpl.validator_level_2_id ?? null,
          // Jalon + docs obligatoires (par étape, plus de cumul artificiel)
          is_milestone: !!tpl.is_milestone,
          milestone_label: tpl.milestone_label,
          auto_milestone_delay_days: tpl.auto_milestone_delay_days,
          auto_milestone_label: tpl.auto_milestone_label,
          required_docs_count: tpl.required_docs_count ?? 0,
          required_docs_description: tpl.required_docs_description,
          start_mode: tpl.start_mode ?? 'parallel',
          delay_after_previous_days: tpl.delay_after_previous_days ?? 0,
        };
      });

      const { data: createdChildren, error: childError } = await sb
        .from('tasks')
        .insert(childInserts)
        .select('id, title, assignee_id, be_status, sub_process_template_id, source_task_template_id');
      if (childError) throw childError;

      // 4. Résolution des dépendances explicites : task.depends_on_task_id pointe
      //    vers la tâche fille issue du task_template référencé par
      //    depends_on_task_template_id (uniquement parmi les tâches qu'on vient
      //    de créer pour cette même demande).
      const taskByTemplateId = new Map<string, string>();
      for (const t of (createdChildren ?? [])) {
        if ((t as any).source_task_template_id) {
          taskByTemplateId.set((t as any).source_task_template_id, t.id);
        }
      }
      for (let i = 0; i < allTaskTemplates.length; i++) {
        const tpl = allTaskTemplates[i];
        if (tpl.start_mode !== 'after_specific' || !tpl.depends_on_task_template_id) continue;
        const myTaskId = taskByTemplateId.get(tpl.id);
        const targetTaskId = taskByTemplateId.get(tpl.depends_on_task_template_id);
        if (myTaskId && targetTaskId) {
          await sb.from('tasks').update({ depends_on_task_id: targetTaskId } as any).eq('id', myTaskId);
        }
      }

      // 2bis. Notifications inbox — informe les managers/dispatchers et les
      // assignés que de nouvelles tâches BE leur arrivent. On résout
      // profile.id → user_id (auth.users.id) via la table profiles, puis
      // on INSERT en lot dans public.notifications.
      try {
        // Collecte les profile_ids à notifier (sans doublons, sans le créateur)
        const profileIdsToNotify = new Set<string>();
        // Manager de dispatch des prestations sélectionnées (= reçoit la demande)
        for (const step of allSelectedSteps) {
          if (step.dispatch_manager_id && step.dispatch_manager_id !== profile.id) {
            profileIdsToNotify.add(step.dispatch_manager_id);
          }
        }
        // Assignés directs des tâches "fixed_user"
        for (const c of (createdChildren ?? [])) {
          if (c.assignee_id && c.assignee_id !== profile.id) {
            profileIdsToNotify.add(c.assignee_id);
          }
        }

        if (profileIdsToNotify.size > 0) {
          // Résout profile.id → user_id (auth) pour la table notifications
          const { data: prfs } = await sb
            .from('profiles')
            .select('id, user_id')
            .in('id', Array.from(profileIdsToNotify));
          const userIdByProfile = new Map<string, string>();
          (prfs ?? []).forEach((p: any) => {
            if (p.user_id) userIdByProfile.set(p.id, p.user_id);
          });

          const notifs: Array<{
            user_id: string;
            title: string;
            message: string;
            type: string;
            related_entity_type: string;
            related_entity_id: string;
          }> = [];

          // Notif au dispatch manager (sur la demande parente)
          const dispatchProfileIds = new Set<string>();
          for (const step of allSelectedSteps) {
            if (step.dispatch_manager_id && step.dispatch_manager_id !== profile.id) {
              dispatchProfileIds.add(step.dispatch_manager_id);
            }
          }
          for (const pid of dispatchProfileIds) {
            const uid = userIdByProfile.get(pid);
            if (!uid) continue;
            notifs.push({
              user_id: uid,
              title: 'Nouvelle demande BE à dispatcher',
              message: `${title} (${selectedGroups.length} prestation${selectedGroups.length > 1 ? 's' : ''})`,
              type: 'be_request_created',
              related_entity_type: 'task',
              related_entity_id: request.id,
            });
          }

          // Notif aux assignés directs (sur chaque tâche enfant)
          for (const c of (createdChildren ?? [])) {
            if (!c.assignee_id || c.assignee_id === profile.id) continue;
            const uid = userIdByProfile.get(c.assignee_id);
            if (!uid) continue;
            notifs.push({
              user_id: uid,
              title: 'Nouvelle tâche BE qui t\'est affectée',
              message: c.title,
              type: 'be_task_assigned',
              related_entity_type: 'task',
              related_entity_id: c.id,
            });
          }

          if (notifs.length > 0) {
            const { error: notifError } = await sb.from('notifications').insert(notifs);
            if (notifError) {
              console.warn('[NewBERequestDialog] notifications insert error (non-blocking):', notifError);
            }
          }
        }
      } catch (notifErr) {
        // Non-bloquant : la création reste valide même si les notifs échouent
        console.warn('[NewBERequestDialog] notification step failed (non-blocking):', notifErr);
      }

      // 3. Liens en tant que task_attachments sur la tâche parente
      const validLinks = links.filter(l => l.url.trim());
      let insertedLinks = 0;
      let linksFailed = false;
      if (validLinks.length > 0) {
        const { data: insertedRows, error: linksError } = await sb.from('task_attachments').insert(
          validLinks.map(l => ({
            task_id: request.id,
            name: l.label.trim() || l.url.trim(),
            url: l.url.trim(),
            type: 'link',
            uploaded_by: user.id,
          }))
        ).select('id');
        if (linksError) {
          console.warn('[NewBERequestDialog] links insert error:', linksError);
          linksFailed = true;
          toast.error(
            `Liens non sauvegardés (${validLinks.length}) : ${linksError.message}`,
          );
        } else {
          insertedLinks = (insertedRows ?? []).length;
        }
      }

      // 3bis. Fichiers uploadés en tant que task_attachments type='file'
      let insertedFiles = 0;
      if (files.length > 0) {
        const { data: insertedFileRows, error: filesError } = await sb.from('task_attachments').insert(
          files.map(f => ({
            task_id: request.id,
            name: f.name,
            url: f.url,
            type: 'file',
            uploaded_by: user.id,
          }))
        ).select('id');
        if (filesError) {
          console.warn('[NewBERequestDialog] files insert error:', filesError);
          toast.error(`Pièces jointes non sauvegardées (${files.length}) : ${filesError.message}`);
        } else {
          insertedFiles = (insertedFileRows ?? []).length;
        }
      }

      // Toast succès enrichi : indique le nb de liens + fichiers insérés
      toast.success(
        `Demande créée : ${selectedGroups.length} prestation(s), ${allSelectedSteps.length} tâche(s)` +
          (validLinks.length > 0
            ? ` · ${insertedLinks}/${validLinks.length} lien${insertedLinks > 1 ? 's' : ''}`
            : '') +
          (files.length > 0
            ? ` · ${insertedFiles}/${files.length} fichier${insertedFiles > 1 ? 's' : ''}`
            : ''),
      );
      onCreated?.(request.id);
      onOpenChange(false);
    } catch (err: any) {
      console.error('[NewBERequestDialog] submit error:', err);
      toast.error(err.message || 'Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-primary" />
            Nouvelle demande BE
          </DialogTitle>

          {/* Projet contextuel (si pré-sélectionné) */}
          {hasDefaultProject && selectedProject && (
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <FolderOpen className="h-3.5 w-3.5" />
              <Badge variant="outline" className="font-mono text-xs">{selectedProject.code_projet}</Badge>
              <span className="font-medium text-foreground">{selectedProject.nom_projet}</span>
            </div>
          )}

          {/* Indicateur d'étapes */}
          <div className="flex items-center gap-1 mt-3 flex-wrap">
            {STEPS.map((label, i) => (
              <React.Fragment key={i}>
                <div
                  className={cn(
                    'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors select-none',
                    i === displayStep
                      ? 'bg-primary text-primary-foreground font-medium'
                      : i < displayStep
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                      : 'text-muted-foreground',
                  )}
                >
                  {i < displayStep ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <span className="w-3 text-center">{i + 1}</span>
                  )}
                  <span>{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        </DialogHeader>

        {/* Content — overflow-y-auto natif (plus fiable que Radix ScrollArea
            avec une grande liste : scrollbar visible et toujours active) */}
        <div className="flex-1 overflow-y-auto px-6 min-h-0">
          <div className="py-5 space-y-4">

            {/* ── ÉTAPE 0 : PROJET & AFFAIRE ──────────────────────────── */}
            {step === 0 && (
              <>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 font-medium">
                    <FolderOpen className="h-4 w-4" />
                    Projet BE <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Rechercher par nom ou code..."
                      value={projectSearch}
                      onChange={e => setProjectSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <div className="border rounded-lg divide-y max-h-52 overflow-y-auto">
                    {projectsLoading ? (
                      <div className="p-3 space-y-2">
                        <Skeleton className="h-8" />
                        <Skeleton className="h-8" />
                      </div>
                    ) : projects.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground text-center">
                        Aucun projet trouvé
                      </div>
                    ) : (
                      projects.map(p => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setSelectedProjectId(p.id);
                            setSelectedAffaireId(null);
                          }}
                          className={cn(
                            'w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-muted/50 transition-colors',
                            selectedProjectId === p.id && 'bg-primary/10',
                          )}
                        >
                          <div
                            className={cn(
                              'w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                              selectedProjectId === p.id
                                ? 'border-primary bg-primary'
                                : 'border-muted-foreground/40',
                            )}
                          >
                            {selectedProjectId === p.id && (
                              <Check className="h-2.5 w-2.5 text-primary-foreground" />
                            )}
                          </div>
                          <Badge variant="outline" className="font-mono text-xs shrink-0">
                            {p.code_projet}
                          </Badge>
                          <span className="text-sm truncate">{p.nom_projet}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Sélection affaire */}
                {selectedProjectId && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 font-medium">
                      <FileText className="h-4 w-4" />
                      Affaire associée{' '}
                      <span className="font-normal text-muted-foreground text-xs">(optionnel)</span>
                    </Label>
                    {affaires.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic px-1">
                        Aucune affaire ouverte pour ce projet
                      </p>
                    ) : (
                      <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                        <button
                          onClick={() => setSelectedAffaireId(null)}
                          className={cn(
                            'w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors',
                            !selectedAffaireId && 'bg-muted/30 font-medium',
                          )}
                        >
                          Sans affaire
                        </button>
                        {affaires.map(a => {
                          const isSel = selectedAffaireId === a.id;
                          return (
                          <button
                            key={a.id}
                            onClick={() => setSelectedAffaireId(a.id)}
                            className={cn(
                              'w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors',
                              isSel
                                ? 'bg-primary/10 ring-1 ring-inset ring-primary/40'
                                : 'hover:bg-muted/50',
                            )}
                          >
                            <div
                              className={cn(
                                'w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                                isSel ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                              )}
                            >
                              {isSel && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                            </div>
                            <Badge variant="outline" className="font-mono text-xs shrink-0">
                              {a.code_affaire}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <span className={cn('text-sm truncate block', isSel && 'font-medium')}>
                                {a.libelle ?? a.code_affaire}
                              </span>
                              {a.commandes && a.commandes.length > 0 && (
                                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                  {a.commandes.slice(0, 3).map(cmd => (
                                    <Badge
                                      key={cmd}
                                      variant="secondary"
                                      className="font-mono text-[10px] px-1 py-0 bg-blue-50 text-blue-700 border border-blue-200"
                                      title="N° commande / devis client (Divalto)"
                                    >
                                      {cmd}
                                    </Badge>
                                  ))}
                                  {a.commandes.length > 3 && (
                                    <span className="text-[10px] text-muted-foreground">
                                      +{a.commandes.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

              </>
            )}

            {/* ── ÉTAPE 1 : PRESTATIONS ───────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Sélectionnez les prestations à commander.
                    <br />
                    <span className="text-xs">Toutes les sous-étapes de la prestation seront créées automatiquement.</span>
                  </p>
                  {selectedGroupNames.size > 0 && (
                    <Badge className="shrink-0">{selectedGroupNames.size} prestation(s)</Badge>
                  )}
                </div>

                {stepsLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}
                  </div>
                ) : (
                  Object.entries(groupsByCategory).map(([cat, groups]) => (
                    <div key={cat} className="space-y-1">
                      {/* Séparateur de catégorie */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className={cn(
                          'h-0.5 flex-1 rounded',
                          cat === 'be_reglementaire' ? 'bg-amber-300' : 'bg-blue-300',
                        )} />
                        <span className={cn(
                          'text-xs font-semibold uppercase tracking-wide px-2',
                          cat === 'be_reglementaire'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-blue-600 dark:text-blue-400',
                        )}>
                          {categoryLabel(cat)}
                        </span>
                        <div className={cn(
                          'h-0.5 flex-1 rounded',
                          cat === 'be_reglementaire' ? 'bg-amber-300' : 'bg-blue-300',
                        )} />
                      </div>

                      <div className="space-y-1.5">
                        {groups.map(g => {
                          const isSelected = selectedGroupNames.has(g.groupName);
                          return (
                            <label
                              key={g.groupName}
                              className={cn(
                                'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/30',
                                isSelected
                                  ? cat === 'be_reglementaire'
                                    ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-900/20'
                                    : 'border-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
                                  : 'border-border',
                              )}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={checked => {
                                  setSelectedGroupNames(prev => {
                                    const next = new Set(prev);
                                    if (checked) next.add(g.groupName);
                                    else next.delete(g.groupName);
                                    return next;
                                  });
                                }}
                                className="shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{g.groupName}</p>
                                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                  <Layers className="h-3 w-3" />
                                  {g.steps.length} étape{g.steps.length > 1 ? 's' : ''}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── ÉTAPE 2 : DÉTAILS ───────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-5">
                {/* Affaire (uniquement en short flow — en full flow, elle est à l'étape 0) */}
                {hasDefaultProject && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 font-medium">
                      <FileText className="h-4 w-4" />
                      Affaire associée{' '}
                      <span className="font-normal text-muted-foreground text-xs">(optionnel)</span>
                    </Label>
                    {affaires.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic px-1">
                        Aucune affaire ouverte pour ce projet
                      </p>
                    ) : (
                      <div className="border rounded-lg divide-y max-h-36 overflow-y-auto">
                        <button
                          onClick={() => setSelectedAffaireId(null)}
                          className={cn(
                            'w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors',
                            !selectedAffaireId && 'bg-muted/30 font-medium',
                          )}
                        >
                          Sans affaire
                        </button>
                        {affaires.map(a => {
                          const isSel = selectedAffaireId === a.id;
                          return (
                          <button
                            key={a.id}
                            onClick={() => setSelectedAffaireId(a.id)}
                            className={cn(
                              'w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors',
                              isSel
                                ? 'bg-primary/10 ring-1 ring-inset ring-primary/40'
                                : 'hover:bg-muted/50',
                            )}
                          >
                            <div
                              className={cn(
                                'w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                                isSel ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                              )}
                            >
                              {isSel && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                            </div>
                            <Badge variant="outline" className="font-mono text-xs shrink-0">
                              {a.code_affaire}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <span className={cn('text-sm truncate block', isSel && 'font-medium')}>
                                {a.libelle ?? a.code_affaire}
                              </span>
                              {a.commandes && a.commandes.length > 0 && (
                                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                  {a.commandes.slice(0, 3).map(cmd => (
                                    <Badge
                                      key={cmd}
                                      variant="secondary"
                                      className="font-mono text-[10px] px-1 py-0 bg-blue-50 text-blue-700 border border-blue-200"
                                      title="N° commande / devis client (Divalto)"
                                    >
                                      {cmd}
                                    </Badge>
                                  ))}
                                  {a.commandes.length > 3 && (
                                    <span className="text-[10px] text-muted-foreground">
                                      +{a.commandes.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Description — masquable / lockable via common_fields_config */}
                {fieldsConfig.description.visible && (
                  <div className="space-y-2">
                    <Label className="font-medium">
                      Description{' '}
                      <span className="font-normal text-muted-foreground text-xs">(optionnel)</span>
                    </Label>
                    <Textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Contexte, contraintes particulières, contraintes de délai, informations complémentaires..."
                      rows={4}
                      disabled={!fieldsConfig.description.editable}
                    />
                  </div>
                )}

                {/* Liens externes — masquables via common_fields_config (champ attachments) */}
                {fieldsConfig.attachments.visible && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 font-medium">
                    <LinkIcon className="h-4 w-4" />
                    Liens{' '}
                    <span className="font-normal text-muted-foreground text-xs">(optionnel — dossiers partagés, références…)</span>
                  </Label>
                  <div className="space-y-2">
                    {links.map((link, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          placeholder="https://..."
                          value={link.url}
                          onChange={e => setLinks(prev => prev.map((l, j) => j === i ? { ...l, url: e.target.value } : l))}
                          className="flex-1 text-sm"
                          disabled={!fieldsConfig.attachments.editable}
                        />
                        <Input
                          placeholder="Intitulé"
                          value={link.label}
                          onChange={e => setLinks(prev => prev.map((l, j) => j === i ? { ...l, label: e.target.value } : l))}
                          className="w-36 text-sm"
                          disabled={!fieldsConfig.attachments.editable}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => setLinks(prev => prev.filter((_, j) => j !== i))}
                          disabled={!fieldsConfig.attachments.editable}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => setLinks(prev => [...prev, { url: '', label: '' }])}
                      disabled={!fieldsConfig.attachments.editable}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Ajouter un lien
                    </Button>
                  </div>
                </div>
                )}

                {/* Fichiers (pièces jointes) — masquables via attachments.visible */}
                {fieldsConfig.attachments.visible && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 font-medium">
                    <Paperclip className="h-4 w-4" />
                    Pièces jointes{' '}
                    <span className="font-normal text-muted-foreground text-xs">(optionnel — PDF, plans, photos, etc.)</span>
                  </Label>
                  <div className="space-y-2">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded border bg-muted/30 text-sm">
                        <FileIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate hover:underline" title={f.name}>
                          {f.name}
                        </a>
                        <span className="text-xs text-muted-foreground shrink-0">{(f.size / 1024).toFixed(0)} Ko</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                          disabled={!fieldsConfig.attachments.editable || isSubmitting}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <label>
                      <input
                        type="file"
                        className="hidden"
                        disabled={!fieldsConfig.attachments.editable || isSubmitting || uploadingFile}
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          // Reset input so the same file can be re-selected if removed
                          e.target.value = '';
                          setUploadingFile(true);
                          try {
                            const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                            const path = `be-requests/draft/${Date.now()}-${safeName}`;
                            const { error: upErr } = await sb.storage
                              .from('attachments')
                              .upload(path, f, { upsert: false });
                            if (upErr) throw upErr;
                            const { data: pub } = sb.storage.from('attachments').getPublicUrl(path);
                            setFiles(prev => [...prev, { name: f.name, url: pub.publicUrl, path, size: f.size }]);
                            toast.success(`Fichier ajouté : ${f.name}`);
                          } catch (err: any) {
                            toast.error(`Upload : ${err.message || 'échec'}`);
                          } finally {
                            setUploadingFile(false);
                          }
                        }}
                      />
                      <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs"
                        disabled={!fieldsConfig.attachments.editable || isSubmitting || uploadingFile} asChild>
                        <span>
                          <Paperclip className="h-3.5 w-3.5" />
                          {uploadingFile ? 'Upload en cours…' : 'Ajouter un fichier'}
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>
                )}

                {links.length === 0 && !description && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5" />
                    Ces informations aideront le manager BE à traiter votre demande.
                  </p>
                )}
              </div>
            )}

            {/* ── ÉTAPE 3 : URGENCE + DATE DE RENDU ───────────────────── */}
            {step === 3 && (
              <div className="space-y-6">
                {/* Urgence — masquable / lockable via common_fields_config */}
                {fieldsConfig.be_urgency.visible && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Quel est le niveau d'urgence de cette demande ?
                      {!fieldsConfig.be_urgency.editable && (
                        <Badge variant="outline" className="ml-2 text-[10px]">Imposée par le BE</Badge>
                      )}
                    </p>
                    <RadioGroup
                      value={urgency}
                      onValueChange={v => setUrgency(v as BEUrgency)}
                      className="space-y-3"
                      disabled={!fieldsConfig.be_urgency.editable}
                    >
                      {URGENCY_OPTIONS.map(opt => (
                        <label
                          key={opt.value}
                          className={cn(
                            'flex items-center gap-4 p-4 rounded-lg border-2 transition-all',
                            urgency === opt.value
                              ? `${opt.bg} border-current ${opt.textColor}`
                              : 'border-border hover:bg-muted/30',
                            fieldsConfig.be_urgency.editable ? 'cursor-pointer' : 'cursor-not-allowed opacity-70',
                          )}
                        >
                          <RadioGroupItem value={opt.value} className="shrink-0" disabled={!fieldsConfig.be_urgency.editable} />
                          <div>
                            <p className={cn('font-medium', urgency === opt.value && opt.textColor)}>
                              {opt.label}
                            </p>
                            <p className="text-xs text-muted-foreground">{opt.desc}</p>
                          </div>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                )}

                {/* Date de rendu attendue — masquable / lockable via common_fields_config */}
                {fieldsConfig.due_date.visible && (
                  <div className="space-y-2 border-t pt-4">
                    <label htmlFor="expectedDate" className="text-sm font-medium">
                      Date de rendu attendue
                      <span className="text-xs text-muted-foreground font-normal ml-1">(optionnel)</span>
                    </label>
                    <Input
                      id="expectedDate"
                      type="date"
                      value={expectedDate}
                      onChange={(e) => setExpectedDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="max-w-xs"
                      disabled={!fieldsConfig.due_date.editable}
                    />
                    <p className="text-xs text-muted-foreground">
                      Indique au BE la date à laquelle tu attends le rendu de cette demande.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── ÉTAPE 4 : RÉCAPITULATIF ─────────────────────────────── */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="rounded-lg border divide-y overflow-hidden">
                  {/* Projet */}
                  <div className="flex items-start gap-3 p-4">
                    <Building className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-1">Projet</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono text-xs">
                          {selectedProject?.code_projet}
                        </Badge>
                        <span className="font-medium">{selectedProject?.nom_projet}</span>
                      </div>
                      {selectedAffaire ? (
                        <p className="text-sm text-muted-foreground mt-1">
                          Affaire : <span className="font-mono font-medium">{selectedAffaire.code_affaire}</span>
                          {selectedAffaire.libelle && ` — ${selectedAffaire.libelle}`}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-1 italic">Sans affaire</p>
                      )}
                    </div>
                  </div>

                  {/* Urgence */}
                  <div className="flex items-center gap-3 p-4">
                    <AlertTriangle className={cn(
                      'h-4 w-4 shrink-0',
                      urgency === 'critique' ? 'text-red-500' :
                      urgency === 'urgent' ? 'text-amber-500' : 'text-slate-400',
                    )} />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Urgence</p>
                      <Badge variant="outline" className={cn(
                        urgency === 'critique'
                          ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-400'
                          : urgency === 'urgent'
                          ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400'
                          : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800',
                      )}>
                        {urgency === 'normal' ? 'Normal' : urgency === 'urgent' ? 'Urgent' : 'Critique'}
                      </Badge>
                    </div>
                  </div>

                  {/* Date de rendu attendue */}
                  {expectedDate && (
                    <div className="flex items-center gap-3 p-4">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">Date de rendu attendue</p>
                        <span className="text-sm font-medium">
                          {new Date(expectedDate).toLocaleDateString('fr-FR', {
                            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Prestations sélectionnées */}
                  <div className="flex items-start gap-3 p-4">
                    <ClipboardList className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-2">
                        Prestations commandées ({selectedGroups.length})
                        <span className="ml-2 text-muted-foreground/70">
                          → {allSelectedSteps.length} tâche(s) au total
                        </span>
                      </p>
                      <div className="space-y-2">
                        {selectedGroups.map(g => (
                          <div key={g.groupName} className="flex items-start gap-2">
                            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-sm font-medium">{g.groupName}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                ({g.steps.length} étape{g.steps.length > 1 ? 's' : ''})
                              </span>
                              {g.be_category === 'be_reglementaire' && (
                                <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0 text-amber-600 border-amber-300">
                                  Régl.
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {description.trim() && (
                    <div className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Description</p>
                      <p className="text-sm">{description}</p>
                    </div>
                  )}

                  {links.filter(l => l.url.trim()).length > 0 && (
                    <div className="flex items-start gap-3 p-4">
                      <LinkIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-2">
                          Liens ({links.filter(l => l.url.trim()).length})
                        </p>
                        <div className="space-y-1">
                          {links.filter(l => l.url.trim()).map((l, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-sm">
                              <LinkIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-primary truncate">{l.label.trim() || l.url.trim()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="flex-row items-center gap-2 px-6 py-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              const firstStep = hasDefaultProject ? 1 : 0;
              if (step > firstStep) setStep(s => s - 1);
              else onOpenChange(false);
            }}
            disabled={isSubmitting}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === (hasDefaultProject ? 1 : 0) ? 'Annuler' : 'Retour'}
          </Button>

          <div className="flex-1" />

          {displayStep < lastStep ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="flex items-center gap-1"
            >
              Suivant
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedProjectId || selectedGroupNames.size === 0}
              className="flex items-center gap-2"
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Création…</>
              ) : (
                <><Zap className="h-4 w-4" />Créer la demande</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
