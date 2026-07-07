import { useState, useMemo, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { HardHat, Save, X, Plus, Minus, ShoppingBag, CalendarIcon, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useEPICatalogue } from '@/hooks/useEPICatalogue';
import { usePermissionsContext } from '@/contexts/PermissionsContext';
import type { EPIProfil, EPITypeDemande, EPICatalogueItem, EPICategorie } from '@/types/epi';
import {
  EPI_PROFIL_LABELS, EPI_TYPE_DEMANDE_LABELS, EPI_CATEGORIE_LABELS, EPI_PROFILS,
} from '@/types/epi';

const EPI_PROCESS_TEMPLATE_ID = '11111111-1111-4111-8111-111111111301';
const EPI_SUB_PROCESS_TEMPLATE_ID = '22222222-2222-4222-8222-222222222301';

interface SelectedLine {
  articleId: string;
  tailleId: string;
  taille: string;
  quantite: number;
  prixUnitaire: number;
  prixFlocage: number;
  designation: string;
  refSycomore: string;
}

interface ProfileOption {
  id: string;
  display_name: string;
  company: string | null;
}

const fmtEur = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

export default function NewEPIRequest() {
  const navigate = useNavigate();
  const { profile: authProfile, user } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const profile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;

  const [activeView, setActiveView] = useState('epi-dispatch');
  const [typeDemande, setTypeDemande] = useState<EPITypeDemande>('ponctuelle');
  const [profilEpi, setProfilEpi] = useState<EPIProfil | ''>('');
  const [categorieFilter, setCategorieFilter] = useState<EPICategorie | '__all__'>('__all__');
  const [beneficiaireId, setBeneficiaireId] = useState(profile?.id ?? '');
  const [filiale, setFiliale] = useState((profile as any)?.company ?? '');
  const [dateSouhaitee, setDateSouhaitee] = useState('');
  const [justification, setJustification] = useState('');
  const [lines, setLines] = useState<SelectedLine[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [allProfiles, setAllProfiles] = useState<ProfileOption[]>([]);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, display_name, company')
      .order('display_name')
      .then(({ data }) => setAllProfiles((data as ProfileOption[]) ?? []));
  }, []);

  useEffect(() => {
    if (!beneficiaireId || allProfiles.length === 0) return;
    const p = allProfiles.find(x => x.id === beneficiaireId);
    if (p?.company) setFiliale(p.company);
  }, [beneficiaireId, allProfiles]);

  // Pre-select beneficiaire to current user
  useEffect(() => {
    if (profile?.id && !beneficiaireId) setBeneficiaireId(profile.id);
  }, [profile?.id]);

  const { effectivePermissions } = usePermissionsContext();
  const showPrices = effectivePermissions.can_manage_epi;

  const selectedBeneficiaire = allProfiles.find(p => p.id === beneficiaireId);

  const { articles, isLoading: catalogueLoading } = useEPICatalogue(
    profilEpi || undefined,
    categorieFilter !== '__all__' ? categorieFilter : undefined,
  );

  const total = useMemo(
    () => lines.reduce((s, l) => s + l.quantite * (l.prixUnitaire + l.prixFlocage), 0),
    [lines],
  );

  const addLine = (art: EPICatalogueItem, tailleId: string) => {
    const t = art.tailles.find(x => x.id === tailleId);
    if (!t) return;
    const existing = lines.find(l => l.articleId === art.id && l.tailleId === tailleId);
    if (existing) {
      setLines(prev => prev.map(l =>
        l.articleId === art.id && l.tailleId === tailleId
          ? { ...l, quantite: l.quantite + 1 }
          : l,
      ));
      return;
    }
    setLines(prev => [...prev, {
      articleId: art.id,
      tailleId,
      taille: t.taille,
      quantite: 1,
      prixUnitaire: t.prix_achat,
      prixFlocage: art.prix_flocage ?? 0,
      designation: art.designation,
      refSycomore: t.ref_sycomore ?? '',
    }]);
  };

  const updateQty = (idx: number, delta: number) => {
    setLines(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], quantite: Math.max(0, next[idx].quantite + delta) };
      return next.filter(l => l.quantite > 0);
    });
  };

  const removeLine = (idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  const canSubmit =
    !isSubmitting &&
    beneficiaireId.length > 0 &&
    profilEpi !== '' &&
    lines.length > 0 &&
    (typeDemande !== 'ponctuelle' || justification.trim().length > 0);

  const handleSubmit = async () => {
    if (!profile?.id || !user || !canSubmit) return;
    setIsSubmitting(true);
    try {
      const benef = allProfiles.find(p => p.id === beneficiaireId);
      const benefNom = benef?.display_name ?? '';
      const title = `EPI ${typeDemande === 'dotation_annuelle' ? 'Dotation' : 'Ponctuelle'} — ${benefNom}`;

      // Résoudre l'assignataire par défaut depuis le sub_process_template
      let defaultAssigneeId: string | null = null;
      const { data: spData } = await supabase
        .from('sub_process_templates' as any)
        .select('target_assignee_id')
        .eq('id', EPI_SUB_PROCESS_TEMPLATE_ID)
        .single();
      if (spData?.target_assignee_id) {
        defaultAssigneeId = spData.target_assignee_id;
      }

      const moduleData: Record<string, any> = {
        type_demande: typeDemande,
        profil_epi: profilEpi,
        beneficiaire_id: beneficiaireId,
        beneficiaire_nom: benefNom.split(' ').slice(1).join(' ') || benefNom,
        beneficiaire_prenom: benefNom.split(' ')[0] || '',
        filiale: filiale || null,
        date_souhaitee: dateSouhaitee || null,
        justification: justification || null,
      };

      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          type: 'request',
          status: 'todo',
          title,
          description: justification || null,
          requester_id: profile.id,
          assignee_id: defaultAssigneeId,
          user_id: user.id,
          due_date: dateSouhaitee || null,
          module_code: 'epi' as any,
          module_data: moduleData,
          source_process_template_id: EPI_PROCESS_TEMPLATE_ID,
        })
        .select('id')
        .single();

      if (error || !task) throw error ?? new Error('Erreur création demande');

      const lignesInsert = lines.map(l => ({
        request_id: task.id,
        article_id: l.articleId,
        taille_id: l.tailleId,
        quantite: l.quantite,
        prix_unitaire: l.prixUnitaire,
        prix_flocage: l.prixFlocage,
        statut: 'en_attente',
      }));

      const { error: lErr } = await supabase
        .from('epi_demande_lignes' as any)
        .insert(lignesInsert);
      if (lErr) throw lErr;

      toast.success('Demande EPI créée');
      navigate('/epi/dispatch');
    } catch (e: any) {
      console.error('NewEPIRequest:', e);
      toast.error(`Erreur : ${e.message ?? 'inconnue'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Nouvelle demande EPI" searchQuery="" onSearchChange={() => {}} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10">
                <HardHat className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold">Nouvelle demande EPI</h1>
                <p className="text-sm text-muted-foreground">
                  Sélectionnez le bénéficiaire, le profil EPI puis choisissez les équipements
                </p>
              </div>
            </div>

            {/* Infos demande */}
            <Card>
              <CardContent className="pt-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Type de demande *</Label>
                    <Select
                      value={typeDemande}
                      onValueChange={(v) => setTypeDemande(v as EPITypeDemande)}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(EPI_TYPE_DEMANDE_LABELS).map(([k, label]) => (
                          <SelectItem key={k} value={k}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Profil EPI *</Label>
                    <Select
                      value={profilEpi}
                      onValueChange={(v) => { setProfilEpi(v as EPIProfil); setLines([]); }}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger><SelectValue placeholder="Sélectionner un profil…" /></SelectTrigger>
                      <SelectContent>
                        {EPI_PROFILS.filter(p => p !== 'non_concerne').map(p => (
                          <SelectItem key={p} value={p}>{EPI_PROFIL_LABELS[p]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Demandeur</Label>
                    <Input
                      value={profile?.display_name ?? ''}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Vous (connecté)</p>
                  </div>
                  <div>
                    <Label>Bénéficiaire des EPI *</Label>
                    <Select
                      value={beneficiaireId}
                      onValueChange={setBeneficiaireId}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un collaborateur…" />
                      </SelectTrigger>
                      <SelectContent>
                        {allProfiles.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.display_name}{p.company ? ` (${p.company})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Par défaut : vous-même. Changez pour une demande au nom d'un autre collaborateur.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Filiale</Label>
                    <Input
                      value={filiale}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Remplie automatiquement depuis le profil du bénéficiaire</p>
                  </div>
                  <div>
                    <Label className="flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      Date souhaitée de réception
                    </Label>
                    <Input
                      type="date"
                      value={dateSouhaitee}
                      onChange={(e) => setDateSouhaitee(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {typeDemande === 'ponctuelle' && (
                  <div>
                    <Label>Justification *</Label>
                    <Textarea
                      rows={2}
                      value={justification}
                      onChange={(e) => setJustification(e.target.value)}
                      disabled={isSubmitting}
                      placeholder="Raison de la demande ponctuelle (nouvel arrivant, remplacement…)"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sélection d'articles */}
            {profilEpi && (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <ShoppingBag className="h-5 w-5" /> Articles éligibles
                    </h2>
                    <Select
                      value={categorieFilter}
                      onValueChange={(v) => setCategorieFilter(v as EPICategorie | '__all__')}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Toutes catégories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Toutes catégories</SelectItem>
                        {Object.entries(EPI_CATEGORIE_LABELS).map(([k, label]) => (
                          <SelectItem key={k} value={k}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {catalogueLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Chargement du catalogue…</div>
                  ) : articles.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">Aucun article pour ce profil.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {articles.map((art) => (
                        <ArticleCard
                          key={art.id}
                          article={art}
                          selectedLines={lines.filter(l => l.articleId === art.id)}
                          onAdd={(tailleId) => addLine(art, tailleId)}
                          disabled={isSubmitting}
                          showPrices={showPrices}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Récapitulatif panier */}
            {lines.length > 0 && (
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <h2 className="text-lg font-semibold">Récapitulatif ({lines.length} article{lines.length > 1 ? 's' : ''})</h2>
                  <div className="divide-y">
                    {lines.map((l, idx) => (
                      <div key={`${l.articleId}-${l.tailleId}`} className="flex items-center gap-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{l.designation}</p>
                          <p className="text-xs text-muted-foreground">
                            {l.refSycomore} — Taille {l.taille}{showPrices ? ` — ${fmtEur(l.prixUnitaire + l.prixFlocage)} /u` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => updateQty(idx, -1)} disabled={isSubmitting}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm font-medium">{l.quantite}</span>
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => updateQty(idx, 1)} disabled={isSubmitting}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        {showPrices && (
                          <span className="text-sm font-mono w-20 text-right">
                            {fmtEur(l.quantite * (l.prixUnitaire + l.prixFlocage))}
                          </span>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                          onClick={() => removeLine(idx)} disabled={isSubmitting}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  {showPrices && (
                    <div className="flex justify-end pt-2 border-t text-lg font-semibold">
                      Total : {fmtEur(total)}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pb-8">
              <Button variant="outline" onClick={() => navigate(-1)} disabled={isSubmitting}>
                <X className="h-4 w-4 mr-2" /> Annuler
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Création…' : 'Soumettre la demande'}
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function ArticleCard({
  article: art, selectedLines, onAdd, disabled, showPrices,
}: {
  article: EPICatalogueItem;
  selectedLines: SelectedLine[];
  onAdd: (tailleId: string) => void;
  disabled: boolean;
  showPrices: boolean;
}) {
  const [selectedTaille, setSelectedTaille] = useState(
    art.tailles.length === 1 ? art.tailles[0].id : '',
  );

  const prixRange = art.tailles.length > 0
    ? `${fmtEur(Math.min(...art.tailles.map(t => t.prix_achat)))} – ${fmtEur(Math.max(...art.tailles.map(t => t.prix_achat)))}`
    : '—';

  const qtyInCart = selectedLines.reduce((s, l) => s + l.quantite, 0);

  return (
    <div className={cn(
      'border rounded-lg p-3 space-y-2 transition-colors',
      qtyInCart > 0 ? 'border-amber-400 bg-amber-50/50' : 'hover:border-muted-foreground/30',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium leading-tight">{art.designation}</p>
          {art.norme && (
            <p className="text-xs text-muted-foreground mt-0.5">{art.norme}</p>
          )}
        </div>
        {qtyInCart > 0 && (
          <Badge variant="default" className="bg-amber-500 text-white shrink-0">
            {qtyInCart}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {EPI_CATEGORIE_LABELS[art.categorie] ?? art.categorie}
        </Badge>
        {art.fiche_technique_url && (
          <a
            href={art.fiche_technique_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <FileText className="h-3 w-3" /> Fiche
          </a>
        )}
      </div>
      {showPrices && <p className="text-xs text-muted-foreground">{prixRange}</p>}
      <div className="flex gap-2">
        {art.tailles.length > 1 ? (
          <Select value={selectedTaille} onValueChange={setSelectedTaille} disabled={disabled}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Taille…" />
            </SelectTrigger>
            <SelectContent>
              {art.tailles.map(t => (
                <SelectItem key={t.id} value={t.id} className="text-xs">
                  {t.taille}{showPrices ? ` — ${fmtEur(t.prix_achat)}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground flex-1 flex items-center">
            Taille unique
          </span>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          disabled={disabled || !selectedTaille}
          onClick={() => { if (selectedTaille) onAdd(selectedTaille); }}
        >
          <Plus className="h-3 w-3 mr-1" /> Ajouter
        </Button>
      </div>
    </div>
  );
}
