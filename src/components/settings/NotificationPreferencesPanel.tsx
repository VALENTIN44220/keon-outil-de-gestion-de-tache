import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Bell, Mail, MessageSquare, Loader2, Save, Check } from 'lucide-react';
import { toast } from 'sonner';

interface NotificationPreference {
  id?: string;
  event_type: string;
  channel: 'in_app' | 'email' | 'teams';
  enabled: boolean;
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
}

const eventTypes = [
  { key: 'task_assigned', label: 'Tâche assignée', description: 'Quand une tâche vous est attribuée' },
  { key: 'task_status_changed', label: 'Changement de statut', description: 'Quand le statut d\'une tâche change' },
  { key: 'task_completed', label: 'Tâche terminée', description: 'Quand une tâche est marquée comme terminée' },
  { key: 'validation_requested', label: 'Validation demandée', description: 'Quand votre validation est requise' },
  { key: 'validation_decided', label: 'Décision de validation', description: 'Quand une validation est approuvée/refusée' },
  { key: 'comment_added', label: 'Nouveau commentaire', description: 'Quand un commentaire est ajouté' },
  { key: 'reminder_triggered', label: 'Rappel d\'échéance', description: 'Rappels avant les dates limites' },
  { key: 'request_created', label: 'Nouvelle demande', description: 'Quand une demande vous concerne' },
];

const channels: { key: 'in_app' | 'email' | 'teams'; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'in_app', label: 'Application', icon: Bell },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'teams', label: 'Teams', icon: MessageSquare },
];

const frequencies = [
  { value: 'immediate', label: 'Immédiat' },
  { value: 'hourly', label: 'Toutes les heures' },
  { value: 'daily', label: 'Quotidien' },
  { value: 'weekly', label: 'Hebdomadaire' },
];

export function NotificationPreferencesPanel() {
  const { profile: currentUser } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    const fetchPreferences = async () => {
      setIsLoading(true);
      try {
        const { data } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', currentUser.id);

        if (data && data.length > 0) {
          setPreferences(data.map(p => ({
            id: p.id,
            event_type: p.event_type,
            channel: p.channel as 'in_app' | 'email' | 'teams',
            enabled: p.enabled,
            frequency: (p.frequency || 'immediate') as NotificationPreference['frequency'],
          })));
        } else {
          // Initialize default preferences
          const defaults: NotificationPreference[] = [];
          eventTypes.forEach(event => {
            channels.forEach(channel => {
              defaults.push({
                event_type: event.key,
                channel: channel.key,
                enabled: channel.key === 'in_app', // Enable in-app by default
                frequency: 'immediate',
              });
            });
          });
          setPreferences(defaults);
        }
      } catch (error) {
        console.error('Error fetching preferences:', error);
        toast.error('Erreur lors du chargement des préférences');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreferences();
  }, [currentUser]);

  const updatePreference = (eventType: string, channel: 'in_app' | 'email' | 'teams', updates: Partial<NotificationPreference>) => {
    setPreferences(prev => prev.map(p => {
      if (p.event_type === eventType && p.channel === channel) {
        return { ...p, ...updates };
      }
      return p;
    }));
    setHasChanges(true);
  };

  const getPreference = (eventType: string, channel: 'in_app' | 'email' | 'teams') => {
    return preferences.find(p => p.event_type === eventType && p.channel === channel);
  };

  const handleSave = async () => {
    if (!currentUser) return;

    setIsSaving(true);
    try {
      // Delete existing preferences
      await supabase
        .from('notification_preferences')
        .delete()
        .eq('user_id', currentUser.id);

      // Insert new preferences
      const toInsert = preferences.map(p => ({
        user_id: currentUser.id,
        event_type: p.event_type,
        channel: p.channel,
        enabled: p.enabled,
        frequency: p.frequency,
      }));

      const { error } = await supabase
        .from('notification_preferences')
        .insert(toInsert);

      if (error) throw error;

      setHasChanges(false);
      toast.success('Préférences enregistrées');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setIsSaving(false);
    }
  };

  const enableAll = (channel: 'in_app' | 'email' | 'teams') => {
    setPreferences(prev => prev.map(p => {
      if (p.channel === channel) {
        return { ...p, enabled: true };
      }
      return p;
    }));
    setHasChanges(true);
  };

  const disableAll = (channel: 'in_app' | 'email' | 'teams') => {
    setPreferences(prev => prev.map(p => {
      if (p.channel === channel) {
        return { ...p, enabled: false };
      }
      return p;
    }));
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Préférences de notification
            </CardTitle>
            <CardDescription>
              Configurez comment et quand vous souhaitez être notifié
            </CardDescription>
          </div>
          <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : hasChanges ? (
              <Save className="h-4 w-4 mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            {hasChanges ? 'Enregistrer' : 'Enregistré'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Channel toggles header */}
        <div className="grid grid-cols-[1fr,100px,100px,100px,120px] gap-4 items-center text-sm font-medium text-muted-foreground border-b pb-3">
          <span>Type d'événement</span>
          {channels.map(channel => {
            const Icon = channel.icon;
            return (
              <div key={channel.key} className="text-center">
                <Icon className="h-4 w-4 mx-auto mb-1" />
                <span className="text-xs">{channel.label}</span>
              </div>
            );
          })}
          <span className="text-center text-xs">Fréquence</span>
        </div>

        {/* Event type rows */}
        {eventTypes.map(event => (
          <div key={event.key} className="grid grid-cols-[1fr,100px,100px,100px,120px] gap-4 items-center">
            <div>
              <Label className="font-medium">{event.label}</Label>
              <p className="text-xs text-muted-foreground">{event.description}</p>
            </div>

            {channels.map(channel => {
              const pref = getPreference(event.key, channel.key);
              return (
                <div key={channel.key} className="flex justify-center">
                  <Switch
                    checked={pref?.enabled || false}
                    onCheckedChange={(checked) => updatePreference(event.key, channel.key, { enabled: checked })}
                  />
                </div>
              );
            })}

            <div>
              <Select
                value={getPreference(event.key, 'email')?.frequency || 'immediate'}
                onValueChange={(value) => {
                  // Apply frequency to all channels for this event
                  channels.forEach(channel => {
                    updatePreference(event.key, channel.key, { frequency: value as NotificationPreference['frequency'] });
                  });
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {frequencies.map(freq => (
                    <SelectItem key={freq.value} value={freq.value} className="text-xs">
                      {freq.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}

        <Separator />

        {/* Quick actions */}
        <div className="flex gap-4 flex-wrap">
          {channels.map(channel => (
            <div key={channel.key} className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => enableAll(channel.key)}
              >
                Activer tout {channel.label}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => disableAll(channel.key)}
              >
                Désactiver
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
