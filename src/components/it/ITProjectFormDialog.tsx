import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ITProject, ITProjectStatus, ITProjectType, ITProjectPriority, ITProjectPhase, IT_PROJECT_PHASES, ALL_IT_PROJECT_PHASES, IT_PROJECT_PILIER_CONFIG, STATUT_FDR_CONFIG, StatutFDR } from '@/types/itProject';
import { ACTIVITES_METIER, STATUT_PORTEFEUILLE_CONFIG, type StatutPortefeuille } from '@/types/fdr';
import { useITProjects } from '@/hooks/useITProjects';
import { useFdrProfils } from '@/hooks/useFdrSettings';
import { useITProjectLoad, useUpsertITProjectLoad } from '@/hooks/useITProjectLoad';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Monitor, Users, Euro, Link2, MessageSquareText, Loader2, Target, BarChart3 } from 'lucide-react';

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
  const [codeProjetDigital, setCodeProjetDigital] = useState('');
  const [nomProjet, setNomProjet] = useState('');
  const [description, setDescription] = useState('');
  const [typeProjet, setTypeProjet] = useState<ITProjectType>('applicatif');
  const [priorite, setPriorite] = useState<ITProjectPriority>('normale');
  const [statut, setStatut] = useState<ITProjectStatus>('backlog');
  const [phaseCourante, setPhaseCourante] = useState<ITProjectPhase>('cadrage');
  const [phasesActives, setPhasesActives] = useState<ITProjectPhase[]>([...ALL_IT_PROJECT_PHASES]);

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

  // Plan de charge — nouveaux champs
  const [statutPortefeuille, setStatutPortefeuille] = useState<StatutPortefeuille>('Idée');
  const [categorieFdr, setCategorieFdr] = useState<'IA' | 'HORS IA' | ''>('');
  const [activiteMetier, setActiviteMetier] = useState('');
  const [profilPrincipal, setProfilPrincipal] = useState(NONE);
  const [dateKickoff, setDateKickoff] = useState('');
  const [dateMepSaisie, setDateMepSaisie] = useState('');
  const [delaiProjete, setDelaiProjete] = useState('');
  const [echeanceCible, setEcheanceCible] = useState('');
  const [suiviJMois, setSuiviJMois] = useState('0');
  const [externe, setExterne] = useState(false);
  const [pctReduction, setPctReduction] = useState('0');
  const [surFdr, setSurFdr] = useState(true);
  const [pctAvancement, setPctAvancement] = useState('0');
  // Ventilation build par profil : map profil_id → j_mois (string pour l'input)
  const [loadMap, setLoadMap] = useState<Record<string, string>>({});

  // Profils FDR (pour la ventilation build)
  const { data: fdrProfils = [] } = useFdrProfils();
  const upsertLoad = useUpsertITProjectLoad();
  // Charge existante (en mode édition)
  const { data: existingLoads = [] } = useITProjectLoad(project?.id);

  // Lookup data
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [allProfiles, setAllProfiles] = useState<{ id: string; display_name: string; department_id: string | null }[]>([]);

  // Search states for each select
  const [companySearch, setCompanySearch] = useState('');
  const [chefMetierSearch, setChefMetierSearch] = useState('');
  const [chefItSearch, setChefItSearch] = useState('');
  const [groupeServiceSearch, setGroupeServiceSearch] = useState('');
  const [directeurSearch, setDirecteurSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    supabase.from('companies').select('id, name').order('name').then(({ data }) => {
      setCompanies(data || []);
    });
    supabase.from('departments').select('id, name').order('name').then(({ data }) => {
      setDepartments(data || []);
    });
    supabase.from('profiles').select('id, display_name, department_id').eq('status', 'active').order('display_name').then(({ data }) => {
      setAllProfiles(data || []);
    });
    // Reset searches on open
    setCompanySearch('');
    setChefMetierSearch('');
    setChefItSearch('');
    setGroupeServiceSearch('');
    setDirecteurSearch('');
  }, [open]);

  const filterList = <T extends { name?: string; display_name?: string }>(items: T[], query: string): T[] => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter(item => {
      const label = (item as any).display_name || (item as any).name || '';
      return label.toLowerCase().includes(q);
    });
  };

  useEffect(() => {
    if (project) {
      setCodeProjetDigital(project.code_projet_digital || '');
      setNomProjet(project.nom_projet || '');
      setDescription(project.description || '');
      setTypeProjet((project.type_projet as ITProjectType) || 'applicatif');
      setPriorite((project.priorite as ITProjectPriority) || 'normale');
      setStatut(project.statut || 'backlog');
      setPhaseCourante((project.phase_courante as ITProjectPhase) || 'cadrage');
      const rawPhases = project.phases_actives as unknown;
      const arr = Array.isArray(rawPhases) ? (rawPhases as ITProjectPhase[]) : null;
      setPhasesActives(arr && arr.length > 0 ? arr : [...ALL_IT_PROJECT_PHASES]);
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
      // Plan de charge
      setStatutPortefeuille((project.statut_portefeuille as StatutPortefeuille) || 'Idée');
      setCategorieFdr((project.categorie_fdr as 'IA' | 'HORS IA') || '');
      setActiviteMetier(project.activite_metier || '');
      setProfilPrincipal(project.profil_principal || NONE);
      setDateKickoff(project.date_kickoff?.slice(0, 10) || '');
      setDateMepSaisie(project.date_mep_saisie?.slice(0, 10) || '');
      setDelaiProjete(project.delai_projete_mois?.toString() || '');
      setEcheanceCible(project.echeance_cible?.slice(0, 10) || '');
      setSuiviJMois(project.suivi_j_mois?.toString() || '0');
      setExterne(project.externe ?? false);
      setPctReduction(((project.pct_reduction_si_externe ?? 0) * 100).toString());
      setSurFdr(project.sur_feuille_de_route ?? true);
      setPctAvancement(project.pct_avancement?.toString() || '0');
    } else {
      resetForm();
    }
  }, [project, open]);

  // Charger la ventilation build existante quand les profils et les loads sont prêts
  useEffect(() => {
    if (!open || existingLoads.length === 0 || fdrProfils.length === 0) return;
    const map: Record<string, string> = {};
    for (const l of existingLoads) {
      map[l.profil_id] = String(l.j_mois);
    }
    setLoadMap(map);
  }, [open, existingLoads, fdrProfils]);

  const resetForm = () => {
    setCodeProjetDigital('');
    setNomProjet('');
    setDescription('');
    setTypeProjet('applicatif');
    setPriorite('normale');
    setStatut('backlog');
    setPhaseCourante('cadrage');
    setPhasesActives([...ALL_IT_PROJECT_PHASES]);
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
    setStatutPortefeuille('Idée');
    setCategorieFdr('');
    setActiviteMetier('');
    setProfilPrincipal(NONE);
    setDateKickoff('');
    setDateMepSaisie('');
    setDelaiProjete('');
    setEcheanceCible('');
    setSuiviJMois('0');
    setExterne(false);
    setPctReduction('0');
    setSurFdr(true);
    setPctAvancement('0');
    setLoadMap({});
  };

  const orderedActivePhases = IT_PROJECT_PHASES
    .map(p => p.value)
    .filter(v => phasesActives.includes(v));

  const togglePhaseActive = (phase: ITProjectPhase, checked: boolean) => {
    setPhasesActives(prev => {
      const next = checked
        ? Array.from(new Set([...prev, phase]))
        : prev.filter(p => p !== phase);
      // Garder au moins une phase activée
      return next.length > 0 ? next : prev;
    });
  };

  const handleSubmit = async () => {
    if (!nomProjet.trim()) return;
    setIsSaving(true);

    const finalPhasesActives = orderedActivePhases.length > 0
      ? orderedActivePhases
      : [...ALL_IT_PROJECT_PHASES];
    const finalPhaseCourante = finalPhasesActives.includes(phaseCourante)
      ? phaseCourante
      : finalPhasesActives[0];

    const payload: any = {
      ...(codeProjetDigital.trim() && { code_projet_digital: codeProjetDigital.trim().toUpperCase() }),
      nom_projet: nomProjet,
      description: description || null,
      type_projet: typeProjet,
      priorite,
      statut,
      phase_courante: finalPhaseCourante,
      phases_actives: finalPhasesActives,
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
      // Plan de charge
      statut_portefeuille: statutPortefeuille,
      categorie_fdr: categorieFdr || null,
      activite_metier: activiteMetier || null,
      profil_principal: profilPrincipal !== NONE ? profilPrincipal : null,
      date_kickoff: dateKickoff || null,
      date_mep_saisie: dateMepSaisie || null,
      delai_projete_mois: delaiProjete ? parseInt(delaiProjete) : null,
      echeance_cible: echeanceCible || null,
      suivi_j_mois: parseFloat(suiviJMois) || 0,
      externe,
      pct_reduction_si_externe: (parseFloat(pctReduction) || 0) / 100,
      sur_feuille_de_route: surFdr,
      pct_avancement: parseFloat(pctAvancement) || 0,
    };

    let savedId: string | undefined;
    if (isEdit && project) {
      await updateProject(project.id, payload);
      savedId = project.id;
    } else {
      const result = await addProject(payload);
      savedId = (result as any)?.id;
    }

    // Sauvegarder la ventilation build
    if (savedId) {
      const loads = fdrProfils
        .filter(p => p.actif)
        .map(p => ({ profil_id: p.id, j_mois: parseFloat(loadMap[p.id] || '0') || 0 }));
      await upsertLoad.mutateAsync({ projectId: savedId, loads });
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
            <TabsTrigger value="fdr" className="text-xs gap-1">
              <Target className="h-3.5 w-3.5" /> FDR
            </TabsTrigger>
            <TabsTrigger value="charge" className="text-xs gap-1">
              <BarChart3 className="h-3.5 w-3.5" /> Charge & planning
            </TabsTrigger>
            <TabsTrigger value="microsoft" className="text-xs gap-1">
              <Link2 className="h-3.5 w-3.5" /> M365
            </TabsTrigger>
          </TabsList>

          {/* General tab */}
          <TabsContent value="general" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code projet digital</Label>
              <Input
                id="code"
                placeholder="Auto-généré si vide (ex: NSK_IT-00001)"
                value={codeProjetDigital}
                onChange={e => setCodeProjetDigital(e.target.value)}
                className="font-mono uppercase"
                disabled={isEdit}
              />
              {isEdit
                ? <p className="text-xs text-muted-foreground">Le code projet ne peut pas être modifié après création.</p>
                : <p className="text-xs text-muted-foreground">Laissez vide pour générer automatiquement un code NSK_IT-XXXXX.</p>
              }
            </div>
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
                <Label>Phase courante</Label>
                <Select value={phaseCourante} onValueChange={v => setPhaseCourante(v as ITProjectPhase)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IT_PROJECT_PHASES.filter(p => phasesActives.includes(p.value)).map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Le statut du projet est piloté par le « Statut portefeuille » (onglet Charge &amp; planning).</p>
              </div>
            </div>

            {/* Phases activées du projet */}
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Phases activées</Label>
                <span className="text-[10px] text-muted-foreground">
                  {phasesActives.length}/{IT_PROJECT_PHASES.length} sélectionnée{phasesActives.length > 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Décochez les phases qui ne s'appliquent pas à ce projet (ex. projet opérationnel sans phase de recette).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {IT_PROJECT_PHASES.map(p => {
                  const checked = phasesActives.includes(p.value);
                  const isOnlyOne = checked && phasesActives.length === 1;
                  return (
                    <label
                      key={p.value}
                      className="flex items-center gap-2 text-xs cursor-pointer rounded-md border bg-background px-2 py-1.5 hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={isOnlyOne}
                        onCheckedChange={(v) => togglePhaseActive(p.value, v === true)}
                      />
                      <span className="font-medium">{p.order}.</span>
                      <span className="truncate">{p.label}</span>
                    </label>
                  );
                })}
              </div>
              {phasesActives.length === 1 && (
                <p className="text-[10px] text-muted-foreground">Au moins une phase doit rester activée.</p>
              )}
            </div>
          </TabsContent>

          {/* Équipe tab */}
          <TabsContent value="equipe" className="space-y-4 pt-4">
            {/* Société */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">🏢 Société</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une société" /></SelectTrigger>
                <SelectContent>
                  <div className="px-2 pb-2">
                    <Input placeholder="Rechercher société..." value={companySearch} onChange={e => setCompanySearch(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <SelectItem value={NONE}>— Aucune —</SelectItem>
                  {filterList(companies, companySearch).length === 0 && companySearch ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">Aucun résultat</div>
                  ) : filterList(companies, companySearch).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Chef de projet Métier */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">👤 Chef de projet Métier</Label>
              <Select value={chefProjetMetierId} onValueChange={setChefProjetMetierId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un chef de projet métier" /></SelectTrigger>
                <SelectContent>
                  <div className="px-2 pb-2">
                    <Input placeholder="Rechercher..." value={chefMetierSearch} onChange={e => setChefMetierSearch(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <SelectItem value={NONE}>— Aucun —</SelectItem>
                  {filterList(allProfiles, chefMetierSearch).length === 0 && chefMetierSearch ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">Aucun résultat</div>
                  ) : filterList(allProfiles, chefMetierSearch).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Chef de projet IT/Digital */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">💻 Chef de projet IT/Digital</Label>
              <Select value={chefProjetItId} onValueChange={setChefProjetItId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un chef de projet IT" /></SelectTrigger>
                <SelectContent>
                  <div className="px-2 pb-2">
                    <Input placeholder="Rechercher..." value={chefItSearch} onChange={e => setChefItSearch(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <SelectItem value={NONE}>— Aucun —</SelectItem>
                  {filterList(allProfiles, chefItSearch).length === 0 && chefItSearch ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">Aucun résultat</div>
                  ) : filterList(allProfiles, chefItSearch).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Groupe de service */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">🏬 Groupe de service</Label>
              <Select value={groupeServiceId} onValueChange={setGroupeServiceId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un groupe de service" /></SelectTrigger>
                <SelectContent>
                  <div className="px-2 pb-2">
                    <Input placeholder="Rechercher..." value={groupeServiceSearch} onChange={e => setGroupeServiceSearch(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <SelectItem value={NONE}>— Aucun —</SelectItem>
                  {filterList(departments, groupeServiceSearch).length === 0 && groupeServiceSearch ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">Aucun résultat</div>
                  ) : filterList(departments, groupeServiceSearch).map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Directeur */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">👔 Directeur</Label>
              <Select value={directeurId} onValueChange={setDirecteurId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un directeur" /></SelectTrigger>
                <SelectContent>
                  <div className="px-2 pb-2">
                    <Input placeholder="Rechercher..." value={directeurSearch} onChange={e => setDirecteurSearch(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <SelectItem value={NONE}>— Aucun —</SelectItem>
                  {filterList(allProfiles, directeurSearch).length === 0 && directeurSearch ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">Aucun résultat</div>
                  ) : filterList(allProfiles, directeurSearch).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label htmlFor="fdr-desc" className="flex items-center gap-1.5">📝 Description FDR</Label>
              <Textarea id="fdr-desc" placeholder="Description issue de la feuille de route..." value={fdrDescription} onChange={e => setFdrDescription(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fdr-comm" className="flex items-center gap-1.5">💬 Commentaires</Label>
              <Textarea id="fdr-comm" placeholder="Commentaires, notes, remarques..." value={fdrCommentaires} onChange={e => setFdrCommentaires(e.target.value)} rows={3} />
            </div>
          </TabsContent>

          {/* Plan de charge tab */}
          <TabsContent value="charge" className="space-y-4 pt-4">

            {/* Statut portefeuille + sur FDR */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Statut portefeuille</Label>
                <Select value={statutPortefeuille} onValueChange={v => setStatutPortefeuille(v as StatutPortefeuille)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(STATUT_PORTEFEUILLE_CONFIG) as [StatutPortefeuille, typeof STATUT_PORTEFEUILLE_CONFIG['Idée']][]).map(([k, cfg]) => (
                      <SelectItem key={k} value={k}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: cfg.color }} />
                          {cfg.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select value={categorieFdr || '__none__'} onValueChange={v => setCategorieFdr(v === '__none__' ? '' : v as 'IA' | 'HORS IA')}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Non défini —</SelectItem>
                    <SelectItem value="IA">IA</SelectItem>
                    <SelectItem value="HORS IA">HORS IA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Activité métier</Label>
                <Select value={activiteMetier || '__none__'} onValueChange={v => setActiviteMetier(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Non défini —</SelectItem>
                    {ACTIVITES_METIER.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>% Avancement</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} max={100} step={5} value={pctAvancement}
                    onChange={e => setPctAvancement(e.target.value)} className="w-24" />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            </div>

            {/* Dates capacitaires */}
            <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dates & durée</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="kickoff" className="text-xs">Date kickoff</Label>
                  <Input id="kickoff" type="date" value={dateKickoff} onChange={e => setDateKickoff(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="delai" className="text-xs">Délai build projeté (mois)</Label>
                  <Input id="delai" type="number" min={0} value={delaiProjete} onChange={e => setDelaiProjete(e.target.value)} className="h-8 text-sm w-28" placeholder="ex: 6" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="mep" className="text-xs">MEP saisie manuellement <span className="text-muted-foreground">(optionnel)</span></Label>
                  <Input id="mep" type="date" value={dateMepSaisie} onChange={e => setDateMepSaisie(e.target.value)} className="h-8 text-sm" />
                  <p className="text-[10px] text-muted-foreground">Si renseignée, écrase kickoff + délai.</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="echeance" className="text-xs">Échéance cible <span className="text-muted-foreground">(tâches permanentes)</span></Label>
                  <Input id="echeance" type="date" value={echeanceCible} onChange={e => setEcheanceCible(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
            </div>

            {/* Ventilation charge BUILD par profil */}
            <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Charge BUILD par profil (j/mois)</p>
              {fdrProfils.filter(p => p.actif).length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun profil défini. Configurez les profils dans Paramètres FDR.</p>
              ) : (
                <div className="space-y-1.5">
                  {fdrProfils.filter(p => p.actif).map(p => (
                    <div key={p.id} className="flex items-center gap-3">
                      <span className="text-xs flex-1 truncate">{p.nom}</span>
                      <Input
                        type="number" min={0} step={0.5}
                        value={loadMap[p.id] ?? '0'}
                        onChange={e => setLoadMap(m => ({ ...m, [p.id]: e.target.value }))}
                        className="h-7 w-24 text-right text-sm tabular-nums"
                      />
                      <span className="text-xs text-muted-foreground w-12">j/mois</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Suivi + profil principal */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Profil principal <span className="text-muted-foreground text-xs">(suivi post-MEP)</span></Label>
                <Select value={profilPrincipal} onValueChange={setProfilPrincipal}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— Aucun —</SelectItem>
                    {fdrProfils.filter(p => p.actif).map(p => (
                      <SelectItem key={p.id} value={p.code}>{p.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="suivi" className="text-sm">Charge suivi (j/mois)</Label>
                <div className="flex items-center gap-2">
                  <Input id="suivi" type="number" min={0} step={0.5} value={suiviJMois}
                    onChange={e => setSuiviJMois(e.target.value)} className="w-24" />
                  <span className="text-sm text-muted-foreground">j/mois</span>
                </div>
              </div>
            </div>

            {/* Budget prévisionnel */}
            <div className="space-y-2">
              <Label htmlFor="budget" className="flex items-center gap-1.5 text-sm">
                <Euro className="h-3.5 w-3.5" /> Budget prévisionnel (€)
              </Label>
              <Input id="budget" type="number" placeholder="Ex: 50000" value={budgetPrevisionnel} onChange={e => setBudgetPrevisionnel(e.target.value)} className="w-48" />
            </div>

            {/* Externalisation + FDR toggle */}
            <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Externalisation & visibilité</p>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Projet externalisé</Label>
                  <p className="text-xs text-muted-foreground">Réduit la charge interne du pourcentage ci-dessous</p>
                </div>
                <Switch checked={externe} onCheckedChange={setExterne} />
              </div>
              {externe && (
                <div className="flex items-center gap-3">
                  <Label className="text-xs shrink-0">Réduction charge interne</Label>
                  <Input type="number" min={0} max={100} step={5} value={pctReduction}
                    onChange={e => setPctReduction(e.target.value)} className="h-8 w-24 text-right" />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-border/50">
                <div>
                  <Label className="text-sm">Inclus dans la feuille de route</Label>
                  <p className="text-xs text-muted-foreground">Décocher pour exclure des calculs de charge sans supprimer</p>
                </div>
                <Switch checked={surFdr} onCheckedChange={setSurFdr} />
              </div>
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
