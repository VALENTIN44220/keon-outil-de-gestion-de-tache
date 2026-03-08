import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Download, Search, Monitor, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// FDR external Supabase config (read-only, publishable anon key)
const FDR_URL = 'https://wlbajtwyccgyzffumvuw.supabase.co';
const FDR_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsYmFqdHd5Y2NneXpmZnVtdnV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMzI2NTksImV4cCI6MjA4NDgwODY1OX0.4Pk1dMHWsHsfq1UIIABTFUpIScl5QUqVGD8STRwejG0';

interface FDRTask {
  id: string;
  title: string;
  description?: string | null;
  type?: string | null;
  priority?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  horizon?: string | null;
  is_example?: boolean;
}

const TYPE_MAP: Record<string, string> = {
  infrastructure: 'infrastructure',
  applicatif: 'applicatif',
  securite: 'securite',
  sécurité: 'securite',
  data: 'data',
  integration: 'integration',
  intégration: 'integration',
};

const PRIORITY_MAP: Record<string, string> = {
  critical: 'critique',
  high: 'haute',
  medium: 'normale',
  low: 'basse',
};

function mapType(t?: string | null): string {
  if (!t) return 'autre';
  return TYPE_MAP[t.toLowerCase()] ?? 'autre';
}

function mapPriority(p?: string | null): string {
  if (!p) return 'normale';
  return PRIORITY_MAP[p.toLowerCase()] ?? 'normale';
}

export default function ITProjectImportFDR() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<FDRTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterHorizon, setFilterHorizon] = useState('all');

  const fetchFDR = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${FDR_URL}/rest/v1/tasks_future?select=*&is_example=eq.false&order=created_at.desc`,
        {
          method: 'GET',
          headers: {
            'apikey': FDR_ANON_KEY,
            'Authorization': `Bearer ${FDR_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('FDR fetch error:', response.status, errorText);
        throw new Error(`Erreur ${response.status}: ${errorText}`);
      }
      
      const data: FDRTask[] = await response.json();
      console.log('FDR data received:', data.length, 'actions');
      setRows(data);
    } catch (e: any) {
      const errorMsg = e.message || 'Erreur de chargement';
      console.error('FDR Error:', errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFDR(); }, [fetchFDR]);

  // Unique values for filter dropdowns
  const uniqueStatuses = [...new Set(rows.map(r => r.status).filter(Boolean))] as string[];
  const uniqueTypes = [...new Set(rows.map(r => r.type).filter(Boolean))] as string[];
  const uniqueHorizons = [...new Set(rows.map(r => r.horizon).filter(Boolean))] as string[];

  const filtered = rows.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterType !== 'all' && r.type !== filterType) return false;
    if (filterHorizon !== 'all' && r.horizon !== filterHorizon) return false;
    if (search && !r.title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(r => r.id)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleImport = async () => {
    const toImport = rows.filter(r => selected.has(r.id) && !importedIds.has(r.id));
    if (toImport.length === 0) return;
    setImporting(true);

    let successCount = 0;
    const newImported = new Set(importedIds);

    for (const row of toImport) {
      const descPrefix = `[Importé depuis FDR - horizon: ${row.horizon || 'N/A'}]`;
      const fullDesc = row.description ? `${descPrefix} ${row.description}` : descPrefix;

      const { error } = await supabase.from('it_projects').insert({
        nom_projet: row.title || 'Sans titre',
        description: fullDesc,
        type_projet: mapType(row.type),
        priorite: mapPriority(row.priority),
        statut: 'backlog',
        date_debut: row.start_date || null,
        date_fin_prevue: row.end_date || null,
        phase_courante: 'cadrage',
      } as any);

      if (!error) {
        successCount++;
        newImported.add(row.id);
      }
    }

    setImportedIds(newImported);
    setSelected(new Set());
    setImporting(false);

    toast({
      title: `${successCount} projet(s) importé(s)`,
      description: `Les projets ont été créés avec le statut Backlog.`,
    });
  };

  const formatDate = (d?: string | null) => {
    if (!d) return '—';
    try { return format(new Date(d), 'dd MMM yyyy', { locale: fr }); }
    catch { return d; }
  };

  return (
    <Layout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/it/projects')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25">
                <Download className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Import FDR Digitale</h1>
                <p className="text-sm text-muted-foreground">
                  Importer des actions depuis la Feuille de Route vers les Projets IT
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigate('/it/projects')}
                className="gap-2"
              >
                <Monitor className="h-4 w-4" /> Aller aux Projets IT
              </Button>
              <Button
                onClick={handleImport}
                disabled={selected.size === 0 || importing}
                className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/25"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Importer la sélection ({selected.size})
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par titre..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                {uniqueStatuses.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                {uniqueTypes.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterHorizon} onValueChange={setFilterHorizon}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Horizon" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous horizons</SelectItem>
                {uniqueHorizons.map(h => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="h-9 px-3 flex items-center">
              {filtered.length} ligne(s)
            </Badge>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-6 pb-6 pt-4">
          {loading ? (
            <div className="flex items-center justify-center h-64 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
              <span className="text-muted-foreground">Chargement de la FDR...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg max-w-md">
                <p className="text-destructive font-bold mb-2">Erreur de connexion à la FDR</p>
                <p className="text-sm text-destructive/80 font-mono break-words">{error}</p>
              </div>
              <Button variant="outline" onClick={fetchFDR} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Réessayer
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Download className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">Aucune action FDR trouvée</p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filtered.length > 0 && selected.size === filtered.length}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[90px]">Priorité</TableHead>
                    <TableHead className="w-[90px]">Statut</TableHead>
                    <TableHead className="w-[110px]">Début</TableHead>
                    <TableHead className="w-[110px]">Fin</TableHead>
                    <TableHead className="w-[100px]">Horizon</TableHead>
                    <TableHead className="w-[120px]">Import</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(row => {
                    const isImported = importedIds.has(row.id);
                    return (
                      <TableRow
                        key={row.id}
                        className={cn(
                          isImported && 'opacity-60',
                          selected.has(row.id) && !isImported && 'bg-violet-50/50 dark:bg-violet-950/20',
                        )}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selected.has(row.id)}
                            onCheckedChange={() => toggle(row.id)}
                            disabled={isImported}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-sm max-w-[300px] truncate">
                          {row.title || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {row.type || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px]',
                              row.priority === 'high' && 'border-orange-500/30 text-orange-600',
                              row.priority === 'critical' && 'border-red-500/30 text-red-600',
                              row.priority === 'low' && 'border-slate-400/30 text-slate-500',
                            )}
                          >
                            {row.priority || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {row.status || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(row.start_date)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(row.end_date)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {row.horizon || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isImported ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px]">
                              ✓ Importé
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Non importé
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
