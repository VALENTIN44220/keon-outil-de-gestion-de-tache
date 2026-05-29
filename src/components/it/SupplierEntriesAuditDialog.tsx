/**
 * Dialog d'audit : liste les écritures comptables rattachées avec leur nb_links.
 * Chaque ligne est dépliable et affiche le détail des rattachements regroupés
 * par groupe de rapprochement (nom du groupe + nb lignes) ou par ligne
 * individuelle. Permet de détacher au niveau groupe ou ligne.
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Unlink,
  Layers,
  FileText,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import {
  useSupplierEntriesLinksAudit,
  useUnlinkSupplierEntry,
  useUnlinkSupplierEntries,
  type SupplierEntryLinkDetail,
} from '@/hooks/useSupplierAccountingEntries';

const eur = (n: number | null | undefined) =>
  Math.abs(n ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Bucket {
  kind: 'group' | 'lines';
  /** Si group : group_id ; si lines : null */
  groupId: string | null;
  /** Si group : nom ; si lines : null */
  groupName: string | null;
  links: SupplierEntryLinkDetail[];
}

/** Regroupe les links par group_id quand présent, sinon les laisse individuels. */
function bucketize(links: SupplierEntryLinkDetail[]): Bucket[] {
  const byGroup = new Map<string, Bucket>();
  const orphans: SupplierEntryLinkDetail[] = [];
  for (const l of links) {
    if (l.group_id) {
      let b = byGroup.get(l.group_id);
      if (!b) {
        b = { kind: 'group', groupId: l.group_id, groupName: l.group_name, links: [] };
        byGroup.set(l.group_id, b);
      }
      b.links.push(l);
    } else {
      orphans.push(l);
    }
  }
  const out: Bucket[] = Array.from(byGroup.values());
  if (orphans.length > 0) {
    out.push({ kind: 'lines', groupId: null, groupName: null, links: orphans });
  }
  return out;
}

export function SupplierEntriesAuditDialog({ open, onOpenChange }: Props) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { data: rows = [], isLoading } = useSupplierEntriesLinksAudit();
  const unlinkOne = useUnlinkSupplierEntry();
  const unlinkMany = useUnlinkSupplierEntries();

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

  const toggle = (k: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const handleDetachLink = async (linkId: string) => {
    try {
      await unlinkOne.mutateAsync(linkId);
      toast({ title: 'Lien supprimé' });
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    }
  };

  const handleDetachBucket = async (bucket: Bucket) => {
    const ids = bucket.links.map((l) => l.link_id);
    const confirmMsg =
      bucket.kind === 'group'
        ? `Détacher l'écriture des ${ids.length} lignes du groupe « ${bucket.groupName ?? 'sans nom'} » ?`
        : `Détacher ${ids.length} lien(s) ?`;
    if (!window.confirm(confirmMsg)) return;
    try {
      const res = await unlinkMany.mutateAsync(ids);
      toast({ title: `${res.deleted} lien(s) supprimé(s)` });
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Audit des rattachements d'écritures comptables</DialogTitle>
          <DialogDescription>
            Le canon constaté <b>ventile</b> automatiquement chaque écriture sur ses N lignes liées
            (montant ÷ nb_links). Cet audit permet de vérifier que les multi-rattachements sont
            voulus (CCA mensuelle = OK) et de détacher facilement (par groupe ou par ligne).
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

        <ScrollArea className="h-[500px] border rounded-md">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              {search ? 'Aucun résultat.' : 'Aucune écriture rattachée pour l\'instant.'}
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((r) => {
                const danger = r.nb_links > 12;
                const warn = r.nb_links > 1 && r.nb_links <= 12;
                const partTTC = r.montant_abs_ttc / r.nb_links;
                const isOpen = expanded.has(r.entry_key);
                const buckets = bucketize(r.links_detail ?? []);
                return (
                  <div key={r.entry_key}>
                    {/* Ligne principale écriture */}
                    <button
                      type="button"
                      onClick={() => toggle(r.entry_key)}
                      className="w-full text-left px-2 py-2 hover:bg-muted/30 flex items-center gap-2 text-xs"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] h-4 px-1.5 font-semibold tabular-nums shrink-0',
                          danger && 'bg-red-100 text-red-700 border-red-300',
                          warn && 'bg-amber-100 text-amber-800 border-amber-300',
                        )}
                      >
                        × {r.nb_links}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                        {r.dos} · {r.journal} · {r.numero}
                      </span>
                      <span className="tabular-nums text-[10px] text-muted-foreground shrink-0">
                        {r.date ?? '—'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium">{r.supplier_name ?? '—'}</div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {r.libelle_ecriture ?? ''}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold tabular-nums">{eur(r.montant_abs_ttc)}</div>
                        <div className="text-[10px] text-violet-700 tabular-nums">
                          ÷ {r.nb_links} = {eur(partTTC)}
                        </div>
                      </div>
                    </button>

                    {/* Détail des rattachements (groupes + lignes) */}
                    {isOpen && (
                      <div className="bg-muted/20 px-3 py-2 space-y-1.5 border-t">
                        {buckets.map((b, i) => {
                          if (b.kind === 'group') {
                            return (
                              <div
                                key={`grp-${b.groupId}`}
                                className="flex items-center gap-2 px-2 py-1.5 rounded bg-background border text-xs"
                              >
                                <Layers className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">
                                    Groupe : {b.groupName ?? 'Sans nom'}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {b.links.length} ligne{b.links.length > 1 ? 's' : ''} budgétaire{b.links.length > 1 ? 's' : ''}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 gap-1 text-[11px] text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDetachBucket(b)}
                                  disabled={unlinkMany.isPending}
                                >
                                  {unlinkMany.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Unlink className="h-3 w-3" />
                                  )}
                                  Détacher le groupe
                                </Button>
                              </div>
                            );
                          }
                          // Lignes individuelles (sans groupe)
                          return (
                            <div key={`lines-${i}`} className="space-y-1">
                              {b.links.map((l) => (
                                <div
                                  key={l.link_id}
                                  className="flex items-center gap-2 px-2 py-1.5 rounded bg-background border text-xs"
                                >
                                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0">
                                        {l.categorie ?? '—'}
                                      </Badge>
                                      <span className="truncate font-medium">
                                        {l.description ?? l.sous_categorie ?? 'Sans description'}
                                      </span>
                                    </div>
                                    {l.fournisseur_prevu && (
                                      <div className="font-mono text-[10px] text-muted-foreground">
                                        {l.fournisseur_prevu}
                                      </div>
                                    )}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 gap-1 text-[11px] text-muted-foreground hover:text-destructive"
                                    onClick={() => handleDetachLink(l.link_id)}
                                    disabled={unlinkOne.isPending}
                                  >
                                    {unlinkOne.isPending ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Unlink className="h-3 w-3" />
                                    )}
                                    Détacher
                                  </Button>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
