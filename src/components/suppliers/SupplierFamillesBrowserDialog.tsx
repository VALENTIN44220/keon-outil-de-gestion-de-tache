/**
 * SupplierFamillesBrowserDialog — fenetre tabulaire des familles fournisseurs.
 *
 * Liste les paires (categorie, famille) actives avec :
 *  - une recherche
 *  - un filtre par categorie
 *  - selection d'une ligne -> retourne la famille au formulaire parent
 */
import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Search, Layers, Loader2 } from 'lucide-react';
import {
  useSupplierCategorisationRows,
  useSupplierCategories,
} from '@/hooks/useSupplierCategorisation';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Callback appelee quand l utilisateur selectionne une famille */
  onSelectFamille: (famille: string) => void;
}

export function SupplierFamillesBrowserDialog({ open, onClose, onSelectFamille }: Props) {
  const { data: rows = [], isLoading } = useSupplierCategorisationRows();
  const { data: categories = [] } = useSupplierCategories();
  const [search, setSearch] = useState('');
  const [filterCategorie, setFilterCategorie] = useState<string>('all');

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filterCategorie !== 'all' && r.categorie !== filterCategorie) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return r.categorie.toLowerCase().includes(q) || r.famille.toLowerCase().includes(q);
      }
      return true;
    });
  }, [rows, search, filterCategorie]);

  // Regroupe les familles par categorie pour un affichage par bloc
  const grouped = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of filtered) {
      if (!map.has(r.categorie)) map.set(r.categorie, []);
      map.get(r.categorie)!.push(r.famille);
    }
    return Array.from(map.entries()).map(([categorie, familles]) => ({ categorie, familles }));
  }, [filtered]);

  const handlePick = (famille: string) => {
    onSelectFamille(famille);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" /> Familles de fournisseurs disponibles
          </DialogTitle>
          <DialogDescription>
            Parcours les catégories et familles. Clique sur une famille pour la sélectionner dans le formulaire.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une famille ou une catégorie..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterCategorie} onValueChange={setFilterCategorie}>
            <SelectTrigger className="w-[260px]"><SelectValue placeholder="Catégorie" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-xs">
            {filtered.length} familles · {grouped.length} catégories
          </Badge>
        </div>

        <div className="flex-1 overflow-y-auto border rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Aucune famille ne correspond à ta recherche.
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-[40%]">Catégorie</TableHead>
                  <TableHead>Famille</TableHead>
                  <TableHead className="text-right w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.flatMap(({ categorie, familles }) =>
                  familles.map((famille, i) => (
                    <TableRow
                      key={`${categorie}::${famille}`}
                      className="cursor-pointer hover:bg-accent/30"
                      onClick={() => handlePick(famille)}
                    >
                      <TableCell className="text-sm align-top">
                        {i === 0 ? (
                          <Badge variant="secondary" className="text-xs">{categorie}</Badge>
                        ) : (
                          <span className="text-muted-foreground/40 pl-2">↳</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{famille}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handlePick(famille); }}>
                          Sélectionner
                        </Button>
                      </TableCell>
                    </TableRow>
                  )),
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
