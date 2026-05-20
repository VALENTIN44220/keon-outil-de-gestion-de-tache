/**
 * LogistiqueQuotationDialog — Modal de chiffrage d'une demande de devis.
 *
 * Utilisation : le logisticien saisit le prix proposé, la durée de validité
 * et un commentaire. À la validation, on met à jour la demande :
 *   - module_data.quotation_price (€)
 *   - module_data.quotation_valid_until (date)
 *   - module_data.quotation_comment
 *   - module_data.quotation_proposed_at (now)
 *   - status → 'affectee' (le demandeur doit décider)
 *
 * Le demandeur voit ensuite 2 boutons sur le détail : « Valider et lancer
 * le transport » (→ mode=transport) ou « Refuser le devis » (→ abandonnee).
 */
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tag } from 'lucide-react';

interface Props {
  taskId: string;
  open: boolean;
  onClose: () => void;
  onProposed: () => void;
}

export function LogistiqueQuotationDialog({ taskId, open, onClose, onProposed }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const defaultValidUntil = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const [price, setPrice] = useState<string>('');
  const [validUntil, setValidUntil] = useState<string>(defaultValidUntil);
  const [comment, setComment] = useState<string>('');
  const [transporteur, setTransporteur] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const priceNum = Number(price.replace(',', '.'));
    if (!priceNum || priceNum <= 0) {
      toast.error('Saisis un prix valide');
      return;
    }
    setBusy(true);
    try {
      const { data: row } = await supabase
        .from('tasks').select('module_data').eq('id', taskId).maybeSingle();
      const current = (row as any)?.module_data ?? {};
      const merged = {
        ...current,
        quotation_price: priceNum,
        quotation_valid_until: validUntil || null,
        quotation_comment: comment.trim() || null,
        quotation_proposed_at: new Date().toISOString(),
        ...(transporteur.trim() ? { transporteur: transporteur.trim() } : {}),
      };
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'devis_a_valider', module_data: merged })
        .eq('id', taskId);
      if (error) throw error;
      toast.success('Devis proposé — le demandeur va recevoir une notification');
      onProposed();
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
            <Tag className="h-5 w-5 text-sky-600" /> Chiffrer le devis
          </DialogTitle>
          <DialogDescription>
            Saisis le prix proposé et la durée de validité. Le demandeur recevra
            une notification pour valider ou refuser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="qp">Prix (€) *</Label>
              <Input
                id="qp" type="number" min={0} step="0.01" value={price}
                onChange={(e) => setPrice(e.target.value)} disabled={busy}
                placeholder="Ex: 450.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qv">Validité jusqu'au</Label>
              <Input
                id="qv" type="date" value={validUntil} min={today}
                onChange={(e) => setValidUntil(e.target.value)} disabled={busy}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="tr">Transporteur prévu</Label>
            <Input
              id="tr" placeholder="Ex : Geodis, DPD..." value={transporteur}
              onChange={(e) => setTransporteur(e.target.value)} disabled={busy}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="qc">Commentaire (optionnel)</Label>
            <Textarea
              id="qc" rows={3} value={comment}
              onChange={(e) => setComment(e.target.value)} disabled={busy}
              placeholder="Détails de la prestation, conditions, exclusions…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Annuler</Button>
          <Button onClick={submit} disabled={busy || !price}>
            Proposer le devis
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
