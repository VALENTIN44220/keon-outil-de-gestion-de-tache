/**
 * LogistiquePlanificationDialog — petit modal pour saisir
 * la date de prise en charge + la date de livraison prevue,
 * puis passer la demande en statut "planifiee".
 *
 * La notification au demandeur est emise automatiquement par le
 * trigger handle_task_status_change (BEFORE UPDATE OF status).
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Calendar } from 'lucide-react';

interface Props {
  taskId: string;
  open: boolean;
  onClose: () => void;
  onPlanned: () => void;
  /** Pre-remplit la date de prise en charge avec aujourd'hui */
  defaultPriseEnCharge?: string;
}

export function LogistiquePlanificationDialog({ taskId, open, onClose, onPlanned, defaultPriseEnCharge }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [datePriseEnCharge, setDatePriseEnCharge] = useState(defaultPriseEnCharge ?? today);
  const [dateLivraisonPrevue, setDateLivraisonPrevue] = useState('');
  const [transporteur, setTransporteur] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!datePriseEnCharge || !dateLivraisonPrevue) {
      toast.error('Renseigne les deux dates');
      return;
    }
    setBusy(true);
    try {
      const { data: row } = await supabase.from('tasks').select('module_data').eq('id', taskId).maybeSingle();
      const current = (row as any)?.module_data ?? {};
      const merged = {
        ...current,
        date_prise_en_charge: datePriseEnCharge,
        date_livraison_prevue: dateLivraisonPrevue,
        ...(transporteur.trim() ? { transporteur: transporteur.trim() } : {}),
      };
      const { error } = await supabase.from('tasks')
        .update({ status: 'planifiee', module_data: merged })
        .eq('id', taskId);
      if (error) throw error;
      toast.success('Demande planifiée — le demandeur est notifié');
      onPlanned();
      onClose();
    } catch (e: any) {
      toast.error(`Erreur : ${e.message ?? 'inconnue'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Planifier le transport
          </DialogTitle>
          <DialogDescription>
            Renseigne les dates clés. Le demandeur sera notifié automatiquement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="dpec">Date de prise en charge *</Label>
            <Input
              id="dpec" type="date" value={datePriseEnCharge}
              onChange={(e) => setDatePriseEnCharge(e.target.value)} disabled={busy}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dlp">Date de livraison prévue *</Label>
            <Input
              id="dlp" type="date" value={dateLivraisonPrevue}
              onChange={(e) => setDateLivraisonPrevue(e.target.value)} disabled={busy}
              min={datePriseEnCharge}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tr">Transporteur (optionnel)</Label>
            <Input
              id="tr" placeholder="Ex : Geodis, DPD..." value={transporteur}
              onChange={(e) => setTransporteur(e.target.value)} disabled={busy}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Annuler</Button>
          <Button onClick={submit} disabled={busy || !datePriseEnCharge || !dateLivraisonPrevue}>
            Planifier & notifier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
