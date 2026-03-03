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

type SortKey = 'nom_projet' | 'code_projet' | 'entite_concernee' | 'usage_inno' | 'status' | 'requester_name' | 'updated_at';

const PAGE_SIZE = 25;

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
      const va = (a[sortKey] || '').toString().toLowerCase();
      const vb = (b[sortKey] || '').toString().toLowerCase();
      const cmp = va.localeCompare(vb);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [requests, sortKey, sortDir]);

  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

  const exportCsv = () => {
    const headers = ['N°', 'Nom projet', 'Code', 'Entité', 'Usage', 'Statut', 'Demandeur', 'Date MAJ'];
    const rows = sorted.map(r => [
      r.request_number || '', r.nom_projet, r.code_projet, r.entite_concernee,
      r.usage_inno, STATUS_CONFIG[r.status]?.label || r.status, r.requester_name,
      format(new Date(r.updated_at), 'yyyy-MM-dd'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
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

  const TH = ({ col, children }: { col: SortKey; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort(col)}>
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">N°</TableHead>
              <TH col="nom_projet">Nom projet</TH>
              <TH col="code_projet">Code</TH>
              <TH col="entite_concernee">Entité</TH>
              <TH col="usage_inno">Usage</TH>
              <TH col="status">Statut</TH>
              <TH col="requester_name">Demandeur</TH>
              <TH col="updated_at">MAJ</TH>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="py-12 text-center text-muted-foreground">Aucune demande.</TableCell></TableRow>
            ) : paged.map(r => (
              <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDrawerReq(r)}>
                <TableCell className="text-xs text-muted-foreground font-mono">{r.request_number || '-'}</TableCell>
                <TableCell className="font-medium max-w-[200px] truncate">{r.nom_projet || r.title}</TableCell>
                <TableCell><Badge variant="outline">{r.code_projet || '-'}</Badge></TableCell>
                <TableCell className="text-sm">{r.entite_concernee || '-'}</TableCell>
                <TableCell className="text-sm">{r.usage_inno || '-'}</TableCell>
                <TableCell>
                  <Badge style={{ backgroundColor: STATUS_CONFIG[r.status]?.color, color: '#fff' }}>
                    {STATUS_CONFIG[r.status]?.label || r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{r.requester_name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{format(new Date(r.updated_at), 'dd/MM/yy', { locale: fr })}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); onOpenDetail(r.id); }}>
                    <Eye className="w-4 h-4" />
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
        <SheetContent className="w-[400px] sm:w-[500px] overflow-y-auto">
          {drawerReq && (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg">{drawerReq.nom_projet || drawerReq.title}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-xs text-muted-foreground block">N°</span>{drawerReq.request_number || '-'}</div>
                  <div><span className="text-xs text-muted-foreground block">Code</span>{drawerReq.code_projet || '-'}</div>
                  <div><span className="text-xs text-muted-foreground block">Entité</span>{drawerReq.entite_concernee || '-'}</div>
                  <div><span className="text-xs text-muted-foreground block">Usage</span>{drawerReq.usage_inno || '-'}</div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Statut</span>
                    <Badge style={{ backgroundColor: STATUS_CONFIG[drawerReq.status]?.color, color: '#fff' }}>
                      {STATUS_CONFIG[drawerReq.status]?.label || drawerReq.status}
                    </Badge>
                  </div>
                  <div><span className="text-xs text-muted-foreground block">Sponsor</span>{drawerReq.sponsor || '-'}</div>
                  <div><span className="text-xs text-muted-foreground block">Demandeur</span>{drawerReq.requester_name}</div>
                  <div><span className="text-xs text-muted-foreground block">Créée le</span>{format(new Date(drawerReq.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</div>
                </div>
                <Separator />
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Descriptif</span>
                  <p className="text-sm whitespace-pre-wrap">{drawerReq.descriptif || '-'}</p>
                </div>
                {drawerReq.commentaire_demande && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Commentaire</span>
                    <p className="text-sm whitespace-pre-wrap">{drawerReq.commentaire_demande}</p>
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
