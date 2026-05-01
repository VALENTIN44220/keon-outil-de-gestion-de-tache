import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Search,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Filter,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import {
  useBEDivaltoAffairesToImport,
  useImportBEDivaltoAffaires,
  type BEDivaltoAffaireToImport,
} from '@/hooks/useBEDivaltoImport';

const eur = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export default function BEAdminDivaltoImport() {
  const navigate = useNavigate();
  const { data: rows = [], isLoading } = useBEDivaltoAffairesToImport();
  const importMut = useImportBEDivaltoAffaires();

  const [search, setSearch] = useState('');
  const [hideOrphans, setHideOrphans] = useState(true);
  const [hideZeroAmount, setHideZeroAmount] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  // Categories disponibles (tirees des donnees, sorted)
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.categorie);
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (hideOrphans && !r.parent_project_exists) return false;
      if (hideZeroAmount && r.montant_total === 0) return false;
      if (selectedCategories.size > 0 && !selectedCategories.has(r.categorie)) return false;
      if (q) {
        const hay = `${r.code_affaire} ${r.libelle_principal ?? ''} ${r.code_projet_parent ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, hideOrphans, hideZeroAmount, selectedCategories]);

  // Actions de selection
  const toggleCode = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedCodes((prev) => {
      const visibleCodes = filtered.map((r) => r.code_affaire);
      const allSelected = visibleCodes.every((c) => prev.has(c));
      if (allSelected) {
        // Deselectionne tous les visibles
        const next = new Set(prev);
        for (const c of visibleCodes) next.delete(c);
        return next;
      }
      const next = new Set(prev);
      for (const c of visibleCodes) next.add(c);
      return next;
    });
  };

  const selectByCategorie = (cat: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      for (const r of filtered) {
        if (r.categorie === cat && r.parent_project_exists) next.add(r.code_affaire);
      }
      return next;
    });
  };

  const toggleCategorieFilter = (cat: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleImport = async () => {
    if (selectedCodes.size === 0) return;

    const codes = Array.from(selectedCodes);
    const libelleByCode: Record<string, string | null> = {};
    const codeProjetByAffaire: Record<string, string | null> = {};
    const byCode = new Map<string, BEDivaltoAffaireToImport>(rows.map((r) => [r.code_affaire, r]));
    for (const c of codes) {
      const r = byCode.get(c);
      libelleByCode[c] = r?.libelle_principal ?? null;
      codeProjetByAffaire[c] = r?.code_projet_parent ?? null;
    }

    try {
      const res = await importMut.mutateAsync({ codes, libelleByCode, codeProjetByAffaire });
      const importedCount = res.imported.length;
      const skippedCount = res.skippedNoProject.length;
      toast({
        title: `Import termine`,
        description:
          `${importedCount} affaire${importedCount > 1 ? 's' : ''} importee${importedCount > 1 ? 's' : ''}` +
          (skippedCount > 0
            ? `, ${skippedCount} skippee${skippedCount > 1 ? 's' : ''} (projet parent manquant)`
            : ''),
      });
      // Reset selection des codes importes
      setSelectedCodes((prev) => {
        const next = new Set(prev);
        for (const c of res.imported) next.delete(c);
        return next;
      });
    } catch (e) {
      toast({
        title: 'Erreur',
        description: extractErrorMessage(e),
        variant: 'destructive',
      });
    }
  };

  // Stats globales
  const totalSelected = selectedCodes.size;
  const totalSelectedWithProject = useMemo(() => {
    const byCode = new Map(rows.map((r) => [r.code_affaire, r]));
    let n = 0;
    for (const c of selectedCodes) {
      if (byCode.get(c)?.parent_project_exists) n++;
    }
    return n;
  }, [selectedCodes, rows]);
  const totalSelectedSkipped = totalSelected - totalSelectedWithProject;

  return (
    <div className="flex h-screen overflow-hidden bg-muted/20">
      <Sidebar activeView="projects" onViewChange={() => {}} />

      <main className="flex-1 flex flex-col min-w-0 overflow-auto">
        <div className="px-6 py-4 border-b bg-background">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 mb-2" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-4 w-4" />
            Retour aux projets
          </Button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-display font-bold flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Import affaires Divalto
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Liste les codes_affaire detectes dans Divalto qui ne sont pas encore importes
                dans le suivi BE. Filtre par categorie metier (1er char), volume ou recherche libre,
                puis coche les affaires a importer en lot.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Affaires Divalto detectees" value={rows.length} />
            <KpiCard label="Affichees (filtres actifs)" value={filtered.length} />
            <KpiCard
              label="Selectionnees"
              value={totalSelected}
              accent={totalSelected > 0 ? 'emerald' : undefined}
              hint={totalSelectedSkipped > 0 ? `${totalSelectedSkipped} sans projet parent` : undefined}
              hintIcon={totalSelectedSkipped > 0 ? <AlertTriangle className="h-3 w-3" /> : null}
            />
            <KpiCard
              label="Categories detectees"
              value={allCategories.length}
              hint={allCategories.join(' · ')}
            />
          </div>

          {/* Filtres */}
          <Card className="border-border/50">
            <CardContent className="p-3 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher (code, libelle, projet)…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>

              <div className="flex items-center gap-1">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1">
                  Catégories
                </span>
                {allCategories.map((c) => {
                  const active = selectedCategories.has(c);
                  return (
                    <Button
                      key={c}
                      variant={active ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 px-2 text-xs font-mono"
                      onClick={() => toggleCategorieFilter(c)}
                    >
                      {c}
                    </Button>
                  );
                })}
                {selectedCategories.size > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => setSelectedCategories(new Set())}>
                    Tout
                  </Button>
                )}
              </div>

              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox checked={hideOrphans} onCheckedChange={(v) => setHideOrphans(!!v)} />
                Masquer si projet parent absent
              </label>

              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox checked={hideZeroAmount} onCheckedChange={(v) => setHideZeroAmount(!!v)} />
                Masquer si montant = 0
              </label>
            </CardContent>
          </Card>

          {/* Actions de selection en masse */}
          {filtered.length > 0 && (
            <Card className="border-border/50">
              <CardContent className="p-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground mr-2">Sélection rapide :</span>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={toggleAll}>
                  <Layers className="h-3 w-3" />
                  Cocher / décocher tout (visible)
                </Button>
                {allCategories.map((c) => (
                  <Button
                    key={c}
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs font-mono"
                    onClick={() => selectByCategorie(c)}
                  >
                    + Tous les "{c}"
                  </Button>
                ))}
                {selectedCodes.size > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs ml-1" onClick={() => setSelectedCodes(new Set())}>
                    Vider la sélection
                  </Button>
                )}
                <Button
                  className="ml-auto gap-1.5"
                  onClick={handleImport}
                  disabled={totalSelected === 0 || importMut.isPending}
                >
                  {importMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Importer {totalSelectedWithProject > 0 ? `(${totalSelectedWithProject})` : ''}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Tableau */}
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-emerald-500/70" />
                {rows.length === 0
                  ? 'Toutes les affaires Divalto sont déjà importées.'
                  : 'Aucune affaire ne correspond aux filtres.'}
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filtered.length > 0 && filtered.every((r) => selectedCodes.has(r.code_affaire))}
                        onCheckedChange={toggleAll}
                        aria-label="Tout selectionner"
                      />
                    </TableHead>
                    <TableHead>Code affaire</TableHead>
                    <TableHead>Libellé Divalto</TableHead>
                    <TableHead>Projet parent</TableHead>
                    <TableHead className="text-right">Pièces</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Période</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const checked = selectedCodes.has(r.code_affaire);
                    const noParent = !r.parent_project_exists;
                    return (
                      <TableRow
                        key={r.code_affaire}
                        className={cn('hover:bg-muted/30 cursor-pointer', noParent && 'opacity-70')}
                        onClick={() => toggleCode(r.code_affaire)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleCode(r.code_affaire)}
                            aria-label={`Selectionner ${r.code_affaire}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                              {r.code_affaire}
                            </code>
                            <Badge variant="outline" className="text-[10px] font-mono h-4 px-1">
                              {r.categorie}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm max-w-[300px] truncate" title={r.libelle_principal ?? ''}>
                          {r.libelle_principal ?? <span className="text-muted-foreground italic">—</span>}
                        </TableCell>
                        <TableCell>
                          {r.code_projet_parent ? (
                            <div className="flex items-center gap-1.5">
                              <code className="text-xs font-mono">{r.code_projet_parent}</code>
                              {noParent ? (
                                <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber-500/40 text-amber-600">
                                  manquant
                                </Badge>
                              ) : (
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">code trop court</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{r.nb_pieces}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm font-semibold">{eur(r.montant_total)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.premier_mouvement && r.dernier_mouvement
                            ? `${new Date(r.premier_mouvement).toLocaleDateString('fr-FR')} → ${new Date(r.dernier_mouvement).toLocaleDateString('fr-FR')}`
                            : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {totalSelectedSkipped > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-3 text-xs flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-700">
                    {totalSelectedSkipped} affaire{totalSelectedSkipped > 1 ? 's' : ''} sera{totalSelectedSkipped > 1 ? 'ont' : ''} skippée{totalSelectedSkipped > 1 ? 's' : ''} a l'import
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    Le projet parent (chars 2-5 du code) n'existe pas encore dans <code className="font-mono">be_projects</code>.
                    Crée d'abord le projet depuis la <Link to="/projects" className="underline hover:text-foreground">liste BE</Link>, puis relance l'import.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
  hint,
  hintIcon,
}: {
  label: string;
  value: number;
  accent?: 'emerald';
  hint?: string;
  hintIcon?: React.ReactNode;
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
        <p
          className={cn(
            'text-xl font-bold tabular-nums',
            accent === 'emerald' && 'text-emerald-600',
          )}
        >
          {value.toLocaleString('fr-FR')}
        </p>
        {hint && (
          <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
            {hintIcon}
            {hint}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
