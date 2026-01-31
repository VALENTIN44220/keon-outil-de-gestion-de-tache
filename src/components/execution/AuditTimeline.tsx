import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Clock, 
  User, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Bell, 
  UserPlus, 
  RefreshCw,
  MessageSquare,
  FileText,
  ChevronDown,
  ChevronUp,
  History,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AuditEvent {
  id: string;
  timestamp: string;
  event_type: string;
  actor_name: string | null;
  actor_id: string | null;
  description: string;
  details: Record<string, unknown>;
  entity_type: string;
  entity_id: string;
}

interface AuditTimelineProps {
  requestId: string;
  className?: string;
  maxHeight?: string;
}

const eventConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  request_created: { icon: Play, color: 'bg-green-100 text-green-600 border-green-200', label: 'Demande créée' },
  task_created: { icon: FileText, color: 'bg-blue-100 text-blue-600 border-blue-200', label: 'Tâche créée' },
  task_assigned: { icon: UserPlus, color: 'bg-indigo-100 text-indigo-600 border-indigo-200', label: 'Tâche assignée' },
  task_status_changed: { icon: RefreshCw, color: 'bg-amber-100 text-amber-600 border-amber-200', label: 'Statut modifié' },
  task_completed: { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600 border-emerald-200', label: 'Tâche terminée' },
  validation_requested: { icon: Clock, color: 'bg-purple-100 text-purple-600 border-purple-200', label: 'Validation demandée' },
  validation_decided: { icon: CheckCircle2, color: 'bg-teal-100 text-teal-600 border-teal-200', label: 'Validation décidée' },
  sub_process_started: { icon: Play, color: 'bg-cyan-100 text-cyan-600 border-cyan-200', label: 'Sous-processus démarré' },
  sub_process_completed: { icon: CheckCircle2, color: 'bg-green-100 text-green-600 border-green-200', label: 'Sous-processus terminé' },
  process_completed: { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600 border-emerald-200', label: 'Processus terminé' },
  comment_added: { icon: MessageSquare, color: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Commentaire ajouté' },
  notification_sent: { icon: Bell, color: 'bg-violet-100 text-violet-600 border-violet-200', label: 'Notification envoyée' },
  reminder_triggered: { icon: Bell, color: 'bg-orange-100 text-orange-600 border-orange-200', label: 'Rappel déclenché' },
};

export function AuditTimeline({ requestId, className, maxHeight = '500px' }: AuditTimelineProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const fetchAuditData = async () => {
      setIsLoading(true);
      try {
        // Fetch workflow events for this request
        const { data: workflowEvents } = await supabase
          .from('workflow_events')
          .select('*')
          .or(`entity_id.eq.${requestId},payload->>request_id.eq.${requestId}`)
          .order('created_at', { ascending: false });

        // Fetch status transitions for child tasks
        const { data: childTasks } = await supabase
          .from('tasks')
          .select('id')
          .eq('parent_request_id', requestId);

        let statusTransitions: any[] = [];
        if (childTasks && childTasks.length > 0) {
          const taskIds = childTasks.map(t => t.id);
          const { data: transitions } = await supabase
            .from('task_status_transitions')
            .select('*')
            .in('task_id', taskIds)
            .order('created_at', { ascending: false });
          
          statusTransitions = transitions || [];
        }

        // Fetch profiles for actor names
        const actorIds = new Set<string>();
        workflowEvents?.forEach(e => {
          if (e.triggered_by) actorIds.add(e.triggered_by);
        });
        statusTransitions.forEach(t => {
          if (t.changed_by) actorIds.add(t.changed_by);
        });

        if (actorIds.size > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, display_name')
            .in('id', Array.from(actorIds));

          if (profilesData) {
            const map = new Map<string, string>();
            profilesData.forEach(p => map.set(p.id, p.display_name || 'Utilisateur'));
            setProfiles(map);
          }
        }

        // Combine and format events
        const allEvents: AuditEvent[] = [];

        workflowEvents?.forEach(e => {
          allEvents.push({
            id: e.id,
            timestamp: e.created_at,
            event_type: e.event_type,
            actor_name: e.triggered_by ? profiles.get(e.triggered_by) || null : null,
            actor_id: e.triggered_by,
            description: formatEventDescription(e.event_type, e.payload as Record<string, unknown>),
            details: e.payload as Record<string, unknown>,
            entity_type: e.entity_type,
            entity_id: e.entity_id,
          });
        });

        statusTransitions.forEach(t => {
          allEvents.push({
            id: t.id,
            timestamp: t.created_at,
            event_type: 'task_status_changed',
            actor_name: t.changed_by ? profiles.get(t.changed_by) || null : null,
            actor_id: t.changed_by,
            description: `Statut changé de "${formatStatus(t.from_status)}" à "${formatStatus(t.to_status)}"`,
            details: { from: t.from_status, to: t.to_status, reason: t.reason },
            entity_type: 'task',
            entity_id: t.task_id,
          });
        });

        // Sort by timestamp descending
        allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        setEvents(allEvents);
      } catch (error) {
        console.error('Error fetching audit data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAuditData();
  }, [requestId]);

  const displayedEvents = isExpanded ? events : events.slice(0, 5);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Journal d'audit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Journal d'audit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Aucun événement enregistré</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Journal d'audit
            <Badge variant="secondary" className="ml-2">
              {events.length} événements
            </Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="pr-4" style={{ maxHeight }}>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

            <div className="space-y-4">
              {displayedEvents.map((event, index) => {
                const config = eventConfig[event.event_type] || {
                  icon: Clock,
                  color: 'bg-gray-100 text-gray-600 border-gray-200',
                  label: event.event_type,
                };
                const Icon = config.icon;
                const actorName = event.actor_id ? profiles.get(event.actor_id) : null;

                return (
                  <div key={event.id} className="relative flex gap-4 pl-0">
                    {/* Timeline dot */}
                    <div className={cn(
                      'relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 shrink-0',
                      config.color
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0 pb-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <span className="font-medium text-sm">{config.label}</span>
                          {actorName && (
                            <span className="text-xs text-muted-foreground ml-2">
                              par {actorName}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0" title={format(new Date(event.timestamp), 'PPPp', { locale: fr })}>
                          {formatDistanceToNow(new Date(event.timestamp), { locale: fr, addSuffix: true })}
                        </span>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {event.description}
                      </p>

                      {event.details && Object.keys(event.details).length > 0 && event.event_type !== 'task_status_changed' && (
                        <div className="mt-2 text-xs bg-muted/50 rounded p-2">
                          {event.details.sub_process_ids && (
                            <span>
                              {(event.details.sub_process_ids as string[]).length} sous-processus sélectionnés
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>

        {events.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Voir moins
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Voir {events.length - 5} événements de plus
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function formatEventDescription(eventType: string, payload: Record<string, unknown>): string {
  switch (eventType) {
    case 'request_created':
      return `Nouvelle demande de type "${payload.request_type || 'standard'}" créée`;
    case 'task_created':
      return `Nouvelle tâche créée${payload.title ? `: ${payload.title}` : ''}`;
    case 'task_assigned':
      return `Tâche assignée${payload.assignee_name ? ` à ${payload.assignee_name}` : ''}`;
    case 'task_completed':
      return 'Tâche marquée comme terminée';
    case 'validation_requested':
      return `Validation demandée (niveau ${payload.level || 1})`;
    case 'validation_decided':
      return payload.decision === 'approved' ? 'Validation approuvée' : 'Validation refusée';
    case 'sub_process_started':
      return `Sous-processus "${payload.sub_process_name || ''}" démarré`;
    case 'sub_process_completed':
      return `Sous-processus "${payload.sub_process_name || ''}" terminé`;
    case 'process_completed':
      return 'Processus complet terminé avec succès';
    case 'comment_added':
      return 'Nouveau commentaire ajouté';
    case 'notification_sent':
      return `Notification envoyée${payload.channel ? ` via ${payload.channel}` : ''}`;
    case 'reminder_triggered':
      return 'Rappel automatique déclenché';
    default:
      return eventType;
  }
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    'to_assign': 'À affecter',
    'todo': 'À faire',
    'in-progress': 'En cours',
    'done': 'Terminé',
    'pending_validation_1': 'Validation N1',
    'pending_validation_2': 'Validation N2',
    'validated': 'Validé',
    'refused': 'Refusé',
    'review': 'À corriger',
  };
  return labels[status] || status;
}
