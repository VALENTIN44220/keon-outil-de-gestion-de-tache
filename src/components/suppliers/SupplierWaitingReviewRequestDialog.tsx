import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquarePlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ReviewField {
  key: string;
  label: string;
  section: string;
}

const REVIEW_FIELDS: ReviewField[] = [
  // Identification
  { key: 'nomfournisseur',  label: 'Nom du fournisseur',                section: 'Identification' },
  { key: 'entite',          label: 'Entité concernée',                  section: 'Identification' },
  { key: 'famille',         label: 'Famille fournisseur',               section: 'Identification' },
  { key: 'pays',            label: 'Pays',                              section: 'Identification' },
  { key: 'siret',           label: 'N° identification (SIRET…)',        section: 'Identification' },
  { key: 'tva',             label: 'N° TVA / identifiant fiscal',       section: 'Identification' },
  // Informations commerciales
  { key: 'commentaires',    label: 'Raison / description de la demande', section: 'Informations commerciales' },
  { key: 'description',     label: 'Description du bien / service',     section: 'Informations commerciales' },
  { key: 'delai_de_paiement', label: 'Délai de paiement',              section: 'Informations commerciales' },
  { key: 'ca_estime',       label: 'CA annuel estimé (€)',              section: 'Informations commerciales' },
  // Contact
  { key: 'nom_contact',     label: 'Nom du contact',                   section: 'Contact fournisseur' },
  { key: 'adresse_mail',    label: 'Email du contact',                 section: 'Contact fournisseur' },
  { key: 'telephone',       label: 'Téléphone',                        section: 'Contact fournisseur' },
  { key: 'poste',           label: 'Rôle / poste du contact',          section: 'Contact fournisseur' },
];

const SECTIONS = [...new Set(REVIEW_FIELDS.map((f) => f.section))];

interface Props {
  waitingId: string | null;
  supplierName: string | null;
  onClose: () => void;
  onSubmitted: () => void;
}

export function SupplierWaitingReviewRequestDialog({ waitingId, supplierName, onClose, onSubmitted }: Props) {
  const [comments, setComments] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const open = !!waitingId;

  const filledCount = Object.values(comments).filter((v) => v.trim()).length;

  const handleSubmit = async () => {
    if (!waitingId || filledCount === 0) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Supprimer les revues non résolues précédentes pour repartir propre
      await supabase
        .from('supplier_waiting_field_reviews')
        .delete()
        .eq('waiting_id', waitingId)
        .is('resolved_at', null);

      // Insérer les nouvelles revues par champ
      const reviews = Object.entries(comments)
        .filter(([, v]) => v.trim())
        .map(([field_key, comment]) => ({
          waiting_id: waitingId,
          field_key,
          comment: comment.trim(),
          created_by: user?.id ?? null,
        }));

      const { error: revErr } = await supabase.from('supplier_waiting_field_reviews').insert(reviews);
      if (revErr) throw revErr;

      // Mettre à jour le statut
      const { error: updErr } = await supabase
        .from('supplier_waiting_approval')
        .update({ status: 'modifications_demandees' })
        .eq('id', waitingId);
      if (updErr) throw updErr;

      // Notifier le demandeur
      const { data: row } = await supabase
        .from('supplier_waiting_approval')
        .select('submitted_by_user_id')
        .eq('id', waitingId)
        .single();

      if (row?.submitted_by_user_id) {
        await supabase.from('notifications').insert({
          user_id: row.submitted_by_user_id,
          title: 'Modifications demandées sur votre demande fournisseur',
          message: `Des modifications sont requises sur votre demande « ${supplierName ?? 'fournisseur'} » (${filledCount} champ${filledCount > 1 ? 's' : ''}). Ouvrez la demande pour voir les commentaires.`,
          type: 'supplier_review_requested',
          related_entity_type: 'supplier_waiting_approval',
          related_entity_id: waitingId,
        });
      }

      toast({
        title: 'Modifications demandées',
        description: `${filledCount} commentaire${filledCount > 1 ? 's' : ''} envoyé${filledCount > 1 ? 's' : ''} au demandeur.`,
      });
      setComments({});
      onSubmitted();
    } catch (e: unknown) {
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : 'Impossible d\'envoyer', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (o: boolean) => {
    if (!o && !submitting) { setComments({}); onClose(); }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquarePlus className="h-4 w-4 text-amber-600" />
            Demander des modifications
          </DialogTitle>
          <DialogDescription className="text-left">
            <span className="font-semibold text-foreground">{supplierName ?? 'Ce fournisseur'}</span>
            {' '}— Ajoutez un commentaire sur les champs à corriger. Seuls les champs commentés seront envoyés.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 px-6 py-4">
          <div className="space-y-6">
            {SECTIONS.map((section) => (
              <div key={section} className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">
                  {section}
                </h3>
                <div className="space-y-3">
                  {REVIEW_FIELDS.filter((f) => f.section === section).map((field) => (
                    <div key={field.key} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{field.label}</span>
                        {comments[field.key]?.trim() && (
                          <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-400/50 py-0">
                            commentaire ajouté
                          </Badge>
                        )}
                      </div>
                      <Textarea
                        value={comments[field.key] ?? ''}
                        onChange={(e) =>
                          setComments((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        placeholder={`Commentaire sur « ${field.label} »…`}
                        rows={2}
                        disabled={submitting}
                        className="resize-none text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t shrink-0 flex-row justify-between items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {filledCount > 0
              ? `${filledCount} champ${filledCount > 1 ? 's' : ''} commenté${filledCount > 1 ? 's' : ''}`
              : 'Aucun commentaire saisi'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button
              onClick={() => void handleSubmit()}
              disabled={submitting || filledCount === 0}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Envoyer les demandes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
