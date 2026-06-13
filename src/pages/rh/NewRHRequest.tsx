/**
 * NewRHRequest — création d'un dossier RH (Onboarding / Offboarding /
 * Mutation / Promotion).
 *
 * Crée 1 task (type=request, module_code='rh') avec les infos collaborateur
 * dans module_data. Les sous-tâches sont spawnnées automatiquement par le
 * trigger fn_auto_spawn_child_tasks selon le process choisi, avec échéance
 * héritée de la date de contrat / mutation / promotion (due_date).
 *
 * Champs conditionnels par prestation : cf. docs/CDC/RH_ONBOARDING.md §4.2.
 * Décision 2026-06-12 : pas de données sensibles (RIB, SS…) en V1.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { UserPlus, Save, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  RH_PROCESS_IDS, RH_PRESTATION_LABELS, RHPrestation,
} from '@/hooks/useRHRequests';

type FieldKey =
  | 'poste' | 'manager' | 'vehicule' | 'type_vehicule' | 'ordinateur_portable'
  | 'telephone' | 'societe' | 'service' | 'lieu_travail'
  | 'date_premier_jour' | 'date_dernier_jour' | 'date_mutation' | 'date_promotion'
  | 'ancien_poste' | 'nouveau_poste' | 'ancienne_societe' | 'nouvelle_societe'
  | 'ancien_manager' | 'nouveau_manager'
  | 'montant_max_devis_divalto' | 'licence_pipedrive';

/** Champs affichés par prestation (CDC §4.2). nom/prenom toujours présents. */
const FIELDS_BY_PRESTATION: Record<RHPrestation, FieldKey[]> = {
  onboarding: [
    'poste', 'manager', 'societe', 'service', 'lieu_travail', 'date_premier_jour',
    'vehicule', 'type_vehicule', 'ordinateur_portable', 'telephone',
    'montant_max_devis_divalto', 'licence_pipedrive',
  ],
  offboarding: [
    'poste', 'manager', 'lieu_travail', 'date_dernier_jour',
    'vehicule', 'type_vehicule', 'ordinateur_portable', 'telephone',
  ],
  mutation: [
    'date_mutation', 'ancien_poste', 'nouveau_poste',
    'ancienne_societe', 'nouvelle_societe', 'ancien_manager', 'nouveau_manager',
  ],
  promotion: [
    'date_promotion', 'ancien_poste', 'nouveau_poste',
    'ancienne_societe', 'nouvelle_societe', 'ancien_manager', 'nouveau_manager',
  ],
};

/** Date qui sert d'échéance au dossier (héritée par les sous-tâches). */
const DUE_DATE_FIELD: Record<RHPrestation, FieldKey> = {
  onboarding: 'date_premier_jour',
  offboarding: 'date_dernier_jour',
  mutation: 'date_mutation',
  promotion: 'date_promotion',
};

const FIELD_LABELS: Record<FieldKey, string> = {
  poste: 'Poste',
  manager: 'Manager',
  vehicule: 'Véhicule',
  type_vehicule: 'Type de véhicule',
  ordinateur_portable: 'Ordinateur portable',
  telephone: 'Téléphone',
  societe: 'Société',
  service: 'Service',
  lieu_travail: 'Lieu de travail',
  date_premier_jour: 'Date du 1er jour de contrat',
  date_dernier_jour: 'Date du dernier jour de contrat',
  date_mutation: 'Date de mutation',
  date_promotion: 'Date de promotion',
  ancien_poste: 'Ancien poste',
  nouveau_poste: 'Nouveau poste',
  ancienne_societe: 'Ancienne société',
  nouvelle_societe: 'Nouvelle société',
  ancien_manager: 'Ancien manager',
  nouveau_manager: 'Nouveau manager',
  montant_max_devis_divalto: 'Droits Divalto — montant max devis',
  licence_pipedrive: 'Licence Pipedrive',
};

const DATE_FIELDS: FieldKey[] = ['date_premier_jour', 'date_dernier_jour', 'date_mutation', 'date_promotion'];
const BOOL_FIELDS: FieldKey[] = ['vehicule', 'ordinateur_portable', 'telephone', 'licence_pipedrive'];
const COMPANY_FIELDS: FieldKey[] = ['societe', 'ancienne_societe', 'nouvelle_societe'];
const DEPARTMENT_FIELDS: FieldKey[] = ['service'];
const PROFILE_FIELDS: FieldKey[] = ['manager', 'ancien_manager', 'nouveau_manager'];

export default function NewRHRequest() {
  const navigate = useNavigate();
  const { profile: authProfile, user } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const profile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;

  const [activeView, setActiveView] = useState('rh-dispatch');
  const [prestation, setPrestation] = useState<RHPrestation>('onboarding');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [description, setDescription] = useState('');
  const [values, setValues] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; display_name: string | null }[]>([]);

  useEffect(() => {
    void (async () => {
      const [c, d, p] = await Promise.all([
        supabase.from('companies').select('id, name').order('name'),
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('profiles').select('id, display_name').order('display_name'),
      ]);
      setCompanies(c.data ?? []);
      setDepartments(d.data ?? []);
      setProfiles((p.data ?? []).filter(x => x.display_name));
    })();
  }, []);

  const fields = FIELDS_BY_PRESTATION[prestation];
  const dueDateField = DUE_DATE_FIELD[prestation];

  const setValue = (key: FieldKey, v: any) =>
    setValues(prev => ({ ...prev, [key]: v }));

  const visibleFields = useMemo(
    () => fields.filter(f => f !== 'type_vehicule' || values.vehicule === true),
    [fields, values.vehicule],
  );

  const canSubmit =
    !isSubmitting &&
    nom.trim().length > 0 &&
    prenom.trim().length > 0 &&
    Boolean(values[dueDateField]);

  const handleSubmit = async () => {
    if (!profile?.id || !user || !canSubmit) return;
    setIsSubmitting(true);
    try {
      const title = `${RH_PRESTATION_LABELS[prestation].toUpperCase()} — ${nom.trim().toUpperCase()} ${prenom.trim()}`;

      // Ne garde que les champs de la prestation courante
      const moduleData: Record<string, any> = {
        prestation,
        nom: nom.trim(),
        prenom: prenom.trim(),
      };
      for (const f of visibleFields) {
        if (values[f] !== undefined && values[f] !== '') moduleData[f] = values[f];
      }

      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          type: 'request',
          status: 'todo',
          title,
          description: description || null,
          requester_id: profile.id,
          user_id: user.id,
          module_code: 'rh',
          source_process_template_id: RH_PROCESS_IDS[prestation],
          due_date: values[dueDateField],
          module_data: moduleData,
        })
        .select('id')
        .single();

      if (error || !task) throw error ?? new Error('Erreur création dossier');

      toast.success('Dossier créé — les sous-tâches ont été générées pour chaque service');
      navigate('/rh/dispatch');
    } catch (e: any) {
      console.error('NewRHRequest:', e);
      toast.error(`Erreur : ${e.message ?? 'inconnue'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (f: FieldKey) => {
    if (BOOL_FIELDS.includes(f)) {
      return (
        <div key={f} className="flex items-center gap-2 pt-1">
          <Checkbox
            id={f}
            checked={values[f] === true}
            onCheckedChange={(c) => setValue(f, c === true)}
            disabled={isSubmitting}
          />
          <Label htmlFor={f} className="cursor-pointer">{FIELD_LABELS[f]}</Label>
        </div>
      );
    }
    if (DATE_FIELDS.includes(f)) {
      return (
        <div key={f}>
          <Label>{FIELD_LABELS[f]} {f === dueDateField ? '*' : ''}</Label>
          <Input
            type="date"
            value={values[f] ?? ''}
            onChange={(e) => setValue(f, e.target.value)}
            disabled={isSubmitting}
          />
        </div>
      );
    }
    if (COMPANY_FIELDS.includes(f) || DEPARTMENT_FIELDS.includes(f) || PROFILE_FIELDS.includes(f)) {
      const options = COMPANY_FIELDS.includes(f)
        ? companies.map(c => c.name)
        : DEPARTMENT_FIELDS.includes(f)
          ? departments.map(d => d.name)
          : profiles.map(p => p.display_name as string);
      return (
        <div key={f}>
          <Label>{FIELD_LABELS[f]}</Label>
          <Select
            value={values[f] ?? ''}
            onValueChange={(v) => setValue(f, v)}
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner…" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {options.map(o => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    return (
      <div key={f}>
        <Label>{FIELD_LABELS[f]}</Label>
        <Input
          value={values[f] ?? ''}
          onChange={(e) => setValue(f, e.target.value)}
          disabled={isSubmitting}
        />
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Nouveau dossier RH" searchQuery="" onSearchChange={() => {}} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-pink-500/10">
                <UserPlus className="h-6 w-6 text-pink-600" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold">Nouveau dossier RH</h1>
                <p className="text-sm text-muted-foreground">
                  Les sous-tâches sont générées automatiquement pour chaque service,
                  validation finale par la RH
                </p>
              </div>
            </div>

            <Card>
              <CardContent className="pt-6 space-y-5">
                <div>
                  <Label>Prestation *</Label>
                  <Select
                    value={prestation}
                    onValueChange={(v) => { setPrestation(v as RHPrestation); setValues({}); }}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(RH_PRESTATION_LABELS) as RHPrestation[]).map(p => (
                        <SelectItem key={p} value={p}>{RH_PRESTATION_LABELS[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Nom *</Label>
                    <Input value={nom} onChange={(e) => setNom(e.target.value)} disabled={isSubmitting} />
                  </div>
                  <div>
                    <Label>Prénom *</Label>
                    <Input value={prenom} onChange={(e) => setPrenom(e.target.value)} disabled={isSubmitting} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {visibleFields.map(renderField)}
                </div>

                <div>
                  <Label>Description / contexte (optionnel)</Label>
                  <Textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => navigate('/rh/dispatch')} disabled={isSubmitting}>
                    <X className="h-4 w-4 mr-2" />
                    Annuler
                  </Button>
                  <Button onClick={handleSubmit} disabled={!canSubmit}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSubmitting ? 'Création…' : 'Créer le dossier'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
