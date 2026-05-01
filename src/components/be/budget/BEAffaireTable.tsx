import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Pencil,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Columns3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BEAffaire,
  BEAffaireBudgetKPI,
  BE_AFFAIRE_STATUS_CONFIG,
} from '@/types/beAffaire';

const eur = (n: number) =>
  n.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });

export type BEAffaireColumnKey =
  | 'status'
  | 'ca_engage'
  | 'ca_constate'
  | 'cogs_constate'
  | 'ndf'
  | 'marge_brute'
  | 'cout_rh'
  | 'marge_directe'
  | 'nb_commandes'
  | 'nb_factures'
  | 'date_ouverture';

interface ColumnDef {
  key: BEAffaireColumnKey;
  label: string;
  numeric?: boolean;
}

export const BE_AFFAIRE_COLUMNS: ColumnDef[] = [
  { key: 'status',         label: 'Statut' },
  { key: 'ca_engage',      label: 'CA engagé',      numeric: true },
  { key: 'ca_constate',    label: 'CA constaté',    numeric: true },
  { key: 'cogs_constate',  label: 'COGS',           numeric: true },
  { key: 'ndf',            label: 'NDF',            numeric: true },
  { key: 'marge_brute',    label: 'Marge brute',    numeric: true },
  { key: 'cout_rh',        label: 'Coût RH',        numeric: true },
  { key: 'marge_directe',  label: 'Marge directe',  numeric: true },
  { key: 'nb_commandes',   label: 'Cmd',            numeric: true },
  { key: 'nb_factures',    label: 'Fact',           numeric: true },
  { key: 'date_ouverture', label: 'Démarrage' },
];

export const BE_AFFAIRE_DEFAULT_COLS: BEAffaireColumnKey[] = [
  'status',
  'ca_constate',
  'cogs_constate',
  'marge_brute',
  'marge_directe',
];

type SortKey = 'code_affaire' | 'libelle' | BEAffaireColumnKey;
type SortDir = 'asc' | 'desc';

interface BEAffaireTableProps {
  affaires: BEAffaire[];
  kpisByAffaireId: Map<string, BEAffaireBudgetKPI>;
  visibleColumns: BEAffaireColumnKey[];
  onColumnsChange: (cols: BEAffaireColumnKey[]) => void;
  projectCode: string;
  onEdit: (a: BEAffaire) => void;
  onDelete: (a: BEAffaire) => void;
}

function getCellValue(
  a: BEAffaire,
  k: BEAffaireBudgetKPI | undefined,
  key: SortKey,
): number | string | null {
  switch (key) {
    case 'code_affaire': return a.code_affaire ?? '';
    case 'libelle':      return a.libelle ?? '';
    case 'status':       return a.status;
    case 'ca_engage':     return k?.ca_engage_brut ?? 0;
    case 'ca_constate':   return k?.ca_constate_brut ?? 0;
    case 'cogs_constate': return k?.cogs_constate_brut ?? 0;
    case 'ndf':           return k?.ndf_brut ?? 0;
    case 'marge_brute':
      return k?.marge_brute_brut ?? k?.marge_constatee_brut ?? 0;
    case 'cout_rh':       return k?.cout_rh_declare ?? 0;
    case 'marge_directe':
      return (
        k?.marge_directe_brut ??
        ((k?.marge_brute_brut ?? k?.marge_constatee_brut ?? 0) - (k?.cout_rh_declare ?? 0))
      );
    case 'nb_commandes':  return k?.nb_commandes ?? 0;
    case 'nb_factures':   return k?.nb_factures ?? 0;
    case 'date_ouverture': return a.date_ouverture ?? '';
  }
}

export function BEAffaireTable({
  affaires,
  kpisByAffaireId,
  visibleColumns,
  onColumnsChange,
  projectCode,
  onEdit,
  onDelete,
}: BEAffaireTableProps) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>('code_affaire');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sorted = useMemo(() => {
    const arr = [...affaires];
    arr.sort((a, b) => {
      const ka = kpisByAffaireId.get(a.id);
      const kb = kpisByAffaireId.get(b.id);
      const va = getCellValue(a, ka, sortKey);
      const vb = getCellValue(b, kb, sortKey);
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va ?? '').localeCompare(String(vb ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [affaires, kpisByAffaireId, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  };

  const cols = BE_AFFAIRE_COLUMNS.filter((c) => visibleColumns.includes(c.key));

  return (
    <div className="space-y-2">
      {/* Toolbar colonnes */}
      <div className="flex items-center justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-8">
              <Columns3 className="h-3.5 w-3.5" />
              Colonnes
              <Badge variant="secondary" className="ml-1 text-[10px] px-1">
                {visibleColumns.length}
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Colonnes affichées</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {BE_AFFAIRE_COLUMNS.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.key}
                checked={visibleColumns.includes(c.key)}
                onCheckedChange={(checked) => {
                  if (checked) onColumnsChange([...visibleColumns, c.key]);
                  else onColumnsChange(visibleColumns.filter((k) => k !== c.key));
                }}
                onSelect={(e) => e.preventDefault()}
              >
                {c.label}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={false}
              onSelect={(e) => {
                e.preventDefault();
                onColumnsChange(BE_AFFAIRE_DEFAULT_COLS);
              }}
            >
              Réinitialiser par défaut
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-32">
                <button
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort('code_affaire')}
                >
                  Code <SortIcon k="code_affaire" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort('libelle')}
                >
                  Libellé <SortIcon k="libelle" />
                </button>
              </TableHead>
              {cols.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn(c.numeric && 'text-right')}
                >
                  <button
                    className={cn(
                      'flex items-center gap-1 hover:text-foreground',
                      c.numeric && 'ml-auto',
                    )}
                    onClick={() => toggleSort(c.key)}
                  >
                    {c.label} <SortIcon k={c.key} />
                  </button>
                </TableHead>
              ))}
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((a) => {
              const k = kpisByAffaireId.get(a.id);
              const statusCfg = BE_AFFAIRE_STATUS_CONFIG[a.status];
              const margeBrute =
                k?.marge_brute_brut ?? k?.marge_constatee_brut ?? 0;
              const margeDirecte =
                k?.marge_directe_brut ??
                margeBrute - (k?.cout_rh_declare ?? 0);

              const renderCell = (key: BEAffaireColumnKey) => {
                switch (key) {
                  case 'status':
                    return (
                      <Badge
                        variant="outline"
                        className={cn('text-[10px] border', statusCfg.className)}
                      >
                        {statusCfg.label}
                      </Badge>
                    );
                  case 'ca_engage':
                    return <span className="tabular-nums">{eur(k?.ca_engage_brut ?? 0)}</span>;
                  case 'ca_constate':
                    return <span className="tabular-nums font-semibold">{eur(k?.ca_constate_brut ?? 0)}</span>;
                  case 'cogs_constate':
                    return <span className="tabular-nums text-muted-foreground">{eur(k?.cogs_constate_brut ?? 0)}</span>;
                  case 'ndf':
                    return <span className="tabular-nums text-muted-foreground">{eur(k?.ndf_brut ?? 0)}</span>;
                  case 'marge_brute':
                    return (
                      <span
                        className={cn(
                          'tabular-nums font-semibold',
                          margeBrute < 0 ? 'text-red-600' : margeBrute > 0 ? 'text-emerald-600' : '',
                        )}
                      >
                        {eur(margeBrute)}
                      </span>
                    );
                  case 'cout_rh':
                    return <span className="tabular-nums text-muted-foreground">{eur(k?.cout_rh_declare ?? 0)}</span>;
                  case 'marge_directe':
                    return (
                      <span
                        className={cn(
                          'tabular-nums font-semibold',
                          margeDirecte < 0 ? 'text-red-600' : margeDirecte > 0 ? 'text-emerald-600' : '',
                        )}
                      >
                        {eur(margeDirecte)}
                      </span>
                    );
                  case 'nb_commandes':
                    return <span className="tabular-nums">{k?.nb_commandes ?? 0}</span>;
                  case 'nb_factures':
                    return <span className="tabular-nums">{k?.nb_factures ?? 0}</span>;
                  case 'date_ouverture':
                    return a.date_ouverture
                      ? new Date(a.date_ouverture).toLocaleDateString('fr-FR')
                      : '—';
                }
              };

              return (
                <TableRow
                  key={a.id}
                  className="hover:bg-muted/30 cursor-pointer"
                  onClick={() =>
                    navigate(
                      `/be/projects/${projectCode}/budget/${a.code_affaire}`,
                    )
                  }
                >
                  <TableCell>
                    <code className="text-xs font-mono font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      {a.code_affaire}
                    </code>
                  </TableCell>
                  <TableCell className="font-medium">
                    {a.libelle || (
                      <span className="text-muted-foreground italic">Sans libellé</span>
                    )}
                  </TableCell>
                  {cols.map((c) => (
                    <TableCell
                      key={c.key}
                      className={cn(c.numeric && 'text-right')}
                    >
                      {renderCell(c.key)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(a);
                        }}
                        title="Modifier"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(a);
                        }}
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
