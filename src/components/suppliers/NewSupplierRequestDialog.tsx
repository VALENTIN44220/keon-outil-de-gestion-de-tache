import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Paperclip, Sparkles, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useSupplierFamillesAll } from '@/hooks/useSupplierCategorisation';
import {
  CONTACT_ROLE_OPTIONS,
  isAllowedDemandAttachmentFile,
  SUPPLIER_DEMAND_FILE_ACCEPT,
  SUPPLIER_DEMAND_PAYS,
  SUPPLIER_DELAIS_PAIEMENT,
} from '@/lib/newSupplierDemandConstants';

export interface NewSupplierRequestDialogProps {
  open: boolean;
  onClose: () => void;
}

function normalizeSiret(raw: string) {
  return raw.replace(/\s/g, '');
}

function isEmailLoose(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function NewSupplierRequestDialog({ open, onClose }: NewSupplierRequestDialogProps) {
  const queryClient = useQueryClient();
  const { data: familles = [], isLoading: famillesLoading } = useSupplierFamillesAll();
  const [tabsKey, setTabsKey] = useState(0);
  useEffect(() => {
    if (open) setTabsKey((k) => k + 1);
  }, [open]);

  const [entite, setEntite] = useState('');
  const [nomSociete, setNomSociete] = useState('');
  const [raison, setRaison] = useState('');
  const [famille, setFamille] = useState('');
  const [description, setDescription] = useState('');
  const [pays, setPays] = useState('');
  const [delaiPaiement, setDelaiPaiement] = useState('');
  const [caEstime, setCaEstime] = useState('');
  const [siret, setSiret] = useState('');
  const [tva, setTva] = useState('');

  const [nomContact, setNomContact] = useState('');
  const [emailContact, setEmailContact] = useState('');
  const [telContact, setTelContact] = useState('');
  const [roleContact, setRoleContact] = useState('');

  const [ribFile, setRibFile] = useState<File | null>(null);
  const [kbisFile, setKbisFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setEntite('');
    setNomSociete('');
    setRaison('');
    setFamille('');
    setDescription('');
    setPays('');
    setDelaiPaiement('');
    setCaEstime('');
    setSiret('');
    setTva('');
    setNomContact('');
    setEmailContact('');
    setTelContact('');
    setRoleContact('');
    setRibFile(null);
    setKbisFile(null);
  };

  const validate = (): string | null => {
    if (!entite.trim()) return 'L’entité concernée est obligatoire.';
    if (!nomSociete.trim()) return 'Le nom du fournisseur est obligatoire.';
    if (!raison.trim()) return 'La raison de la création est obligatoire.';
    if (!famille.trim()) return 'La famille fournisseur est obligatoire.';
    if (!description.trim()) return 'La description du bien / service est obligatoire.';
    if (!pays.trim()) return 'Le pays est obligatoire.';
    if (!delaiPaiement.trim()) return 'Le délai de paiement est obligatoire.';
    const ca = Number(String(caEstime).replace(',', '.').trim());
    if (!Number.isFinite(ca) || ca < 0) return 'Le montant CA annuel estimé doit être un nombre valide.';
    const s = normalizeSiret(siret);
    if (s.length !== 14 || !/^\d{14}$/.test(s)) return 'Le N° SIRET doit comporter 14 chiffres.';
    if (!tva.trim()) return 'Le N° TVA intracommunautaire est obligatoire.';
    if (emailContact.trim() && !isEmailLoose(emailContact.trim())) return 'L’email du contact n’est pas valide.';
    if (!ribFile) return 'Le RIB du fournisseur est obligatoire.';
    if (!kbisFile) return 'Le justificatif SIRET / Kbis est obligatoire.';
    return null;
  };

  const uploadWaitingFile = async (waitingId: string, file: File, kind: 'rib' | 'justificatif_siret') => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Non connecté');
    const ext = file.name.split('.').pop() ?? 'bin';
    const storagePath = `${waitingId}/${kind}.${ext}`;
    const { error: upErr } = await supabase.storage.from('supplier-waiting-attachments').upload(storagePath, file);
    if (upErr) throw upErr;
    const { data: signed } = await supabase.storage.from('supplier-waiting-attachments').createSignedUrl(storagePath, 60 * 60 * 24 * 365);
    const fileUrl = signed?.signedUrl ?? '';
    const { error: insErr } = await supabase.from('supplier_waiting_approval_attachments').insert({
      waiting_approval_id: waitingId,
      attachment_kind: kind,
      file_name: file.name,
      file_url: fileUrl,
      storage_path: storagePath,
      uploaded_by: userData.user.id,
    });
    if (insErr) throw insErr;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      toast({ title: 'Formulaire incomplet', description: err, variant: 'destructive' });
      return;
    }
    if (ribFile && !isAllowedDemandAttachmentFile(ribFile)) {
      toast({ title: 'RIB', description: 'Format de fichier non autorisé.', variant: 'destructive' });
      return;
    }
    if (kbisFile && !isAllowedDemandAttachmentFile(kbisFile)) {
      toast({ title: 'Justificatif SIRET', description: 'Format de fichier non autorisé.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    const lineIndex = crypto.randomUUID();
    const ca = Number(String(caEstime).replace(',', '.').trim());
    const siretNorm = normalizeSiret(siret);

    const row = {
      line_index: lineIndex,
      tiers: null as string | null,
      entite: entite.trim(),
      nomfournisseur: nomSociete.trim(),
      commentaires: raison.trim(),
      famille: famille.trim(),
      description: description.trim(),
      pays: pays.trim(),
      delai_de_paiement: delaiPaiement.trim(),
      ca_estime: ca,
      siret: siretNorm,
      tva: tva.trim(),
      nom_contact: nomContact.trim() || null,
      adresse_mail: emailContact.trim() || null,
      telephone: telContact.trim() || null,
      poste: roleContact.trim() || null,
      status: 'a_completer',
      completeness_score: 0,
    };

    try {
      const { data: inserted, error: insErr } = await supabase
        .from('supplier_waiting_approval')
        .insert(row)
        .select('id')
        .single();
      if (insErr) throw insErr;
      const waitingId = inserted?.id as string;
      if (!waitingId) throw new Error('Insertion sans identifiant');

      try {
        if (ribFile) await uploadWaitingFile(waitingId, ribFile, 'rib');
        if (kbisFile) await uploadWaitingFile(waitingId, kbisFile, 'justificatif_siret');
      } catch (uploadErr) {
        const { data: atts } = await supabase
          .from('supplier_waiting_approval_attachments')
          .select('storage_path')
          .eq('waiting_approval_id', waitingId);
        const paths = (atts ?? []).map((a) => a.storage_path).filter(Boolean);
        if (paths.length > 0) {
          await supabase.storage.from('supplier-waiting-attachments').remove(paths);
        }
        await supabase.from('supplier_waiting_approval').delete().eq('id', waitingId);
        throw uploadErr;
      }

      await queryClient.invalidateQueries({ queryKey: ['supplier-waiting-approval'] });
      toast({ title: 'Demande enregistrée', description: 'La demande a été ajoutée à la file d’attente.' });
      resetForm();
      onClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Échec de l’enregistrement';
      toast({ title: 'Erreur', description: message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const familleOptions = familles.map((f) => ({ value: f, label: f }));

  const handleFamilleChange = useCallback(
    (next: string) => {
      setFamille(next);
      const trimmed = next.trim();
      if (!trimmed) return;
      if (familles.some((f) => f.toLowerCase() === trimmed.toLowerCase())) return;

      void (async () => {
        const { error } = await supabase.rpc('register_supplier_famille_from_demand', {
          p_famille: trimmed,
        });
        if (error) {
          toast({
            title: 'Enregistrement de la famille',
            description: error.message,
            variant: 'destructive',
          });
          return;
        }
        await queryClient.invalidateQueries({ queryKey: ['categories_ref', 'familles_all'] });
      })();
    },
    [familles, queryClient]
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !submitting && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-violet-600 shrink-0" />
            Demande de nouveau fournisseur
          </DialogTitle>
          <DialogDescription className="text-left">
            Les informations sont enregistrées lorsque vous soumettez la demande ; joignez les pièces obligatoires dans
            l’onglet prévu à cet effet.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2 pt-4 min-h-0 flex-1 overflow-y-auto">
          <Tabs key={tabsKey} defaultValue="informations" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto gap-1 p-1">
              <TabsTrigger value="informations" className="flex items-center gap-2 py-2.5 text-xs sm:text-sm">
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="leading-tight text-left">Informations Fournisseur</span>
              </TabsTrigger>
              <TabsTrigger value="contact" className="flex items-center gap-2 py-2.5 text-xs sm:text-sm">
                <User className="h-4 w-4 shrink-0" />
                <span className="leading-tight text-left">Contact Fournisseur</span>
              </TabsTrigger>
              <TabsTrigger value="pieces" className="flex items-center gap-2 py-2.5 text-xs sm:text-sm">
                <Paperclip className="h-4 w-4 shrink-0" />
                <span className="leading-tight text-left">Pièces jointes obligatoires</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="informations" className="mt-4 space-y-4">
              <section className="rounded-xl border border-border bg-muted/30 p-4 space-y-4" aria-label="Informations fournisseur">
                <div className="space-y-2">
                  <Label>Entité concernée par la demande de création *</Label>
                  <Input value={entite} onChange={(e) => setEntite(e.target.value)} placeholder="Ex. NASKEO…" />
                </div>
                <div className="space-y-2">
                  <Label>Entité sociale / Nom du fournisseur *</Label>
                  <Input value={nomSociete} onChange={(e) => setNomSociete(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Raison de la création *</Label>
                  <Textarea value={raison} onChange={(e) => setRaison(e.target.value)} rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Famille de fournisseur *</Label>
                  <SearchableSelect
                    value={famille}
                    onValueChange={handleFamilleChange}
                    options={familleOptions}
                    placeholder={famillesLoading ? 'Chargement…' : 'Sélectionner une famille…'}
                    disabled={famillesLoading}
                    searchPlaceholder="Rechercher une famille…"
                    allowCustom
                    customPlaceholder="Saisir une famille…"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description du bien / service *</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Pays *</Label>
                  <SearchableSelect
                    value={pays}
                    onValueChange={setPays}
                    options={SUPPLIER_DEMAND_PAYS}
                    placeholder="Sélectionner…"
                    searchPlaceholder="Rechercher un pays…"
                    allowCustom
                    customPlaceholder="Autre pays…"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Délais de paiement *</Label>
                  <SearchableSelect
                    value={delaiPaiement}
                    onValueChange={setDelaiPaiement}
                    options={SUPPLIER_DELAIS_PAIEMENT.map((d) => ({ value: d, label: d }))}
                    placeholder="Sélectionner…"
                    allowCustom
                    customPlaceholder="Préciser…"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Montant estimé CA annuel (€) *</Label>
                  <Input
                    inputMode="decimal"
                    value={caEstime}
                    onChange={(e) => setCaEstime(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>N° SIRET *</Label>
                  <Input value={siret} onChange={(e) => setSiret(e.target.value)} placeholder="14 chiffres" className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>N° TVA intracommunautaire *</Label>
                  <Input value={tva} onChange={(e) => setTva(e.target.value)} className="font-mono" />
                </div>
              </section>
            </TabsContent>

            <TabsContent value="contact" className="mt-4">
              <section className="rounded-xl border border-border bg-muted/30 p-4 space-y-4" aria-label="Contact fournisseur">
                <div className="space-y-2">
                  <Label>Nom du contact</Label>
                  <Input value={nomContact} onChange={(e) => setNomContact(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email du contact</Label>
                  <Input type="email" value={emailContact} onChange={(e) => setEmailContact(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone du contact</Label>
                  <Input type="tel" value={telContact} onChange={(e) => setTelContact(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Rôle du contact</Label>
                  <SearchableSelect
                    value={roleContact}
                    onValueChange={setRoleContact}
                    options={CONTACT_ROLE_OPTIONS.map((r) => ({ value: r, label: r }))}
                    placeholder="Facultatif"
                    allowCustom
                    customPlaceholder="Préciser le rôle…"
                  />
                </div>
              </section>
            </TabsContent>

            <TabsContent value="pieces" className="mt-4">
              <section className="rounded-xl border border-border bg-muted/30 p-4 space-y-6" aria-label="Pièces jointes obligatoires">
                <div className="space-y-2">
                  <Label>RIB du fournisseur *</Label>
                  <p className="text-xs text-muted-foreground">Image, PDF, CSV, XLS, XLSX ou ODS.</p>
                  <Input
                    type="file"
                    accept={SUPPLIER_DEMAND_FILE_ACCEPT}
                    onChange={(e) => setRibFile(e.target.files?.[0] ?? null)}
                  />
                  {ribFile ? <p className="text-sm text-muted-foreground truncate">{ribFile.name}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label>Justificatif SIRET / Kbis *</Label>
                  <p className="text-xs text-muted-foreground">Image, PDF, CSV, XLS, XLSX ou ODS.</p>
                  <Input
                    type="file"
                    accept={SUPPLIER_DEMAND_FILE_ACCEPT}
                    onChange={(e) => setKbisFile(e.target.files?.[0] ?? null)}
                  />
                  {kbisFile ? <p className="text-sm text-muted-foreground truncate">{kbisFile.name}</p> : null}
                </div>
              </section>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border shrink-0 gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button type="button" className="bg-violet-600 hover:bg-violet-700" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Envoi…
              </>
            ) : (
              'Soumettre la demande de fournisseur'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
