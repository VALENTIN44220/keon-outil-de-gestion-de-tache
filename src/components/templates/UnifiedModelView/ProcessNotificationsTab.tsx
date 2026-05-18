/**
 * ProcessNotificationsTab — Quelles notifications envoyer, sur quels canaux.
 *
 * Matrice événement × canal (In-app, Email, Teams). 1 toggle par cellule.
 * La configuration est sérialisée dans `process_templates.settings.notification_config`.
 *
 * La section « Tokens disponibles » de l'ancienne version a été retirée :
 * aucun éditeur de gabarit ne les consommait, c'était de la doc orpheline.
 */
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Bell, Mail, MessageSquare, BellRing, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TabHeader, ReadOnlyBanner, SaveBar } from './_TabShell';

type Channel = 'inApp' | 'email' | 'teams';

interface NotificationEvent {
  id: string;
  label: string;
  description: string;
  channels: Record<Channel, boolean>;
}

const DEFAULT_EVENTS: NotificationEvent[] = [
  { id: 'request_created',      label: 'Création de demande',     description: 'Quand une nouvelle demande est créée',                    channels: { email: true,  inApp: true,  teams: false } },
  { id: 'task_assigned',        label: 'Affectation de tâche',    description: 'Quand une tâche est assignée à un utilisateur',         channels: { email: true,  inApp: true,  teams: false } },
  { id: 'task_status_changed',  label: 'Changement de statut',    description: 'Quand le statut d\'une tâche change',                    channels: { email: false, inApp: true,  teams: false } },
  { id: 'validation_requested', label: 'Demande de validation',   description: 'Quand une validation est requise',                       channels: { email: true,  inApp: true,  teams: true  } },
  { id: 'validation_decided',   label: 'Décision de validation',  description: 'Quand une validation est approuvée ou refusée',         channels: { email: true,  inApp: true,  teams: false } },
  { id: 'request_completed',    label: 'Clôture de demande',      description: 'Quand une demande est clôturée',                         channels: { email: true,  inApp: true,  teams: false } },
];

const CHANNELS: { key: Channel; label: string; icon: any }[] = [
  { key: 'inApp', label: 'In-app', icon: Bell },
  { key: 'email', label: 'Email',  icon: Mail },
  { key: 'teams', label: 'Teams',  icon: MessageSquare },
];

interface ProcessNotificationsTabProps {
  processId: string;
  canManage: boolean;
  onUpdate?: () => void;
}

export function ProcessNotificationsTab({ processId, canManage, onUpdate }: ProcessNotificationsTabProps) {
  const [events, setEvents] = useState<NotificationEvent[]>(DEFAULT_EVENTS);
  const [initial, setInitial] = useState<string>(JSON.stringify(DEFAULT_EVENTS));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processId]);

  const load = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('process_templates').select('settings').eq('id', processId).single();
      if (error) throw error;
      const settings = (data?.settings as Record<string, any>) || {};
      const saved = settings.notification_config as NotificationEvent[] | undefined;
      const merged = DEFAULT_EVENTS.map(def => {
        const s = saved?.find(e => e.id === def.id);
        return s ? { ...def, channels: { ...def.channels, ...s.channels } } : def;
      });
      setEvents(merged);
      setInitial(JSON.stringify(merged));
    } catch (err) {
      console.error(err);
      toast.error('Erreur de chargement');
    } finally {
      setIsLoading(false);
    }
  };

  const dirty = useMemo(() => JSON.stringify(events) !== initial, [events, initial]);

  const toggleChannel = (eventId: string, channel: Channel) => {
    if (!canManage) return;
    setEvents(prev => prev.map(e =>
      e.id === eventId ? { ...e, channels: { ...e.channels, [channel]: !e.channels[channel] } } : e,
    ));
  };

  const toggleAllRow = (eventId: string, value: boolean) => {
    if (!canManage) return;
    setEvents(prev => prev.map(e =>
      e.id === eventId ? { ...e, channels: { inApp: value, email: value, teams: value } } : e,
    ));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: cur } = await supabase
        .from('process_templates').select('settings').eq('id', processId).single();
      const currentSettings = (cur?.settings as Record<string, unknown>) || {};
      const updated = { ...currentSettings, notification_config: events as unknown };
      const { error } = await supabase
        .from('process_templates').update({ settings: updated as any }).eq('id', processId);
      if (error) throw error;
      toast.success('Notifications enregistrées');
      setInitial(JSON.stringify(events));
      onUpdate?.();
    } catch (err: any) {
      console.error(err);
      toast.error(`Erreur : ${err.message ?? err}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-2">
      <TabHeader
        icon={BellRing}
        title="Notifications"
        description="Pour chaque événement, choisis sur quels canaux les utilisateurs sont prévenus."
      />

      <ReadOnlyBanner show={!canManage} />

      {/* En-tête colonnes */}
      <div className="hidden sm:grid grid-cols-[1fr_auto] gap-3 px-3 text-[10px] uppercase tracking-wide text-muted-foreground">
        <div>Événement</div>
        <div className="flex items-center gap-3">
          {CHANNELS.map(c => (
            <div key={c.key} className="w-14 flex items-center justify-center gap-1">
              <c.icon className="h-3 w-3" />
              <span>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Liste des événements */}
      <div className="space-y-2">
        {events.map((event) => {
          const allOn = event.channels.inApp && event.channels.email && event.channels.teams;
          const anyOn = event.channels.inApp || event.channels.email || event.channels.teams;
          return (
            <Card key={event.id} className={cn(!anyOn && 'opacity-70')}>
              <CardContent className="p-3">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleAllRow(event.id, !allOn)}
                      disabled={!canManage}
                      title={allOn ? 'Désactiver tous les canaux' : 'Activer tous les canaux'}
                      className={cn(
                        'mt-0.5 h-2 w-2 rounded-full shrink-0 transition-colors',
                        anyOn ? 'bg-emerald-500' : 'bg-muted-foreground/30',
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{event.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{event.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-2 justify-end">
                    {CHANNELS.map((c) => (
                      <div key={c.key} className="w-14 flex flex-col items-center gap-0.5">
                        <Switch
                          checked={event.channels[c.key]}
                          onCheckedChange={() => toggleChannel(event.id, c.key)}
                          disabled={!canManage}
                          aria-label={`${c.label} pour ${event.label}`}
                        />
                        <span className="sm:hidden text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <c.icon className="h-2.5 w-2.5" />
                          {c.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {canManage && (
        <SaveBar
          dirty={dirty}
          saving={isSaving}
          canSave={true}
          onSave={handleSave}
          label="Enregistrer les notifications"
        />
      )}
    </div>
  );
}
