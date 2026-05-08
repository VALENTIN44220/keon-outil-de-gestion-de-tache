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
import { useSupplierWaitingApprovalDetail } from '@/hooks/useSupplierWaitingApproval';

interface ReviewField {
  key: string;
  label: string;
  section: string;
  multiline?: boolean;
}

const REVIEW_FIELDS: ReviewField[] = [
  // Identification
  { key: 'nomfournisseur',    label: 'Nom du fournisseur',                 section: 'Identification' },
  { key: 'entite',            label: 'Entité concernée',                   section: 'Identification' },
  { key: 'famille',           label: 'Famille fournisseur',                section: 'Identification' },
  { key: 'pays',              label: 'Pays',                               section: 'Identification' },
  { key: 'siret',             label: 'N° identification (SIRET…)',         section: 'Identification' },
  { key: 'tva',               label: 'N° TVA / identifiant fiscal',        section: 'Identification' },
  // Informations commerciales
  { key: 'commentaires',      label: 'Raison / description de la demande', section: 'Informations commerciales', multiline: true },
  { key: 'description',       label: 'Description du bien / service',      section: 'Informations commerciales', multiline: true },
  { key: 'delai_de_paiement', label: 'Délai de paiement',                 section: 'Informations commerciales' },
  { key: 'ca_estime',         label: 'CA annuel estimé (€)',               section: 'Informations commerciales' },
  // Contact
  { key: 'nom_contact',       label: 'Nom du contact',                    section: 'Contact fournisseur' },
  { key: 'adresse_mail',      label: 'Email du contact',                  section: 'Contact fournisseur' },
  { key: 'telephone',         label: 'Téléphone',                         section: 'Contact fournisseur' },
  { key: 'poste',             label: 'Rôle / poste du contact',           section: 'Contact fournisseur' },
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

  const { data: supplierData, isLoading: loadingData } = useSupplierWaitingApprovalDetail(waitingId);

  const filledCount = Object.values(comments).filter((v) => v.trim()).length;

  const handleSubmit = async () => {
    if (!waitingId || filledCount === 0) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Supprimer les revues non résolues précédentes
      await supabase
        .from('supplier_waiting_field_reviews')
        .delete()
        .eq('waiting_id', waitingId)
        .is('resolved_at', null);

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

      const { error: updErr } = await supabase
        .from('supplier_waiting_approval')
        .update({ status: 'modifications_demandees' })
        .eq('id', waitingId);
      if (updErr) throw updErr;

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
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : "Impossible d'envoyer", variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (o: boolean) => {
    if (!o && !submitting) { setComments({}); onClose(); }
  };

  const getFieldValue = (key: string): string => {
    if (!supplierData) return '';
    const v = (supplierData as Record<string, unknown>)[key];
    if (v == null || v === '') return '';
    return String(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[92vw] sm:max-w-5xl max-h-[90vh] h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquarePlus className="h-4 w-4 text-amber-600" />
            Demander des modifications —{' '}
            <span className="font-semibold truncate">{supplierName ?? 'ce fournisseur'}</span>
          </DialogTitle>
          <DialogDescription className="text-left text-xs">
            Colonne gauche : valeurs actuelles. Colonne droite : votre commentaire (laissez vide pour ne pas signaler ce champ).
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          {loadingData ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="px-6 py-4 space-y-8">
              {SECTIONS.map((section) => (
                <div key={section}>
                  {/* En-tête de section sur toute la largeur */}
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1.5 mb-3">
                    {section}
                  </h3>

                  {/* Grille 2 colonnes : valeur | commentaire */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {/* En-têtes colonnes */}
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      Valeur actuelle
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      Commentaire (optionnel)
                    </div>

                    {REVIEW_FIELDS.filter((f) => f.section === section).map((field) => {
                      const currentVal = getFieldValue(field.key);
                      const hasComment = !!comments[field.key]?.trim();
                      return (
                        <>
                          {/* Colonne gauche : label + valeur */}
                          <div key={`val-${field.key}`} className="space-y-0.5 self-start pt-1">
                            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                              {field.label}
                              {hasComment && (
                                <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-400/50 py-0 px-1.5">
                                  à corriger
                                </Badge>
                              )}
                            </p>
                            <p className={`text-sm break-words ${currentVal ? '' : 'text-muted-foreground italic'}`}>
                              {currentVal || 'Non renseigné'}
                            </p>
                          </div>

                          {/* Colonne droite : textarea */}
                          <div key={`comment-${field.key}`} className="self-start">
                            <Textarea
                              value={comments[field.key] ?? ''}
                              onChange={(e) =>
                                setComments((prev) => ({ ...prev, [field.key]: e.target.value }))
                              }
                              placeholder={`Commentaire sur ce champ…`}
                              rows={field.multiline ? 3 : 2}
                              disabled={submitting}
                              className={`resize-none text-sm ${hasComment ? 'border-amber-400/70 focus-visible:ring-amber-400/50' : ''}`}
                            />
                          </div>
                        </>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
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
