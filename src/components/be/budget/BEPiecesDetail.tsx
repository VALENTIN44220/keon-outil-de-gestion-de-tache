/**
 * BEPiecesDetail — Affichage détaillé des pièces Divalto d'une affaire BE.
 * Port du composant PiecesDetail de SpvBudget.tsx, adapté au flux BE :
 *   DC (Devis Client sans commande) = CA Potentiel
 *   CC (Commande Client) = CA Vendu
 *   FC (Facture Client) = CA Constaté
 *   CF (Commande Fourn.) = COGS Prévu
 *   FF (Facture Fourn.) = COGS Constaté
 */
import { Fragment, useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronRight, ChevronDown, FilePen, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  classifyBEPiece,
  BE_PIECE_CAT_LABEL,
  BE_PIECE_CAT_COLOR,
  BE_PIECE_CAT_BG,
  type BEPieceCategorie,
  type BEAffairePiece,
} from '@/types/beAffaire';
import { useBEAffairePieces, useBEPiecePeriodes } from '@/hooks/useBEAffairePieces';

const eur = (n: number) =>
  (Number(n) || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const CAT_ORDER: BEPieceCategorie[] = [
  'ca_potentiel', 'ca_vendu', 'ca_constate', 'cogs_prevu', 'cogs_constate', 'devis_fournisseur',
];

const ZERO_CATS: Record<BEPieceCategorie, number> = {
  ca_potentiel: 0, ca_vendu: 0, ca_constate: 0,
  cogs_prevu: 0, cogs_constate: 0, devis_fournisseur: 0, autre: 0,
};

interface PieceLine { libelle: string | null; montant: number; date_piece: string | null; }
interface PieceGroup {
  key: string;
  numero_piece: string | null;
  date_piece: string | null;
  tiers_code: string | null;
  nom_tiers: string | null;
  libelle_entete: string | null;
  categorie: BEPieceCategorie;
  montantTotal: number;
  lines: PieceLine[];
  fullcdno_lie: string | null;
  doc_type: string;
}

function useBEPiecesData(codeAffaire: string) {
  const { data: pieces = [], isLoading } = useBEAffairePieces(codeAffaire);

  const computed = useMemo(() => {
    const totals: Record<BEPieceCategorie, number> = { ...ZERO_CATS };
    const monthMap = new Map<string, Record<BEPieceCategorie, number>>();
    const groupMap = new Map<string, PieceGroup>();
    let noKeyIdx = 0;

    for (const p of pieces) {
      const { categorie, montant } = classifyBEPiece(p);
      totals[categorie] += montant;

      const mois = (p.date_piece ?? '').slice(0, 7) || '—';
      if (!monthMap.has(mois)) monthMap.set(mois, { ...ZERO_CATS });
      monthMap.get(mois)![categorie] += montant;

      const hasPiece = p.numero_piece && p.numero_piece !== '0';
      const key = hasPiece ? p.numero_piece! : `__${noKeyIdx++}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          numero_piece:   hasPiece ? p.numero_piece : null,
          date_piece:     p.date_piece,
          tiers_code:     p.tiers_code,
          nom_tiers:      p.nom_tiers,
          libelle_entete: p.libelle_entete ?? null,
          categorie,
          montantTotal:   0,
          lines:          [],
          fullcdno_lie:   p.fullcdno_lie,
          doc_type:       p.doc_type,
        });
      }
      const g = groupMap.get(key)!;
      g.montantTotal += montant;
      g.lines.push({ libelle: p.libelle, montant, date_piece: p.date_piece });
    }

    const groups = Array.from(groupMap.values()).sort((a, b) => {
      const d = (b.date_piece ?? '').localeCompare(a.date_piece ?? '');
      return d !== 0 ? d : (a.numero_piece ?? '').localeCompare(b.numero_piece ?? '');
    });
    const byMonth = Array.from(monthMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]));

    return { totals, byMonth, groups };
  }, [pieces]);

  return { ...computed, isLoading, isEmpty: pieces.length === 0 };
}

// ── Résumé mensuel ─────────────────────────────────────────────────────────
export function BEMensuelBreakdown({ codeAffaire }: { codeAffaire: string }) {
  const { totals, byMonth, isLoading, isEmpty } = useBEPiecesData(codeAffaire);
  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (isEmpty) return <p className="text-xs text-muted-foreground">Aucune pièce Divalto pour cette affaire.</p>;

  const hasDevis = totals.ca_potentiel > 0;
  const hasCogs  = totals.cogs_prevu > 0 || totals.cogs_constate > 0;

  return (
    <div className="space-y-3">
      {/* Résumé par catégorie */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {CAT_ORDER.filter(c => totals[c] > 0).map((c) => (
          <div key={c} className={cn('rounded-lg border px-3 py-2', BE_PIECE_CAT_BG[c])}>
            <p className="text-[10px] text-muted-foreground leading-tight">{BE_PIECE_CAT_LABEL[c]}</p>
            <p className={cn('text-sm font-bold tabular-nums', BE_PIECE_CAT_COLOR[c])}>{eur(totals[c])}</p>
          </div>
        ))}
      </div>

      {/* Tableau mensuel */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-7 text-[11px]">Mois</TableHead>
              {hasDevis && <TableHead className="h-7 text-[11px] text-right text-violet-600">CA Potentiel</TableHead>}
              <TableHead className="h-7 text-[11px] text-right text-blue-600">CA Vendu</TableHead>
              <TableHead className="h-7 text-[11px] text-right text-blue-900">CA Constaté</TableHead>
              {hasCogs && <TableHead className="h-7 text-[11px] text-right text-orange-500">COGS Prévu</TableHead>}
              {hasCogs && <TableHead className="h-7 text-[11px] text-right text-orange-800">COGS Constaté</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {byMonth.map(([mois, v]) => (
              <TableRow key={mois} className="hover:bg-muted/40">
                <TableCell className="py-1 text-xs font-medium tabular-nums">{mois}</TableCell>
                {hasDevis && <TableCell className="py-1 text-xs text-right tabular-nums">{v.ca_potentiel   ? eur(v.ca_potentiel)   : '—'}</TableCell>}
                <TableCell className="py-1 text-xs text-right tabular-nums">{v.ca_vendu      ? eur(v.ca_vendu)      : '—'}</TableCell>
                <TableCell className="py-1 text-xs text-right tabular-nums">{v.ca_constate   ? eur(v.ca_constate)   : '—'}</TableCell>
                {hasCogs && <TableCell className="py-1 text-xs text-right tabular-nums">{v.cogs_prevu    ? eur(v.cogs_prevu)    : '—'}</TableCell>}
                {hasCogs && <TableCell className="py-1 text-xs text-right tabular-nums">{v.cogs_constate ? eur(v.cogs_constate) : '—'}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Ligne pièce avec assignation période ─────────────────────────────────────
function PeriodeInput({
  codeAffaire,
  numeroPiece,
  docType,
  periodeMap,
  upsert,
}: {
  codeAffaire: string;
  numeroPiece: string;
  docType: string;
  periodeMap: Map<string, { date_prevue: string | null; date_prevue_fin: string | null }>;
  upsert: { mutate: (v: any, opts?: any) => void; isPending: boolean };
}) {
  const existing = periodeMap.get(numeroPiece);
  const [val, setVal] = useState(existing?.date_prevue ?? '');

  const handleBlur = () => {
    if (val === (existing?.date_prevue ?? '')) return;
    upsert.mutate(
      { code_affaire: codeAffaire, numero_piece: numeroPiece, doc_type: docType, date_prevue: val || null },
      { onSuccess: () => toast({ title: 'Période enregistrée' }) },
    );
  };

  return (
    <Input
      type="month"
      value={val ? val.slice(0, 7) : ''}
      onChange={e => setVal(e.target.value ? e.target.value + '-01' : '')}
      onBlur={handleBlur}
      className="h-6 text-[10px] w-28 border-dashed"
      title="Affecter à une période prévisionnelle"
    />
  );
}

// ── Liste des pièces (expandable) ─────────────────────────────────────────────
export function BEPiecesDetail({ codeAffaire }: { codeAffaire: string }) {
  const { groups, isLoading, isEmpty } = useBEPiecesData(codeAffaire);
  const { periodes, upsert } = useBEPiecePeriodes(codeAffaire);
  const [expandedPieces, setExpandedPieces] = useState<Set<string>>(new Set());

  const periodeMap = useMemo(() => {
    const m = new Map<string, { date_prevue: string | null; date_prevue_fin: string | null }>();
    for (const p of periodes) m.set(p.numero_piece, { date_prevue: p.date_prevue, date_prevue_fin: p.date_prevue_fin });
    return m;
  }, [periodes]);

  const togglePiece = (key: string) =>
    setExpandedPieces(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (isEmpty)   return <p className="text-xs text-muted-foreground">Aucune pièce Divalto pour cette affaire.</p>;

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="max-h-[520px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-7 w-6 text-[11px]" />
              <TableHead className="h-7 text-[11px]">Date</TableHead>
              <TableHead className="h-7 text-[11px]">Type</TableHead>
              <TableHead className="h-7 text-[11px]">N° pièce</TableHead>
              <TableHead className="h-7 text-[11px]">Objet</TableHead>
              <TableHead className="h-7 text-[11px]">Tiers</TableHead>
              <TableHead className="h-7 text-[11px] flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                Période prévi.
              </TableHead>
              <TableHead className="h-7 text-[11px] text-right">Montant HT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => {
              const isExpanded = expandedPieces.has(g.key);
              const multiLine = g.lines.length > 1;
              const isPotentiel = g.categorie === 'ca_potentiel';
              return (
                <Fragment key={g.key}>
                  <TableRow
                    className={cn(
                      'hover:bg-muted/40',
                      multiLine ? 'cursor-pointer' : '',
                      isExpanded ? 'bg-muted/20' : '',
                      isPotentiel ? 'bg-violet-50/60' : '',
                    )}
                    onClick={() => multiLine && togglePiece(g.key)}
                  >
                    <TableCell className="py-1 pl-2">
                      {multiLine
                        ? isExpanded
                          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        : <span className="w-3.5 inline-block" />}
                    </TableCell>
                    <TableCell className="py-1 text-xs tabular-nums whitespace-nowrap">{g.date_piece ?? '—'}</TableCell>
                    <TableCell className="py-1 text-xs">
                      <span className={cn('font-semibold text-[11px]', BE_PIECE_CAT_COLOR[g.categorie])}>
                        {isPotentiel && <FilePen className="h-3 w-3 inline mr-1 -mt-0.5" />}
                        {BE_PIECE_CAT_LABEL[g.categorie]}
                      </span>
                    </TableCell>
                    <TableCell className="py-1 text-xs font-mono whitespace-nowrap">
                      {g.numero_piece ?? <span className="text-muted-foreground italic">—</span>}
                      {multiLine && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground font-sans">
                          ({g.lines.length})
                        </span>
                      )}
                      {g.fullcdno_lie && (
                        <span className="ml-1 text-[9px] text-muted-foreground font-sans">→{g.fullcdno_lie}</span>
                      )}
                    </TableCell>
                    <TableCell
                      className="py-1 text-[11px] text-muted-foreground max-w-[200px] truncate"
                      title={g.libelle_entete ?? ''}
                    >
                      {g.libelle_entete ?? <span className="italic opacity-40">—</span>}
                    </TableCell>
                    <TableCell className="py-1 text-[11px] text-muted-foreground whitespace-nowrap">
                      {g.nom_tiers ?? g.tiers_code ?? '—'}
                    </TableCell>
                    <TableCell className="py-1" onClick={e => e.stopPropagation()}>
                      {g.numero_piece && (isPotentiel || g.categorie === 'ca_vendu' || g.categorie === 'cogs_prevu') ? (
                        <PeriodeInput
                          codeAffaire={codeAffaire}
                          numeroPiece={g.numero_piece}
                          docType={g.doc_type}
                          periodeMap={periodeMap}
                          upsert={upsert}
                        />
                      ) : (
                        <span className="text-[10px] text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1 text-xs text-right tabular-nums font-semibold">
                      {eur(g.montantTotal)}
                    </TableCell>
                  </TableRow>
                  {isExpanded && g.lines.map((l, li) => (
                    <TableRow key={li} className="bg-muted/10 hover:bg-muted/20">
                      <TableCell className="py-0.5 pl-2" />
                      <TableCell className="py-0.5 text-[11px] text-muted-foreground tabular-nums pl-6">{l.date_piece ?? ''}</TableCell>
                      <TableCell colSpan={5} className="py-0.5 text-[11px] text-muted-foreground pl-4 max-w-[360px] truncate" title={l.libelle ?? ''}>
                        {l.libelle ?? '—'}
                      </TableCell>
                      <TableCell className="py-0.5 text-[11px] text-right tabular-nums text-muted-foreground">
                        {eur(l.montant)}
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
