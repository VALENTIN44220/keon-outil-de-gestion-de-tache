import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useSupplierCategories, useSupplierFamillesByCategorie } from "@/hooks/useSupplierCategorisation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSupplierEnrichment, SupplierFilters } from '@/hooks/useSupplierEnrichment';
import { Search, Building2, Filter, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

interface SupplierListViewProps {
  onOpenSupplier: (id: string) => void;
}


type DateTone = 'past' | 'soon' | 'future' | 'none';

function dateTone(iso?: string | null): DateTone {
  if (!iso) return 'none';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'none';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dd = new Date(d);
  dd.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((dd.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return 'past';
  if (diffDays <= 30) return 'soon';
  return 'future';
}

function dateClass(iso?: string | null): string {
  const t = dateTone(iso);
  if (t === 'past') return 'text-red-600 font-semibold';
  if (t === 'soon') return 'text-orange-600 font-semibold';
  if (t === 'future') return 'text-green-700';
  return 'text-muted-foreground';
}

function safeFormatDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'dd/MM/yyyy', { locale: fr });
}

export function SupplierListView({ onOpenSupplier }: SupplierListViewProps)
 {
  const pageSize = 200;

  const [page, setPage] = useState(0);

  const [filters, setFilters] = useState<SupplierFilters>({
    search: '',
    status: 'all',
    entite: 'all',
    categorie: 'all',
    segment: 'all',
    sous_segment: 'all',
    validite_prix_from: '',
    validite_prix_to: '',
    validite_contrat_from: '',
    validite_contrat_to: '',
  });

  const updateFilters = (patch: Partial<SupplierFilters>) => {
    setFilters(prev => ({ ...prev, ...patch }));
    setPage(0);
  };

  const { suppliers, total, isLoading, filterOptions } = useSupplierEnrichment(filters, page, pageSize);

  const totalPages = useMemo(() => Math.max(1, Math.ceil((total || 0) / pageSize)), [total, pageSize]);

  useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  const statusConfig = {
    a_completer: { label: 'À compléter', color: 'bg-destructive/10 text-destructive' },
    en_cours: { label: 'En cours', color: 'bg-warning/10 text-warning' },
    complet: { label: 'Complet', color: 'bg-success/10 text-success' },
  } as const;

  const stats = useMemo(() => {
    return {
      total,
      aCompleter: filterOptions?.stats?.a_completer ?? 0,
      enCours: filterOptions?.stats?.en_cours ?? 0,
      complet: filterOptions?.stats?.complet ?? 0,
    };
  }, [total, filterOptions]);

 const { data: categories = [] } = useSupplierCategories();
const { data: familles = [] } = useSupplierFamillesByCategorie(filters.categorie !== "all" ? filters.categorie : null);
  

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Référentiel Fournisseurs</h1>
            <p className="text-muted-foreground">Service Achats</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="text-2xl font-bold">{stats.total ?? 0}</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-destructive">
          <div className="text-sm text-muted-foreground">À compléter</div>
          <div className="text-2xl font-bold text-destructive">{stats.aCompleter}</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-warning">
          <div className="text-sm text-muted-foreground">En cours</div>
          <div className="text-2xl font-bold text-warning">{stats.enCours}</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-success">
          <div className="text-sm text-muted-foreground">Complet</div>
          <div className="text-2xl font-bold text-success">{stats.complet}</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher TIERS, Nom, Famille, Segment, Entité..."
                value={filters.search}
                onChange={(e) => updateFilters({ search: e.target.value })}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />

            <Select value={filters.status} onValueChange={(value) => updateFilters({ status: value })}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les status</SelectItem>
                <SelectItem value="a_completer">À compléter</SelectItem>
                <SelectItem value="en_cours">En cours</SelectItem>
                <SelectItem value="complet">Complet</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.entite} onValueChange={(value) => updateFilters({ entite: value })}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Entité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes entités</SelectItem>
                {filterOptions.entites.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.categorie} onValueChange={(value) => updateFilters({ categorie: value, /* reset famille si tu ajoutes un filtre famille */ })}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.segment} onValueChange={(value) => updateFilters({ segment: value })}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous segments</SelectItem>
                {filterOptions.segments.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.sous_segment ?? 'all'} onValueChange={(value) => updateFilters({ sous_segment: value })}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Sous-segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous sous-segments</SelectItem>
                {filterOptions.sous_segments.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Date filters */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Validité prix - du</div>
            <Input
              type="date"
              value={filters.validite_prix_from || ''}
              onChange={(e) => updateFilters({ validite_prix_from: e.target.value })}
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Validité prix - au</div>
            <Input
              type="date"
              value={filters.validite_prix_to || ''}
              onChange={(e) => updateFilters({ validite_prix_to: e.target.value })}
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Validité contrat - du</div>
            <Input
              type="date"
              value={filters.validite_contrat_from || ''}
              onChange={(e) => updateFilters({ validite_contrat_from: e.target.value })}
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Validité contrat - au</div>
            <Input
              type="date"
              value={filters.validite_contrat_to || ''}
              onChange={(e) => updateFilters({ validite_contrat_to: e.target.value })}
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">TIERS</TableHead>
              <TableHead>Nom Fournisseur</TableHead>
              <TableHead>Entité</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Famille</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead className="w-[150px]">Complétude</TableHead>
              <TableHead className="w-[140px]">Validité prix</TableHead>
              <TableHead className="w-[140px]">Validité contrat</TableHead>
              <TableHead>Mise à jour</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 11 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : suppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  Aucun fournisseur trouvé
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((supplier) => (
                <TableRow
                  key={supplier.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onOpenSupplier(supplier.id)}
                >
                  <TableCell className="font-mono font-medium">{supplier.tiers}</TableCell>
                  <TableCell className="font-medium">{supplier.nomfournisseur || '—'}</TableCell>
                  <TableCell>{supplier.entite || '—'}</TableCell>
                  <TableCell>{supplier.categorie || '—'}</TableCell>
                  <TableCell>{supplier.famille || '—'}</TableCell>
                  <TableCell>
                    {supplier.segment ? (
                      <span>
                        {supplier.segment}
                        {supplier.sous_segment && (
                          <span className="text-muted-foreground"> / {supplier.sous_segment}</span>
                        )}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={supplier.completeness_score ?? 0} className="h-2 flex-1" />
                      {supplier.status ? (
                        <Badge className={statusConfig[supplier.status]?.color ?? 'bg-muted text-muted-foreground'}>
                          {supplier.completeness_score ?? 0}%
                        </Badge>
                      ) : (
                        <Badge className="bg-muted text-muted-foreground">{supplier.completeness_score ?? 0}%</Badge>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className={`text-sm ${dateClass((supplier as any).validite_prix)}`}>
                    {safeFormatDate((supplier as any).validite_prix)}
                  </TableCell>

                  <TableCell className={`text-sm ${dateClass((supplier as any).validite_du_contrat)}`}>
                    {safeFormatDate((supplier as any).validite_du_contrat)}
                  </TableCell>

                  <TableCell className="text-muted-foreground text-sm">
                    {safeFormatDate(supplier.updated_at)}
                  </TableCell>

                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onOpenSupplier(supplier.id); }}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t">
          <div className="text-sm text-muted-foreground">
            {(total ?? 0)} lignes — page {page + 1} / {totalPages} — {pageSize} / page
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || isLoading}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Précédent
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages || isLoading}
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              className="gap-2"
            >
              Suivant
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
