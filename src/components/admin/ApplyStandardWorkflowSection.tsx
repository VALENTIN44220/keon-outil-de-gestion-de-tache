import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Play, AlertCircle, CheckSquare, Square, MinusSquare } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isApplying, setIsApplying] = useState(false);
  const [results, setResults] = useState<{ total: number; success: number; errors: number } | null>(null);

  useEffect(() => {
    supabase
      .from('sub_process_templates')
      .select('id, name, process_templates(name)')
      .order('name')
      .then(({ data }) => {
        const items = (data || []).map((sp: any) => ({
          id: sp.id,
          name: sp.name,
          process_name: sp.process_templates?.name || null,
        }));
        setSubProcesses(items);
        // Select all by default
        setSelectedIds(new Set(items.map(i => i.id)));
      });
  }, []);

  // Group by process name
  const grouped = useMemo(() => {
    const map = new Map<string, SubProcessOption[]>();
    for (const sp of subProcesses) {
      const key = sp.process_name || 'Sans processus';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(sp);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [subProcesses]);

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === subProcesses.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(subProcesses.map(s => s.id)));
    }
  };

  const toggleGroup = (groupSps: SubProcessOption[]) => {
    const allSelected = groupSps.every(sp => selectedIds.has(sp.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const sp of groupSps) {
        if (allSelected) next.delete(sp.id);
        else next.add(sp.id);
      }
      return next;
    });
  };

  const applyToSelected = async () => {
    const targets = subProcesses.filter(sp => selectedIds.has(sp.id));
    if (targets.length === 0) return;
    setIsApplying(true);
    setResults(null);
    try {
      const res = await applyStandardToSubProcesses(workflowId, targets);
      setResults(res);
      toast.success(`Workflow standard appliqué à ${res.success}/${res.total} sous-processus`);
    } catch {
      toast.error("Erreur lors de l'application");
    } finally {
      setIsApplying(false);
    }
  };

  const allChecked = selectedIds.size === subProcesses.length;
  const someChecked = selectedIds.size > 0 && !allChecked;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Play className="h-4 w-4" />
          Appliquer le workflow standard
        </CardTitle>
        <CardDescription>
          Sélectionnez les sous-processus auxquels appliquer la configuration standard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>La régénération écrasera les workflows personnalisés existants des sous-processus sélectionnés.</p>
        </div>

        {/* Select all / none */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={toggleAll}
            className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
          >
            {allChecked ? (
              <CheckSquare className="h-4 w-4 text-primary" />
            ) : someChecked ? (
              <MinusSquare className="h-4 w-4 text-primary" />
            ) : (
              <Square className="h-4 w-4 text-muted-foreground" />
            )}
            {allChecked ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} / {subProcesses.length} sélectionnés
          </span>
        </div>

        {/* Checkbox list grouped by process */}
        <ScrollArea className="max-h-72 border rounded-lg">
          <div className="p-2 space-y-3">
            {grouped.map(([processName, sps]) => {
              const groupAllSelected = sps.every(sp => selectedIds.has(sp.id));
              const groupSomeSelected = sps.some(sp => selectedIds.has(sp.id)) && !groupAllSelected;

              return (
                <div key={processName}>
                  {/* Group header */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(sps)}
                    className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground mb-1 hover:text-foreground transition-colors w-full"
                  >
                    {groupAllSelected ? (
                      <CheckSquare className="h-3.5 w-3.5 text-primary" />
                    ) : groupSomeSelected ? (
                      <MinusSquare className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Square className="h-3.5 w-3.5" />
                    )}
                    {processName} ({sps.length})
                  </button>
                  {/* Items */}
                  <div className="space-y-0.5 ml-1">
                    {sps.map(sp => (
                      <label
                        key={sp.id}
                        className="flex items-center gap-2 py-1 px-2 rounded hover:bg-accent cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={selectedIds.has(sp.id)}
                          onCheckedChange={() => toggleOne(sp.id)}
                        />
                        {sp.name}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Apply button */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="default"
              disabled={selectedIds.size === 0 || isApplying}
              className="gap-2 w-full"
            >
              {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Appliquer aux {selectedIds.size} sous-processus sélectionnés
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Appliquer le workflow standard ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action va régénérer les workflows de <strong>{selectedIds.size} sous-processus</strong> avec la configuration standard. Les workflows personnalisés existants seront écrasés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={applyToSelected}>Confirmer</AlertDialogAction>
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
