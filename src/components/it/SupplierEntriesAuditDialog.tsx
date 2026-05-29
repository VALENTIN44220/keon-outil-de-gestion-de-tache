/**
 * Dialog d'audit : liste les écritures comptables rattachées avec leur nb_links.
 * Permet de détecter facilement les multi-rattachements (volontaires pour les
 * CCA annuelles ventilées, ou doublons accidentels).
 *
 * La vue d'agrégation côté DB ventile (montant / nb_links) donc le constaté
 * global est correct même quand 1 écriture est sur N lignes. Cet audit reste
 * utile pour s'assurer que les multi-rattachements sont voulus.
 */
import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSupplierEntriesLinksAudit } from '@/hooks/useSupplierAccountingEntries';

const eur = (n: number | null | undefined) =>
  (Math.abs(n ?? 0)).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupplierEntriesAuditDialog({ open, onOpenChange }: Props) {
  const [search, setSearch] = useState('');
  const { data: rows = [], isLoading } = useSupplierEntriesLinksAudit();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.supplier_name, r.supplier_code, r.libelle_ecriture, r.dos, r.journal, r.numero]
        .filter(Boolean)
        .some((s) => (s as string).toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const multi = rows.filter((r) => r.nb_links > 1).length;
    const heavy = rows.filter((r) => r.nb_links > 12).length;
    return { total, multi, heavy };
  }, [rows]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Audit des rattachements d'écritures comptables</DialogTitle>
          <DialogDescription>
            Le canon constaté <b>ventile</b> automatiquement chaque écriture sur ses N lignes liées
            (montant ÷ nb_links). Cet audit te permet de vérifier que les multi-rattachements sont
            voulus (CCA ventilée sur 12 mois = OK) et pas des doublons accidentels.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 text-xs">
          <Badge variant="outline" className="gap-1">
            <span className="text-muted-foreground">Rattachées</span>
            <span className="font-semibold">{stats.total}</span>
          </Badge>
          <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700">
            <span className="text-muted-foreground">Multi-rattachées (≥2)</span>
            <span className="font-semibold">{stats.multi}</span>
          </Badge>
          {stats.heavy > 0 && (
            <Badge variant="outline" className="gap-1 border-red-300 text-red-700">
              <AlertTriangle className="h-3 w-3" />
              <span className="text-muted-foreground">+ de 12 liens</span>
              <span className="font-semibold">{stats.heavy}</span>
            </Badge>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-xs"
            placeholder="Rechercher (fournisseur, libellé, DOS, journal…)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <ScrollArea className="h-[450px] border rounded-md">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              {search ? 'Aucun résultat.' : 'Aucune écriture rattachée pour l\'instant.'}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background border-b">
                <tr>
                  <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">N° liens</th>
                  <th className="text-left px-2 py-1.5 font-medium text-muted-foreground whitespace-nowrap">Date</th>
                  <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">DOS · Journal · N°</th>
                  <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Fournisseur</th>
                  <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Libellé</th>
                  <th className="text-right px-2 py-1.5 font-medium text-muted-foreground">TTC</th>
                  <th className="text-right px-2 py-1.5 font-medium text-muted-foreground">Part / ligne</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((r) => {
                  const danger = r.nb_links > 12;
                  const warn = r.nb_links > 1 && r.nb_links <= 12;
                  const partTTC = r.montant_abs_ttc / r.nb_links;
                  return (
                    <tr key={r.entry_key} className="hover:bg-muted/30">
                      <td className="px-2 py-1.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] h-4 px-1.5 font-semibold tabular-nums',
                            danger && 'bg-red-100 text-red-700 border-red-300',
                            warn && 'bg-amber-100 text-amber-800 border-amber-300',
                          )}
                        >
                          × {r.nb_links}
                        </Badge>
                      </td>
                      <td className="px-2 py-1.5 tabular-nums whitespace-nowrap text-muted-foreground">
                        {r.date ?? '—'}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                        {r.dos} · {r.journal} · {r.numero}
                      </td>
                      <td className="px-2 py-1.5 max-w-[180px]">
                        <div className="truncate font-medium">{r.supplier_name ?? '—'}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{r.supplier_code ?? ''}</div>
                      </td>
                      <td className="px-2 py-1.5 max-w-[200px]">
                        <span className="truncate block" title={r.libelle_ecriture ?? ''}>
                          {r.libelle_ecriture ?? '—'}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-semibold">
                        {eur(r.montant_abs_ttc)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-violet-700">
                        {eur(partTTC)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
