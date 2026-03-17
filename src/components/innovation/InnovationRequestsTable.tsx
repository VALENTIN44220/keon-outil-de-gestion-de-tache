import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Download, Eye, ChevronUp, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { STATUS_CONFIG, type InnoRequest } from './constants';

interface Props {
  requests: InnoRequest[];
  onOpenDetail: (id: string) => void;
}

type SortKey = keyof InnoRequest;

const PAGE_SIZE = 25;

const formatCurrency = (v: number | null) => {
  if (v == null) return '-';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
};

export function InnovationRequestsTable({ requests, onOpenDetail }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('updated_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [drawerReq, setDrawerReq] = useState<InnoRequest | null>(null);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = useMemo(() => {
    const copy = [...requests];
    copy.sort((a, b) => {
      const va = (a[sortKey] ?? '').toString().toLowerCase();
      const vb = (b[sortKey] ?? '').toString().toLowerCase();
      const cmp = va.localeCompare(vb);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [requests, sortKey, sortDir]);

  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

  const exportCsv = () => {
    const headers = ['Nom projet', 'Code', 'Thème', 'Sous-thème', 'Entité', 'Usage', 'Statut', 'Demandeur',
      'Gain attendu', 'Partenaires', 'EBITDA (€/an)', 'CAPEX (€)', 'ROI', 'Commentaires financiers',
      'Temps caractéristique', 'Difficulté', 'Niveau stratégique', 'Étiquettes', 'Sponsor', 'Date MAJ'];
    const rows = sorted.map(r => [
      r.nom_projet, r.code_projet, r.theme, r.sous_theme, r.entite_concernee,
      r.usage_inno, STATUS_CONFIG[r.status]?.label || r.status, r.requester_name,
      r.gain_attendu, r.partenaires_identifies,
      r.ebitda_retour_financier ?? '', r.capex_investissement ?? '', r.roi ?? '',
      r.commentaires_financiers, r.temps_caracteristique,
      r.difficulte_complexite ?? '', r.niveau_strategique ?? '',
      r.etiquettes, r.sponsor,
      format(new Date(r.updated_at), 'yyyy-MM-dd'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c?.toString() || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `innovation_demandes_${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />;
  };

  const TH = ({ col, children, className }: { col: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead className={`cursor-pointer select-none hover:text-foreground whitespace-nowrap text-xs ${className || ''}`} onClick={() => toggleSort(col)}>
      {children}<SortIcon col={col} />
    </TableHead>
  );

  return (
    <div>
      <div className="flex justify-end mb-2">
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="w-3.5 h-3.5 mr-1" /> CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TH col="nom_projet">Nom projet</TH>
              <TH col="code_projet">Code</TH>
              <TH col="theme">Thème</TH>
              <TH col="sous_theme">Sous-thème</TH>
              <TH col="entite_concernee">Entité</TH>
              <TH col="usage_inno">Usage</TH>
              <TH col="status">Statut</TH>
              <TH col="requester_name">Demandeur</TH>
              <TH col="gain_attendu">Gain attendu</TH>
              <TH col="partenaires_identifies">Partenaires</TH>
              <TH col="ebitda_retour_financier">EBITDA</TH>
              <TH col="capex_investissement">CAPEX</TH>
              <TH col="roi">ROI</TH>
              <TH col="commentaires_financiers">Com. financiers</TH>
              <TH col="temps_caracteristique">Temps caract.</TH>
              <TH col="difficulte_complexite">Difficulté</TH>
              <TH col="niveau_strategique">Niveau strat.</TH>
              <TH col="etiquettes">Étiquettes</TH>
              <TH col="sponsor">Sponsor</TH>
              <TH col="updated_at">MAJ</TH>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow><TableCell colSpan={21} className="py-12 text-center text-muted-foreground">Aucune demande.</TableCell></TableRow>
            ) : paged.map(r => (
              <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDrawerReq(r)}>
                <TableCell className="font-medium max-w-[180px] truncate">{r.nom_projet || r.title}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px]">{r.code_projet || '-'}</Badge></TableCell>
                <TableCell className="max-w-[120px] truncate">{r.theme || '-'}</TableCell>
                <TableCell className="max-w-[120px] truncate">{r.sous_theme || '-'}</TableCell>
                <TableCell>{r.entite_concernee || '-'}</TableCell>
                <TableCell>{r.usage_inno || '-'}</TableCell>
                <TableCell>
                  <Badge className="text-[10px]" style={{ backgroundColor: STATUS_CONFIG[r.status]?.color, color: '#fff' }}>
                    {STATUS_CONFIG[r.status]?.label || r.status}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[100px] truncate">{r.requester_name}</TableCell>
                <TableCell className="max-w-[150px] truncate">{r.gain_attendu || '-'}</TableCell>
                <TableCell className="max-w-[120px] truncate">{r.partenaires_identifies || '-'}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(r.ebitda_retour_financier)}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(r.capex_investissement)}</TableCell>
                <TableCell className="text-right font-mono">{r.roi != null ? r.roi.toFixed(1) : '-'}</TableCell>
                <TableCell className="max-w-[150px] truncate">{r.commentaires_financiers || '-'}</TableCell>
                <TableCell>{r.temps_caracteristique || '-'}</TableCell>
                <TableCell className="text-center">{r.difficulte_complexite ?? '-'}</TableCell>
                <TableCell className="text-center">{r.niveau_strategique ?? '-'}</TableCell>
                <TableCell className="max-w-[100px] truncate">{r.etiquettes || '-'}</TableCell>
                <TableCell className="max-w-[100px] truncate">{r.sponsor || '-'}</TableCell>
                <TableCell className="text-muted-foreground">{format(new Date(r.updated_at), 'dd/MM/yy', { locale: fr })}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); onOpenDetail(r.id); }}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
          <span>Page {page + 1} / {totalPages} ({sorted.length} demandes)</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Préc.</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Suiv.</Button>
          </div>
        </div>
      )}

      {/* Drawer detail */}
      <Sheet open={!!drawerReq} onOpenChange={o => !o && setDrawerReq(null)}>
        <SheetContent className="w-[450px] sm:w-[550px] overflow-y-auto">
          {drawerReq && (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg">{drawerReq.nom_projet || drawerReq.title}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-xs text-muted-foreground block">Code</span>{drawerReq.code_projet || '-'}</div>
                  <div><span className="text-xs text-muted-foreground block">Thème</span>{drawerReq.theme || '-'}</div>
                  <div><span className="text-xs text-muted-foreground block">Sous-thème</span>{drawerReq.sous_theme || '-'}</div>
                  <div><span className="text-xs text-muted-foreground block">Entité</span>{drawerReq.entite_concernee || '-'}</div>
                  <div><span className="text-xs text-muted-foreground block">Usage</span>{drawerReq.usage_inno || '-'}</div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Statut</span>
                    <Badge style={{ backgroundColor: STATUS_CONFIG[drawerReq.status]?.color, color: '#fff' }}>
                      {STATUS_CONFIG[drawerReq.status]?.label || drawerReq.status}
                    </Badge>
                  </div>
                  <div><span className="text-xs text-muted-foreground block">Demandeur</span>{drawerReq.requester_name}</div>
                  <div><span className="text-xs text-muted-foreground block">Sponsor</span>{drawerReq.sponsor || '-'}</div>
                  <div><span className="text-xs text-muted-foreground block">Créée le</span>{format(new Date(drawerReq.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</div>
                </div>
                <Separator />
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Gain attendu</span>
                  <p className="text-sm">{drawerReq.gain_attendu || '-'}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Partenaires identifiés</span>
                  <p className="text-sm">{drawerReq.partenaires_identifies || '-'}</p>
                </div>
                <Separator />
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><span className="text-xs text-muted-foreground block">EBITDA (€/an)</span>{formatCurrency(drawerReq.ebitda_retour_financier)}</div>
                  <div><span className="text-xs text-muted-foreground block">CAPEX (€)</span>{formatCurrency(drawerReq.capex_investissement)}</div>
                  <div><span className="text-xs text-muted-foreground block">ROI</span>{drawerReq.roi != null ? drawerReq.roi.toFixed(1) : '-'}</div>
                </div>
                {drawerReq.commentaires_financiers && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Commentaires financiers</span>
                    <p className="text-sm whitespace-pre-wrap">{drawerReq.commentaires_financiers}</p>
                  </div>
                )}
                <Separator />
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><span className="text-xs text-muted-foreground block">Temps caractéristique</span>{drawerReq.temps_caracteristique || '-'}</div>
                  <div><span className="text-xs text-muted-foreground block">Difficulté (1-10)</span>{drawerReq.difficulte_complexite ?? '-'}</div>
                  <div><span className="text-xs text-muted-foreground block">Niveau stratégique (1-10)</span>{drawerReq.niveau_strategique ?? '-'}</div>
                </div>
                <Separator />
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Descriptif</span>
                  <p className="text-sm whitespace-pre-wrap">{drawerReq.descriptif || '-'}</p>
                </div>
                {drawerReq.commentaire_demande && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Commentaire demande</span>
                    <p className="text-sm whitespace-pre-wrap">{drawerReq.commentaire_demande}</p>
                  </div>
                )}
                {drawerReq.commentaire_projet && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Commentaire projet</span>
                    <p className="text-sm whitespace-pre-wrap">{drawerReq.commentaire_projet}</p>
                  </div>
                )}
                {drawerReq.etiquettes && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Étiquettes</span>
                    <p className="text-sm">{drawerReq.etiquettes}</p>
                  </div>
                )}
                <Separator />
                <Button className="w-full" onClick={() => onOpenDetail(drawerReq.id)}>Ouvrir le détail</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
