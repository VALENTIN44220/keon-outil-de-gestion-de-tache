/**
 * SMQNewDeclaration — Formulaire de déclaration d'une nouvelle NC
 *
 * Reproduit le formulaire SharePoint actuel KEONGROUP, en plus structuré :
 * sections claires, validations, affectation auto au pilote du processus
 * (ou Alexandre Baffou si NC fournisseur).
 */
import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageHeader } from '@/components/layout/PageHeader';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Save, Loader2, AlertTriangle, Link as LinkIcon, X, Plus, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
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

  // Override manuel du pilote (sinon auto-affectation via nc_process_pilots)
  const [piloteOverride, setPiloteOverride] = useState<string>('');

  // Liens / pièces jointes ajoutés à la création
  const [links, setLinks] = useState<{ url: string; label: string }[]>([]);

  // Liste des profils pour le sélecteur Pilote
  const [users, setUsers] = useState<Array<{ id: string; display_name: string | null; department: string | null }>>([]);
  useEffect(() => {
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
  }, []);

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
        pilote_id: piloteOverride || undefined,  // override manuel si renseigné
      });
      if (!created) return;

      // Insère les liens en nc_attachments
      const validLinks = links.filter(l => l.url.trim());
      if (validLinks.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user?.id ?? '')
          .maybeSingle();
        const uploadedBy = profile?.id ?? null;
        const { error: attError } = await supabase.from('nc_attachments').insert(
          validLinks.map(l => ({
            nc_id: created.id,
            name: l.label.trim() || l.url.trim(),
            url: l.url.trim(),
            type: 'link',
            uploaded_by: uploadedBy,
          }))
        );
        if (attError) {
          toast.error(`Liens non sauvegardés : ${attError.message}`);
        } else {
          toast.success(`${validLinks.length} lien(s) ajouté(s)`);
        }
      }

      navigate(`/smq/${created.id}`);
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Code projet (4 lettres) / année si audit</Label>
                    <Input value={form.code_projet}
                      onChange={(e) => setForm({ ...form, code_projet: e.target.value })}
                      placeholder="ex: AOUZ ou 2026" maxLength={10} />
                  </div>
                  {isFournisseur && (
                    <div className="space-y-1.5">
                      <Label className="text-amber-700">Nom du fournisseur</Label>
                      <Input value={form.fournisseur_nom}
                        onChange={(e) => setForm({ ...form, fournisseur_nom: e.target.value })}
                        placeholder="Raison sociale du fournisseur"
                        className="border-amber-200" />
                    </div>
                  )}
                </div>

                {isFournisseur && (
                  <p className="text-[11px] text-amber-700 bg-amber-50/60 border border-amber-200 rounded p-2">
                    NC fournisseur : si aucun pilote n'est désigné ci-dessous,
                    la NC sera automatiquement assignée à Alexandre Baffou.
                  </p>
                )}

                {/* Sélecteur Pilote (override manuel — sinon auto-affecté
                    via le mapping admin processus → pilote) */}
                <div className="space-y-1.5">
                  <Label>Pilote de la NC (optionnel — override manuel)</Label>
                  <SearchableSelect
                    value={piloteOverride}
                    onValueChange={setPiloteOverride}
                    placeholder="Auto-affecté selon le processus si vide"
                    searchPlaceholder="Rechercher un utilisateur…"
                    options={[
                      { value: '', label: '— Auto (selon processus) —' },
                      ...users.map(u => ({
                        value: u.id,
                        label: `${u.display_name ?? 'Sans nom'}${u.department ? ` · ${u.department}` : ''}`,
                      })),
                    ]}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Laisse vide pour utiliser le pilote configuré par l'admin SMQ pour ce processus.
                  </p>
                </div>
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

            {/* ── Pièces jointes (liens) ──────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Paperclip className="h-4 w-4" /> Pièces jointes
                </CardTitle>
                <CardDescription>
                  Ajoute des liens vers des documents (SharePoint, dossiers partagés, photos…).
                  Les fichiers physiques pourront être attachés depuis la fiche après création.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {links.map((link, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      placeholder="https://…"
                      value={link.url}
                      onChange={(e) => setLinks(prev => prev.map((l, j) => j === i ? { ...l, url: e.target.value } : l))}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Intitulé"
                      value={link.label}
                      onChange={(e) => setLinks(prev => prev.map((l, j) => j === i ? { ...l, label: e.target.value } : l))}
                      className="w-48"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => setLinks(prev => prev.filter((_, j) => j !== i))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLinks(prev => [...prev, { url: '', label: '' }])}
                  className="gap-2"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter un lien
                </Button>
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
