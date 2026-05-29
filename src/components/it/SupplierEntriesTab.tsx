/**
 * Onglet "Écritures fournisseurs" du Budget global IT.
 * Liste les écritures comptables sur compte F* (supplier_accounting_entries),
 * filtrées par défaut sur celles SANS pièce Gescom (cibles principales du
 * rattachement manuel). Bouton "Rattacher" par ligne -> SupplierEntryLinkDialog.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
  ChevronLeft,
  ChevronRight,
  Link as LinkIcon,
  Unlink,
  Search,
  FileSpreadsheet,
  Filter,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import {
  useSupplierAccountingEntries,
  useSupplierEntryLinks,
  useUnlinkSupplierEntry,
  useSupplierEntryDosList,
  type SupplierAccountingEntry,
  type SupplierEntryFilters,
} from '@/hooks/useSupplierAccountingEntries';
import { SupplierEntryLinkDialog } from './SupplierEntryLinkDialog';

const eur = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

/**
 * Les écritures comptables F* sont stockées en TTC dans Divalto, alors que
 * les it_budget_lines sont en HT. Pour comparer/rattacher proprement, on
 * affiche un HT estimé à 20% (TVA standard FR). Approximation : ne couvre
 * pas les taux 10% / 5,5% / 2,1% / exempté. À raffiner via la ligne TVA
 * de l'écriture côté Fabric quand on le voudra.
 */
const TVA_STD = 0.20;
const htEstime = (ttc: number | null | undefined): number => (ttc ?? 0) / (1 + TVA_STD);

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending:   { label: 'À traiter', className: 'bg-slate-100 text-slate-700 border-slate-300' },
  validated: { label: 'Validé',    className: 'bg-green-100 text-green-800 border-green-300' },
  rejected:  { label: 'Rejeté',    className: 'bg-red-100 text-red-700 border-red-300' },
  to_review: { label: 'À revoir',  className: 'bg-amber-100 text-amber-800 border-amber-300' },
};

interface Props {
  annee: number;
  entite: string;
}

export function SupplierEntriesTab({ annee, entite }: Props) {
  // ── Filters ─────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [hasGescom, setHasGescom] = useState<'no' | 'yes' | 'all'>('no'); // défaut : sans Gescom
  const [dos, setDos] = useState<string>('100'); // défaut : DOS 100 (KEON)
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [statusUser, setStatusUser] = useState<string>('');
  const [amountMin, setAmountMin] = useState<string>('');
  const [amountMax, setAmountMax] = useState<string>('');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const filters: SupplierEntryFilters = useMemo(() => {
    const f: SupplierEntryFilters = { page, page_size: pageSize };
    if (hasGescom !== 'all') f.has_gescom_piece = hasGescom === 'yes';
    if (dos) f.dos = dos;
    if (dateFrom) f.date_from = dateFrom;
    if (dateTo) f.date_to = dateTo;
    if (search.trim()) f.supplier_search = search.trim();
    if (statusUser) f.status_user = statusUser as any;
    const min = parseFloat(amountMin.replace(',', '.'));
    if (!isNaN(min)) f.amount_min = min;
    const max = parseFloat(amountMax.replace(',', '.'));
    if (!isNaN(max)) f.amount_max = max;
    return f;
  }, [page, hasGescom, dos, dateFrom, dateTo, search, statusUser, amountMin, amountMax]);

  const { data: result, isLoading } = useSupplierAccountingEntries(filters);
  const entries = result?.data ?? [];
  const count = result?.count ?? 0;
  const nbPages = Math.max(1, Math.ceil(count / pageSize));

  const entryKeys = useMemo(() => entries.map((e) => e.entry_key), [entries]);
  const { data: links = [] } = useSupplierEntryLinks(entryKeys);
  const linkByEntry = useMemo(() => {
    const m = new Map<string, typeof links[number][]>();
    for (const l of links) {
      const arr = m.get(l.supplier_entry_key) ?? [];
      arr.push(l);
      m.set(l.supplier_entry_key, arr);
    }
    return m;
  }, [links]);

  const { data: dosList = [] } = useSupplierEntryDosList();
  const unlinkMutation = useUnlinkSupplierEntry();

  // ── Dialog rattachement ─────────────────────────────────────────────
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkEntry, setLinkEntry] = useState<SupplierAccountingEntry | null>(null);

  const openLink = (entry: SupplierAccountingEntry) => {
    setLinkEntry(entry);
    setLinkOpen(true);
  };

  const handleUnlink = async (linkId: string) => {
    try {
      await unlinkMutation.mutateAsync(linkId);
      toast({ title: 'Lien supprimé' });
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    }
  };

  const resetFilters = () => {
    setSearch('');
    setHasGescom('no');
    setDos('100'); // reset = retour au défaut DOS 100
    setDateFrom('');
    setDateTo('');
    setStatusUser('');
    setAmountMin('');
    setAmountMax('');
    setPage(0);
  };

  const hasActiveFilter =
    !!search ||
    hasGescom !== 'no' ||
    dos !== '100' ||
    !!dateFrom ||
    !!dateTo ||
    !!statusUser ||
    !!amountMin ||
    !!amountMax;

  return (
    <div className="space-y-4">
      {/* En-tête + intro */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-violet-500/10">
          <FileSpreadsheet className="h-5 w-5 text-violet-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold">Écritures comptables fournisseurs</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Écritures sur comptes auxiliaires <code className="font-mono">F*</code> (OD, banque,
            à-nouveau). Par défaut, on affiche celles SANS pièce Gescom — à rattacher manuellement
            à une ligne du budget IT.
          </p>
          <p className="text-[11px] text-amber-700 mt-1">
            ⚠️ Les écritures sont en <b>TTC</b>, les lignes budgétaires en <b>HT</b>.
            L'<b>HT estimé</b> ci-dessous est calculé à TVA 20 % par défaut (taux standard FR) —
            approximatif pour les taux 10 / 5,5 / 2,1 / exempté.
          </p>
        </div>
      </div>

      {/* Filtres */}
      <Card className="border-border/50">
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Fournisseur, code, libellé…"
                className="pl-8 h-8"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              />
            </div>

            <Select value={hasGescom} onValueChange={(v) => { setHasGescom(v as any); setPage(0); }}>
              <SelectTrigger className="w-[170px] h-8 text-xs">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">Sans pièce Gescom</SelectItem>
                <SelectItem value="yes">Avec pièce Gescom</SelectItem>
                <SelectItem value="all">Toutes</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dos || '__all__'} onValueChange={(v) => { setDos(v === '__all__' ? '' : v); setPage(0); }}>
              <SelectTrigger className="w-[110px] h-8 text-xs">
                <SelectValue placeholder="DOS" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tous DOS</SelectItem>
                {dosList.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusUser || '__all__'} onValueChange={(v) => { setStatusUser(v === '__all__' ? '' : v); setPage(0); }}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tous statuts</SelectItem>
                <SelectItem value="pending">À traiter</SelectItem>
                <SelectItem value="validated">Validé</SelectItem>
                <SelectItem value="rejected">Rejeté</SelectItem>
                <SelectItem value="to_review">À revoir</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilter && (
              <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={resetFilters}>
                <X className="h-3.5 w-3.5" /> Reset
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Label className="text-[11px] text-muted-foreground">Du</Label>
              <Input type="date" className="h-8 w-[140px] text-xs"
                value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} />
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-[11px] text-muted-foreground">au</Label>
              <Input type="date" className="h-8 w-[140px] text-xs"
                value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} />
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-[11px] text-muted-foreground">Solde min</Label>
              <Input className="h-8 w-[100px] text-xs" inputMode="decimal"
                value={amountMin} onChange={(e) => { setAmountMin(e.target.value); setPage(0); }} />
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-[11px] text-muted-foreground">max</Label>
              <Input className="h-8 w-[100px] text-xs" inputMode="decimal"
                value={amountMax} onChange={(e) => { setAmountMax(e.target.value); setPage(0); }} />
            </div>
            <span className="text-xs text-muted-foreground ml-auto">
              {isLoading ? '…' : `${count.toLocaleString('fr-FR')} écritures`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Aucune écriture pour ces critères.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-xs whitespace-nowrap">Date</TableHead>
                    <TableHead className="text-xs">DOS</TableHead>
                    <TableHead className="text-xs">Journal</TableHead>
                    <TableHead className="text-xs">Fournisseur</TableHead>
                    <TableHead className="text-xs">Libellé</TableHead>
                    <TableHead className="text-xs text-right whitespace-nowrap">Solde TTC</TableHead>
                    <TableHead className="text-xs text-right whitespace-nowrap" title="HT estimé à TVA 20% (taux standard FR)">
                      HT est.
                    </TableHead>
                    <TableHead className="text-xs">Statut</TableHead>
                    <TableHead className="text-xs">Liens</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => {
                    const sc = STATUS_LABEL[e.status_user] ?? STATUS_LABEL.pending;
                    const myLinks = linkByEntry.get(e.entry_key) ?? [];
                    return (
                      <TableRow key={e.entry_key} className="hover:bg-muted/20">
                        <TableCell className="text-xs whitespace-nowrap tabular-nums">
                          {e.date ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="font-mono text-[10px] h-4 px-1">
                            {e.dos}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{e.journal}</TableCell>
                        <TableCell className="text-xs max-w-[200px]">
                          <div className="flex flex-col min-w-0">
                            <span className="truncate font-medium">{e.supplier_name ?? '—'}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {e.supplier_code}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs max-w-[300px]">
                          <span className="truncate block" title={e.libelle_ecriture ?? ''}>
                            {e.libelle_ecriture ?? '—'}
                          </span>
                        </TableCell>
                        <TableCell className={cn(
                          'text-xs text-right tabular-nums font-semibold',
                          (e.solde ?? 0) < 0 && 'text-red-600',
                          (e.solde ?? 0) > 0 && 'text-foreground',
                        )}>
                          {eur(e.solde)}
                        </TableCell>
                        <TableCell
                          className="text-xs text-right tabular-nums text-muted-foreground"
                          title="HT estimé à TVA 20%"
                        >
                          {eur(htEstime(e.solde))}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className={cn('text-[10px] h-4 px-1.5 border', sc.className)}>
                            {sc.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {myLinks.length === 0 ? (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {myLinks.map((l) => (
                                <button
                                  key={l.id}
                                  onClick={() => handleUnlink(l.id)}
                                  title="Cliquer pour détacher"
                                  className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-red-100 hover:text-red-700 hover:border-red-300 group transition-colors"
                                >
                                  <LinkIcon className="h-2.5 w-2.5 group-hover:hidden" />
                                  <Unlink className="h-2.5 w-2.5 hidden group-hover:inline" />
                                  {l.budget_line_id.slice(0, 8)}…
                                </button>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 text-[11px]"
                            onClick={() => openLink(e)}
                            title="Rattacher à une ligne budgétaire IT"
                          >
                            <LinkIcon className="h-3 w-3" />
                            Rattacher
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {count > pageSize && (
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <span>
            Page {page + 1} / {nbPages}
          </span>
          <Button
            size="icon" variant="outline" className="h-7 w-7"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon" variant="outline" className="h-7 w-7"
            disabled={page >= nbPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <SupplierEntryLinkDialog
        entry={linkEntry}
        annee={annee}
        entite={entite}
        open={linkOpen}
        onOpenChange={setLinkOpen}
      />
    </div>
  );
}
