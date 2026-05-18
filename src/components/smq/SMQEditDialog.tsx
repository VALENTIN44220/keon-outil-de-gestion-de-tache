/**
 * SMQEditDialog — Édition complète des champs d'une NC.
 *
 * Ouvrable par :
 *  - le rédacteur (déclarant) tant que la NC n'est pas cloturée
 *  - le pilote désigné (à tout moment)
 *  - les admins / responsables SMQ (can_manage_smq) (à tout moment)
 *
 * Tous les champs métier sont éditables (sauf nc_number, créateur, dates auto).
 */
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  NC_PROCESSUS, NC_METIERS, NC_SOCIETES,
  NC_IDENTIFICATION_LABELS, NC_APPARITION_LABELS,
  type NCDeclaration, type NCIdentification, type NCApparition,
} from '@/types/smqNC';

interface Props {
  nc: NCDeclaration;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function SMQEditDialog({ nc, open, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    title: nc.title,
    description_problem: nc.description_problem ?? '',
    date_constat: nc.date_constat,
    date_cloture_souhaitee: nc.date_cloture_souhaitee ?? '',
    processus_code: nc.processus_code ?? '',
    metier_code: nc.metier_code ?? '',
    societe_code: nc.societe_code ?? '',
    identification: (nc.identification ?? '') as NCIdentification | '',
    apparition_ailleurs: (nc.apparition_ailleurs ?? '') as NCApparition | '',
    fournisseur_nom: nc.fournisseur_nom ?? '',
    code_projet: nc.code_projet ?? '',
    causes_racines: nc.causes_racines ?? '',
    actions_correctives: nc.actions_correctives ?? '',
    actions_preventives: nc.actions_preventives ?? '',
    pilote_id: nc.pilote_id ?? '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; display_name: string | null; department: string | null }>>([]);

  // Recharge les valeurs si la NC change
  useEffect(() => {
    setForm({
      title: nc.title,
      description_problem: nc.description_problem ?? '',
      date_constat: nc.date_constat,
      date_cloture_souhaitee: nc.date_cloture_souhaitee ?? '',
      processus_code: nc.processus_code ?? '',
      metier_code: nc.metier_code ?? '',
      societe_code: nc.societe_code ?? '',
      identification: (nc.identification ?? '') as NCIdentification | '',
      apparition_ailleurs: (nc.apparition_ailleurs ?? '') as NCApparition | '',
      fournisseur_nom: nc.fournisseur_nom ?? '',
      code_projet: nc.code_projet ?? '',
      causes_racines: nc.causes_racines ?? '',
      actions_correctives: nc.actions_correctives ?? '',
      actions_preventives: nc.actions_preventives ?? '',
      pilote_id: nc.pilote_id ?? '',
    });
  }, [nc.id]);

  useEffect(() => {
    if (!open) return;
    void supabase
      .from('profiles')
      .select('id, display_name, department:departments(name)')
      .order('display_name')
      .then(({ data }) => {
        if (data) setUsers(data.map((u: any) => ({
          id: u.id,
          display_name: u.display_name,
          department: u.department?.name ?? null,
        })));
      });
  }, [open]);

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Le titre est obligatoire');
      return;
    }
    setIsSaving(true);
    const { error } = await supabase
      .from('nc_declarations')
      .update({
        title: form.title.trim(),
        description_problem: form.description_problem || null,
        date_constat: form.date_constat,
        date_cloture_souhaitee: form.date_cloture_souhaitee || null,
        processus_code: form.processus_code || null,
        metier_code: form.metier_code || null,
        societe_code: form.societe_code || null,
        identification: form.identification || null,
        apparition_ailleurs: form.apparition_ailleurs || null,
        fournisseur_nom: form.fournisseur_nom || null,
        code_projet: form.code_projet || null,
        causes_racines: form.causes_racines || null,
        actions_correctives: form.actions_correctives || null,
        actions_preventives: form.actions_preventives || null,
        pilote_id: form.pilote_id || null,
      })
      .eq('id', nc.id);
    setIsSaving(false);
    if (error) {
      toast.error(`Erreur : ${error.message}`);
      return;
    }
    toast.success('NC mise à jour');
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Modifier {nc.nc_number}</DialogTitle>
          <DialogDescription>
            Tous les champs de la NC peuvent être édités. Les changements sont
            tracés dans l'historique.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">

          {/* Identité */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground">Identité</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Date du constat *</Label>
                <Input type="date" value={form.date_constat}
                  onChange={(e) => setForm({ ...form, date_constat: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date de clôture souhaitée</Label>
                <Input type="date" value={form.date_cloture_souhaitee}
                  onChange={(e) => setForm({ ...form, date_cloture_souhaitee: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type d'identification</Label>
              <Select value={form.identification} onValueChange={(v) => setForm({ ...form, identification: v as NCIdentification })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(NC_IDENTIFICATION_LABELS) as [NCIdentification, string][]).map(([k, lbl]) => (
                    <SelectItem key={k} value={k}>{lbl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Société</Label>
                <Select value={form.societe_code} onValueChange={(v) => setForm({ ...form, societe_code: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{NC_SOCIETES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Métier</Label>
                <Select value={form.metier_code} onValueChange={(v) => setForm({ ...form, metier_code: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent className="max-h-72">{NC_METIERS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Processus</Label>
              <Select value={form.processus_code} onValueChange={(v) => setForm({ ...form, processus_code: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {NC_PROCESSUS.map(p => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Code projet / année si audit</Label>
                <Input value={form.code_projet}
                  onChange={(e) => setForm({ ...form, code_projet: e.target.value })}
                  maxLength={10} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fournisseur (si NC fournisseur)</Label>
                <Input value={form.fournisseur_nom}
                  onChange={(e) => setForm({ ...form, fournisseur_nom: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pilote</Label>
              <SearchableSelect
                value={form.pilote_id}
                onValueChange={(v) => setForm({ ...form, pilote_id: v })}
                placeholder="Aucun pilote"
                searchPlaceholder="Rechercher…"
                options={[
                  { value: '', label: '— Aucun pilote —' },
                  ...users.map(u => ({
                    value: u.id,
                    label: `${u.display_name ?? 'Sans nom'}${u.department ? ` · ${u.department}` : ''}`,
                  })),
                ]}
              />
            </div>
          </div>

          {/* Problème */}
          <div className="space-y-3 pt-2 border-t">
            <h4 className="text-sm font-semibold text-muted-foreground">Description du problème</h4>
            <div className="space-y-1.5">
              <Label className="text-xs">Intitulé *</Label>
              <Input value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={300} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description_problem}
                onChange={(e) => setForm({ ...form, description_problem: e.target.value })} rows={4} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Apparition possible ailleurs</Label>
              <Select value={form.apparition_ailleurs} onValueChange={(v) => setForm({ ...form, apparition_ailleurs: v as NCApparition })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(NC_APPARITION_LABELS) as [NCApparition, string][]).map(([k, lbl]) => (
                    <SelectItem key={k} value={k}>{lbl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Analyse */}
          <div className="space-y-3 pt-2 border-t">
            <h4 className="text-sm font-semibold text-muted-foreground">Analyse</h4>
            <div className="space-y-1.5">
              <Label className="text-xs">Causes racines</Label>
              <Textarea value={form.causes_racines}
                onChange={(e) => setForm({ ...form, causes_racines: e.target.value })} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Actions correctives</Label>
              <Textarea value={form.actions_correctives}
                onChange={(e) => setForm({ ...form, actions_correctives: e.target.value })} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Actions préventives</Label>
              <Textarea value={form.actions_preventives}
                onChange={(e) => setForm({ ...form, actions_preventives: e.target.value })} rows={3} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
