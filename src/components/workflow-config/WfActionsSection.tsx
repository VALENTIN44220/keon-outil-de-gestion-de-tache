import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Trash2, Eye, EyeOff, Edit2, Loader2, Save, Info } from 'lucide-react';
import type { WfAction, WfActionInsert, WfTransition, WfStep, WfActionType } from '@/types/workflow';
import { WF_ACTION_TYPE_LABELS } from '@/types/workflow';
import type { Json } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  actions: WfAction[];
  transitions: WfTransition[];
  steps: WfStep[];
  canManage: boolean;
  subProcessId: string;
  onAdd: (a: Omit<WfActionInsert, 'workflow_id'>) => Promise<WfAction | null>;
  onUpdate: (id: string, updates: Partial<WfAction>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const ACTION_TYPES: WfActionType[] = ['create_task', 'db_insert', 'db_update', 'set_field'];

interface TaskTemplateOption {
  id: string;
  title: string;
}

interface TableInfo {
  table_name: string;
}

// ---- Config type shapes ----
interface CreateTaskConfig {
  task_template_id?: string;
}

interface DbInsertConfig {
  target_table?: string;
  field_mappings?: Record<string, string>;
}

interface DbUpdateConfig {
  target_table?: string;
  filter_column?: string;
  filter_value?: string;
  field_mappings?: Record<string, string>;
}

interface SetFieldConfig {
  field_name?: string;
  field_value?: string;
}

type ActionConfig = CreateTaskConfig | DbInsertConfig | DbUpdateConfig | SetFieldConfig;

export function WfActionsSection({ actions, transitions, steps, canManage, subProcessId, onAdd, onUpdate, onDelete }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<WfAction | null>(null);

  // Form state
  const [actionType, setActionType] = useState<WfActionType>('create_task');
  const [stepKey, setStepKey] = useState('');
  const [transitionId, setTransitionId] = useState('');
  const [onError, setOnError] = useState<'continue' | 'stop'>('continue');
  const [configJson, setConfigJson] = useState<ActionConfig>({});
  const [isSaving, setIsSaving] = useState(false);

  // Reference data
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplateOption[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);

  useEffect(() => {
    if (subProcessId) {
      supabase
        .from('task_templates')
        .select('id, title')
        .eq('sub_process_template_id', subProcessId)
        .order('order_index')
        .then(({ data }) => setTaskTemplates(data || []));
    }

    // Load available tables
    supabase.rpc('get_public_tables_info').then(({ data }) => {
      setTables((data || []).filter((t: any) => !t.table_name.startsWith('wf_') && !t.table_name.startsWith('pg_')));
    });
  }, [subProcessId]);

  const openAdd = () => {
    setEditingAction(null);
    setActionType('create_task');
    setStepKey('');
    setTransitionId('');
    setOnError('continue');
    setConfigJson({});
    setDialogOpen(true);
  };

  const openEdit = (action: WfAction) => {
    setEditingAction(action);
    setActionType(action.action_type);
    setStepKey(action.step_key || '');
    setTransitionId(action.transition_id || '');
    setOnError(action.on_error as 'continue' | 'stop');
    setConfigJson((action.config_json as ActionConfig) || {});
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (editingAction) {
        await onUpdate(editingAction.id, {
          action_type: actionType,
          step_key: stepKey || null,
          transition_id: transitionId || null,
          on_error: onError,
          config_json: configJson as Json,
        });
      } else {
        await onAdd({
          action_type: actionType,
          step_key: stepKey || null,
          transition_id: transitionId || null,
          order_index: actions.length,
          config_json: configJson as Json,
          on_error: onError,
        });
      }
      setDialogOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const getStepName = (key: string | null) => {
    if (!key) return '—';
    return steps.find(s => s.step_key === key)?.name || key;
  };

  const getTransitionLabel = (tId: string | null) => {
    if (!tId) return '—';
    const t = transitions.find(tr => tr.id === tId);
    if (!t) return tId;
    return `${getStepName(t.from_step_key)} → ${getStepName(t.to_step_key)}`;
  };

  const getConfigSummary = (action: WfAction): string => {
    const cfg = action.config_json as ActionConfig;
    if (!cfg || Object.keys(cfg).length === 0) return 'Non configuré';

    switch (action.action_type) {
      case 'create_task': {
        const c = cfg as CreateTaskConfig;
        if (c.task_template_id) {
          const tt = taskTemplates.find(t => t.id === c.task_template_id);
          return tt ? tt.title : 'Tâche configurée';
        }
        return 'Non configuré';
      }
      case 'db_insert':
      case 'db_update': {
        const c = cfg as DbInsertConfig;
        return c.target_table ? `Table: ${c.target_table}` : 'Non configuré';
      }
      case 'set_field': {
        const c = cfg as SetFieldConfig;
        return c.field_name ? `Champ: ${c.field_name}` : 'Non configuré';
      }
      default:
        return '—';
    }
  };

  // --- Config form per type ---
  const updateConfig = (updates: Partial<ActionConfig>) => {
    setConfigJson(prev => ({ ...prev, ...updates }));
  };

  const renderConfigFields = () => {
    switch (actionType) {
      case 'create_task':
        return (
          <div className="space-y-2">
            <Label>Tâche à créer *</Label>
            <Select
              value={(configJson as CreateTaskConfig).task_template_id || '__none__'}
              onValueChange={v => updateConfig({ task_template_id: v === '__none__' ? undefined : v })}
            >
              <SelectTrigger><SelectValue placeholder="Sélectionner une tâche" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sélectionner...</SelectItem>
                {taskTemplates.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {taskTemplates.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Aucune tâche dans ce sous-processus.
              </p>
            )}
          </div>
        );

      case 'db_insert':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Table cible *</Label>
              <Select
                value={(configJson as DbInsertConfig).target_table || '__none__'}
                onValueChange={v => updateConfig({ target_table: v === '__none__' ? undefined : v })}
              >
                <SelectTrigger><SelectValue placeholder="Sélectionner une table" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sélectionner...</SelectItem>
                  {tables.map(t => (
                    <SelectItem key={t.table_name} value={t.table_name}>{t.table_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mappings champs (JSON)</Label>
              <Textarea
                className="font-mono text-xs"
                rows={4}
                placeholder='{"colonne": "{{champ_formulaire}}"}'
                value={JSON.stringify((configJson as DbInsertConfig).field_mappings || {}, null, 2)}
                onChange={e => {
                  try { updateConfig({ field_mappings: JSON.parse(e.target.value) }); } catch {}
                }}
              />
              <p className="text-xs text-muted-foreground">
                Associez les colonnes de la table aux champs du formulaire avec la syntaxe {'{{nom_champ}}'}
              </p>
            </div>
          </div>
        );

      case 'db_update':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Table cible *</Label>
              <Select
                value={(configJson as DbUpdateConfig).target_table || '__none__'}
                onValueChange={v => updateConfig({ target_table: v === '__none__' ? undefined : v })}
              >
                <SelectTrigger><SelectValue placeholder="Sélectionner une table" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sélectionner...</SelectItem>
                  {tables.map(t => (
                    <SelectItem key={t.table_name} value={t.table_name}>{t.table_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Colonne filtre</Label>
                <Input
                  value={(configJson as DbUpdateConfig).filter_column || ''}
                  onChange={e => updateConfig({ filter_column: e.target.value })}
                  placeholder="ex: id"
                />
              </div>
              <div className="space-y-2">
                <Label>Valeur filtre</Label>
                <Input
                  value={(configJson as DbUpdateConfig).filter_value || ''}
                  onChange={e => updateConfig({ filter_value: e.target.value })}
                  placeholder="ex: {{request_id}}"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mappings champs (JSON)</Label>
              <Textarea
                className="font-mono text-xs"
                rows={4}
                placeholder='{"colonne": "{{champ_formulaire}}"}'
                value={JSON.stringify((configJson as DbUpdateConfig).field_mappings || {}, null, 2)}
                onChange={e => {
                  try { updateConfig({ field_mappings: JSON.parse(e.target.value) }); } catch {}
                }}
              />
            </div>
          </div>
        );

      case 'set_field':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom du champ</Label>
              <Input
                value={(configJson as SetFieldConfig).field_name || ''}
                onChange={e => updateConfig({ field_name: e.target.value })}
                placeholder="ex: status, priority"
              />
            </div>
            <div className="space-y-2">
              <Label>Nouvelle valeur</Label>
              <Input
                value={(configJson as SetFieldConfig).field_value || ''}
                onChange={e => updateConfig({ field_value: e.target.value })}
                placeholder="ex: done, {{requester_name}}"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base">Actions & tâches</CardTitle>
            <CardDescription>{actions.length} action(s) configurée(s)</CardDescription>
          </div>
          {canManage && (
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Étape</TableHead>
                <TableHead>Configuration</TableHead>
                <TableHead>Erreur</TableHead>
                <TableHead className="w-[60px]">Actif</TableHead>
                {canManage && <TableHead className="w-[80px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {actions.map((a, idx) => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {WF_ACTION_TYPE_LABELS[a.action_type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {a.transition_id ? getTransitionLabel(a.transition_id) : getStepName(a.step_key)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {getConfigSummary(a)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{a.on_error === 'stop' ? 'Arrêt' : 'Continuer'}</Badge>
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onUpdate(a.id, { is_active: !a.is_active })}>
                        {a.is_active ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    ) : (
                      a.is_active ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(a.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {actions.length === 0 && (
            <p className="text-center py-6 text-sm text-muted-foreground">Aucune action configurée</p>
          )}
        </CardContent>
      </Card>

      {/* Dialog ajout/édition */}
      <Dialog open={dialogOpen} onOpenChange={o => !o && setDialogOpen(false)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAction ? 'Modifier l\'action' : 'Ajouter une action'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Type */}
            <div className="space-y-2">
              <Label>Type d'action *</Label>
              <Select value={actionType} onValueChange={v => { setActionType(v as WfActionType); setConfigJson({}); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{WF_ACTION_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Étape de déclenchement */}
            <div className="space-y-2">
              <Label>Déclenchée à l'étape</Label>
              <Select value={stepKey || '__none__'} onValueChange={v => setStepKey(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une étape" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Aucune —</SelectItem>
                  {steps.filter(s => s.step_type !== 'start' && s.step_type !== 'end').map(s => (
                    <SelectItem key={s.step_key} value={s.step_key}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Transition (optionnel) */}
            {transitions.length > 0 && (
              <div className="space-y-2">
                <Label>Ou lors de la transition</Label>
                <Select value={transitionId || '__none__'} onValueChange={v => setTransitionId(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Aucune —</SelectItem>
                    {transitions.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {getStepName(t.from_step_key)} → {getStepName(t.to_step_key)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Comportement en erreur */}
            <div className="space-y-2">
              <Label>En cas d'erreur</Label>
              <Select value={onError} onValueChange={v => setOnError(v as 'continue' | 'stop')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="continue">Continuer le workflow</SelectItem>
                  <SelectItem value="stop">Arrêter le workflow</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Config spécifique au type */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Configuration — {WF_ACTION_TYPE_LABELS[actionType]}</span>
              </div>
              {renderConfigFields()}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {editingAction ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
