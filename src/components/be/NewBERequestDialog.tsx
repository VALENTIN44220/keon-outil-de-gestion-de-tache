/**
 * NewBERequestDialog — Wizard 4 étapes pour créer une demande Bureau d'Études.
 *
 * Étape 1 : Sélection projet BE + affaire optionnelle
 * Étape 2 : Multi-sélection des prestations (groupées par catégorie)
 * Étape 3 : Niveau d'urgence
 * Étape 4 : Récapitulatif + soumission
 *
 * Crée : 1 tâche parent (type='request') + N tâches enfant (type='task', une par prestation).
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { BEProject } from '@/types/beProject';
import type { BEAffaire } from '@/types/beAffaire';

// ─── Constantes ─────────────────────────────────────────────────────────────

const BE_PROCESS_TEMPLATE_ID = 'bd75a3b0-c918-4b43-befe-739b83f7461a';

const STEPS = ['Projet & Affaire', 'Prestations', 'Urgence', 'Récapitulatif'] as const;

// ─── Types locaux ────────────────────────────────────────────────────────────

interface Prestation {
  id: string;
  name: string;
  description: string | null;
  be_category: 'be' | 'be_reglementaire' | null;
  order_index: number | null;
}

type BEUrgency = 'normal' | 'urgent' | 'critique';

// ─── Props ───────────────────────────────────────────────────────────────────

interface NewBERequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pré-sélectionner un projet (depuis BEProjectHubOverview par ex.) */
  defaultProjectId?: string;
  /** Pré-sélectionner une affaire */
  defaultAffaireId?: string;
  /** Callback après création réussie */
  onCreated?: (requestId: string) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const sb = supabase as any;

function categoryLabel(cat: string) {
  return cat === 'be_reglementaire' ? 'Réglementaire' : "Bureau d'Études";
}

function categoryColor(cat: string) {
  return cat === 'be_reglementaire' ? 'amber' : 'blue';
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
  const { user, profile } = useAuth();

  // ── Navigation ────────────────────────────────────────────────────────────
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Étape 1 : Projet & Affaire ────────────────────────────────────────────
  const [projects, setProjects] = useState<Pick<BEProject, 'id' | 'code_projet' | 'nom_projet'>[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(defaultProjectId ?? null);

  const [affaires, setAffaires] = useState<Pick<BEAffaire, 'id' | 'code_affaire' | 'libelle' | 'status'>[]>([]);
  const [selectedAffaireId, setSelectedAffaireId] = useState<string | null>(defaultAffaireId ?? null);
  const [description, setDescription] = useState('');

  // ── Étape 2 : Prestations ─────────────────────────────────────────────────
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [prestationsLoading, setPrestationsLoading] = useState(false);
  const [selectedPrestationIds, setSelectedPrestationIds] = useState<Set<string>>(new Set());

  // ── Étape 3 : Urgence ─────────────────────────────────────────────────────
  const [urgency, setUrgency] = useState<BEUrgency>('normal');

  // ── Reset sur ouverture ───────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setStep(0);
      setSelectedProjectId(defaultProjectId ?? null);
      setSelectedAffaireId(defaultAffaireId ?? null);
      setSelectedPrestationIds(new Set());
      setUrgency('normal');
      setDescription('');
      setProjectSearch('');
    }
  }, [open, defaultProjectId, defaultAffaireId]);

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

  // ── Chargement affaires ───────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedProjectId) { setAffaires([]); return; }
    sb.from('be_affaires')
      .select('id,code_affaire,libelle,status')
      .eq('be_project_id', selectedProjectId)
      .in('status', ['ouverte', 'en_cours'])
      .order('code_affaire')
      .then(({ data }: any) => setAffaires(data ?? []));
  }, [selectedProjectId]);

  // ── Chargement prestations (uniquement à l'étape 1 → 2) ──────────────────
  useEffect(() => {
    if (step !== 1) return;
    setPrestationsLoading(true);
    sb.from('sub_process_templates')
      .select('id,name,description,be_category,order_index')
      .eq('process_template_id', BE_PROCESS_TEMPLATE_ID)
      .eq('is_shared', true)
      .order('be_category')
      .order('order_index')
      .then(({ data }: any) => {
        setPrestations(data ?? []);
        setPrestationsLoading(false);
      });
  }, [step]);

  // ── Données dérivées ──────────────────────────────────────────────────────
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const selectedAffaire = affaires.find(a => a.id === selectedAffaireId);
  const selectedPrestations = prestations.filter(p => selectedPrestationIds.has(p.id));

  const prestationsByCategory = useMemo(() => {
    const groups: Record<string, Prestation[]> = {};
    for (const p of prestations) {
      const key = p.be_category ?? 'be';
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    return groups;
  }, [prestations]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const canNext = () => {
    if (step === 0) return !!selectedProjectId;
    if (step === 1) return selectedPrestationIds.size > 0;
    return true;
  };

  // ── Soumission ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!user || !profile || !selectedProjectId) return;
    setIsSubmitting(true);

    try {
      const titleSuffix = selectedAffaire
        ? selectedAffaire.code_affaire
        : 'Sans affaire';
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
          be_status: 'en_cours',
          user_id: user.id,
          requester_id: profile.id,
          source_process_template_id: BE_PROCESS_TEMPLATE_ID,
          process_template_id: BE_PROCESS_TEMPLATE_ID,
        })
        .select()
        .single();

      if (reqError) throw reqError;

      // 2. Tâches enfant (une par prestation)
      const childInserts = selectedPrestations.map(p => ({
        title: `${title} — ${p.name}`,
        type: 'task',
        status: 'todo',
        be_project_id: selectedProjectId,
        be_affaire_id: selectedAffaireId || null,
        be_urgency: urgency,
        be_status: 'en_cours',
        user_id: user.id,
        requester_id: profile.id,
        parent_request_id: request.id,
        sub_process_template_id: p.id,
        source_process_template_id: BE_PROCESS_TEMPLATE_ID,
        process_template_id: BE_PROCESS_TEMPLATE_ID,
      }));

      const { error: childError } = await sb.from('tasks').insert(childInserts);
      if (childError) throw childError;

      toast.success(
        `Demande BE créée avec ${selectedPrestations.length} prestation(s)`,
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-primary" />
            Nouvelle demande BE
          </DialogTitle>

          {/* Indicateur d'étapes */}
          <div className="flex items-center gap-1 mt-3 flex-wrap">
            {STEPS.map((label, i) => (
              <React.Fragment key={i}>
                <div
                  className={cn(
                    'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors select-none',
                    i === step
                      ? 'bg-primary text-primary-foreground font-medium'
                      : i < step
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                      : 'text-muted-foreground',
                  )}
                >
                  {i < step ? (
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

        {/* Content */}
        <ScrollArea className="flex-1 px-6">
          <div className="py-5 space-y-4">

            {/* ── ÉTAPE 0 : PROJET & AFFAIRE ──────────────────────────── */}
            {step === 0 && (
              <>
                {/* Recherche projet */}
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
                        {affaires.map(a => (
                          <button
                            key={a.id}
                            onClick={() => setSelectedAffaireId(a.id)}
                            className={cn(
                              'w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-muted/50 transition-colors',
                              selectedAffaireId === a.id && 'bg-primary/10',
                            )}
                          >
                            <Badge variant="outline" className="font-mono text-xs">
                              {a.code_affaire}
                            </Badge>
                            <span className="text-sm truncate">{a.libelle ?? a.code_affaire}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Description */}
                <div className="space-y-2">
                  <Label className="font-medium">
                    Description{' '}
                    <span className="font-normal text-muted-foreground text-xs">(optionnel)</span>
                  </Label>
                  <Textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Contexte, contraintes particulières, informations complémentaires..."
                    rows={3}
                  />
                </div>
              </>
            )}

            {/* ── ÉTAPE 1 : PRESTATIONS ───────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Sélectionnez les prestations à inclure dans cette demande.
                  </p>
                  {selectedPrestationIds.size > 0 && (
                    <Badge className="shrink-0">{selectedPrestationIds.size} sélectionnée(s)</Badge>
                  )}
                </div>

                {prestationsLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-14" />
                    ))}
                  </div>
                ) : (
                  Object.entries(prestationsByCategory).map(([cat, prests]) => (
                    <div key={cat} className="space-y-1">
                      {/* Séparateur de catégorie */}
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className={cn(
                            'h-0.5 flex-1 rounded',
                            cat === 'be_reglementaire' ? 'bg-amber-300' : 'bg-blue-300',
                          )}
                        />
                        <span
                          className={cn(
                            'text-xs font-semibold uppercase tracking-wide px-2',
                            cat === 'be_reglementaire'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-blue-600 dark:text-blue-400',
                          )}
                        >
                          {categoryLabel(cat)}
                        </span>
                        <div
                          className={cn(
                            'h-0.5 flex-1 rounded',
                            cat === 'be_reglementaire' ? 'bg-amber-300' : 'bg-blue-300',
                          )}
                        />
                      </div>

                      <div className="space-y-1.5">
                        {prests.map(p => (
                          <label
                            key={p.id}
                            className={cn(
                              'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/30',
                              selectedPrestationIds.has(p.id)
                                ? cat === 'be_reglementaire'
                                  ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-900/20'
                                  : 'border-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
                                : 'border-border',
                            )}
                          >
                            <Checkbox
                              checked={selectedPrestationIds.has(p.id)}
                              onCheckedChange={checked => {
                                setSelectedPrestationIds(prev => {
                                  const next = new Set(prev);
                                  if (checked) next.add(p.id);
                                  else next.delete(p.id);
                                  return next;
                                });
                              }}
                              className="mt-0.5 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-snug">{p.name}</p>
                              {p.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {p.description}
                                </p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── ÉTAPE 2 : URGENCE ───────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Quel est le niveau d'urgence de cette demande ?
                </p>
                <RadioGroup
                  value={urgency}
                  onValueChange={v => setUrgency(v as BEUrgency)}
                  className="space-y-3"
                >
                  {URGENCY_OPTIONS.map(opt => (
                    <label
                      key={opt.value}
                      className={cn(
                        'flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all',
                        urgency === opt.value
                          ? `${opt.bg} border-current ${opt.textColor}`
                          : 'border-border hover:bg-muted/30',
                      )}
                    >
                      <RadioGroupItem value={opt.value} className="shrink-0" />
                      <div>
                        <p
                          className={cn(
                            'font-medium',
                            urgency === opt.value && opt.textColor,
                          )}
                        >
                          {opt.label}
                        </p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            )}

            {/* ── ÉTAPE 3 : RÉCAPITULATIF ─────────────────────────────── */}
            {step === 3 && (
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
                          Affaire :{' '}
                          <span className="font-mono font-medium">
                            {selectedAffaire.code_affaire}
                          </span>
                          {selectedAffaire.libelle && ` — ${selectedAffaire.libelle}`}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-1 italic">Sans affaire</p>
                      )}
                    </div>
                  </div>

                  {/* Urgence */}
                  <div className="flex items-center gap-3 p-4">
                    <AlertTriangle
                      className={cn(
                        'h-4 w-4 shrink-0',
                        urgency === 'critique'
                          ? 'text-red-500'
                          : urgency === 'urgent'
                          ? 'text-amber-500'
                          : 'text-slate-400',
                      )}
                    />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Urgence</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          urgency === 'critique'
                            ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-400'
                            : urgency === 'urgent'
                            ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400'
                            : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300',
                        )}
                      >
                        {urgency === 'normal'
                          ? 'Normal'
                          : urgency === 'urgent'
                          ? 'Urgent'
                          : 'Critique'}
                      </Badge>
                    </div>
                  </div>

                  {/* Prestations */}
                  <div className="flex items-start gap-3 p-4">
                    <ClipboardList className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-2">
                        Prestations ({selectedPrestations.length})
                      </p>
                      <div className="space-y-1.5">
                        {selectedPrestations.map(p => (
                          <div key={p.id} className="flex items-center gap-2">
                            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <span className="text-sm">{p.name}</span>
                            {p.be_category === 'be_reglementaire' && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1 py-0 text-amber-600 border-amber-300 dark:text-amber-400"
                              >
                                Régl.
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {description.trim() && (
                    <div className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Description</p>
                      <p className="text-sm">{description}</p>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Cela créera{' '}
                  <strong>1 demande</strong> + {selectedPrestations.length}{' '}
                  tâche(s) enfant
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="flex-row items-center gap-2 px-6 py-4 border-t">
          <Button
            variant="outline"
            onClick={() =>
              step > 0 ? setStep(s => s - 1) : onOpenChange(false)
            }
            disabled={isSubmitting}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 0 ? 'Annuler' : 'Retour'}
          </Button>

          <div className="flex-1" />

          {step < STEPS.length - 1 ? (
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
              disabled={isSubmitting || !selectedProjectId || selectedPrestationIds.size === 0}
              className="flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Création…
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Créer la demande
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
