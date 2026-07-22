/**
 * ITProjectROITab — Onglet ROI / Rentabilité d'un projet IT.
 *
 * Sections :
 *  1. Profils RH interne hors service IT (CRUD)
 *  2. Calcul ROI : COGS / RH IT / GAIN / BILAN / Temps de retour
 */
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Plus, Pencil, Trash2, Loader2, TrendingUp, Users, Euro, Clock,
  AlertCircle, CheckCircle2, Info, Timer, X, Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import type { ITProject, ITProjectRHHorsIT, ITRHHorsITUnite } from '@/types/itProject';
import type { ITProjectLoad } from '@/types/fdr';
import { computeRoi } from '@/lib/it/roiCalc';
import { RoiKpi } from '@/components/it/RoiKpi';
import {
  useITProjectRHHorsIT,
  useAddITProjectRHHorsIT,
  useUpdateITProjectRHHorsIT,
  useDeleteITProjectRHHorsIT,
} from '@/hooks/useITProjectRHHorsIT';
import { useITTjmReferentiel } from '@/hooks/useITTjmReferentiel';
import { useFdrProfils } from '@/hooks/useFdrSettings';
import { useITProjectTempsReel } from '@/hooks/useITProjectTempsReel';
import {
  useITProjectLuccaCodes, useAddITProjectLuccaCode, useDeleteITProjectLuccaCode,
} from '@/hooks/useITProjectLuccaCodes';
import {
  useITProjectTempsManuel, useAddITProjectTempsManuel, useDeleteITProjectTempsManuel,
} from '@/hooks/useITProjectTempsManuel';
import { useLuccaCodeSites } from '@/hooks/useLuccaCodeSites';
import { useActiveProfiles } from '@/hooks/useActiveProfiles';
import { SearchableSelect } from '@/components/ui/searchable-select';

// ── Formatage ──────────────────────────────────────────────────────────────

const eur = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const jours = (n: number) =>
  `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} j`;

// ── Formulaire RH hors IT ──────────────────────────────────────────────────

interface RHFormState {
  profil_label: string;
  j_build: string;
  unite: ITRHHorsITUnite;
  jours_an: string;
  jours_par_spv: string;
  nb_spv: string;
  tjm_interne: string;
  note: string;
}

const emptyForm = (): RHFormState => ({
  profil_label: '',
  j_build: '',
  unite: 'jours_an',
  jours_an: '',
  jours_par_spv: '',
  nb_spv: '',
  tjm_interne: '400',
  note: '',
});

function rhFormToPayload(f: RHFormState, projectId: string) {
  return {
    it_project_id: projectId,
    profil_label: f.profil_label.trim(),
    j_build: parseFloat(f.j_build) || null,
    unite: f.unite,
    jours_an: f.unite === 'jours_an' ? parseFloat(f.jours_an) || null : null,
    jours_par_spv: f.unite === 'jours_spv' ? parseFloat(f.jours_par_spv) || null : null,
    nb_spv: f.unite === 'jours_spv' ? parseInt(f.nb_spv) || null : null,
    tjm_interne: parseFloat(f.tjm_interne) || 0,
    note: f.note.trim() || null,
  };
}

// ── Composant principal ────────────────────────────────────────────────────

interface Props {
  project: ITProject;
  loads: ITProjectLoad[];
}

export function ITProjectROITab({ project, loads }: Props) {
  const { data: rhHorsIT = [], isLoading: rhLoading } = useITProjectRHHorsIT(project.id);
  const { data: tjmList = [], isLoading: tjmLoading } = useITTjmReferentiel();
  const { data: profils = [] } = useFdrProfils();
  const add = useAddITProjectRHHorsIT();
  const update = useUpdateITProjectRHHorsIT();
  const del = useDeleteITProjectRHHorsIT();

  // ── Temps réel (RH dépensées) ──
  const { data: tempsReel } = useITProjectTempsReel(project.id);
  const { data: luccaCodes = [] } = useITProjectLuccaCodes(project.id);
  const addLucca = useAddITProjectLuccaCode();
  const delLucca = useDeleteITProjectLuccaCode();
  const { data: tempsManuel = [] } = useITProjectTempsManuel(project.id);
  const addManuel = useAddITProjectTempsManuel();
  const delManuel = useDeleteITProjectTempsManuel();
  const { data: luccaSites = [] } = useLuccaCodeSites();
  const { data: activeProfiles = [] } = useActiveProfiles();

  const [newCode, setNewCode] = useState('');
  // Mode B : person picker (value = profile id, ou texte libre si saisi à la main)
  const [manForm, setManForm] = useState({ person: '', mois: '', jours: '', note: '' });

  const luccaOptions = useMemo(
    () => luccaSites
      .filter(s => !luccaCodes.some(c => c.code_site === s.code_site))
      .map(s => ({ value: s.code_site, label: `${s.code_site} · ${Math.round(s.jours)} j` })),
    [luccaSites, luccaCodes],
  );
  const profileOptions = useMemo(
    () => activeProfiles.map(p => ({
      value: p.id,
      label: p.job_title ? `${p.display_name} — ${p.job_title}` : p.display_name,
    })),
    [activeProfiles],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ITProjectRHHorsIT | null>(null);
  const [form, setForm] = useState<RHFormState>(emptyForm());

  const tjmMap = useMemo(
    () => Object.fromEntries(tjmList.map(t => [t.profil_code, t.tjm_eur])),
    [tjmList],
  );

  const roi = useMemo(
    () => computeRoi(project, loads, tjmMap, rhHorsIT),
    [project, loads, tjmMap, rhHorsIT],
  );

  const openAdd = () => {
    setEditTarget(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (row: ITProjectRHHorsIT) => {
    setEditTarget(row);
    setForm({
      profil_label: row.profil_label,
      j_build: row.j_build != null ? String(row.j_build) : '',
      unite: row.unite,
      jours_an: row.jours_an != null ? String(row.jours_an) : '',
      jours_par_spv: row.jours_par_spv != null ? String(row.jours_par_spv) : '',
      nb_spv: row.nb_spv != null ? String(row.nb_spv) : '',
      tjm_interne: String(row.tjm_interne),
      note: row.note ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.profil_label.trim()) {
      toast.error('Libellé du profil obligatoire'); return;
    }
    try {
      const payload = rhFormToPayload(form, project.id);
      if (editTarget) {
        await update.mutateAsync({ id: editTarget.id, projectId: project.id, ...payload });
        toast.success('Profil mis à jour');
      } else {
        await add.mutateAsync(payload);
        toast.success('Profil ajouté');
      }
      setDialogOpen(false);
    } catch (e) {
      toast.error(extractErrorMessage(e));
    }
  };

  const handleDelete = async (row: ITProjectRHHorsIT) => {
    if (!confirm(`Supprimer le profil « ${row.profil_label} » ?`)) return;
    try {
      await del.mutateAsync({ id: row.id, projectId: project.id });
      toast.success('Profil supprimé');
    } catch (e) {
      toast.error(extractErrorMessage(e));
    }
  };

  const isSaving = add.isPending || update.isPending;

  // ── Handlers temps réel ──
  const handleAddCode = async () => {
    const code = newCode.trim();
    if (!code) return;
    try {
      await addLucca.mutateAsync({ it_project_id: project.id, code_site: code });
      setNewCode('');
      toast.success(`Code « ${code} » ajouté`);
    } catch (e) {
      toast.error(extractErrorMessage(e));
    }
  };

  const handleAddManuel = async () => {
    const j = parseFloat(manForm.jours);
    if (!manForm.person.trim() || !j) {
      toast.error('Renseignez un collaborateur et un nombre de jours');
      return;
    }
    // Si la valeur correspond à un profil connu → user_id (valorisé via TJM fonction),
    // sinon on conserve le texte libre comme profil_label.
    const matched = activeProfiles.find(p => p.id === manForm.person);
    try {
      await addManuel.mutateAsync({
        it_project_id: project.id,
        user_id: matched ? matched.id : null,
        profil_label: matched ? null : manForm.person.trim(),
        mois: manForm.mois ? `${manForm.mois}-01` : null,
        jours: j,
        note: manForm.note.trim() || null,
      });
      setManForm({ person: '', mois: '', jours: '', note: '' });
      toast.success('Temps ajouté');
    } catch (e) {
      toast.error(extractErrorMessage(e));
    }
  };

  // Réel vs planifié
  const joursReel = tempsReel?.totalJours ?? 0;
  const coutReel = tempsReel?.totalCout ?? 0;
  const joursPlan = roi.total_j_build;
  const coutPlan = roi.rh_it_eur;

  // Gain annuel par ligne
  const gainByRow = (rh: ITProjectRHHorsIT) => {
    const j = rh.unite === 'jours_an'
      ? (rh.jours_an ?? 0)
      : (rh.jours_par_spv ?? 0) * (rh.nb_spv ?? 0);
    return j * rh.tjm_interne;
  };

  // Libellé du champ volume
  const volumeLabel = (rh: ITProjectRHHorsIT) => {
    if (rh.unite === 'jours_an') return jours(rh.jours_an ?? 0) + '/an';
    return `${jours(rh.jours_par_spv ?? 0)}/SPV × ${rh.nb_spv ?? 0} SPV`;
  };

  const hasTjmWarning = loads.some(l => {
    const code = l.profil?.code ?? '';
    return (tjmMap[code] ?? 0) === 0;
  });

  return (
    <div className="space-y-6">
      {/* ── Section 1 : RH hors IT ─────────────────────────────────────── */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-violet-500" />
            Profils RH interne hors service IT
            {!rhLoading && rhHorsIT.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{rhHorsIT.length}</Badge>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Ressources internes hors IT mobilisées sur le projet (chef de projet métier,
            référents, formateurs…). Les économies ETP sont valorisées pour le calcul ROI.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {rhLoading ? (
            <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : rhHorsIT.length > 0 ? (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>Profil</TableHead>
                    <TableHead className="text-right">J. Build</TableHead>
                    <TableHead>Gain ETP / an</TableHead>
                    <TableHead className="text-right">TJM interne</TableHead>
                    <TableHead className="text-right">Coût build</TableHead>
                    <TableHead className="text-right">Gain annuel</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="w-[72px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rhHorsIT.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-sm">{row.profil_label}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-violet-600">
                        {(row.j_build ?? 0) > 0 ? jours(row.j_build!) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground tabular-nums">
                        {volumeLabel(row)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {eur(row.tjm_interne)}/j
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-violet-600">
                        {(row.j_build ?? 0) > 0
                          ? eur((row.j_build!) * row.tjm_interne)
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-semibold text-emerald-600">
                        {gainByRow(row) > 0 ? eur(gainByRow(row)) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.note ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(row)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(row)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Aucun profil RH hors IT renseigné.
            </div>
          )}
          <Button variant="outline" size="sm" onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" />Ajouter un profil
          </Button>
        </CardContent>
      </Card>

      {/* ── Section 2 : Calcul ROI ─────────────────────────────────────── */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            Calcul ROI / Rentabilité
          </CardTitle>
          {hasTjmWarning && (
            <div className="flex items-center gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-700 mt-1">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Certains profils du plan de charge n'ont pas de TJM renseigné — configurer dans
              <strong className="ml-1">Params FDR → TJM référentiel</strong>.
            </div>
          )}
        </CardHeader>
        <CardContent>
          {tjmLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="space-y-4">
              {/* Détail charges RH IT */}
              {loads.length > 0 && (
                <div className="rounded-lg border overflow-hidden">
                  <div className="bg-muted/30 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Charge BUILD par profil IT
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/10 hover:bg-muted/10">
                        <TableHead>Profil</TableHead>
                        <TableHead className="text-right">j/mois</TableHead>
                        <TableHead className="text-right">Durée build</TableHead>
                        <TableHead className="text-right">J total</TableHead>
                        <TableHead className="text-right">TJM</TableHead>
                        <TableHead className="text-right">Coût RH</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loads.map(l => {
                        const code = l.profil?.code ?? '';
                        const tjm = tjmMap[code] ?? 0;
                        // Tâche permanente = coût annuel (× 12 mois) ; sinon durée totale du projet.
                        const isPermanent = project.statut_portefeuille === 'Tâche permanente';
                        const monthsFactor = isPermanent ? 12 : (project.delai_projete_mois ?? 0);
                        const jTotal = l.j_mois * monthsFactor;
                        const cout = jTotal * tjm;
                        return (
                          <TableRow key={l.id}>
                            <TableCell className="text-sm">{l.profil?.nom ?? code}</TableCell>
                            <TableCell className="text-right tabular-nums text-sm">{l.j_mois} j</TableCell>
                            <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                              {monthsFactor ? `× ${monthsFactor} mois${isPermanent ? ' (annuel)' : ''}` : '—'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm font-medium">
                              {monthsFactor ? jours(jTotal) : '—'}
                            </TableCell>
                            <TableCell className={cn('text-right tabular-nums text-sm', tjm === 0 && 'text-amber-500')}>
                              {tjm > 0 ? `${eur(tjm)}/j` : '—'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm font-semibold">
                              {tjm > 0 && monthsFactor > 0 ? eur(cout) : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Tableau synthèse ROI */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <RoiKpi
                  label="COGS (si ST)"
                  value={eur(roi.cogs_eur)}
                  sub={project.budget_externe_eur != null ? 'budget externe' : 'non renseigné'}
                  color="text-blue-600"
                  icon={<Euro className="h-4 w-4" />}
                />
                <RoiKpi
                  label="Coût RH IT"
                  value={eur(roi.rh_it_eur)}
                  sub={roi.total_j_build > 0 ? `${jours(roi.total_j_build)} build` : 'aucune charge'}
                  color="text-violet-600"
                  icon={<Users className="h-4 w-4" />}
                />
                <RoiKpi
                  label="Gain annuel ETP"
                  value={eur(roi.gain_annuel_eur)}
                  sub={rhHorsIT.length > 0 ? `${rhHorsIT.length} profil${rhHorsIT.length > 1 ? 's' : ''}` : 'aucun profil'}
                  color="text-emerald-600"
                  icon={<TrendingUp className="h-4 w-4" />}
                />
                <RoiKpi
                  label="BILAN annuel"
                  value={eur(roi.bilan_annuel_eur)}
                  sub="Gain − COGS − RH"
                  color={roi.bilan_annuel_eur >= 0 ? 'text-emerald-600' : 'text-red-600'}
                  icon={roi.bilan_annuel_eur >= 0
                    ? <CheckCircle2 className="h-4 w-4" />
                    : <AlertCircle className="h-4 w-4" />}
                  highlight
                />
                <RoiKpi
                  label="Temps de retour"
                  value={roi.temps_retour_an != null
                    ? `${roi.temps_retour_an.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} an${roi.temps_retour_an >= 2 ? 's' : ''}`
                    : '—'}
                  sub={roi.temps_retour_an != null ? `${Math.round(roi.temps_retour_an * 12)} mois` : 'gain nul'}
                  color={roi.temps_retour_an != null && roi.temps_retour_an <= 2 ? 'text-emerald-600'
                    : roi.temps_retour_an != null ? 'text-amber-600' : 'text-muted-foreground'}
                  icon={<Clock className="h-4 w-4" />}
                />
              </div>

              {(roi.rh_it_eur === 0 && roi.gain_annuel_eur === 0) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="h-4 w-4 shrink-0" />
                  Renseignez la charge build (plan de charge), les TJM référentiel et les profils RH
                  hors IT pour obtenir le calcul ROI complet.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 3 : RH dépensées (réel) ────────────────────────────── */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Timer className="h-5 w-5 text-blue-500" />
            RH dépensées (réel)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Temps réellement passé sur le projet : déclarations Lucca rapprochées par code
            d'imputation (Mode A) + répartition manuelle pour les projets génériques (Mode B).
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* KPI réel vs planifié */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <RoiKpi label="Jours réels" value={jours(joursReel)}
              sub={`Lucca ${jours(tempsReel?.joursLucca ?? 0)} · manuel ${jours(tempsReel?.joursManuel ?? 0)}`}
              color="text-blue-600" icon={<Timer className="h-4 w-4" />} />
            <RoiKpi label="Jours planifiés" value={joursPlan > 0 ? jours(joursPlan) : '—'}
              sub="build (plan de charge)" color="text-violet-600" icon={<Users className="h-4 w-4" />} />
            <RoiKpi label="Coût RH réel" value={eur(coutReel)}
              sub="valorisé TJM fonction" color="text-blue-600" icon={<Euro className="h-4 w-4" />} />
            <RoiKpi label="Écart vs planifié"
              value={joursPlan > 0 ? jours(joursReel - joursPlan) : '—'}
              sub={coutPlan > 0 ? `${eur(coutReel - coutPlan)}` : 'plan non chiffré'}
              color={joursReel <= joursPlan || joursPlan === 0 ? 'text-emerald-600' : 'text-amber-600'}
              icon={<TrendingUp className="h-4 w-4" />} highlight />
          </div>

          {/* Détail par collaborateur */}
          {(tempsReel?.parCollaborateur.length ?? 0) > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-muted/30 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Détail par collaborateur
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/10 hover:bg-muted/10">
                    <TableHead>Collaborateur</TableHead>
                    <TableHead className="text-right">Jours</TableHead>
                    <TableHead className="text-right">Coût RH</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tempsReel!.parCollaborateur.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{c.collaborateur}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{jours(c.jours)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        {c.cout > 0 ? eur(c.cout) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Mode A : codes d'imputation Lucca */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5" /> Codes d'imputation Lucca (Mode A — par code projet)
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {luccaCodes.map(c => (
                <Badge key={c.id} variant="secondary" className="gap-1 font-mono">
                  {c.code_site}
                  <button
                    onClick={() => delLucca.mutate({ id: c.id, projectId: project.id })}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {luccaCodes.length === 0 && (
                <span className="text-xs text-muted-foreground">Aucun code rapproché.</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-80">
                <SearchableSelect
                  value={newCode}
                  onValueChange={setNewCode}
                  options={luccaOptions}
                  placeholder="Choisir un code Lucca (préfixe S/R)…"
                  searchPlaceholder="Rechercher un code…"
                  emptyMessage="Aucun code disponible"
                  allowCustom
                  customPlaceholder="Saisir un code à la main"
                  triggerClassName="h-8 text-xs font-mono"
                />
              </div>
              <Button size="sm" variant="outline" onClick={handleAddCode} disabled={addLucca.isPending || !newCode} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Ajouter
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Les temps IT sont déclarés sous des codes entité/activité (ex : SDEVE000, SEXPL000,
              RGENE000). Rattachez le ou les codes correspondant à ce projet.
            </p>
          </div>

          {/* Mode B : saisie manuelle */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Répartition manuelle (Mode B — projets génériques)
            </p>
            {tempsManuel.length > 0 && (
              <div className="rounded-md border overflow-hidden bg-background">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/10 hover:bg-muted/10">
                      <TableHead>Collaborateur / profil</TableHead>
                      <TableHead>Mois</TableHead>
                      <TableHead className="text-right">Jours</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead className="w-[44px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tempsManuel.map(row => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm">
                          {row.profil_label
                            ?? activeProfiles.find(p => p.id === row.user_id)?.display_name
                            ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">{row.mois ? row.mois.slice(0, 7) : '—'}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{jours(row.jours)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.note ?? '—'}</TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => delManuel.mutate({ id: row.id, projectId: project.id })}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_130px_90px_auto] gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Collaborateur</Label>
                <SearchableSelect
                  value={manForm.person}
                  onValueChange={v => setManForm(f => ({ ...f, person: v }))}
                  options={profileOptions}
                  placeholder="Choisir un collaborateur…"
                  searchPlaceholder="Rechercher…"
                  emptyMessage="Aucun collaborateur"
                  allowCustom
                  customPlaceholder="Saisir un libellé"
                  triggerClassName="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mois</Label>
                <Input type="month" value={manForm.mois}
                  onChange={e => setManForm(f => ({ ...f, mois: e.target.value }))} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Jours</Label>
                <Input type="number" min={0} step={0.5} placeholder="ex : 3" value={manForm.jours}
                  onChange={e => setManForm(f => ({ ...f, jours: e.target.value }))} className="h-8" />
              </div>
              <Button size="sm" variant="outline" onClick={handleAddManuel} disabled={addManuel.isPending} className="gap-1 h-8">
                <Plus className="h-3.5 w-3.5" /> Ajouter
              </Button>
            </div>
            <Input placeholder="Note (optionnel)" value={manForm.note}
              onChange={e => setManForm(f => ({ ...f, note: e.target.value }))} className="h-8" />
          </div>
        </CardContent>
      </Card>

      {/* ── Dialog ajout / édition ─────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? 'Modifier le profil RH' : 'Ajouter un profil RH hors IT'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="profil_label">Profil / fonction</Label>
              <Input
                id="profil_label"
                placeholder="Chef de projet métier, Référent RH, Formateur…"
                value={form.profil_label}
                onChange={e => setForm(f => ({ ...f, profil_label: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="j_build">Jours de BUILD (participation au projet)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="j_build"
                  type="number"
                  min={0}
                  step={0.5}
                  placeholder="ex : 20"
                  value={form.j_build}
                  onChange={e => setForm(f => ({ ...f, j_build: e.target.value }))}
                  className="w-36"
                />
                <span className="text-sm text-muted-foreground">jours (one-shot)</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Temps passé sur le build (ex : chef de projet métier). S'ajoute au coût RH du projet.
              </p>
            </div>

            <Separator />

            <div className="space-y-1">
              <Label>Unité de mesure de l'économie ETP</Label>
              <Select value={form.unite} onValueChange={v => setForm(f => ({ ...f, unite: v as ITRHHorsITUnite }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jours_an">Jours / an (ETP annuel)</SelectItem>
                  <SelectItem value="jours_spv">Jours / SPV × nombre de SPV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.unite === 'jours_an' ? (
              <div className="space-y-1">
                <Label htmlFor="jours_an">Économie (jours/an)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="jours_an"
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="ex : 15"
                    value={form.jours_an}
                    onChange={e => setForm(f => ({ ...f, jours_an: e.target.value }))}
                    className="w-36"
                  />
                  <span className="text-sm text-muted-foreground">j/an</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="jours_par_spv">Jours / SPV</Label>
                  <Input
                    id="jours_par_spv"
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="ex : 2"
                    value={form.jours_par_spv}
                    onChange={e => setForm(f => ({ ...f, jours_par_spv: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="nb_spv">Nombre de SPV / an</Label>
                  <Input
                    id="nb_spv"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="ex : 8"
                    value={form.nb_spv}
                    onChange={e => setForm(f => ({ ...f, nb_spv: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="tjm_interne">TJM interne (€/j)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="tjm_interne"
                  type="number"
                  min={0}
                  step={10}
                  placeholder="400"
                  value={form.tjm_interne}
                  onChange={e => setForm(f => ({ ...f, tjm_interne: e.target.value }))}
                  className="w-36"
                />
                <span className="text-sm text-muted-foreground">€/jour</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Coût journalier interne estimé (charges incluses / TJM marché).
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="note">Note (optionnel)</Label>
              <Textarea
                id="note"
                placeholder="Précisions sur le rôle, les hypothèses…"
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editTarget ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

