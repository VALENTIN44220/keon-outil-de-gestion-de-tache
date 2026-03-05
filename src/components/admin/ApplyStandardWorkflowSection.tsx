import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Play, AlertCircle } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SubProcessOption {
  id: string;
  name: string;
  process_name: string | null;
}

async function applyStandardToSubProcesses(
  workflowId: string,
  targets: SubProcessOption[],
) {
  const [stepsRes, transRes, notifsRes, actionsRes] = await Promise.all([
    supabase.from('wf_steps').select('*').eq('workflow_id', workflowId).order('order_index'),
    supabase.from('wf_transitions').select('*').eq('workflow_id', workflowId),
    supabase.from('wf_notifications').select('*').eq('workflow_id', workflowId),
    supabase.from('wf_actions').select('*').eq('workflow_id', workflowId),
  ]);

  const templateSteps = stepsRes.data || [];
  const templateTransitions = transRes.data || [];
  const templateNotifications = notifsRes.data || [];
  const templateActions = actionsRes.data || [];

  let success = 0;
  let errors = 0;

  for (const sp of targets) {
    try {
      const { data: existingWfs } = await supabase
        .from('wf_workflows')
        .select('id')
        .eq('sub_process_template_id', sp.id);

      for (const ewf of existingWfs || []) {
        await Promise.all([
          supabase.from('wf_steps').delete().eq('workflow_id', ewf.id),
          supabase.from('wf_transitions').delete().eq('workflow_id', ewf.id),
          supabase.from('wf_notifications').delete().eq('workflow_id', ewf.id),
          supabase.from('wf_actions').delete().eq('workflow_id', ewf.id),
        ]);
      }
      if (existingWfs && existingWfs.length > 0) {
        await supabase.from('wf_workflows').delete().eq('sub_process_template_id', sp.id);
      }

      const { data: newWf, error: wfErr } = await supabase
        .from('wf_workflows')
        .insert({
          name: `Workflow — ${sp.name}`,
          sub_process_template_id: sp.id,
          is_active: true,
          is_draft: false,
          version: 1,
          published_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (wfErr || !newWf) throw wfErr;

      const stepKeyMap = new Map<string, string>();
      const newSteps = templateSteps.map(s => {
        const newKey = `${s.step_key}_${sp.id.slice(0, 8)}`;
        stepKeyMap.set(s.step_key, newKey);
        return {
          workflow_id: newWf.id,
          step_key: newKey,
          name: s.name,
          step_type: s.step_type,
          order_index: s.order_index,
          state_label: s.state_label,
          is_required: s.is_required,
          validation_mode: s.validation_mode,
          n_required: s.n_required,
          assignment_rule_id: s.assignment_rule_id,
        };
      });

      if (newSteps.length > 0) {
        await supabase.from('wf_steps').insert(newSteps);
      }

      const newTransitions = templateTransitions.map(t => ({
        workflow_id: newWf.id,
        from_step_key: stepKeyMap.get(t.from_step_key) || t.from_step_key,
        to_step_key: stepKeyMap.get(t.to_step_key) || t.to_step_key,
        event: t.event,
        condition_json: t.condition_json,
        is_active: t.is_active,
      }));
      if (newTransitions.length > 0) {
        await supabase.from('wf_transitions').insert(newTransitions);
      }

      const newNotifications = templateNotifications.map(n => ({
        workflow_id: newWf.id,
        step_key: n.step_key ? (stepKeyMap.get(n.step_key) || n.step_key) : null,
        event: n.event,
        channels_json: n.channels_json,
        recipients_rules_json: n.recipients_rules_json,
        subject_template: n.subject_template,
        body_template: n.body_template,
        is_active: n.is_active,
      }));
      if (newNotifications.length > 0) {
        await supabase.from('wf_notifications').insert(newNotifications);
      }

      const newActions = templateActions.map(a => ({
        workflow_id: newWf.id,
        transition_id: a.transition_id,
        step_key: a.step_key ? (stepKeyMap.get(a.step_key) || a.step_key) : null,
        action_type: a.action_type,
        config_json: a.config_json,
        order_index: a.order_index,
        is_active: a.is_active,
      }));
      if (newActions.length > 0) {
        await supabase.from('wf_actions').insert(newActions);
      }

      success++;
    } catch (err) {
      console.error(`Error applying to ${sp.name}:`, err);
      errors++;
    }
  }

  return { total: targets.length, success, errors };
}

export function ApplyStandardWorkflowSection({ workflowId }: { workflowId: string }) {
  const [subProcesses, setSubProcesses] = useState<SubProcessOption[]>([]);
  const [selectedSpId, setSelectedSpId] = useState<string>('');
  const [isApplying, setIsApplying] = useState(false);
  const [isApplyingAll, setIsApplyingAll] = useState(false);
  const [results, setResults] = useState<{ total: number; success: number; errors: number } | null>(null);

  useEffect(() => {
    supabase
      .from('sub_process_templates')
      .select('id, name, process_templates(name)')
      .order('name')
      .then(({ data }) => {
        setSubProcesses(
          (data || []).map((sp: any) => ({
            id: sp.id,
            name: sp.name,
            process_name: sp.process_templates?.name || null,
          }))
        );
      });
  }, []);

  const applyToOne = async () => {
    const sp = subProcesses.find(s => s.id === selectedSpId);
    if (!sp) return;
    setIsApplying(true);
    setResults(null);
    try {
      const res = await applyStandardToSubProcesses(workflowId, [sp]);
      setResults(res);
      if (res.success > 0) toast.success(`Workflow standard appliqué à "${sp.name}"`);
      else toast.error(`Échec de l'application à "${sp.name}"`);
    } catch {
      toast.error("Erreur lors de l'application");
    } finally {
      setIsApplying(false);
    }
  };

  const applyToAll = async () => {
    setIsApplyingAll(true);
    setResults(null);
    try {
      const res = await applyStandardToSubProcesses(workflowId, subProcesses);
      setResults(res);
      toast.success(`Workflow standard appliqué à ${res.success} sous-processus`);
    } catch {
      toast.error("Erreur lors de l'application");
    } finally {
      setIsApplyingAll(false);
    }
  };

  const isLoading = isApplying || isApplyingAll;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Play className="h-4 w-4" />
          Appliquer le workflow standard
        </CardTitle>
        <CardDescription>
          Appliquez la configuration standard à un sous-processus spécifique ou à tous.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>La régénération écrasera les workflows personnalisés existants.</p>
        </div>

        {/* Individual apply */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Appliquer à un sous-processus</label>
          <div className="flex gap-2">
            <Select value={selectedSpId} onValueChange={setSelectedSpId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Sélectionner un sous-processus…" />
              </SelectTrigger>
              <SelectContent>
                {subProcesses.map(sp => (
                  <SelectItem key={sp.id} value={sp.id}>
                    {sp.process_name ? `${sp.process_name} › ` : ''}{sp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="default" disabled={!selectedSpId || isLoading} className="gap-2 shrink-0">
                  {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Appliquer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Appliquer le workflow standard ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Le workflow de <strong>{subProcesses.find(s => s.id === selectedSpId)?.name}</strong> sera régénéré avec la configuration standard. Le workflow personnalisé existant sera écrasé.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={applyToOne}>Confirmer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Separator */}
        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">ou</span>
          </div>
        </div>

        {/* Apply to all */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={isLoading} className="gap-2 w-full">
              {isApplyingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Appliquer à tous les sous-processus ({subProcesses.length})
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Appliquer à tous les sous-processus ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action va régénérer les workflows de <strong>tous les {subProcesses.length} sous-processus</strong> avec la configuration standard. Les workflows personnalisés seront écrasés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={applyToAll}>Confirmer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {results && (
          <div className="text-sm p-3 bg-muted rounded-lg">
            Résultat : <strong>{results.success}</strong> / {results.total} réussis
            {results.errors > 0 && <span className="text-destructive ml-2">({results.errors} erreurs)</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
