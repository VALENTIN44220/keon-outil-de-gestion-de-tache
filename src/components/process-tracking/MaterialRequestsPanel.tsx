import { useState, useMemo } from 'react';
import { useDemandesMateriel } from '@/hooks/useDemandesMateriel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, RefreshCw, ChevronDown, Loader2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const etatColors: Record<string, string> = {
  'En attente validation': 'bg-muted text-muted-foreground',
  'Demande de devis': 'bg-warning/10 text-warning border-warning/30',
  'Bon de commande envoyé': 'bg-info/10 text-info border-info/30',
  'AR reçu': 'bg-accent/10 text-accent border-accent/30',
  'Commande livrée': 'bg-success/10 text-success border-success/30',
  'Commande distribuée': 'bg-primary/10 text-primary border-primary/30',
};

interface MaterialRequestsPanelProps {
  canWrite: boolean;
}

export function MaterialRequestsPanel({ canWrite }: MaterialRequestsPanelProps) {
  const { lines, isLoading, ETATS_COMMANDE, fetchLines, updateEtat } = useDemandesMateriel();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEtat, setFilterEtat] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const filteredLines = useMemo(() => {
    return lines.filter((line) => {
      if (filterEtat !== 'all' && line.etat_commande !== filterEtat) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchRef = line.ref?.toLowerCase().includes(q);
        const matchDes = line.des?.toLowerCase().includes(q);
        const matchNum = line.request_number?.toLowerCase().includes(q);
        const matchDemandeur = line.demandeur_nom?.toLowerCase().includes(q);
        if (!matchRef && !matchDes && !matchNum && !matchDemandeur) return false;
      }
      return true;
    });
  }, [lines, filterEtat, searchQuery]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredLines.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLines.map((l) => l.id)));
    }
  };

  const handleBulkUpdateEtat = async (newEtat: string) => {
    if (selectedIds.size === 0) return;
    const success = await updateEtat(Array.from(selectedIds), newEtat);
    if (success) setSelectedIds(new Set());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par réf., désignation, n° demande, demandeur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterEtat} onValueChange={setFilterEtat}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filtrer par état" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les états</SelectItem>
            {ETATS_COMMANDE.map((etat) => (
              <SelectItem key={etat} value={etat}>
                {etat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={() => fetchLines()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>

        {canWrite && selectedIds.size > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm">
                Changer l'état ({selectedIds.size})
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {ETATS_COMMANDE.filter((e) => e !== 'En attente validation').map((etat) => (
                <DropdownMenuItem key={etat} onClick={() => handleBulkUpdateEtat(etat)}>
                  {etat}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Table */}
      {filteredLines.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Aucune demande matériel trouvée
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {canWrite && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.size === filteredLines.length && filteredLines.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                )}
                <TableHead>Réf. Demande</TableHead>
                <TableHead>Demandeur</TableHead>
                <TableHead>Réf. Article</TableHead>
                <TableHead>Désignation</TableHead>
                <TableHead className="text-right">Qté</TableHead>
                <TableHead>État</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLines.map((line) => (
                <TableRow key={line.id} className={cn(selectedIds.has(line.id) && 'bg-primary/5')}>
                  {canWrite && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(line.id)}
                        onCheckedChange={() => toggleSelect(line.id)}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <button
                      className="text-primary hover:underline text-sm font-medium flex items-center gap-1"
                      onClick={() => navigate('/requests')}
                      title="Voir la demande source"
                    >
                      {line.request_number || '—'}
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </TableCell>
                  <TableCell className="text-sm">{line.demandeur_nom || '—'}</TableCell>
                  <TableCell className="text-sm font-mono">{line.ref}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{line.des}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{line.quantite}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn('text-xs', etatColors[line.etat_commande])}
                    >
                      {line.etat_commande}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(line.created_at), 'dd/MM/yyyy', { locale: fr })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
