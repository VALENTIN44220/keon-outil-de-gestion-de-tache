import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import type { WfTransition, WfTransitionInsert, WfStep } from '@/types/workflow';
import { WF_EVENT_LABELS } from '@/types/workflow';

interface Props {
  transitions: WfTransition[];
  steps: WfStep[];
  canManage: boolean;
  onAdd: (t: Omit<WfTransitionInsert, 'workflow_id'>) => Promise<WfTransition | null>;
  onUpdate: (id: string, updates: Partial<WfTransition>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const EVENTS = ['approved', 'rejected', 'done', 'cancelled', 'info', 'started', 'assigned'];

export function WfTransitionsSection({ transitions, steps, canManage, onAdd, onUpdate, onDelete }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [newFrom, setNewFrom] = useState('');
  const [newTo, setNewTo] = useState('');
  const [newEvent, setNewEvent] = useState('done');

  const handleAdd = async () => {
    if (!newFrom || !newTo) return;
    await onAdd({ from_step_key: newFrom, to_step_key: newTo, event: newEvent });
    setIsAdding(false);
    setNewFrom('');
    setNewTo('');
    setNewEvent('done');
  };

  const getStepName = (key: string) => steps.find(s => s.step_key === key)?.name || key;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base">Transitions & règles</CardTitle>
          <CardDescription>{transitions.length} transition(s)</CardDescription>
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
              <TableHead>Depuis</TableHead>
              <TableHead>Événement</TableHead>
              <TableHead>Vers</TableHead>
              <TableHead className="w-[60px]">Actif</TableHead>
              {canManage && <TableHead className="w-[60px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {transitions.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-medium text-sm">{getStepName(t.from_step_key)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {WF_EVENT_LABELS[t.event] || t.event}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium text-sm">{getStepName(t.to_step_key)}</TableCell>
                <TableCell>
                  {canManage ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onUpdate(t.id, { is_active: !t.is_active })}
                    >
                      {t.is_active ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  ) : (
                    t.is_active ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />
                  )}
                </TableCell>
                {canManage && (
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {isAdding && (
              <TableRow>
                <TableCell>
                  <Select value={newFrom} onValueChange={setNewFrom}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Depuis..." />
                    </SelectTrigger>
                    <SelectContent>
                      {steps.filter(s => s.step_type !== 'end').map(s => (
                        <SelectItem key={s.step_key} value={s.step_key}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={newEvent} onValueChange={setNewEvent}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENTS.map(e => (
                        <SelectItem key={e} value={e}>{WF_EVENT_LABELS[e] || e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={newTo} onValueChange={setNewTo}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Vers..." />
                    </SelectTrigger>
                    <SelectContent>
                      {steps.filter(s => s.step_type !== 'start').map(s => (
                        <SelectItem key={s.step_key} value={s.step_key}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell colSpan={2}>
                  <div className="flex gap-1">
                    <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={!newFrom || !newTo}>OK</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setIsAdding(false)}>✕</Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {transitions.length === 0 && !isAdding && (
          <p className="text-center py-6 text-sm text-muted-foreground">
            Aucune transition. Les transitions par défaut seront créées automatiquement lors de l'ajout d'étapes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
