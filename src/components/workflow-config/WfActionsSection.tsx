import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import type { WfAction, WfActionInsert, WfTransition, WfStep, WfActionType } from '@/types/workflow';
import { WF_ACTION_TYPE_LABELS, WF_EVENT_LABELS } from '@/types/workflow';
import type { Json } from '@/integrations/supabase/types';

interface Props {
  actions: WfAction[];
  transitions: WfTransition[];
  steps: WfStep[];
  canManage: boolean;
  onAdd: (a: Omit<WfActionInsert, 'workflow_id'>) => Promise<WfAction | null>;
  onUpdate: (id: string, updates: Partial<WfAction>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const ACTION_TYPES: WfActionType[] = ['db_insert', 'db_update', 'create_task', 'set_field'];

export function WfActionsSection({ actions, transitions, steps, canManage, onAdd, onUpdate, onDelete }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [newActionType, setNewActionType] = useState<WfActionType>('create_task');
  const [newStepKey, setNewStepKey] = useState('');
  const [newTransitionId, setNewTransitionId] = useState('');

  const handleAdd = async () => {
    await onAdd({
      action_type: newActionType,
      step_key: newStepKey || null,
      transition_id: newTransitionId || null,
      order_index: actions.length,
      config_json: {} as Json,
      on_error: 'continue',
    });
    setIsAdding(false);
    setNewActionType('create_task');
    setNewStepKey('');
    setNewTransitionId('');
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base">Actions & tâches</CardTitle>
          <CardDescription>{actions.length} action(s) configurée(s)</CardDescription>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setIsAdding(true)}>
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
              <TableHead>Étape / Transition</TableHead>
              <TableHead>Erreur</TableHead>
              <TableHead className="w-[60px]">Actif</TableHead>
              {canManage && <TableHead className="w-[60px]"></TableHead>}
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
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {isAdding && (
              <TableRow>
                <TableCell className="text-xs text-muted-foreground">{actions.length + 1}</TableCell>
                <TableCell>
                  <Select value={newActionType} onValueChange={v => setNewActionType(v as WfActionType)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{WF_ACTION_TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={newStepKey || '__none__'} onValueChange={v => setNewStepKey(v === '__none__' ? '' : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Étape..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {steps.map(s => (
                        <SelectItem key={s.step_key} value={s.step_key}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell colSpan={3}>
                  <div className="flex gap-1">
                    <Button size="sm" className="h-7 text-xs" onClick={handleAdd}>OK</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setIsAdding(false)}>✕</Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {actions.length === 0 && !isAdding && (
          <p className="text-center py-6 text-sm text-muted-foreground">Aucune action configurée</p>
        )}
      </CardContent>
    </Card>
  );
}
