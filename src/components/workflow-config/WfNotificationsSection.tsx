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
import { Plus, Trash2, Eye, EyeOff, Bell, Mail, MessageSquare } from 'lucide-react';
import type { WfNotification, WfNotificationInsert, WfStep } from '@/types/workflow';
import { WF_EVENT_LABELS } from '@/types/workflow';
import type { Json } from '@/integrations/supabase/types';

interface Props {
  notifications: WfNotification[];
  steps: WfStep[];
  canManage: boolean;
  onAdd: (n: Omit<WfNotificationInsert, 'workflow_id'>) => Promise<WfNotification | null>;
  onUpdate: (id: string, updates: Partial<WfNotification>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const EVENTS = ['approved', 'rejected', 'done', 'cancelled', 'started', 'assigned'];

function getChannels(json: Json): string[] {
  if (Array.isArray(json)) return json as string[];
  return ['in_app'];
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  in_app: <Bell className="h-3 w-3" />,
  email: <Mail className="h-3 w-3" />,
  teams: <MessageSquare className="h-3 w-3" />,
};

export function WfNotificationsSection({ notifications, steps, canManage, onAdd, onUpdate, onDelete }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [newStepKey, setNewStepKey] = useState('');
  const [newEvent, setNewEvent] = useState('done');
  const [newSubject, setNewSubject] = useState('');

  const handleAdd = async () => {
    if (!newStepKey) return;
    await onAdd({
      step_key: newStepKey,
      event: newEvent,
      channels_json: ['in_app', 'email'] as unknown as Json,
      recipients_rules_json: { type: 'requester' } as unknown as Json,
      subject_template: newSubject || null,
    });
    setIsAdding(false);
    setNewStepKey('');
    setNewEvent('done');
    setNewSubject('');
  };

  const getStepName = (key: string) => steps.find(s => s.step_key === key)?.name || key;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base">Notifications</CardTitle>
          <CardDescription>{notifications.length} notification(s) configurée(s)</CardDescription>
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
              <TableHead>Étape</TableHead>
              <TableHead>Événement</TableHead>
              <TableHead>Canaux</TableHead>
              <TableHead>Sujet</TableHead>
              <TableHead className="w-[60px]">Actif</TableHead>
              {canManage && <TableHead className="w-[60px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {notifications.map(n => (
              <TableRow key={n.id}>
                <TableCell className="text-sm">{getStepName(n.step_key)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{WF_EVENT_LABELS[n.event] || n.event}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {getChannels(n.channels_json).map(ch => (
                      <span key={ch} title={ch}>{CHANNEL_ICONS[ch] || ch}</span>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                  {n.subject_template || '—'}
                </TableCell>
                <TableCell>
                  {canManage ? (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onUpdate(n.id, { is_active: !n.is_active })}>
                      {n.is_active ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  ) : (
                    n.is_active ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />
                  )}
                </TableCell>
                {canManage && (
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(n.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {isAdding && (
              <TableRow>
                <TableCell>
                  <Select value={newStepKey} onValueChange={setNewStepKey}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Étape..." /></SelectTrigger>
                    <SelectContent>
                      {steps.map(s => (
                        <SelectItem key={s.step_key} value={s.step_key}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={newEvent} onValueChange={setNewEvent}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EVENTS.map(e => (
                        <SelectItem key={e} value={e}>{WF_EVENT_LABELS[e] || e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell colSpan={2}>
                  <Input className="h-8 text-xs" value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Sujet..." />
                </TableCell>
                <TableCell colSpan={2}>
                  <div className="flex gap-1">
                    <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={!newStepKey}>OK</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setIsAdding(false)}>✕</Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {notifications.length === 0 && !isAdding && (
          <p className="text-center py-6 text-sm text-muted-foreground">Aucune notification configurée</p>
        )}
      </CardContent>
    </Card>
  );
}
