import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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
import { Search, RefreshCw, Building2, Filter, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

interface SupplierListViewProps {
  onOpenSupplier: (id: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function SupplierListView({ onOpenSupplier, onRefresh, isRefreshing }: SupplierListViewProps) {
  const [filters, setFilters] = useState<SupplierFilters>({
    search: '',
    status: 'all',
    entite: 'all',
    categorie: 'all',
    segment: 'all',
  });

  const { suppliers, isLoading, filterOptions } = useSupplierEnrichment(filters);

  const statusConfig = {
    a_completer: { label: 'À compléter', variant: 'destructive' as const, color: 'bg-destructive/10 text-destructive' },
    en_cours: { label: 'En cours', variant: 'warning' as const, color: 'bg-warning/10 text-warning' },
    complet: { label: 'Complet', variant: 'success' as const, color: 'bg-success/10 text-success' },
  };

  const stats = {
    total: suppliers.length,
    aCompleter: suppliers.filter(s => s.status === 'a_completer').length,
    enCours: suppliers.filter(s => s.status === 'en_cours').length,
    complet: suppliers.filter(s => s.status === 'complet').length,
  };

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
        <Button onClick={onRefresh} disabled={isRefreshing} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Rafraîchir depuis datalake
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="text-2xl font-bold">{stats.total}</div>
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
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
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

            <Select
              value={filters.entite}
              onValueChange={(value) => setFilters(prev => ({ ...prev, entite: value }))}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Entité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes entités</SelectItem>
                {filterOptions.entites.map(e => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.categorie}
              onValueChange={(value) => setFilters(prev => ({ ...prev, categorie: value }))}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {filterOptions.categories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.segment}
              onValueChange={(value) => setFilters(prev => ({ ...prev, segment: value }))}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous segments</SelectItem>
                {filterOptions.segments.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <TableHead>Mise à jour</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : suppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
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
                    {supplier.segment && (
                      <span>
                        {supplier.segment}
                        {supplier.sous_segment && <span className="text-muted-foreground"> / {supplier.sous_segment}</span>}
                      </span>
                    )}
                    {!supplier.segment && '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={supplier.completeness_score} className="h-2 flex-1" />
                      <Badge className={statusConfig[supplier.status].color}>
                        {supplier.completeness_score}%
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(supplier.updated_at), 'dd/MM/yyyy', { locale: fr })}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
