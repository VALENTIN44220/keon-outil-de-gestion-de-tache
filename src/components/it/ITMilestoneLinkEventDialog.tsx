import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarClock, Loader2, Link2, MapPin, Search, CheckCircle2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useOutlookCalendar } from '@/hooks/useOutlookCalendar';
import type { ITProjectMilestone, ITMilestoneCalendarLink } from '@/types/itProject';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestone: ITProjectMilestone;
  existingLinks: ITMilestoneCalendarLink[];
  onLink: (snapshot: {
    outlook_event_id: string;
    subject: string;
    start_time: string;
    end_time: string;
    location?: string | null;
    organizer_email?: string | null;
  }) => Promise<void>;
}

const WINDOW_OPTIONS: { value: string; label: string; days: number }[] = [
  { value: '15',  label: '± 15 jours',  days: 15 },
  { value: '30',  label: '± 30 jours',  days: 30 },
  { value: '90',  label: '± 3 mois',    days: 90 },
  { value: '180', label: '± 6 mois',    days: 180 },
  { value: '365', label: '± 1 an',      days: 365 },
];

export function ITMilestoneLinkEventDialog({ open, onOpenChange, milestone, existingLinks, onLink }: Props) {
  const [search, setSearch] = useState('');
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<string>('30');

  // Fenêtre temporelle autour de la date prévue (ou « à partir d'aujourd'hui » si pas de date)
  const { startDate, endDate } = useMemo(() => {
    const days = parseInt(windowDays, 10) || 30;
    if (milestone.date_prevue) {
      const center = new Date(milestone.date_prevue);
      return {
        startDate: addDays(center, -days),
        endDate: addDays(center, days),
      };
    }
    const now = new Date();
    return { startDate: addDays(now, -days), endDate: addDays(now, days * 2) };
  }, [milestone.date_prevue, windowDays]);

  const { events, isLoading } = useOutlookCalendar(startDate, endDate);

  const linkedIds = useMemo(
    () => new Set(existingLinks.map(l => l.outlook_event_id)),
    [existingLinks],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter(e =>
      e.subject.toLowerCase().includes(q) ||
      (e.location || '').toLowerCase().includes(q) ||
      (e.organizer_email || '').toLowerCase().includes(q),
    );
  }, [events, search]);

  const handleLink = async (event: typeof events[number]) => {
    setLinkingId(event.outlook_event_id);
    try {
      await onLink({
        outlook_event_id: event.outlook_event_id,
        subject: event.subject,
        start_time: event.start_time,
        end_time: event.end_time,
        location: event.location || null,
        organizer_email: event.organizer_email || null,
      });
    } finally {
      setLinkingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-violet-600" />
            Lier un évènement au jalon
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium">{milestone.titre}</span>
            {' — '}fenêtre {format(startDate, 'dd MMM yyyy', { locale: fr })} → {format(endDate, 'dd MMM yyyy', { locale: fr })}
            {' '}({events.length} évènement{events.length > 1 ? 's' : ''})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un évènement..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={windowDays} onValueChange={setWindowDays}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WINDOW_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="h-[360px] rounded-md border">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm gap-2 py-12">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement des évènements...
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-12 px-4">
                Aucun évènement Outlook dans cette fenêtre.
                <br />
                <span className="text-xs">Vérifie que la synchronisation Outlook est activée dans ton profil.</span>
              </div>
            ) : (
              <ul className="divide-y">
                {filtered.map((ev) => {
                  const linked = linkedIds.has(ev.outlook_event_id);
                  const isLinkingThis = linkingId === ev.outlook_event_id;
                  return (
                    <li key={ev.outlook_event_id} className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/40">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ev.subject}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[11px] text-muted-foreground">
                            {format(new Date(ev.start_time), "EEE dd MMM yyyy 'à' HH:mm", { locale: fr })}
                          </span>
                          {ev.location && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {ev.location}
                            </span>
                          )}
                        </div>
                      </div>
                      {linked ? (
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                          <CheckCircle2 className="h-3 w-3" /> Lié
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 h-7 text-xs"
                          disabled={isLinkingThis}
                          onClick={() => handleLink(ev)}
                        >
                          {isLinkingThis ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Link2 className="h-3 w-3" />
                          )}
                          Lier
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
