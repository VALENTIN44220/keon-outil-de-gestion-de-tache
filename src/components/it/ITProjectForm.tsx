import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ITProject, ITProjectPriority, ITProjectPhase, IT_PROJECT_PHASES, ALL_IT_PROJECT_PHASES, IT_PROJECT_PILIER_CONFIG, FDR_ANNEE_OPTIONS, FDR_ETAT_CONFIG, type FdrEtat } from '@/types/itProject';
import { STATUT_PORTEFEUILLE_CONFIG, type StatutPortefeuille } from '@/types/fdr';
import { useITProjects } from '@/hooks/useITProjects';
import { useITProjectTypes } from '@/hooks/useITProjectTypes';
import { useFdrProfils } from '@/hooks/useFdrSettings';
import { useITActivites } from '@/hooks/useITActivites';
import { useITProjectLoad, useUpsertITProjectLoad } from '@/hooks/useITProjectLoad';
import { generateHorizon } from '@/lib/fdr/calculationEngine';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Monitor, Users, Euro, Link2, MessageSquareText, Loader2, Target, BarChart3 } from 'lucide-react';

const NONE = '__none__';

const SECTIONS = [
  { id: 'general',  label: 'Général',                  icon: Monitor },
  { id: 'equipe',   label: 'Équipe',                   icon: Users },
  { id: 'fdr',      label: 'FDR',                      icon: Target },
  { id: 'planning', label: 'Planning & charge',        icon: BarChart3 },
  { id: 'budget',   label: 'Budget & externalisation', icon: Euro },
  { id: 'm365',     label: 'Microsoft 365',            icon: Link2 },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

interface ITProjectFormProps {
  project?: ITProject | null;
  onSaved?: () => void;
  onCancel: () => void;
}

export function ITProjectForm({ project, onSaved, onCancel }: ITProjectFormProps) {
  const { addProject, updateProject } = useITProjects();
  const { activeTypes, resolve: resolveType } = useITProjectTypes();
  const isEdit = !!project;
  const [isSaving, setIsSaving] = useState(false);
  const [section, setSection] = useState<SectionId>('general');

  // Form state
  const [codeProjetDigital, setCodeProjetDigital] = useState('');
  const [nomProjet, setNomProjet] = useState('');
  const [description, setDescription] = useState('');
  const [typeProjet, setTypeProjet] = useState<string>('applicatif');
  const [priorite, setPriorite] = useState<ITProjectPriority>('normale');
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
  const [fdrAnnee, setFdrAnnee] = useState('AUCUNE');
  const [fdrEtat, setFdrEtat] = useState<FdrEtat>('non_soumis');
  const [pilier, setPilier] = useState(NONE);
  const [fdrPriorite, setFdrPriorite] = useState('');
  const [fdrDescription, setFdrDescription] = useState('');
  const [fdrCommentaires, setFdrCommentaires] = useState('');

  // Plan de charge
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
  const [budgetExterneEur, setBudgetExterneEur] = useState('');
  const [surFdr, setSurFdr] = useState(true);
  const [pctAvancement, setPctAvancement] = useState('0');
  // Ventilation build par profil : map profil_id → j_mois (string pour l'input)
  const [loadMap, setLoadMap] = useState<Record<string, string>>({});
  // Détail mensuel optionnel : profil_id → { 'YYYY-MM': j_mois (string) }
  const [monthsMap, setMonthsMap] = useState<Record<string, Record<string, string>>>({});
  // Profils en mode « détaillé par mois »
  const [detailedProfils, setDetailedProfils] = useState<Set<string>>(new Set());

  // Profils FDR (pour la ventilation build)
  const { data: fdrProfils = [] } = useFdrProfils();
  // Activités métier paramétrables (Paramètres FDR)
  const { activeLabels: activiteLabels } = useITActivites();
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
    supabase.from('companies').select('id, name').order('name').then(({ data }) => {
      setCompanies(data || []);
    });
    supabase.from('departments').select('id, name').order('name').then(({ data }) => {
      setDepartments(data || []);
    });
    supabase.from('profiles').select('id, display_name, department_id').eq('status', 'active').order('display_name').then(({ data }) => {
      setAllProfiles(data || []);
    });
  }, []);

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
      setTypeProjet((project.type_projet as string) || 'applicatif');
      setPriorite((project.priorite as ITProjectPriority) || 'normale');
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
      setFdrAnnee(project.fdr_annee || 'AUCUNE');
      setFdrEtat((project.fdr_etat as FdrEtat) || 'non_soumis');
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
      setBudgetExterneEur(project.budget_externe_eur?.toString() || '');
      setSurFdr(project.sur_feuille_de_route ?? true);
      setPctAvancement(project.pct_avancement?.toString() || '0');
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  // Charger la ventilation build existante quand les profils et les loads sont prêts
  useEffect(() => {
    if (existingLoads.length === 0 || fdrProfils.length === 0) return;
    const map: Record<string, string> = {};
    const mmap: Record<string, Record<string, string>> = {};
    const detailed = new Set<string>();
    for (const l of existingLoads) {
      map[l.profil_id] = String(l.j_mois);
      if (l.months && Object.keys(l.months).length > 0) {
        detailed.add(l.profil_id);
        mmap[l.profil_id] = Object.fromEntries(
          Object.entries(l.months).map(([ym, v]) => [ym, String(v)]),
        );
      }
    }
    setLoadMap(map);
    setMonthsMap(mmap);
    setDetailedProfils(detailed);
  }, [existingLoads, fdrProfils]);

  const resetForm = () => {
    setCodeProjetDigital('');
    setNomProjet('');
    setDescription('');
    setTypeProjet('applicatif');
    setPriorite('normale');
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
    setFdrAnnee('AUCUNE');
    setFdrEtat('non_soumis');
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
    setBudgetExterneEur('');
    setSurFdr(true);
    setPctAvancement('0');
    setLoadMap({});
    setMonthsMap({});
    setDetailedProfils(new Set());
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

  // ─── Charge BUILD : saisie en jours totaux, répartie sur le délai build ───
  // Source de vérité stockée = j/mois (loadMap), consommée telle quelle par le
  // moteur de plan de charge. La « charge totale » est une vue dérivée :
  //   total = j/mois × délai build  ⇔  j/mois = total ÷ délai build
  const delaiNum = parseFloat(delaiProjete) || 0;
  const round1 = (n: number) => Math.round(n * 10) / 10;
  // j/mois → charge totale (j) affichée
  const totalForProfil = (profilId: string): string => {
    if (delaiNum <= 0) return '';
    const jMois = parseFloat(loadMap[profilId] || '0') || 0;
    return jMois ? String(round1(jMois * delaiNum)) : '0';
  };
  // Saisie d'une charge totale (j) → recalcule le j/mois stocké
  const setTotalForProfil = (profilId: string, totalStr: string) => {
    if (totalStr.trim() === '') {
      setLoadMap(m => ({ ...m, [profilId]: '0' }));
      return;
    }
    const total = parseFloat(totalStr);
    if (isNaN(total) || delaiNum <= 0) return;
    setLoadMap(m => ({ ...m, [profilId]: String(Math.round((total / delaiNum) * 10000) / 10000) }));
  };
  // ─── Détail mensuel de la charge build ───────────────────────────────────
  // Mois de la fenêtre build = kickoff → kickoff + délai (YYYY-MM).
  const buildMonths = useMemo<string[]>(() => {
    if (!dateKickoff || delaiNum <= 0) return [];
    const start = dateKickoff.slice(0, 7);
    return generateHorizon(start, Math.min(delaiNum, 36));
  }, [dateKickoff, delaiNum]);
  const fmtMonth = (ym: string) => {
    const [y, m] = ym.split('-');
    return `${m}/${y.slice(2)}`;
  };
  const isDetailed = (profilId: string) => detailedProfils.has(profilId);
  /** Total jours d'un profil : Σ mois si détaillé, sinon j/mois × délai. */
  const profilTotalJours = (profilId: string): number => {
    if (isDetailed(profilId)) {
      return round1(Object.values(monthsMap[profilId] ?? {}).reduce((s, v) => s + (parseFloat(v) || 0), 0));
    }
    return round1((parseFloat(loadMap[profilId] || '0') || 0) * delaiNum);
  };
  const setMonthValue = (profilId: string, ym: string, val: string) =>
    setMonthsMap(m => ({ ...m, [profilId]: { ...(m[profilId] ?? {}), [ym]: val } }));
  /** Bascule un profil entre uniforme et détaillé (pré-remplit la grille depuis le j/mois). */
  const toggleDetailed = (profilId: string) => {
    setDetailedProfils(prev => {
      const next = new Set(prev);
      if (next.has(profilId)) {
        next.delete(profilId);
      } else {
        next.add(profilId);
        const jm = loadMap[profilId] && parseFloat(loadMap[profilId]) > 0 ? loadMap[profilId] : '';
        setMonthsMap(m => {
          if (m[profilId] && Object.keys(m[profilId]).length > 0) return m; // garde l'existant
          const grid: Record<string, string> = {};
          for (const ym of buildMonths) grid[ym] = jm;
          return { ...m, [profilId]: grid };
        });
      }
      return next;
    });
  };
  // Total build cumulé (tous profils) en jours (détaillé ou uniforme)
  const totalBuildJours = round1(
    fdrProfils.filter(p => p.actif).reduce((s, p) => s + profilTotalJours(p.id), 0),
  );

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
      fdr_annee: fdrAnnee !== 'AUCUNE' ? fdrAnnee : null,
      fdr_etat: fdrAnnee === 'AUCUNE' ? 'non_soumis' : fdrEtat,
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
      // 0 (et non null) : la colonne it_projects.budget_externe_eur est NOT NULL
      // (un projet non externalisé a un budget de sous-traitance de 0).
      budget_externe_eur: budgetExterneEur ? parseFloat(budgetExterneEur) : 0,
      sur_feuille_de_route: surFdr,
      pct_avancement: parseFloat(pctAvancement) || 0,
      // `progress` est la colonne affichée dans la liste/KPI : on la garde
      // synchronisée avec la saisie manuelle (aucun trigger ne la calcule).
      progress: parseFloat(pctAvancement) || 0,
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
        .map(p => {
          const detailed = detailedProfils.has(p.id);
          const months = detailed
            ? Object.fromEntries(
                Object.entries(monthsMap[p.id] ?? {})
                  .map(([ym, v]) => [ym, parseFloat(v) || 0] as const)
                  .filter(([, v]) => v > 0),
              )
            : null;
          return { profil_id: p.id, j_mois: parseFloat(loadMap[p.id] || '0') || 0, months };
        });
      await upsertLoad.mutateAsync({ projectId: savedId, loads });
    }

    setIsSaving(false);
    onSaved?.();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-[210px_1fr] gap-6">
        {/* Navigation latérale par sections */}
        <aside className="md:sticky md:top-0 h-fit">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {SECTIONS.map(s => {
              const Icon = s.icon;
              const active = section === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSection(s.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-left whitespace-nowrap transition-colors',
                    active
                      ? 'bg-violet-100 text-violet-700'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {s.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Contenu de la section active */}
        <div className="min-w-0 space-y-4 max-w-3xl">
          {/* ───── Général ───── */}
          {section === 'general' && (
            <div className="space-y-4">
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
                  <Select value={typeProjet} onValueChange={setTypeProjet}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const opts = activeTypes.map(t => ({ value: t.value, label: t.label, icon: t.icon }));
                        if (typeProjet && !opts.some(o => o.value === typeProjet)) {
                          const r = resolveType(typeProjet);
                          opts.push({ value: typeProjet, label: r.label, icon: r.icon });
                        }
                        return opts.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.icon} {o.label}</SelectItem>
                        ));
                      })()}
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
                  <p className="text-[10px] text-muted-foreground">Le statut du projet est piloté par le « Statut portefeuille » (section Planning &amp; charge).</p>
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
            </div>
          )}

          {/* ───── Équipe ───── */}
          {section === 'equipe' && (
            <div className="space-y-4">
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
            </div>
          )}

          {/* ───── FDR ───── */}
          {section === 'fdr' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">📅 Année FDR</Label>
                  <Select value={fdrAnnee} onValueChange={(v) => { setFdrAnnee(v); if (v === 'AUCUNE') setFdrEtat('non_soumis'); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUCUNE">Aucune</SelectItem>
                      {FDR_ANNEE_OPTIONS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">📋 État FDR</Label>
                  <Select value={fdrAnnee === 'AUCUNE' ? 'non_soumis' : fdrEtat} onValueChange={(v) => setFdrEtat(v as FdrEtat)} disabled={fdrAnnee === 'AUCUNE'}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.entries(FDR_ETAT_CONFIG) as [FdrEtat, typeof FDR_ETAT_CONFIG['non_soumis']][]).map(([k, cfg]) => (
                        <SelectItem key={k} value={k}>{cfg.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
            </div>
          )}

          {/* ───── Planning & charge ───── */}
          {section === 'planning' && (
            <div className="space-y-4">
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
                      {(() => {
                        const opts = [...activiteLabels];
                        // Conserve une valeur historique non présente dans la liste paramétrée
                        if (activiteMetier && !opts.includes(activiteMetier)) opts.push(activiteMetier);
                        return opts.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>);
                      })()}
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
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Charge BUILD par profil</p>
                  {totalBuildJours > 0 && (
                    <span className="text-[11px] font-medium text-violet-700 tabular-nums">
                      Total ≈ {totalBuildJours} j build
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Saisissez la <strong>charge totale (jours)</strong> par profil. Elle est répartie sur le délai build
                  {delaiNum > 0 ? ` (${delaiNum} mois)` : ''} pour obtenir le j/mois consommé par le plan de charge.
                  Vous pouvez aussi ajuster directement le j/mois.
                </p>
                {delaiNum <= 0 && (
                  <p className="text-[11px] text-amber-600">
                    Renseignez le « Délai build projeté » ci-dessus pour saisir en jours totaux. En attendant, saisissez le j/mois.
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  « Par mois » : varier la charge d'un mois sur l'autre et/ou décaler le démarrage d'un profil
                  (le 1er mois renseigné = début). Nécessite kickoff + délai build.
                </p>
                {fdrProfils.filter(p => p.actif).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucun profil défini. Configurez les profils dans Paramètres FDR.</p>
                ) : (
                  <div className="space-y-2">
                    {fdrProfils.filter(p => p.actif).map(p => {
                      const detailed = isDetailed(p.id);
                      return (
                        <div key={p.id} className="rounded-md border border-border/40 bg-background/40 p-2 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs flex-1 truncate font-medium">{p.nom}</span>
                            {!detailed ? (
                              <>
                                <div className="flex items-center gap-1">
                                  <Input type="number" min={0} step={1} value={totalForProfil(p.id)}
                                    onChange={e => setTotalForProfil(p.id, e.target.value)}
                                    disabled={delaiNum <= 0} placeholder={delaiNum <= 0 ? '—' : '0'}
                                    className="h-7 w-20 text-right text-sm tabular-nums" />
                                  <span className="text-[10px] text-muted-foreground w-8">j tot.</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Input type="number" min={0} step={0.5} value={loadMap[p.id] ?? '0'}
                                    onChange={e => setLoadMap(m => ({ ...m, [p.id]: e.target.value }))}
                                    className="h-7 w-20 text-right text-sm tabular-nums text-muted-foreground" />
                                  <span className="text-[10px] text-muted-foreground w-10">j/mois</span>
                                </div>
                              </>
                            ) : (
                              <span className="text-xs text-violet-700 tabular-nums">{profilTotalJours(p.id)} j au total</span>
                            )}
                            <Button type="button" variant={detailed ? 'default' : 'outline'} size="sm"
                              className="h-7 px-2 text-[11px]"
                              disabled={buildMonths.length === 0}
                              title={buildMonths.length === 0 ? 'Renseignez kickoff + délai build pour détailler par mois' : undefined}
                              onClick={() => toggleDetailed(p.id)}>
                              {detailed ? 'Uniforme' : 'Par mois'}
                            </Button>
                          </div>
                          {detailed && buildMonths.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {buildMonths.map(ym => (
                                <div key={ym} className="flex flex-col items-center">
                                  <span className="text-[9px] text-muted-foreground">{fmtMonth(ym)}</span>
                                  <Input type="number" min={0} step={0.5}
                                    value={monthsMap[p.id]?.[ym] ?? ''}
                                    onChange={e => setMonthValue(p.id, ym, e.target.value)}
                                    placeholder="0"
                                    className="h-7 w-12 text-center text-xs tabular-nums px-1" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
            </div>
          )}

          {/* ───── Budget & externalisation ───── */}
          {section === 'budget' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="budget" className="flex items-center gap-1.5 text-sm">
                  <Euro className="h-3.5 w-3.5" /> Budget prévisionnel (€)
                </Label>
                <Input id="budget" type="number" placeholder="Ex: 50000" value={budgetPrevisionnel} onChange={e => setBudgetPrevisionnel(e.target.value)} className="w-48" />
              </div>

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
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Label className="text-xs shrink-0 w-40">Réduction charge interne</Label>
                      <Input type="number" min={0} max={100} step={5} value={pctReduction}
                        onChange={e => setPctReduction(e.target.value)} className="h-8 w-24 text-right" />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="text-xs shrink-0 w-40">Budget externe / ST (€)</Label>
                      <Input type="number" min={0} step={1000} placeholder="ex: 30000" value={budgetExterneEur}
                        onChange={e => setBudgetExterneEur(e.target.value)} className="h-8 w-32 text-right" />
                      <span className="text-xs text-muted-foreground">€ (COGS ROI)</span>
                    </div>
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
            </div>
          )}

          {/* ───── Microsoft 365 ───── */}
          {section === 'm365' && (
            <div className="space-y-4">
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
            </div>
          )}
        </div>
      </div>

      {/* Barre d'actions */}
      <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-3">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>Annuler</Button>
        <Button onClick={handleSubmit} disabled={!nomProjet.trim() || isSaving} className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? 'Enregistrer' : 'Créer le projet'}
        </Button>
      </div>
    </div>
  );
}
