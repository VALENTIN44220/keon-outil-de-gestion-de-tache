import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { IT_PROJECT_PHASES } from '@/types/itProject';
import type { ITProjectMilestone, MilestoneStatus } from '@/types/itProject';

const NONE_PHASE = '__none__';

const MILESTONE_STATUSES: { value: MilestoneStatus; label: string }[] = [
  { value: 'a_venir', label: 'À venir' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'termine', label: 'Terminé' },
  { value: 'retarde', label: 'Retardé' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  milestone?: ITProjectMilestone | null;
  nextOrdre: number;
  onSave: (data: any) => Promise<void>;
}

export function ITMilestoneDialog({ open, onOpenChange, projectId, milestone, nextOrdre, onSave }: Props) {
  const isEdit = !!milestone;

  const [titre, setTitre] = useState(milestone?.titre || '');
  const [phase, setPhase] = useState<string>(milestone?.phase || NONE_PHASE);
  const [datePrevue, setDatePrevue] = useState<Date | undefined>(
    milestone?.date_prevue ? new Date(milestone.date_prevue) : undefined
  );
  const [statut, setStatut] = useState<MilestoneStatus>(milestone?.statut || 'a_venir');
  const [description, setDescription] = useState(milestone?.description || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!titre.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...(isEdit ? {} : { it_project_id: projectId, ordre: nextOrdre }),
        titre: titre.trim(),
        phase: phase === NONE_PHASE ? null : phase,
        date_prevue: datePrevue ? format(datePrevue, 'yyyy-MM-dd') : null,
        statut,
        description: description.trim() || null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le jalon' : 'Ajouter un jalon'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Modifiez les informations du jalon.' : 'Définissez les informations du nouveau jalon.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Titre *</Label>
            <Input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Ex: Cadrage validé" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phase</Label>
              <Select value={phase} onValueChange={setPhase}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_PHASE}>— Aucune —</SelectItem>
                  {IT_PROJECT_PHASES.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Statut</Label>
              <Select value={statut} onValueChange={v => setStatut(v as MilestoneStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MILESTONE_STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Date prévue</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !datePrevue && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {datePrevue ? format(datePrevue, 'dd MMMM yyyy', { locale: fr }) : 'Sélectionner...'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={datePrevue} onSelect={setDatePrevue} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optionnel..." rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={!titre.trim() || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEdit ? 'Enregistrer' : 'Créer le jalon'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
