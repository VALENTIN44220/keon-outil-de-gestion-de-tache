import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ITProject, ITProjectStatus, ITProjectType, ITProjectPriority, ITProjectPhase, ITProjectPilier, IT_PROJECT_PHASES, IT_PROJECT_PILIER_CONFIG, STATUT_FDR_CONFIG, StatutFDR } from '@/types/itProject';
import { useITProjects } from '@/hooks/useITProjects';
import { supabase } from '@/integrations/supabase/client';
import { Monitor, Users, Calendar, Euro, Link2, MessageSquareText, Loader2, Target } from 'lucide-react';

const NONE = '__none__';

interface ITProjectFormDialogProps {
  open: boolean;
  onClose: () => void;
  project?: ITProject | null;
  onSaved?: () => void;
}

export function ITProjectFormDialog({ open, onClose, project, onSaved }: ITProjectFormDialogProps) {
  const { addProject, updateProject } = useITProjects();
  const isEdit = !!project;
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [nomProjet, setNomProjet] = useState('');
  const [description, setDescription] = useState('');
  const [typeProjet, setTypeProjet] = useState<ITProjectType>('applicatif');
  const [priorite, setPriorite] = useState<ITProjectPriority>('normale');
  const [statut, setStatut] = useState<ITProjectStatus>('backlog');
  const [phaseCourante, setPhaseCourante] = useState<ITProjectPhase>('cadrage');
  
  const [dateFinPrevue, setDateFinPrevue] = useState('');
  const [budgetPrevisionnel, setBudgetPrevisionnel] = useState('');
  const [teamsChannelUrl, setTeamsChannelUrl] = useState('');
  const [loopWorkspaceUrl, setLoopWorkspaceUrl] = useState('');

  // Équipe
  const [companyId, setCompanyId] = useState(NONE);
  const [chefProjetMetierId, setChefProjetMetierId] = useState(NONE);
  const [chefProjetItId, setChefProjetItId] = useState(NONE);
  const [groupeServiceId, setGroupeServiceId] = useState(NONE);
  const [directeurId, setDirecteurId] = useState(NONE);

  // FDR / Contexte
  const [statutFdr, setStatutFdr] = useState('__none__');
  const [pilier, setPilier] = useState(NONE);
  const [fdrPriorite, setFdrPriorite] = useState('');
  const [fdrDescription, setFdrDescription] = useState('');
  const [fdrCommentaires, setFdrCommentaires] = useState('');

  // Lookup data
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [allProfiles, setAllProfiles] = useState<{ id: string; display_name: string; department_id: string | null }[]>([]);
  const [companySearch, setCompanySearch] = useState('');

  useEffect(() => {
    if (!open) return;
    supabase.from('companies').select('id, name').order('name').then(({ data }) => {
      setCompanies(data || []);
    });
    supabase.from('departments').select('id, name').order('name').then(({ data }) => {
      setDepartments(data || []);
    });
    supabase.from('profiles').select('id, display_name, department_id').order('display_name').then(({ data }) => {
      setAllProfiles(data || []);
    });
  }, [open]);

  const filteredCompanies = companySearch
    ? companies.filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase()))
    : companies;

  useEffect(() => {
    if (project) {
      setNomProjet(project.nom_projet || '');
      setDescription(project.description || '');
      setTypeProjet((project.type_projet as ITProjectType) || 'applicatif');
      setPriorite((project.priorite as ITProjectPriority) || 'normale');
      setStatut(project.statut || 'backlog');
      setPhaseCourante((project.phase_courante as ITProjectPhase) || 'cadrage');
      setDateFinPrevue(project.date_fin_prevue || '');
      setBudgetPrevisionnel(project.budget_previsionnel?.toString() || '');
      setTeamsChannelUrl(project.teams_channel_url || '');
      setLoopWorkspaceUrl(project.loop_workspace_url || '');
      setCompanyId(project.company_id || NONE);
      setChefProjetMetierId(project.chef_projet_metier_id || NONE);
      setChefProjetItId(project.chef_projet_it_id || NONE);
      setGroupeServiceId(project.groupe_service_id || NONE);
      setDirecteurId(project.directeur_id || NONE);
      setPilier(project.pilier || NONE);
      setStatutFdr(project.statut_fdr || '__none__');
      setFdrPriorite(project.fdr_priorite || '');
      setFdrDescription(project.fdr_description || '');
      setFdrCommentaires(project.fdr_commentaires || '');
    } else {
      resetForm();
    }
  }, [project, open]);

  const resetForm = () => {
    setNomProjet('');
    setDescription('');
    setTypeProjet('applicatif');
    setPriorite('normale');
    setStatut('backlog');
    setPhaseCourante('cadrage');
    setDateFinPrevue('');
    setBudgetPrevisionnel('');
    setTeamsChannelUrl('');
    setLoopWorkspaceUrl('');
    setCompanyId(NONE);
    setChefProjetMetierId(NONE);
    setChefProjetItId(NONE);
    setGroupeServiceId(NONE);
    setDirecteurId(NONE);
    setPilier(NONE);
    setStatutFdr('__none__');
    setFdrPriorite('');
    setFdrDescription('');
    setFdrCommentaires('');
  };

  const handleSubmit = async () => {
    if (!nomProjet.trim()) return;
    setIsSaving(true);

    const payload: any = {
      nom_projet: nomProjet,
      description: description || null,
      type_projet: typeProjet,
      priorite,
      statut,
      phase_courante: phaseCourante,
      date_fin_prevue: dateFinPrevue || null,
      budget_previsionnel: budgetPrevisionnel ? parseFloat(budgetPrevisionnel) : null,
      teams_channel_url: teamsChannelUrl || null,
      loop_workspace_url: loopWorkspaceUrl || null,
      company_id: companyId !== NONE ? companyId : null,
      chef_projet_metier_id: chefProjetMetierId !== NONE ? chefProjetMetierId : null,
      chef_projet_it_id: chefProjetItId !== NONE ? chefProjetItId : null,
      groupe_service_id: groupeServiceId !== NONE ? groupeServiceId : null,
      directeur_id: directeurId !== NONE ? directeurId : null,
      pilier: pilier !== NONE ? pilier : null,
      statut_fdr: statutFdr !== '__none__' ? statutFdr : null,
      fdr_priorite: fdrPriorite || null,
      fdr_description: fdrDescription || null,
      fdr_commentaires: fdrCommentaires || null,
    };

    if (isEdit && project) {
      await updateProject(project.id, payload);
    } else {
      await addProject(payload);
    }

    setIsSaving(false);
    onSaved?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-violet-600" />
            {isEdit ? 'Modifier le projet IT' : 'Nouveau projet IT'}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-2">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="general" className="text-xs gap-1">
              <Monitor className="h-3.5 w-3.5" /> Général
            </TabsTrigger>
            <TabsTrigger value="equipe" className="text-xs gap-1">
              <Users className="h-3.5 w-3.5" /> Équipe
            </TabsTrigger>
            <TabsTrigger value="planning" className="text-xs gap-1">
              <Calendar className="h-3.5 w-3.5" /> Planning
            </TabsTrigger>
            <TabsTrigger value="fdr" className="text-xs gap-1">
              <Target className="h-3.5 w-3.5" /> FDR / Contexte
            </TabsTrigger>
            <TabsTrigger value="microsoft" className="text-xs gap-1">
              <Link2 className="h-3.5 w-3.5" /> Microsoft 365
            </TabsTrigger>
          </TabsList>

          {/* General tab */}
          <TabsContent value="general" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="nom">Nom du projet *</Label>
              <Input id="nom" placeholder="Ex: Refonte portail client, Migration ERP..." value={nomProjet} onChange={e => setNomProjet(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" placeholder="Objectifs, contexte, périmètre..." value={description} onChange={e => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type de projet</Label>
                <Select value={typeProjet} onValueChange={v => setTypeProjet(v as ITProjectType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="infrastructure">🖧 Infrastructure</SelectItem>
                    <SelectItem value="applicatif">💻 Applicatif</SelectItem>
                    <SelectItem value="securite">🔒 Sécurité</SelectItem>
                    <SelectItem value="data">📊 Data / BI</SelectItem>
                    <SelectItem value="integration">🔗 Intégration</SelectItem>
                    <SelectItem value="autre">📦 Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priorité</Label>
                <Select value={priorite} onValueChange={v => setPriorite(v as ITProjectPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critique">🔴 Critique</SelectItem>
                    <SelectItem value="haute">🟠 Haute</SelectItem>
                    <SelectItem value="normale">🔵 Normale</SelectItem>
                    <SelectItem value="basse">⚪ Basse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={statut} onValueChange={v => setStatut(v as ITProjectStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backlog">Backlog</SelectItem>
                    <SelectItem value="en_cours">En cours</SelectItem>
                    <SelectItem value="recette">Recette</SelectItem>
                    <SelectItem value="deploye">Déployé</SelectItem>
                    <SelectItem value="cloture">Clôturé</SelectItem>
                    <SelectItem value="suspendu">Suspendu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Phase courante</Label>
                <Select value={phaseCourante} onValueChange={v => setPhaseCourante(v as ITProjectPhase)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IT_PROJECT_PHASES.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          {/* Équipe tab */}
          <TabsContent value="equipe" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">🏢 Société</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une société" /></SelectTrigger>
                <SelectContent>
                  <div className="px-2 pb-2">
                    <Input
                      placeholder="Rechercher société..."
                      value={companySearch}
                      onChange={e => setCompanySearch(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <SelectItem value={NONE}>— Aucune —</SelectItem>
                  {filteredCompanies.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">👤 Chef de projet Métier</Label>
              <Select value={chefProjetMetierId} onValueChange={setChefProjetMetierId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un chef de projet métier" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Aucun —</SelectItem>
                  {allProfiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">💻 Chef de projet IT/Digital</Label>
              <Select value={chefProjetItId} onValueChange={setChefProjetItId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un chef de projet IT" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Aucun —</SelectItem>
                  {allProfiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">🏬 Groupe de service</Label>
              <Select value={groupeServiceId} onValueChange={setGroupeServiceId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un groupe de service" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Aucun —</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">👔 Directeur</Label>
              <Select value={directeurId} onValueChange={setDirecteurId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un directeur" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Aucun —</SelectItem>
                  {allProfiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Planning tab */}
          <TabsContent value="planning" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date-fin">Date de fin prévue</Label>
                <Input id="date-fin" type="date" value={dateFinPrevue} onChange={e => setDateFinPrevue(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget" className="flex items-center gap-1.5">
                <Euro className="h-3.5 w-3.5" /> Budget prévisionnel (€)
              </Label>
              <Input id="budget" type="number" placeholder="Ex: 50000" value={budgetPrevisionnel} onChange={e => setBudgetPrevisionnel(e.target.value)} />
            </div>
          </TabsContent>

          {/* FDR / Contexte tab */}
          <TabsContent value="fdr" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">📋 Statut Feuille de Route</Label>
              <Select value={statutFdr} onValueChange={setStatutFdr}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un statut FDR" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Aucun —</SelectItem>
                  {(Object.entries(STATUT_FDR_CONFIG) as [StatutFDR, typeof STATUT_FDR_CONFIG['non_soumis']][]).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <span>{cfg.icon}</span>
                        <span>{cfg.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">🎯 Pilier stratégique</Label>
              <Select value={pilier} onValueChange={setPilier}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un pilier" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Aucun —</SelectItem>
                  {(Object.entries(IT_PROJECT_PILIER_CONFIG) as [string, typeof IT_PROJECT_PILIER_CONFIG['P1']][]).map(([code, cfg]) => (
                    <SelectItem key={code} value={code}>
                      <div className="flex items-center gap-2">
                        <Badge className={`${cfg.className} border text-[10px] px-1.5`}>{code}</Badge>
                        <span className="font-medium">{cfg.label}</span>
                        <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">— {cfg.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fdr-prio" className="flex items-center gap-1.5">⚡ Priorité FDR</Label>
              <Input id="fdr-prio" placeholder="Valeur brute FDR (ex: Haute, P1, ...)" value={fdrPriorite} onChange={e => setFdrPriorite(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fdr-desc" className="flex items-center gap-1.5">📝 Description FDR</Label>
              <Textarea id="fdr-desc" placeholder="Description issue de la feuille de route..." value={fdrDescription} onChange={e => setFdrDescription(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fdr-comm" className="flex items-center gap-1.5">💬 Commentaires</Label>
              <Textarea id="fdr-comm" placeholder="Commentaires, notes, remarques..." value={fdrCommentaires} onChange={e => setFdrCommentaires(e.target.value)} rows={3} />
            </div>
          </TabsContent>

          {/* Microsoft 365 tab */}
          <TabsContent value="microsoft" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="loop-url" className="flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5 text-violet-600" /> URL du workspace Loop
              </Label>
              <Input id="loop-url" placeholder="https://loop.microsoft.com/p/..." value={loopWorkspaceUrl} onChange={e => setLoopWorkspaceUrl(e.target.value)} className="font-mono text-xs" />
              <p className="text-xs text-muted-foreground">Loop → Workspace → Partager → Copier le lien</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="teams-url" className="flex items-center gap-1.5">
                <MessageSquareText className="h-3.5 w-3.5 text-blue-600" /> URL du canal Teams
              </Label>
              <Input id="teams-url" placeholder="https://teams.microsoft.com/l/channel/..." value={teamsChannelUrl} onChange={e => setTeamsChannelUrl(e.target.value)} className="font-mono text-xs" />
              <p className="text-xs text-muted-foreground">Teams → Clic droit sur le canal → Obtenir le lien</p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={!nomProjet.trim() || isSaving} className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Enregistrer' : 'Créer le projet'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
