import { useState, useMemo } from 'react';
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
import { HardHat, Save, X, Plus, Minus, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useEPICatalogue } from '@/hooks/useEPICatalogue';
import type { EPIProfil, EPITypeDemande, EPICatalogueItem, EPICategorie } from '@/types/epi';
import {
  EPI_PROFIL_LABELS, EPI_TYPE_DEMANDE_LABELS, EPI_CATEGORIE_LABELS, EPI_PROFILS,
} from '@/types/epi';

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
  const [nom, setNom] = useState(profile?.display_name?.split(' ').slice(1).join(' ') ?? '');
  const [prenom, setPrenom] = useState(profile?.display_name?.split(' ')[0] ?? '');
  const [filiale, setFiliale] = useState('');
  const [justification, setJustification] = useState('');
  const [lines, setLines] = useState<SelectedLine[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { articles, isLoading: catalogueLoading } = useEPICatalogue(
    profilEpi || undefined,
    categorieFilter !== '__all__' ? categorieFilter : undefined,
  );

  const filteredArticles = articles;

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
    nom.trim().length > 0 &&
    prenom.trim().length > 0 &&
    profilEpi !== '' &&
    lines.length > 0 &&
    (typeDemande !== 'ponctuelle' || justification.trim().length > 0);

  const handleSubmit = async () => {
    if (!profile?.id || !user || !canSubmit) return;
    setIsSubmitting(true);
    try {
      const title = `EPI ${typeDemande === 'dotation_annuelle' ? 'Dotation' : 'Ponctuelle'} — ${prenom.trim()} ${nom.trim()}`;

      const moduleData: Record<string, any> = {
        type_demande: typeDemande,
        profil_epi: profilEpi,
        nom: nom.trim(),
        prenom: prenom.trim(),
        filiale: filiale || null,
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
          user_id: user.id,
          module_code: 'epi' as any,
          module_data: moduleData,
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
                  Sélectionnez votre profil EPI puis choisissez vos équipements
                </p>
              </div>
            </div>

            {/* Infos collaborateur */}
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label>Prénom *</Label>
                    <Input value={prenom} onChange={(e) => setPrenom(e.target.value)} disabled={isSubmitting} />
                  </div>
                  <div>
                    <Label>Nom *</Label>
                    <Input value={nom} onChange={(e) => setNom(e.target.value)} disabled={isSubmitting} />
                  </div>
                  <div>
                    <Label>Filiale</Label>
                    <Input value={filiale} onChange={(e) => setFiliale(e.target.value)} disabled={isSubmitting} />
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
                      placeholder="Raison de la demande ponctuelle…"
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
                  ) : filteredArticles.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">Aucun article pour ce profil.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredArticles.map((art) => (
                        <ArticleCard
                          key={art.id}
                          article={art}
                          selectedLines={lines.filter(l => l.articleId === art.id)}
                          onAdd={(tailleId) => addLine(art, tailleId)}
                          disabled={isSubmitting}
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
                            {l.refSycomore} — Taille {l.taille} — {fmtEur(l.prixUnitaire + l.prixFlocage)} /u
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
                        <span className="text-sm font-mono w-20 text-right">
                          {fmtEur(l.quantite * (l.prixUnitaire + l.prixFlocage))}
                        </span>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                          onClick={() => removeLine(idx)} disabled={isSubmitting}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end pt-2 border-t text-lg font-semibold">
                    Total : {fmtEur(total)}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pb-8">
              <Button variant="outline" onClick={() => navigate('/epi/dispatch')} disabled={isSubmitting}>
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
  article: art, selectedLines, onAdd, disabled,
}: {
  article: EPICatalogueItem;
  selectedLines: SelectedLine[];
  onAdd: (tailleId: string) => void;
  disabled: boolean;
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
      <Badge variant="outline" className="text-xs">
        {EPI_CATEGORIE_LABELS[art.categorie] ?? art.categorie}
      </Badge>
      <p className="text-xs text-muted-foreground">{prixRange}</p>
      <div className="flex gap-2">
        {art.tailles.length > 1 ? (
          <Select value={selectedTaille} onValueChange={setSelectedTaille} disabled={disabled}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Taille…" />
            </SelectTrigger>
            <SelectContent>
              {art.tailles.map(t => (
                <SelectItem key={t.id} value={t.id} className="text-xs">
                  {t.taille} — {fmtEur(t.prix_achat)}
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
