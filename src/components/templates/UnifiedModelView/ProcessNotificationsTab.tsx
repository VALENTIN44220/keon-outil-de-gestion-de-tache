import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Bell,
  Mail,
  MessageSquare,
  Loader2,
  Settings,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';

interface NotificationEvent {
  id: string;
  label: string;
  description: string;
  channels: {
    email: boolean;
    inApp: boolean;
    teams: boolean;
  };
}

const DEFAULT_EVENTS: NotificationEvent[] = [
  {
    id: 'request_created',
    label: 'Création de demande',
    description: 'Quand une nouvelle demande est créée',
    channels: { email: true, inApp: true, teams: false },
  },
  {
    id: 'task_assigned',
    label: 'Affectation de tâche',
    description: 'Quand une tâche est assignée à un utilisateur',
    channels: { email: true, inApp: true, teams: false },
  },
  {
    id: 'task_status_changed',
    label: 'Changement de statut',
    description: 'Quand le statut d\'une tâche change',
    channels: { email: false, inApp: true, teams: false },
  },
  {
    id: 'validation_requested',
    label: 'Demande de validation',
    description: 'Quand une validation est requise',
    channels: { email: true, inApp: true, teams: true },
  },
  {
    id: 'validation_decided',
    label: 'Décision de validation',
    description: 'Quand une validation est approuvée ou refusée',
    channels: { email: true, inApp: true, teams: false },
  },
  {
    id: 'request_completed',
    label: 'Clôture de demande',
    description: 'Quand une demande est clôturée',
    channels: { email: true, inApp: true, teams: false },
  },
];

interface ProcessNotificationsTabProps {
  processId: string;
  canManage: boolean;
}

export function ProcessNotificationsTab({ processId, canManage }: ProcessNotificationsTabProps) {
  const [events, setEvents] = useState<NotificationEvent[]>(DEFAULT_EVENTS);
  const [isSaving, setIsSaving] = useState(false);

  const toggleChannel = (eventId: string, channel: 'email' | 'inApp' | 'teams') => {
    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventId
          ? {
              ...event,
              channels: {
                ...event.channels,
                [channel]: !event.channels[channel],
              },
            }
          : event
      )
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // In a real implementation, save to process_notification_config table
      // For now, we just show success
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success('Configuration des notifications enregistrée');
    } catch (error) {
      console.error('Error saving notifications:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const availableVariables = [
    { name: '{{requester_name}}', description: 'Nom du demandeur' },
    { name: '{{request_title}}', description: 'Titre de la demande' },
    { name: '{{process_name}}', description: 'Nom du processus' },
    { name: '{{task_title}}', description: 'Titre de la tâche' },
    { name: '{{assignee_name}}', description: 'Nom de l\'assigné' },
    { name: '{{due_date}}', description: 'Date d\'échéance' },
    { name: '{{status}}', description: 'Statut actuel' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Notifications</h3>
          <p className="text-sm text-muted-foreground">
            Configurez les notifications par événement
          </p>
        </div>
      </div>

      {/* Event notifications */}
      <div className="space-y-3">
        {events.map((event) => (
          <Card key={event.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-medium text-sm mb-1">{event.label}</h4>
                  <p className="text-xs text-muted-foreground">{event.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Button
                      variant={event.channels.inApp ? 'default' : 'outline'}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => canManage && toggleChannel(event.id, 'inApp')}
                      disabled={!canManage}
                    >
                      <Bell className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={event.channels.email ? 'default' : 'outline'}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => canManage && toggleChannel(event.id, 'email')}
                      disabled={!canManage}
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={event.channels.teams ? 'default' : 'outline'}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => canManage && toggleChannel(event.id, 'teams')}
                      disabled={!canManage}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      {/* Available Variables */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Variables disponibles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Ces variables peuvent être utilisées dans les modèles de notification
          </p>
          <div className="flex flex-wrap gap-2">
            {availableVariables.map((variable) => (
              <Badge
                key={variable.name}
                variant="outline"
                className="font-mono text-xs"
                title={variable.description}
              >
                {variable.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Channel Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Bell className="h-3 w-3" />
          <span>In-app</span>
        </div>
        <div className="flex items-center gap-1">
          <Mail className="h-3 w-3" />
          <span>Email</span>
        </div>
        <div className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          <span>Teams</span>
        </div>
      </div>

      {/* Save Button */}
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Enregistrer les notifications
          </Button>
        </div>
      )}
    </div>
  );
}
