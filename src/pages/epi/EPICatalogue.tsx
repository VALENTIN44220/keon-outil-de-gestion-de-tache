import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ShoppingBag, Search, Plus, FileText, Loader2 } from 'lucide-react';
import { useEPICatalogue } from '@/hooks/useEPICatalogue';
import { cn } from '@/lib/utils';
import type { EPICategorie, EPICatalogueItem } from '@/types/epi';
import { EPI_CATEGORIE_LABELS, EPI_CATEGORIES } from '@/types/epi';

const fmtEur = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

export default function EPICatalogue() {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('epi-catalogue');
  const [search, setSearch] = useState('');
  const [categorie, setCategorie] = useState<EPICategorie | 'all'>('all');

  const { articles, isLoading } = useEPICatalogue(
    undefined,
    categorie !== 'all' ? categorie : undefined,
  );

  const filtered = search.trim()
    ? articles.filter(a =>
        a.designation.toLowerCase().includes(search.toLowerCase()) ||
        (a.norme ?? '').toLowerCase().includes(search.toLowerCase()) ||
        a.tailles.some(t => t.ref_sycomore?.toLowerCase().includes(search.toLowerCase())),
      )
    : articles;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Catalogue EPI" searchQuery="" onSearchChange={() => {}} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10">
                  <ShoppingBag className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-display font-bold">Catalogue EPI</h1>
                  <p className="text-sm text-muted-foreground">
                    {articles.length} articles disponibles
                  </p>
                </div>
              </div>
              <Button onClick={() => navigate('/epi/new')}>
                <Plus className="h-4 w-4 mr-2" /> Faire une demande
              </Button>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 h-9"
                  placeholder="Rechercher un article, norme ou référence…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <Tabs value={categorie} onValueChange={(v) => setCategorie(v as EPICategorie | 'all')}>
              <TabsList>
                <TabsTrigger value="all">Tous</TabsTrigger>
                {EPI_CATEGORIES.map(c => (
                  <TabsTrigger key={c} value={c}>{EPI_CATEGORIE_LABELS[c]}</TabsTrigger>
                ))}
              </TabsList>

              {isLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  Aucun article trouvé.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
                  {filtered.map((art) => (
                    <CatalogueCard key={art.id} article={art} />
                  ))}
                </div>
              )}
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}

function CatalogueCard({ article: art }: { article: EPICatalogueItem }) {
  const [expanded, setExpanded] = useState(false);

  const prixMin = art.tailles.length > 0 ? Math.min(...art.tailles.map(t => t.prix_achat)) : 0;
  const prixMax = art.tailles.length > 0 ? Math.max(...art.tailles.map(t => t.prix_achat)) : 0;
  const prixLabel = prixMin === prixMax
    ? fmtEur(prixMin)
    : `${fmtEur(prixMin)} – ${fmtEur(prixMax)}`;

  return (
    <Card
      className={cn('cursor-pointer transition-all hover:shadow-md', expanded && 'ring-1 ring-amber-300')}
      onClick={() => setExpanded(!expanded)}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-tight">{art.designation}</p>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {EPI_CATEGORIE_LABELS[art.categorie] ?? art.categorie}
          </Badge>
        </div>

        {art.norme && (
          <p className="text-xs text-muted-foreground">{art.norme}</p>
        )}

        <p className="text-sm font-mono text-amber-700">{prixLabel} HT</p>

        {art.type_flocage && art.type_flocage !== 'aucun' && (
          <p className="text-[10px] text-muted-foreground">
            Flocage : {art.type_flocage.replace('_', ' ')} ({fmtEur(art.prix_flocage ?? 0)})
          </p>
        )}

        {expanded && (
          <div className="pt-2 border-t space-y-2 text-xs">
            {art.caracteristiques && (
              <p className="text-muted-foreground">{art.caracteristiques}</p>
            )}
            {art.frequence_renouvellement && (
              <p className="text-muted-foreground">
                Renouvellement : {art.frequence_renouvellement}
              </p>
            )}
            <div>
              <p className="font-medium mb-1">Tailles disponibles :</p>
              <div className="flex flex-wrap gap-1">
                {art.tailles.map(t => (
                  <Badge key={t.id} variant="secondary" className="text-[10px]">
                    {t.taille} — {fmtEur(t.prix_achat)}
                  </Badge>
                ))}
              </div>
            </div>
            {art.fiche_technique_url && (
              <a
                href={art.fiche_technique_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <FileText className="h-3 w-3" /> Fiche technique
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
