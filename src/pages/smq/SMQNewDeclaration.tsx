/**
 * SMQNewDeclaration — Formulaire de déclaration d'une nouvelle NC
 *
 * Reproduit le formulaire SharePoint actuel KEONGROUP, en plus structuré :
 * sections claires, validations, affectation auto au pilote du processus
 * (ou Alexandre Baffou si NC fournisseur).
 */
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageHeader } from '@/components/layout/PageHeader';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Save, Loader2, FileText, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateNC } from '@/hooks/useNCDeclarations';
import {
  NC_PROCESSUS, NC_METIERS, NC_SOCIETES,
  NC_IDENTIFICATION_LABELS, NC_APPARITION_LABELS,
  type NCIdentification, type NCApparition,
} from '@/types/smqNC';

export default function SMQNewDeclaration() {
  const navigate = useNavigate();
  const createNC = useCreateNC();
  const { effectivePermissions, isLoading: permLoading } = useEffectivePermissions();
  const [activeView, setActiveView] = useState('smq');
  const [isSaving, setIsSaving] = useState(false);

  if (!permLoading && !effectivePermissions.can_access_smq) {
    return <Navigate to="/" replace />;
  }

  const [form, setForm] = useState({
    title: '',
    description_problem: '',
    date_constat: new Date().toISOString().slice(0, 10),
    date_cloture_souhaitee: '',
    processus_code: '',
    metier_code: '',
    societe_code: '',
    identification: '' as NCIdentification | '',
    apparition_ailleurs: '' as NCApparition | '',
    fournisseur_nom: '',
    code_projet: '',
    causes_racines: '',
    actions_correctives: '',
    actions_preventives: '',
  });

  const isFournisseur = form.identification === 'nc_fournisseur';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Le titre est obligatoire');
      return;
    }
    if (!form.identification) {
      toast.error('Sélectionne l\'identification de la NC');
      return;
    }
    setIsSaving(true);
    try {
      const created = await createNC({
        ...form,
        identification: form.identification as NCIdentification,
        apparition_ailleurs: form.apparition_ailleurs ? (form.apparition_ailleurs as NCApparition) : null,
        date_cloture_souhaitee: form.date_cloture_souhaitee || null,
      });
      if (created) navigate(`/smq/${created.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader
          title={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => navigate('/smq')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span>Déclarer une Non-Conformité</span>
            </div>
          }
        />

        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl mx-auto">

            {/* ── Identification ──────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Identification de la NC</CardTitle>
                <CardDescription>Indique le contexte de la non-conformité</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Date du constat <span className="text-destructive">*</span></Label>
                    <Input type="date" value={form.date_constat}
                      onChange={(e) => setForm({ ...form, date_constat: e.target.value })}
                      max={new Date().toISOString().slice(0, 10)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date de clôture souhaitée</Label>
                    <Input type="date" value={form.date_cloture_souhaitee}
                      onChange={(e) => setForm({ ...form, date_cloture_souhaitee: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Type d'identification <span className="text-destructive">*</span></Label>
                  <Select value={form.identification} onValueChange={(v) => setForm({ ...form, identification: v as NCIdentification })}>
                    <SelectTrigger><SelectValue placeholder="Choisir le type…" /></SelectTrigger>
                    <SelectContent>
                      {(Object.entries(NC_IDENTIFICATION_LABELS) as [NCIdentification, string][]).map(([k, lbl]) => (
                        <SelectItem key={k} value={k}>{lbl}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Société</Label>
                    <Select value={form.societe_code} onValueChange={(v) => setForm({ ...form, societe_code: v })}>
                      <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                      <SelectContent>{NC_SOCIETES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Métier</Label>
                    <Select value={form.metier_code} onValueChange={(v) => setForm({ ...form, metier_code: v })}>
                      <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {NC_METIERS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Processus de référence</Label>
                  <Select value={form.processus_code} onValueChange={(v) => setForm({ ...form, processus_code: v })}>
                    <SelectTrigger><SelectValue placeholder="Choisir le processus…" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {NC_PROCESSUS.map(p => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Le pilote de ce processus sera automatiquement notifié et désigné comme pilote de la NC.
                  </p>
                </div>

                {isFournisseur && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-amber-50/40 border border-amber-200 rounded-lg">
                    <div className="space-y-1.5">
                      <Label>Nom du fournisseur</Label>
                      <Input value={form.fournisseur_nom}
                        onChange={(e) => setForm({ ...form, fournisseur_nom: e.target.value })}
                        placeholder="Raison sociale du fournisseur" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Code projet (4 lettres) / année audit</Label>
                      <Input value={form.code_projet}
                        onChange={(e) => setForm({ ...form, code_projet: e.target.value })}
                        placeholder="ex: AOUZ ou 2026" maxLength={10} />
                    </div>
                    <p className="text-[11px] text-amber-700 col-span-full">
                      NC fournisseur : la NC sera automatiquement assignée à Alexandre Baffou
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Description du problème ─────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Description du problème</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Intitulé de la NC <span className="text-destructive">*</span></Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Court résumé du problème" required maxLength={300} />
                </div>
                <div className="space-y-1.5">
                  <Label>Quel est le problème / la situation / l'axe de performance souhaité ? <span className="text-destructive">*</span></Label>
                  <Textarea value={form.description_problem}
                    onChange={(e) => setForm({ ...form, description_problem: e.target.value })}
                    placeholder="Décris la NC en détail…" rows={5} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Apparition possible sur d'autre site / pièce ?</Label>
                  <Select value={form.apparition_ailleurs} onValueChange={(v) => setForm({ ...form, apparition_ailleurs: v as NCApparition })}>
                    <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                    <SelectContent>
                      {(Object.entries(NC_APPARITION_LABELS) as [NCApparition, string][]).map(([k, lbl]) => (
                        <SelectItem key={k} value={k}>{lbl}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* ── Analyse & actions ───────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Analyse et premières pistes</CardTitle>
                <CardDescription>
                  Ces champs peuvent être complétés plus tard par le pilote.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Causes racines prépondérantes</Label>
                  <Textarea value={form.causes_racines}
                    onChange={(e) => setForm({ ...form, causes_racines: e.target.value })}
                    placeholder="Numéroter les causes (1. ... 2. ... 3. ...)" rows={4} />
                </div>
                <div className="space-y-1.5">
                  <Label>Actions correctives proposées (court terme)</Label>
                  <Textarea value={form.actions_correctives}
                    onChange={(e) => setForm({ ...form, actions_correctives: e.target.value })}
                    placeholder="Quelles actions sur le court terme ? Indiquer une date de mise en place" rows={3} />
                </div>
                <div className="space-y-1.5">
                  <Label>Actions préventives (éviter le retour)</Label>
                  <Textarea value={form.actions_preventives}
                    onChange={(e) => setForm({ ...form, actions_preventives: e.target.value })}
                    placeholder="Numéroter les actions (1. ... 2. ...)" rows={3} />
                </div>
              </CardContent>
            </Card>

            {/* ── Submit ──────────────────────────────────────────────── */}
            <div className="flex justify-end gap-2 sticky bottom-0 bg-background py-3 border-t">
              <Button type="button" variant="outline" onClick={() => navigate('/smq')}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSaving} className="gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Déclarer la NC
              </Button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
