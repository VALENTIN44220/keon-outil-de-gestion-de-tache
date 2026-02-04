import { useState, useEffect } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
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
    id: 'subprocess_started',
    label: 'Démarrage du sous-processus',
    description: 'Quand le sous-processus démarre',
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
    id: 'subprocess_completed',
    label: 'Clôture du sous-processus',
    description: 'Quand toutes les tâches sont terminées',
    channels: { email: true, inApp: true, teams: false },
  },
];

interface SubProcessNotificationsPanelProps {
  subProcessId: string;
  canManage: boolean;
  onUpdate?: () => void;
}

export function SubProcessNotificationsPanel({ 
  subProcessId, 
  canManage, 
  onUpdate 
}: SubProcessNotificationsPanelProps) {
  const [events, setEvents] = useState<NotificationEvent[]>(DEFAULT_EVENTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    loadNotificationConfig();
  }, [subProcessId]);

  const loadNotificationConfig = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('sub_process_templates')
        .select('form_schema')
        .eq('id', subProcessId)
        .single();

      if (error) throw error;

      // Use form_schema as a settings store (or we can use a separate column)
      const formSchema = data?.form_schema as Record<string, any> | null;
      const notificationConfig = formSchema?.notification_config as NotificationEvent[] | undefined;

      if (notificationConfig && Array.isArray(notificationConfig)) {
        // Merge saved config with defaults to handle new events
        const mergedEvents = DEFAULT_EVENTS.map(defaultEvent => {
          const saved = notificationConfig.find(e => e.id === defaultEvent.id);
          return saved || defaultEvent;
        });
        setEvents(mergedEvents);
      } else {
        setEvents(DEFAULT_EVENTS);
      }
      setIsDirty(false);
    } catch (error) {
      console.error('Error loading notification config:', error);
      toast.error('Erreur lors du chargement de la configuration');
    } finally {
      setIsLoading(false);
    }
  };

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
    setIsDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // First get current form_schema to merge
      const { data: currentData, error: fetchError } = await supabase
        .from('sub_process_templates')
        .select('form_schema')
        .eq('id', subProcessId)
        .single();

      if (fetchError) throw fetchError;

      const currentSchema = (currentData?.form_schema as Record<string, unknown>) || {};
      const updatedSchema = {
        ...currentSchema,
        notification_config: events as unknown,
      };

      const { error } = await supabase
        .from('sub_process_templates')
        .update({ form_schema: updatedSchema as any })
        .eq('id', subProcessId);

      if (error) throw error;

      toast.success('Configuration des notifications enregistrée');
      setIsDirty(false);
      onUpdate?.();
    } catch (error: any) {
      console.error('Error saving notifications:', error);
      toast.error(`Erreur: ${error.message || 'Impossible de sauvegarder'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Available template tokens for notifications
  const availableTokens = [
    { name: '{{requester_name}}', description: 'Nom du demandeur' },
    { name: '{{request_title}}', description: 'Titre de la demande' },
    { name: '{{subprocess_name}}', description: 'Nom du sous-processus' },
    { name: '{{task_title}}', description: 'Titre de la tâche' },
    { name: '{{assignee_name}}', description: 'Nom de l\'assigné' },
    { name: '{{due_date}}', description: 'Date d\'échéance' },
    { name: '{{status}}', description: 'Statut actuel' },
  ];

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
          <h3 className="text-base font-semibold">Notifications</h3>
          <p className="text-sm text-muted-foreground">
            Configurez les notifications par événement
          </p>
        </div>
        {isDirty && (
          <Badge variant="outline" className="text-warning border-warning">
            Modifications non enregistrées
          </Badge>
        )}
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

      {/* Available Tokens */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Tokens disponibles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Ces tokens peuvent être utilisés dans les modèles de notification
          </p>
          <div className="flex flex-wrap gap-2">
            {availableTokens.map((token) => (
              <Badge
                key={token.name}
                variant="outline"
                className="font-mono text-xs"
                title={token.description}
              >
                {token.name}
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
          <Button onClick={handleSave} disabled={isSaving || !isDirty}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Enregistrer les notifications
          </Button>
        </div>
      )}
    </div>
  );
}
