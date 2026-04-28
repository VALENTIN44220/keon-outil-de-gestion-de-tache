import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Plus, X, Loader2, AlertTriangle, FileText, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import { useBEBudgetRapprochement } from '@/hooks/useBEBudgetRapprochement';
import type {
  BEDivaltoMouvementGrouped,
  BEDivaltoTypeMouv,
} from '@/types/beAffaire';

const eur = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

interface BEBudgetRapprochementPanelProps {
  budgetLineId: string | null;
  codeAffaire: string | null;
}

export function BEBudgetRapprochementPanel({
  budgetLineId,
  codeAffaire,
}: BEBudgetRapprochementPanelProps) {
  const {
    commandesLiees,
    facturesLiees,
    commandeLienByPiece,
    factureLienByPiece,
    isLoading,
    searchCommandes,
    searchFactures,
    lierCommande,
    delierCommande,
    lierFacture,
    delierFacture,
    engage,
    constate,
  } = useBEBudgetRapprochement(budgetLineId, codeAffaire);

  if (!budgetLineId) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Sauvegardez la ligne d'abord pour accéder au rapprochement Divalto.
      </div>
    );
  }

  if (!codeAffaire) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-amber-600 gap-2">
        <AlertTriangle className="h-4 w-4" />
        Aucun code affaire — impossible de proposer des pièces Divalto.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Commandes (CCN/CFK) */}
      <Section
        title="Commandes (CCN / CFK)"
        icon={FileText}
        accent="text-indigo-600"
        liees={commandesLiees}
        liensByPiece={commandeLienByPiece}
        types={['CCN', 'CFK']}
        search={searchCommandes}
        onLier={(num) =>
          lierCommande.mutate(num, {
            onSuccess: () => toast({ title: 'Commande liée' }),
            onError: (e) => toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' }),
          })
        }
        onDelier={(id) =>
          delierCommande.mutate(id, {
            onError: (e) => toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' }),
          })
        }
        pending={lierCommande.isPending || delierCommande.isPending}
        loading={isLoading}
      />

      {/* Factures (FCN/FFK) */}
      <Section
        title="Factures (FCN / FFK)"
        icon={Receipt}
        accent="text-violet-600"
        liees={facturesLiees}
        liensByPiece={factureLienByPiece}
        types={['FCN', 'FFK']}
        search={searchFactures}
        onLier={(num) =>
          lierFacture.mutate(num, {
            onSuccess: () => toast({ title: 'Facture liée' }),
            onError: (e) => toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' }),
          })
        }
        onDelier={(id) =>
          delierFacture.mutate(id, {
            onError: (e) => toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' }),
          })
        }
        pending={lierFacture.isPending || delierFacture.isPending}
        loading={isLoading}
      />

      {/* Récap */}
      <div className="border-t pt-3 flex items-center gap-6 text-sm tabular-nums">
        <span className={cn('font-semibold', engage > 0 ? 'text-indigo-600' : 'text-muted-foreground')}>
          Engagé : {eur(engage)}
        </span>
        <span className={cn('font-semibold', constate > 0 ? 'text-violet-600' : 'text-muted-foreground')}>
          Constaté : {eur(constate)}
        </span>
      </div>
    </div>
  );
}

// ─── Section générique (commandes ou factures) ──────────────────────────────

interface SectionProps {
  title: string;
  icon: React.ElementType;
  accent: string;
  liees: BEDivaltoMouvementGrouped[];
  liensByPiece: Map<string, { id: string }>;
  types: BEDivaltoTypeMouv[];
  search: (q: string) => Promise<BEDivaltoMouvementGrouped[]>;
  onLier: (numero_piece: string) => void;
  onDelier: (lienId: string) => void;
  pending: boolean;
  loading: boolean;
}

function Section({
  title, icon: Icon, accent, liees, liensByPiece, types, search,
  onLier, onDelier, pending, loading,
}: SectionProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BEDivaltoMouvementGrouped[]>([]);
  const [searching, setSearching] = useState(false);

  const runSearch = useCallback(
    async (q: string) => {
      setSearching(true);
      try {
        const r = await search(q);
        setResults(r);
      } catch (e) {
        toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
      } finally {
        setSearching(false);
      }
    },
    [search],
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', accent)} />
          <h4 className="text-sm font-semibold">{title}</h4>
          <Badge variant="secondary" className="text-[10px]">
            {liees.length}
          </Badge>
        </div>

        <Popover
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (o) runSearch('');
          }}
        >
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
              <Plus className="h-3 w-3" />
              Lier une pièce
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[420px] p-0" align="end">
            <div className="p-2 border-b">
              <Input
                placeholder="Rechercher (numéro, libellé, tiers)…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  runSearch(e.target.value);
                }}
                className="h-8 text-sm"
                autoFocus
              />
            </div>
            <ScrollArea className="max-h-72">
              {searching ? (
                <div className="p-3 space-y-2">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : results.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Aucune pièce {types.join(' / ')} trouvée pour ce code affaire.
                </div>
              ) : (
                <div className="divide-y">
                  {results.map((p) => {
                    const alreadyLinked = liensByPiece.has(p.numero_piece);
                    return (
                      <div
                        key={p.numero_piece}
                        className="flex items-center gap-2 p-2 hover:bg-muted/30"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono font-semibold">{p.numero_piece}</code>
                            <Badge variant="outline" className="text-[9px] px-1 py-0">
                              {p.type_mouv}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {p.nom_tiers ?? '—'} · {p.libelle ?? ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold tabular-nums">
                            {eur(p.montant_ht)}
                          </p>
                          {p.ht_estime && (
                            <p className="text-[9px] text-amber-600">HT estimé</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant={alreadyLinked ? 'secondary' : 'default'}
                          className="h-7 text-xs"
                          disabled={alreadyLinked || pending}
                          onClick={() => {
                            onLier(p.numero_piece);
                            setOpen(false);
                          }}
                        >
                          {alreadyLinked ? 'Liée' : 'Lier'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>

      {/* Liste des pièces liées */}
      {loading && liees.length === 0 ? (
        <div className="space-y-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : liees.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded">
          Aucune pièce liée
        </div>
      ) : (
        <div className="border rounded divide-y">
          {liees.map((p) => {
            const lien = liensByPiece.get(p.numero_piece);
            return (
              <div
                key={p.numero_piece}
                className="flex items-center gap-2 px-3 py-2 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono font-semibold">{p.numero_piece}</code>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      {p.type_mouv}
                    </Badge>
                    {p.ht_estime && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-[9px] text-amber-600 cursor-help">HT estimé</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            HT calculé depuis le TTC compta (TVA 20 %) — pas de pièce gescom liée.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {p.nom_tiers ?? '—'} · {p.date_piece ?? ''}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums">{eur(p.montant_ht)}</p>
                {lien && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    disabled={pending}
                    onClick={() => onDelier(lien.id)}
                    title="Délier"
                  >
                    {pending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
