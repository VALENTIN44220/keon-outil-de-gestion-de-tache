/**
 * NewJuridiqueRequest — création d'une demande au service Juridique.
 *
 * Crée 1 task (type=request, module_code='juridique'). Modèle simple (pas de
 * sous-tâches) : la demande arrive « à affecter », le service juridique la
 * dispatche ensuite à un membre. Peut être rattachée à un projet (base BE)
 * et/ou à un contrat fournisseur (référentiel Achats).
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Scale, Save, X, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SupplierCombobox } from '@/components/it/SupplierCombobox';
import {
  JURIDIQUE_PRESTATIONS, JURIDIQUE_PRESTATION_LABELS, JuridiquePrestation,
} from '@/hooks/useJuridiqueRequests';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Basse' },
  { value: 'medium', label: 'Moyenne' },
  { value: 'high', label: 'Élevée' },
];

/** Charge estimée par défaut (h) selon la prestation — modifiable par le demandeur. */
const DEFAULT_HOURS: Record<JuridiquePrestation, number> = {
  contrat: 4,
  contrat_fournisseur: 4,
  pacte_gouvernance: 8,
  secretariat: 2,
  instance: 6,
  capital: 8,
  contentieux: 8,
  veille: 2,
  conseil: 1,
  autre: 2,
};

interface ProjectOption { id: string; code_projet: string | null; nom_projet: string | null; }

export default function NewJuridiqueRequest() {
  const navigate = useNavigate();
  const { profile: authProfile, user } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const profile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;

  const [activeView, setActiveView] = useState('juridique-dispatch');
  const [prestation, setPrestation] = useState<JuridiquePrestation>('contrat');
  const [objet, setObjet] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [hours, setHours] = useState<number>(DEFAULT_HOURS.contrat);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rattachement projet (base BE)
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [projectId, setProjectId] = useState('');

  // Rattachement contrat fournisseur
  const [fournisseurTiers, setFournisseurTiers] = useState('');

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('be_projects')
        .select('id, code_projet, nom_projet')
        .in('status', ['active', 'actif'])
        .order('nom_projet');
      setProjects((data ?? []) as ProjectOption[]);
    })();
  }, []);

  const filteredProjects = useMemo(() => {
    const s = projectSearch.trim().toLowerCase();
    if (!s) return projects.slice(0, 30);
    return projects
      .filter(p =>
        (p.nom_projet ?? '').toLowerCase().includes(s) ||
        (p.code_projet ?? '').toLowerCase().includes(s))
      .slice(0, 30);
  }, [projects, projectSearch]);

  const selectedProject = projects.find(p => p.id === projectId) ?? null;

  const onPrestationChange = (v: JuridiquePrestation) => {
    setPrestation(v);
    setHours(DEFAULT_HOURS[v]);
  };

  const canSubmit = !isSubmitting && objet.trim().length > 0;

  const handleSubmit = async () => {
    if (!profile?.id || !user || !canSubmit) return;
    setIsSubmitting(true);
    try {
      const projectLabel = selectedProject
        ? [selectedProject.code_projet, selectedProject.nom_projet].filter(Boolean).join(' — ')
        : null;

      // Résout le nom du fournisseur pour l'affichage.
      let fournisseurNom: string | null = null;
      if (fournisseurTiers) {
        const { data: sup } = await supabase
          .from('supplier_purchase_enrichment')
          .select('nomfournisseur')
          .eq('tiers', fournisseurTiers)
          .maybeSingle();
        fournisseurNom = (sup as any)?.nomfournisseur ?? null;
      }

      const moduleData: Record<string, any> = {
        prestation,
        objet: objet.trim(),
        projet_id: projectId || null,
        projet_label: projectLabel,
        fournisseur_tiers: fournisseurTiers || null,
        fournisseur_nom: fournisseurNom,
      };

      const title = `${JURIDIQUE_PRESTATION_LABELS[prestation]} — ${objet.trim()}`;

      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          type: 'request',
          status: 'todo',
          priority,
          title,
          description: description || null,
          requester_id: profile.id,
          user_id: user.id,
          assignee_id: null, // à affecter par le service juridique
          due_date: dueDate || null,
          duration_hours: hours,
          module_code: 'juridique' as any,
          module_data: moduleData,
        } as any)
        .select('id')
        .single();

      if (error || !task) throw error ?? new Error('Erreur création demande');

      toast.success('Demande envoyée au service juridique');
      navigate('/juridique/dispatch');
    } catch (e: any) {
      console.error('NewJuridiqueRequest:', e);
      toast.error(`Erreur : ${e.message ?? 'inconnue'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Nouvelle demande juridique" searchQuery="" onSearchChange={() => {}} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10">
                <Scale className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold">Nouvelle demande juridique</h1>
                <p className="text-sm text-muted-foreground">
                  La demande est transmise au service juridique, qui l'affecte et la prend en charge.
                </p>
              </div>
            </div>

            <Card>
              <CardContent className="pt-6 space-y-5">
                <div>
                  <Label>Type de demande *</Label>
                  <Select
                    value={prestation}
                    onValueChange={(v) => onPrestationChange(v as JuridiquePrestation)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {JURIDIQUE_PRESTATIONS.map(p => (
                        <SelectItem key={p} value={p}>{JURIDIQUE_PRESTATION_LABELS[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Objet *</Label>
                  <Input
                    value={objet}
                    onChange={(e) => setObjet(e.target.value)}
                    placeholder="Ex : Relecture contrat de maintenance SPV DOLE"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label>Priorité</Label>
                    <Select value={priority} onValueChange={setPriority} disabled={isSubmitting}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Échéance souhaitée</Label>
                    <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={isSubmitting} />
                  </div>
                  <div>
                    <Label>Charge estimée (h)</Label>
                    <Input
                      type="number" min={0} step={0.5}
                      value={hours}
                      onChange={(e) => setHours(Number(e.target.value))}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Rattachement projet (base BE) */}
                <div>
                  <Label>Projet lié (optionnel)</Label>
                  {selectedProject ? (
                    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                      <span className="truncate">
                        {[selectedProject.code_projet, selectedProject.nom_projet].filter(Boolean).join(' — ')}
                      </span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setProjectId('')} disabled={isSubmitting}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-8"
                          placeholder="Rechercher un projet par nom ou code…"
                          value={projectSearch}
                          onChange={(e) => setProjectSearch(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>
                      {projectSearch.trim() && (
                        <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                          {filteredProjects.length === 0 && (
                            <p className="px-3 py-2 text-sm text-muted-foreground">Aucun projet</p>
                          )}
                          {filteredProjects.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => { setProjectId(p.id); setProjectSearch(''); }}
                              className={cn('w-full text-left px-3 py-2 text-sm hover:bg-muted')}
                            >
                              <span className="font-medium">{p.code_projet ?? '—'}</span>
                              <span className="text-muted-foreground"> · {p.nom_projet ?? ''}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Rattachement contrat fournisseur */}
                <div>
                  <Label>Contrat fournisseur lié (optionnel)</Label>
                  <SupplierCombobox
                    value={fournisseurTiers}
                    onValueChange={setFournisseurTiers}
                    placeholder="Rechercher un fournisseur…"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <Label>Description / contexte</Label>
                  <Textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Précisez le besoin, les échéances, les pièces disponibles…"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => navigate('/juridique/dispatch')} disabled={isSubmitting}>
                    <X className="h-4 w-4 mr-2" />
                    Annuler
                  </Button>
                  <Button onClick={handleSubmit} disabled={!canSubmit}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSubmitting ? 'Envoi…' : 'Envoyer la demande'}
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
