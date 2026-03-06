import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Trash2, Edit2, Eye, EyeOff, Bell, Mail, MessageSquare, Save, Loader2 } from 'lucide-react';
import type { WfNotification, WfNotificationInsert, WfNotificationUpdate, WfStep } from '@/types/workflow';
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

const CHANNELS = [
  { value: 'in_app', label: 'In-app', icon: <Bell className="h-4 w-4" /> },
  { value: 'email', label: 'Email', icon: <Mail className="h-4 w-4" /> },
  { value: 'teams', label: 'Teams', icon: <MessageSquare className="h-4 w-4" /> },
];

const RECIPIENT_TYPES = [
  { value: 'requester', label: 'Demandeur' },
  { value: 'assignee', label: 'Exécutant / Affecté' },
  { value: 'manager', label: 'Manager du demandeur' },
  { value: 'target_manager', label: 'Manager de l\'exécutant' },
  { value: 'department', label: 'Tout le service cible' },
  { value: 'watchers', label: 'Observateurs' },
  { value: 'validators', label: 'Validateurs de l\'étape' },
];

function getChannels(json: Json): string[] {
  if (Array.isArray(json)) return json as string[];
  return ['in_app'];
}

function getRecipients(json: Json): string[] {
  if (!json) return ['requester'];
  if (Array.isArray(json)) {
    return json.map(item => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null && 'type' in item) return String((item as any).type);
      return String(item);
    });
  }
  if (typeof json === 'object' && json !== null && 'types' in json && Array.isArray((json as any).types)) {
    return (json as any).types.map((t: any) => typeof t === 'string' ? t : String(t));
  }
  if (typeof json === 'object' && json !== null && 'type' in json) {
    return [String((json as any).type)];
  }
  return ['requester'];
}

function getRecipientLabel(type: string): string {
  return RECIPIENT_TYPES.find(r => r.value === type)?.label || type;
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  in_app: <Bell className="h-3 w-3" />,
  email: <Mail className="h-3 w-3" />,
  teams: <MessageSquare className="h-3 w-3" />,
};

export function WfNotificationsSection({ notifications, steps, canManage, onAdd, onUpdate, onDelete }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingNotif, setEditingNotif] = useState<WfNotification | null>(null);

  const getStepName = (key: string) => steps.find(s => s.step_key === key)?.name || key;

  const openAdd = () => {
    setEditingNotif(null);
    setDrawerOpen(true);
  };

  const openEdit = (n: WfNotification) => {
    setEditingNotif(n);
    setDrawerOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base">Notifications</CardTitle>
            <CardDescription>{notifications.length} notification(s) configurée(s)</CardDescription>
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
                <TableHead>Étape</TableHead>
                <TableHead>Événement</TableHead>
                <TableHead>Destinataires</TableHead>
                <TableHead>Canaux</TableHead>
                <TableHead>Sujet</TableHead>
                <TableHead className="w-[60px]">Actif</TableHead>
                {canManage && <TableHead className="w-[80px]">Actions</TableHead>}
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
                    <div className="flex flex-wrap gap-1">
                      {getRecipients(n.recipients_rules_json).map(r => (
                        <Badge key={r} variant="secondary" className="text-xs">{getRecipientLabel(r)}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {getChannels(n.channels_json).map(ch => (
                        <span key={ch} title={ch} className="text-muted-foreground">{CHANNEL_ICONS[ch] || ch}</span>
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
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(n)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(n.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {notifications.length === 0 && (
            <p className="text-center py-6 text-sm text-muted-foreground">Aucune notification configurée</p>
          )}
        </CardContent>
      </Card>

      <NotificationDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditingNotif(null); }}
        steps={steps}
        initialData={editingNotif}
        onSave={async (data) => {
          if (editingNotif) {
            await onUpdate(editingNotif.id, data);
          } else {
            await onAdd(data as Omit<WfNotificationInsert, 'workflow_id'>);
          }
          setDrawerOpen(false);
          setEditingNotif(null);
        }}
      />
    </>
  );
}

// ─── Drawer ────────────────────────────────────────────────

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  steps: WfStep[];
  initialData: WfNotification | null;
  onSave: (data: any) => Promise<void>;
}

function NotificationDrawer({ open, onClose, steps, initialData, onSave }: DrawerProps) {
  const isEdit = !!initialData;

  const [stepKey, setStepKey] = useState('');
  const [event, setEvent] = useState('done');
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['in_app', 'email']);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>(['requester']);
  const [subject, setSubject] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Reset on open
  useState(() => {
    // Will be handled by the effect below
  });

  // Use a manual reset when open/initialData changes
  const resetForm = () => {
    if (initialData) {
      setStepKey(initialData.step_key);
      setEvent(initialData.event);
      setSelectedChannels(getChannels(initialData.channels_json));
      setSelectedRecipients(getRecipients(initialData.recipients_rules_json));
      setSubject(initialData.subject_template || '');
      setBodyTemplate(initialData.body_template || '');
      setIsActive(initialData.is_active);
    } else {
      setStepKey('');
      setEvent('done');
      setSelectedChannels(['in_app', 'email']);
      setSelectedRecipients(['requester']);
      setSubject('');
      setBodyTemplate('');
      setIsActive(true);
    }
  };

  // Reset when drawer opens
  if (open) {
    // Using a ref-like pattern to only reset once
  }

  // Simple effect replacement
  const [lastOpenState, setLastOpenState] = useState(false);
  if (open !== lastOpenState) {
    setLastOpenState(open);
    if (open) resetForm();
  }

  const toggleChannel = (ch: string) => {
    setSelectedChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    );
  };

  const toggleRecipient = (r: string) => {
    setSelectedRecipients(prev =>
      prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
    );
  };

  const handleSave = async () => {
    if (!stepKey && !isEdit) return;
    setIsSaving(true);
    try {
      const data: any = {
        step_key: stepKey,
        event,
        channels_json: selectedChannels as unknown as Json,
        recipients_rules_json: { types: selectedRecipients } as unknown as Json,
        subject_template: subject || null,
        body_template: bodyTemplate || null,
        is_active: isActive,
      };
      await onSave(data);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier la notification' : 'Ajouter une notification'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Step */}
          <div className="space-y-2">
            <Label>Étape déclenchante *</Label>
            <Select value={stepKey} onValueChange={setStepKey} disabled={isEdit}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une étape..." />
              </SelectTrigger>
              <SelectContent>
                {steps.map(s => (
                  <SelectItem key={s.step_key} value={s.step_key}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Event */}
          <div className="space-y-2">
            <Label>Événement déclencheur *</Label>
            <Select value={event} onValueChange={setEvent}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENTS.map(e => (
                  <SelectItem key={e} value={e}>{WF_EVENT_LABELS[e] || e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recipients */}
          <div className="space-y-3">
            <Label>Qui notifier ? *</Label>
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
              {RECIPIENT_TYPES.map(r => (
                <div key={r.value} className="flex items-center gap-3">
                  <Checkbox
                    id={`recipient-${r.value}`}
                    checked={selectedRecipients.includes(r.value)}
                    onCheckedChange={() => toggleRecipient(r.value)}
                  />
                  <label htmlFor={`recipient-${r.value}`} className="text-sm cursor-pointer flex-1">
                    {r.label}
                  </label>
                </div>
              ))}
            </div>
            {selectedRecipients.length === 0 && (
              <p className="text-xs text-destructive">Sélectionnez au moins un destinataire</p>
            )}
          </div>

          {/* Channels */}
          <div className="space-y-3">
            <Label>Comment notifier ? *</Label>
            <div className="flex gap-2">
              {CHANNELS.map(ch => {
                const selected = selectedChannels.includes(ch.value);
                return (
                  <Button
                    key={ch.value}
                    type="button"
                    variant={selected ? 'default' : 'outline'}
                    size="sm"
                    className="gap-2"
                    onClick={() => toggleChannel(ch.value)}
                  >
                    {ch.icon}
                    {ch.label}
                  </Button>
                );
              })}
            </div>
            {selectedChannels.length === 0 && (
              <p className="text-xs text-destructive">Sélectionnez au moins un canal</p>
            )}
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label>Sujet du message</Label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Ex: Votre demande a été validée"
            />
            <p className="text-xs text-muted-foreground">
              Variables disponibles : {'{request_number}'}, {'{requester_name}'}, {'{step_name}'}
            </p>
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label>Corps du message (optionnel)</Label>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={bodyTemplate}
              onChange={e => setBodyTemplate(e.target.value)}
              placeholder="Ex: La demande {request_number} a été traitée..."
            />
          </div>

          {/* Active */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <Label>Actif</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || (!isEdit && !stepKey) || selectedChannels.length === 0 || selectedRecipients.length === 0}
          >
            {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            {isEdit ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
