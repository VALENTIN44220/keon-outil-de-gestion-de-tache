/**
 * TaskTemplateFlowSection — Bloc « Enchaînement & Affectation & État » d'un task_template.
 *
 * Aligne le configurateur (CONFIGURATION:MODELE) avec le fichier
 * AUTRES_FLUX_parametrage.xlsx : démarrage, dépendance, délai, override
 * affectation groupe, état en sortie. Ces champs s'ajoutent à la validation
 * N1/N2 et à la durée déjà gérées par TaskTemplateValidationSection.
 */
import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRightCircle, Workflow, Layers, Users } from 'lucide-react';

export type StartMode = 'parallel' | 'after_previous';

interface SiblingTask {
  id: string;
  title: string;
  order_index: number | null;
}

interface CollaboratorGroup {
  id: string;
  name: string;
}

interface RequestState {
  code: string;
  label: string;
}

export interface TaskTemplateFlowValues {
  startMode: StartMode;
  dependsOnTaskTemplateId: string | null;
  delayAfterPreviousDays: number;
  targetGroupId: string | null;
  outputStateCode: string | null;
}

interface Props extends TaskTemplateFlowValues {
  /** Sous-processus parent — sert à lister les étapes sœurs pour « Dépend de ». */
  subProcessTemplateId: string | null;
  /** Process parent — sert à lister les états (request_states) en sortie. */
  processTemplateId: string | null;
  /** ID du task_template courant (en édition) — exclu de la liste des dépendances. */
  currentTaskTemplateId?: string | null;

  onChange: (next: Partial<TaskTemplateFlowValues>) => void;
}

export function TaskTemplateFlowSection({
  startMode,
  dependsOnTaskTemplateId,
  delayAfterPreviousDays,
  targetGroupId,
  outputStateCode,
  subProcessTemplateId,
  processTemplateId,
  currentTaskTemplateId,
  onChange,
}: Props) {
  const [siblings, setSiblings] = useState<SiblingTask[]>([]);
  const [groups, setGroups] = useState<CollaboratorGroup[]>([]);
  const [states, setStates] = useState<RequestState[]>([]);

  // Étapes sœurs (pour « Dépend de »)
  useEffect(() => {
    if (!subProcessTemplateId) {
      setSiblings([]);
      return;
    }
    (async () => {
      const { data } = await (supabase as any)
        .from('task_templates')
        .select('id, title, order_index')
        .eq('sub_process_template_id', subProcessTemplateId)
        .order('order_index', { ascending: true });
      const filtered = ((data as SiblingTask[]) ?? []).filter(s => s.id !== currentTaskTemplateId);
      setSiblings(filtered);
    })();
  }, [subProcessTemplateId, currentTaskTemplateId]);

  // Groupes collaborateurs (override affectation par étape)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('collaborator_groups')
        .select('id, name')
        .order('name');
      setGroups((data as CollaboratorGroup[]) ?? []);
    })();
  }, []);

  // États métier du process (output_state_code)
  useEffect(() => {
    if (!processTemplateId) {
      setStates([]);
      return;
    }
    (async () => {
      const { data } = await (supabase as any)
        .from('request_states')
        .select('code, label')
        .eq('process_template_id', processTemplateId)
        .order('order_index', { ascending: true });
      setStates((data as RequestState[]) ?? []);
    })();
  }, [processTemplateId]);

  const showDependsOn = startMode === 'after_previous';

  const siblingsOptions = useMemo(
    () =>
      siblings.map(s => ({
        value: s.id,
        label: `${s.order_index ?? '?'} — ${s.title}`,
      })),
    [siblings],
  );

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Workflow className="h-4 w-4" />
        Enchaînement, affectation & état
      </div>

      {/* Démarrage + dépendance + délai */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            Démarrage
          </Label>
          <Select
            value={startMode}
            onValueChange={(v) => {
              const next = v as StartMode;
              onChange({
                startMode: next,
                // Si on repasse en parallèle, on nettoie la dépendance
                dependsOnTaskTemplateId: next === 'parallel' ? null : dependsOnTaskTemplateId,
                delayAfterPreviousDays: next === 'parallel' ? 0 : delayAfterPreviousDays,
              });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="parallel">En parallèle (dès le départ)</SelectItem>
              <SelectItem value="after_previous">Après une autre étape</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showDependsOn && (
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <ArrowRightCircle className="h-3.5 w-3.5 text-muted-foreground" />
              Dépend de
            </Label>
            <Select
              value={dependsOnTaskTemplateId ?? '__none__'}
              onValueChange={(v) =>
                onChange({ dependsOnTaskTemplateId: v === '__none__' ? null : v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner l'étape précédente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Aucune dépendance spécifique —</SelectItem>
                {siblingsOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {siblingsOptions.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                Aucune autre étape configurée dans ce sous-processus.
              </p>
            )}
          </div>
        )}

        {showDependsOn && (
          <div className="space-y-2 sm:col-span-2">
            <Label>Délai après précédente (jours)</Label>
            <Input
              type="number"
              min={0}
              max={365}
              value={delayAfterPreviousDays}
              onChange={(e) => onChange({ delayAfterPreviousDays: Number(e.target.value) || 0 })}
              className="w-32"
            />
            <p className="text-[11px] text-muted-foreground">
              Nombre de jours d'attente après la fin de l'étape précédente avant de démarrer.
            </p>
          </div>
        )}
      </div>

      {/* Override affectation groupe (Excel : "Affectation cible (UUID)" par étape) */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          Affectation — groupe (override par étape)
        </Label>
        <Select
          value={targetGroupId ?? '__inherit__'}
          onValueChange={(v) => onChange({ targetGroupId: v === '__inherit__' ? null : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Hériter de l'affectation du sous-processus" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__inherit__">Hériter du sous-processus</SelectItem>
            {groups.map(g => (
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          Utile si une étape doit aller à un autre groupe que celui du sous-processus
          (ex : Vérification → groupe Achat puis Création → groupe Comptabilité).
        </p>
      </div>

      {/* État en sortie (output_state_code) */}
      <div className="space-y-2">
        <Label>État de la demande en sortie</Label>
        <Select
          value={outputStateCode ?? '__none__'}
          onValueChange={(v) => onChange({ outputStateCode: v === '__none__' ? null : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Ne change pas l'état de la demande" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Aucun changement —</SelectItem>
            {states.map(s => (
              <SelectItem key={s.code} value={s.code}>
                <span className="font-mono text-[11px] text-muted-foreground mr-2">{s.code}</span>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {processTemplateId && states.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            Aucun état configuré pour ce process — onglet « États » du process pour en ajouter.
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">
          Quand cette étape est terminée, la demande passe automatiquement à cet état métier.
        </p>
      </div>
    </div>
  );
}
