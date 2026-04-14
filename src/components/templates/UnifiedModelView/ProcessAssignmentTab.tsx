import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, Loader2, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ProcessWithTasks } from '@/types/template';
import { toast } from 'sonner';
import {
  fetchEnrichedWorkflowAssignmentRules,
  EnrichedAssignmentRule,
} from '@/lib/workflowAssignmentRules';
import type { ProcessAssignmentHandling } from '@/lib/processAssignmentConfig';

interface ProcessAssignmentTabProps {
  process: ProcessWithTasks;
  onUpdate: () => void;
  canManage: boolean;
}

type AssignmentScope = 'global' | 'per_subprocess';

interface AssignmentConfig {
  scope: AssignmentScope;
  /**
   * Direct = tâches assignées aux cibles des règles.
   * team_lead_reassignment = le collaborateur ciblé reçoit la tâche « À faire » avec réaffectation possible ;
   * après transfert il garde la visibilité pour suivre l'avancement (voir exécution workflow S1).
   */
  assignment_handling: ProcessAssignmentHandling;
  /** ID from wf_assignment_rules — the default rule for the process */
  default_assignment_rule_id: string | null;
}

const DEFAULT_CONFIG: AssignmentConfig = {
  scope: 'per_subprocess',
  assignment_handling: 'direct',
  default_assignment_rule_id: null,
};

export function ProcessAssignmentTab({ process, onUpdate, canManage }: ProcessAssignmentTabProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [config, setConfig] = useState<AssignmentConfig>(DEFAULT_CONFIG);
  const [rules, setRules] = useState<EnrichedAssignmentRule[]>([]);

  useEffect(() => {
    Promise.all([loadRules(), loadAssignmentConfig()]);
  }, [process.id]);

  const loadRules = async () => {
    try {
      const enriched = await fetchEnrichedWorkflowAssignmentRules();
      setRules(enriched);
    } catch (e) {
      console.error('Error loading assignment rules:', e);
    }
  };

  const loadAssignmentConfig = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('process_templates')
        .select('settings')
        .eq('id', process.id)
        .single();

      if (error) throw error;

      const settings = (data?.settings as Record<string, unknown>) || {};
      const saved = settings.assignment_config as Partial<AssignmentConfig> & { scope?: string } | undefined;

      const handlingRaw = saved?.assignment_handling;
      const assignment_handling: ProcessAssignmentHandling =
        handlingRaw === 'team_lead_reassignment' ? 'team_lead_reassignment' : 'direct';

      const scopeRaw = saved?.scope;
      const scope: AssignmentScope = scopeRaw === 'global' ? 'global' : 'per_subprocess';

      const merged: AssignmentConfig = {
        ...DEFAULT_CONFIG,
        scope,
        assignment_handling,
        default_assignment_rule_id:
          typeof saved?.default_assignment_rule_id === 'string'
            ? saved.default_assignment_rule_id
            : null,
      };
      setConfig(merged);
      setIsDirty(false);
    } catch (err) {
      console.error('Error loading assignment config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateConfig = (updates: Partial<AssignmentConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!canManage) return;
    setIsSaving(true);

    try {
      const { data: currentData, error: fetchError } = await supabase
        .from('process_templates')
        .select('settings')
        .eq('id', process.id)
        .single();

      if (fetchError) throw fetchError;

      const currentSettings = (currentData?.settings as Record<string, unknown>) || {};

      const payload = {
        scope: config.scope,
        assignment_handling: config.assignment_handling,
        default_assignment_rule_id: config.default_assignment_rule_id,
        // Ancienne option retirée : on nettoie le JSON pour les sauvegardes futures.
        conditional_sub_process_rules: [] as const,
      };

      const updatedSettings = {
        ...currentSettings,
        assignment_config: payload as unknown,
      };

      const { error } = await supabase
        .from('process_templates')
        .update({ settings: updatedSettings as any })
        .eq('id', process.id);

      if (error) throw error;

      setConfig(config);
      toast.success("Configuration d'affectation enregistrée");
      setIsDirty(false);
      onUpdate();
    } catch (error: any) {
      console.error('Error saving assignment config:', error);
      toast.error(`Erreur: ${error.message || 'Impossible de sauvegarder'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const groupedRules = useMemo(() => groupRulesByType(rules), [rules]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Affectation des tâches</h3>
          <p className="text-sm text-muted-foreground">
            Définissez la règle d'affectation par défaut. Les étapes de workflow peuvent la surcharger individuellement.
          </p>
        </div>
        {isDirty && (
          <Badge variant="outline" className="text-warning border-warning">
            Modifications non enregistrées
          </Badge>
        )}
      </div>

      {/*
       * TODO (désactivé) — Type d'affectation : « Affectation directe » vs « Réaffectation par les managers »
       * La logique `assignment_handling: team_lead_reassignment` permet, lorsqu'une règle résout un collaborateur,
       * de lui attribuer la tâche en « À faire » avec une option de réaffectation (allows_reassignment).
       * L'approche actuelle privilégie la configuration par sous-processus (chaque SP définit ses propres règles
       * dans son onglet Workflow) ; ce mode processus-global sera réactivé ultérieurement.
       *
       * <Card>
       *   <CardHeader>
       *     <CardTitle className="text-base">Type d'affectation</CardTitle>
       *     <CardDescription>
       *       Détermine comment les cibles des règles (poste, groupe, utilisateur…) sont matérialisées en tâches
       *       lors de l'exécution des workflows de ce processus.
       *     </CardDescription>
       *   </CardHeader>
       *   <CardContent>
       *     <RadioGroup value={config.assignment_handling}
       *       onValueChange={(v) => updateConfig({ assignment_handling: v as ProcessAssignmentHandling })}
       *       disabled={!canManage} className="space-y-3">
       *       <div …> direct — Affectation directe </div>
       *       <div …> team_lead_reassignment — Réaffectation par les managers </div>
       *     </RadioGroup>
       *     <Info note>
       *       Ce mode ne remplace pas une affectation « manager » d'une étape de workflow : il s'applique aux
       *       branches où la cible serait déjà un collaborateur précis, en ajoutant la délégation et le suivi.
       *     </Info note>
       *   </CardContent>
       * </Card>
       */}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Périmètre d'affectation</CardTitle>
          <CardDescription>
            Définissez si l'affectation par défaut est gérée globalement ou par sous-processus
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={config.scope}
            onValueChange={(v) => updateConfig({ scope: v as AssignmentScope })}
            disabled={!canManage}
            className="space-y-3"
          >
            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="per_subprocess" id="scope-subprocess" className="mt-1" />
              <div>
                <Label htmlFor="scope-subprocess" className="font-medium cursor-pointer">
                  Par sous-processus
                </Label>
                <p className="text-sm text-muted-foreground">
                  Chaque sous-processus définit ses propres règles dans son workflow
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="global" id="scope-global" className="mt-1" />
              <div>
                <Label htmlFor="scope-global" className="font-medium cursor-pointer">
                  Global (processus)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Une règle par défaut pour tout le processus (les étapes du workflow peuvent la surcharger)
                </p>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {config.scope === 'global' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Règle d'affectation par défaut</CardTitle>
            <CardDescription>
              Les étapes de workflow qui n'ont pas de règle spécifique utiliseront cette règle
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              value={config.default_assignment_rule_id || '__none__'}
              onValueChange={(v) =>
                updateConfig({ default_assignment_rule_id: v === '__none__' ? null : v })
              }
              disabled={!canManage}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une règle d'affectation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Aucune règle par défaut</SelectItem>
                <GroupedRuleSelectItems groupedRules={groupedRules} />
              </SelectContent>
            </Select>

            {config.default_assignment_rule_id && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-3 flex gap-2 items-start">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Cette règle sera utilisée comme valeur par défaut pour toute étape de workflow
                  sans règle d'affectation spécifique.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {config.scope === 'per_subprocess' && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center">
              <Info className="h-10 w-10 text-blue-500 mb-3" />
              <h4 className="font-medium mb-1">Configuration par sous-processus</h4>
              <p className="text-sm text-muted-foreground max-w-sm">
                Chaque sous-processus définit ses propres règles d'affectation dans la
                configuration de son workflow (onglet "Workflow" → étapes).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {canManage && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving || !isDirty}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Enregistrer
          </Button>
        </div>
      )}
    </div>
  );
}

// ---- helpers ----

interface RuleGroup {
  label: string;
  items: EnrichedAssignmentRule[];
}

function GroupedRuleSelectItems({ groupedRules }: { groupedRules: RuleGroup[] }) {
  return (
    <>
      {groupedRules.map((group) => (
        <div key={group.label}>
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group.label}</div>
          {group.items.map((rule) => (
            <SelectItem key={rule.id} value={rule.id}>
              {rule.display_name}
            </SelectItem>
          ))}
        </div>
      ))}
    </>
  );
}

function groupRulesByType(rules: EnrichedAssignmentRule[]): RuleGroup[] {
  const typeOrder: Record<string, string> = {
    manager: 'Manager',
    requester: 'Demandeur',
    user: 'Utilisateurs',
    group: 'Groupes',
    department: 'Services',
    job_title: 'Postes',
  };

  const grouped = new Map<string, EnrichedAssignmentRule[]>();
  for (const rule of rules) {
    const key = rule.type;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(rule);
  }

  const result: RuleGroup[] = [];
  for (const [type, label] of Object.entries(typeOrder)) {
    const items = grouped.get(type);
    if (items && items.length > 0) {
      result.push({ label, items });
    }
  }
  return result;
}
