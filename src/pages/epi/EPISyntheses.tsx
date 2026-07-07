import { useState, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet, Download, Users, Building2, Truck, ClipboardList,
  ChevronDown, ChevronRight, Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import type { EPIRequest } from '@/types/epi';
import {
  EPI_PROFIL_LABELS, EPI_TYPE_DEMANDE_LABELS, EPI_LIGNE_STATUT_LABELS,
} from '@/types/epi';

const EPI_STATUS_LABELS: Record<string, string> = {
  todo: 'Soumise', 'in-progress': 'En cours', commandee: 'Commandée',
  attribuee: 'Attribuée', done: 'Clôturée', cancelled: 'Annulée',
};

const fmtEur = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

type SyntheseView = 'fournisseur' | 'filiale' | 'individuel' | 'attributions';

interface EPISynthesesProps {
  requests: EPIRequest[];
  isAdmin: boolean;
  refetch: () => void;
}

// ── Filters ─────────────────────────────────────────────────────────────────

function useFilters(requests: EPIRequest[]) {
  const [includeTerminal, setIncludeTerminal] = useState(false);
  const [typeDemande, setTypeDemande] = useState<string>('__all__');
  const [selectedFiliales, setSelectedFiliales] = useState<Set<string>>(new Set());
  const [selectedBeneficiaires, setSelectedBeneficiaires] = useState<Set<string>>(new Set());

  const allFiliales = useMemo(() => {
    const set = new Set<string>();
    requests.forEach(r => { if (r.filiale) set.add(r.filiale); });
    return Array.from(set).sort();
  }, [requests]);

  const allBeneficiaires = useMemo(() => {
    const map = new Map<string, string>();
    requests.forEach(r => {
      if (r.beneficiaire_id) {
        map.set(r.beneficiaire_id, `${r.beneficiaire_prenom ?? ''} ${r.beneficiaire_nom ?? ''}`.trim());
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [requests]);

  const filtered = useMemo(() => {
    let result = requests;
    if (!includeTerminal) {
      result = result.filter(r => !['done', 'cancelled'].includes(r.status));
    }
    if (typeDemande !== '__all__') {
      result = result.filter(r => r.type_demande === typeDemande);
    }
    if (selectedFiliales.size > 0) {
      result = result.filter(r => r.filiale && selectedFiliales.has(r.filiale));
    }
    if (selectedBeneficiaires.size > 0) {
      result = result.filter(r => r.beneficiaire_id && selectedBeneficiaires.has(r.beneficiaire_id));
    }
    return result;
  }, [requests, includeTerminal, typeDemande, selectedFiliales, selectedBeneficiaires]);

  return {
    filtered, includeTerminal, setIncludeTerminal,
    typeDemande, setTypeDemande,
    selectedFiliales, setSelectedFiliales, allFiliales,
    selectedBeneficiaires, setSelectedBeneficiaires, allBeneficiaires,
  };
}

// ── XLSX export helper ──────────────────────────────────────────────────────

function exportXlsx(data: Record<string, any>[], sheetName: string, filename: string) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  const colWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.max(key.length, ...data.map(r => String(r[key] ?? '').length)).toString().length + 4,
  }));
  ws['!cols'] = colWidths;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
  toast.success(`Export : ${filename}`);
}

// ── Main component ──────────────────────────────────────────────────────────

export default function EPISyntheses({ requests }: EPISynthesesProps) {
  const [view, setView] = useState<SyntheseView>('fournisseur');
  const filters = useFilters(requests);

  return (
    <div className="space-y-4">
      <FiltersPanel filters={filters} />

      <Tabs value={view} onValueChange={v => setView(v as SyntheseView)}>
        <TabsList className="h-9 p-0.5 bg-muted rounded-lg">
          <TabsTrigger value="fournisseur" className="h-7 px-3 gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
            <Truck className="h-3.5 w-3.5" /> Commandes fournisseur
          </TabsTrigger>
          <TabsTrigger value="filiale" className="h-7 px-3 gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
            <Building2 className="h-3.5 w-3.5" /> Par filiale
          </TabsTrigger>
          <TabsTrigger value="individuel" className="h-7 px-3 gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
            <Users className="h-3.5 w-3.5" /> Fiches individuelles
          </TabsTrigger>
          <TabsTrigger value="attributions" className="h-7 px-3 gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
            <ClipboardList className="h-3.5 w-3.5" /> Bilan attributions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fournisseur" className="mt-4">
          <SyntheseFournisseur requests={filters.filtered} />
        </TabsContent>
        <TabsContent value="filiale" className="mt-4">
          <SyntheseFiliale requests={filters.filtered} />
        </TabsContent>
        <TabsContent value="individuel" className="mt-4">
          <SyntheseIndividuel requests={filters.filtered} />
        </TabsContent>
        <TabsContent value="attributions" className="mt-4">
          <BilanAttributions />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Filters panel ───────────────────────────────────────────────────────────

function FiltersPanel({ filters }: { filters: ReturnType<typeof useFilters> }) {
  const [open, setOpen] = useState(true);

  return (
    <Card>
      <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">Filtres de synthèse</CardTitle>
          {open ? <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" /> : <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />}
        </div>
      </CardHeader>
      {open && (
        <CardContent className="pt-0 pb-4 px-4 space-y-3">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Type de demande</Label>
              <Select value={filters.typeDemande} onValueChange={filters.setTypeDemande}>
                <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Toutes</SelectItem>
                  {Object.entries(EPI_TYPE_DEMANDE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="incl-terminal"
                checked={filters.includeTerminal}
                onCheckedChange={(v) => filters.setIncludeTerminal(!!v)}
              />
              <Label htmlFor="incl-terminal" className="text-xs cursor-pointer">Inclure clôturées / annulées</Label>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Filiales ({filters.selectedFiliales.size || 'toutes'})</Label>
              <div className="flex flex-wrap gap-1 max-w-md">
                {filters.allFiliales.map(f => {
                  const sel = filters.selectedFiliales.has(f);
                  return (
                    <Badge
                      key={f}
                      variant={sel ? 'default' : 'outline'}
                      className={cn('cursor-pointer text-xs', sel && 'bg-primary')}
                      onClick={() => {
                        const next = new Set(filters.selectedFiliales);
                        sel ? next.delete(f) : next.add(f);
                        filters.setSelectedFiliales(next);
                      }}
                    >
                      {f}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Bénéficiaires ({filters.selectedBeneficiaires.size || 'tous'})</Label>
              <div className="flex flex-wrap gap-1 max-w-lg max-h-20 overflow-y-auto">
                {filters.allBeneficiaires.map(([id, name]) => {
                  const sel = filters.selectedBeneficiaires.has(id);
                  return (
                    <Badge
                      key={id}
                      variant={sel ? 'default' : 'outline'}
                      className={cn('cursor-pointer text-xs', sel && 'bg-primary')}
                      onClick={() => {
                        const next = new Set(filters.selectedBeneficiaires);
                        sel ? next.delete(id) : next.add(id);
                        filters.setSelectedBeneficiaires(next);
                      }}
                    >
                      {name}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ── Synthèse fournisseur ────────────────────────────────────────────────────

interface FournisseurRow {
  ref: string; designation: string; taille: string;
  qteTotal: number; qteCmdee: number; qteAttribuee: number;
  prixUnit: number; totalHT: number;
}

function SyntheseFournisseur({ requests }: { requests: EPIRequest[] }) {
  const rows = useMemo(() => {
    const map = new Map<string, FournisseurRow>();
    for (const r of requests) {
      for (const l of r.lignes ?? []) {
        const key = `${l.ref_sycomore}|${l.taille}`;
        const ex = map.get(key);
        if (ex) {
          ex.qteTotal += l.quantite;
          if (l.statut === 'commandee') ex.qteCmdee += l.quantite;
          if (l.statut === 'attribuee') ex.qteAttribuee += l.quantite;
          ex.totalHT = ex.qteTotal * ex.prixUnit;
        } else {
          map.set(key, {
            ref: l.ref_sycomore, designation: l.designation, taille: l.taille,
            qteTotal: l.quantite,
            qteCmdee: l.statut === 'commandee' ? l.quantite : 0,
            qteAttribuee: l.statut === 'attribuee' ? l.quantite : 0,
            prixUnit: l.prix_unitaire, totalHT: l.quantite * l.prix_unitaire,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.ref.localeCompare(b.ref));
  }, [requests]);

  const grandTotal = rows.reduce((s, r) => s + r.totalHT, 0);

  const handleExport = () => {
    if (rows.length === 0) return;
    exportXlsx(
      rows.map(r => ({
        'Référence': r.ref, 'Désignation': r.designation, 'Taille': r.taille,
        'Qté totale': r.qteTotal, 'Qté commandée': r.qteCmdee, 'Qté attribuée': r.qteAttribuee,
        'Prix unit. HT': r.prixUnit, 'Total HT': r.totalHT,
      })),
      'Commandes fournisseur',
      `commandes_fournisseur_epi_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  return (
    <Card>
      <CardHeader className="py-3 px-4 flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Truck className="h-4 w-4" /> Synthèse commandes fournisseur
          <Badge variant="secondary" className="text-xs">{rows.length} réf.</Badge>
        </CardTitle>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={rows.length === 0}>
          <Download className="h-3 w-3 mr-1" /> Export XLSX
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Aucune ligne pour les filtres sélectionnés.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Désignation</TableHead>
                  <TableHead>Taille</TableHead>
                  <TableHead className="text-right">Qté totale</TableHead>
                  <TableHead className="text-right">Qté cmdée</TableHead>
                  <TableHead className="text-right">Qté attribuée</TableHead>
                  <TableHead className="text-right">Prix unit.</TableHead>
                  <TableHead className="text-right">Total HT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={`${r.ref}|${r.taille}`}>
                    <TableCell className="font-mono text-xs">{r.ref}</TableCell>
                    <TableCell className="text-sm">{r.designation}</TableCell>
                    <TableCell className="text-xs">{r.taille}</TableCell>
                    <TableCell className="text-right font-medium">{r.qteTotal}</TableCell>
                    <TableCell className="text-right text-purple-600">{r.qteCmdee}</TableCell>
                    <TableCell className="text-right text-emerald-600">{r.qteAttribuee}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtEur(r.prixUnit)}</TableCell>
                    <TableCell className="text-right font-mono text-xs font-medium">{fmtEur(r.totalHT)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right">{rows.reduce((s, r) => s + r.qteTotal, 0)}</TableCell>
                  <TableCell className="text-right text-purple-600">{rows.reduce((s, r) => s + r.qteCmdee, 0)}</TableCell>
                  <TableCell className="text-right text-emerald-600">{rows.reduce((s, r) => s + r.qteAttribuee, 0)}</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-mono">{fmtEur(grandTotal)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Synthèse par filiale ────────────────────────────────────────────────────

function SyntheseFiliale({ requests }: { requests: EPIRequest[] }) {
  const [expandedFiliales, setExpandedFiliales] = useState<Set<string>>(new Set());

  const byFiliale = useMemo(() => {
    const map = new Map<string, { lines: Array<{ ref: string; designation: string; taille: string; qte: number; prix: number }>; total: number }>();
    for (const r of requests) {
      const fil = r.filiale ?? 'Non renseignée';
      if (!map.has(fil)) map.set(fil, { lines: [], total: 0 });
      const entry = map.get(fil)!;
      for (const l of r.lignes ?? []) {
        const prix = l.prix_unitaire + l.prix_flocage;
        entry.lines.push({ ref: l.ref_sycomore, designation: l.designation, taille: l.taille, qte: l.quantite, prix });
        entry.total += l.quantite * prix;
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [requests]);

  const toggle = (fil: string) => {
    const next = new Set(expandedFiliales);
    next.has(fil) ? next.delete(fil) : next.add(fil);
    setExpandedFiliales(next);
  };

  const handleExport = () => {
    const data: Record<string, any>[] = [];
    for (const [fil, { lines }] of byFiliale) {
      for (const l of lines) {
        data.push({ 'Filiale': fil, 'Référence': l.ref, 'Désignation': l.designation, 'Taille': l.taille, 'Quantité': l.qte, 'Prix unit. HT': l.prix, 'Total HT': l.qte * l.prix });
      }
    }
    if (data.length === 0) return;
    exportXlsx(data, 'Devis par filiale', `devis_filiale_epi_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <Card>
      <CardHeader className="py-3 px-4 flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Synthèse par filiale
          <Badge variant="secondary" className="text-xs">{byFiliale.length} filiale(s)</Badge>
        </CardTitle>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={byFiliale.length === 0}>
          <Download className="h-3 w-3 mr-1" /> Export XLSX
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {byFiliale.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Aucune donnée.</p>
        ) : byFiliale.map(([fil, { lines, total }]) => (
          <div key={fil} className="border rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
              onClick={() => toggle(fil)}
            >
              <div className="flex items-center gap-2">
                {expandedFiliales.has(fil) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="font-medium text-sm">{fil}</span>
                <Badge variant="outline" className="text-xs">{lines.length} lignes</Badge>
              </div>
              <span className="font-mono text-sm font-medium">{fmtEur(total)}</span>
            </button>
            {expandedFiliales.has(fil) && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead>Désignation</TableHead>
                    <TableHead>Taille</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead className="text-right">Prix unit.</TableHead>
                    <TableHead className="text-right">Total HT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{l.ref}</TableCell>
                      <TableCell className="text-sm">{l.designation}</TableCell>
                      <TableCell className="text-xs">{l.taille}</TableCell>
                      <TableCell className="text-right">{l.qte}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmtEur(l.prix)}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-medium">{fmtEur(l.qte * l.prix)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Fiches individuelles ────────────────────────────────────────────────────

function SyntheseIndividuel({ requests }: { requests: EPIRequest[] }) {
  const [expandedBenefs, setExpandedBenefs] = useState<Set<string>>(new Set());

  const byBenef = useMemo(() => {
    const map = new Map<string, {
      nom: string; filiale: string; profil: string;
      lines: Array<{ ref: string; designation: string; taille: string; qte: number; prix: number; statut: string; refDevis: string; refCmd: string }>;
      total: number;
    }>();
    for (const r of requests) {
      const bId = r.beneficiaire_id ?? 'unknown';
      const bNom = `${r.beneficiaire_prenom ?? ''} ${r.beneficiaire_nom ?? ''}`.trim() || '—';
      if (!map.has(bId)) map.set(bId, { nom: bNom, filiale: r.filiale ?? '—', profil: r.profil_epi ? EPI_PROFIL_LABELS[r.profil_epi] : '—', lines: [], total: 0 });
      const entry = map.get(bId)!;
      for (const l of r.lignes ?? []) {
        const prix = l.prix_unitaire + l.prix_flocage;
        entry.lines.push({
          ref: l.ref_sycomore, designation: l.designation, taille: l.taille, qte: l.quantite, prix,
          statut: EPI_STATUS_LABELS[r.status] ?? r.status,
          refDevis: r.ref_devis_divalto ?? '', refCmd: r.ref_commande_divalto ?? '',
        });
        entry.total += l.quantite * prix;
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].nom.localeCompare(b[1].nom));
  }, [requests]);

  const toggle = (id: string) => {
    const next = new Set(expandedBenefs);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedBenefs(next);
  };

  const handleExport = () => {
    const data: Record<string, any>[] = [];
    for (const [, b] of byBenef) {
      for (const l of b.lines) {
        data.push({
          'Collaborateur': b.nom, 'Filiale': b.filiale, 'Profil': b.profil,
          'Référence': l.ref, 'Désignation': l.designation, 'Taille': l.taille,
          'Quantité': l.qte, 'Prix unit. HT': l.prix, 'Total HT': l.qte * l.prix,
          'Statut': l.statut, 'Réf. devis': l.refDevis, 'Réf. commande': l.refCmd,
        });
      }
    }
    if (data.length === 0) return;
    exportXlsx(data, 'Fiches individuelles', `fiches_individuelles_epi_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportOne = (bId: string) => {
    const b = byBenef.find(([id]) => id === bId)?.[1];
    if (!b) return;
    const data = b.lines.map(l => ({
      'Référence': l.ref, 'Désignation': l.designation, 'Taille': l.taille,
      'Quantité': l.qte, 'Prix unit. HT': l.prix, 'Total HT': l.qte * l.prix,
      'Statut': l.statut, 'Réf. devis': l.refDevis, 'Réf. commande': l.refCmd,
    }));
    const slug = b.nom.replace(/[^a-zA-Z0-9]/g, '_');
    exportXlsx(data, b.nom, `fiche_epi_${slug}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <Card>
      <CardHeader className="py-3 px-4 flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" /> Fiches individuelles
          <Badge variant="secondary" className="text-xs">{byBenef.length} collaborateur(s)</Badge>
        </CardTitle>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={byBenef.length === 0}>
          <Download className="h-3 w-3 mr-1" /> Export XLSX (tous)
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {byBenef.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Aucune donnée.</p>
        ) : byBenef.map(([bId, b]) => (
          <div key={bId} className="border rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
              onClick={() => toggle(bId)}
            >
              <div className="flex items-center gap-2">
                {expandedBenefs.has(bId) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="font-medium text-sm">{b.nom}</span>
                <Badge variant="outline" className="text-xs">{b.filiale}</Badge>
                <Badge variant="outline" className="text-xs">{b.profil}</Badge>
                <Badge variant="secondary" className="text-xs">{b.lines.length} art.</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium">{fmtEur(b.total)}</span>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); handleExportOne(bId); }}>
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </button>
            {expandedBenefs.has(bId) && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead>Désignation</TableHead>
                    <TableHead>Taille</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead className="text-right">Prix unit.</TableHead>
                    <TableHead className="text-right">Total HT</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Réf. devis</TableHead>
                    <TableHead>Réf. cmd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {b.lines.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{l.ref}</TableCell>
                      <TableCell className="text-sm">{l.designation}</TableCell>
                      <TableCell className="text-xs">{l.taille}</TableCell>
                      <TableCell className="text-right">{l.qte}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmtEur(l.prix)}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-medium">{fmtEur(l.qte * l.prix)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{l.statut}</Badge></TableCell>
                      <TableCell className="text-xs">{l.refDevis}</TableCell>
                      <TableCell className="text-xs">{l.refCmd}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Bilan attributions ──────────────────────────────────────────────────────

interface AttributionRow {
  collaborateur: string; filiale: string; designation: string;
  categorie: string; taille: string; refSycomore: string;
  quantite: number; campagne: string; dateAttribution: string;
}

function BilanAttributions() {
  const [rows, setRows] = useState<AttributionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('epi_attributions' as any)
          .select('*, profiles:beneficiaire_id(display_name, company), article:article_id(designation, categorie), taille:taille_id(taille, ref_sycomore)')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setRows((data || []).map((r: any) => ({
          collaborateur: r.profiles?.display_name ?? '—',
          filiale: r.profiles?.company ?? '—',
          designation: r.article?.designation ?? '—',
          categorie: r.article?.categorie ?? '—',
          taille: r.taille?.taille ?? '—',
          refSycomore: r.taille?.ref_sycomore ?? '—',
          quantite: r.quantite,
          campagne: r.campagne_annee ? String(r.campagne_annee) : '—',
          dateAttribution: r.created_at ? r.created_at.slice(0, 10) : '—',
        })));
      } catch (e: any) {
        toast.error(`Erreur chargement attributions : ${e.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleExport = () => {
    if (rows.length === 0) return;
    exportXlsx(
      rows.map(r => ({
        'Collaborateur': r.collaborateur, 'Filiale': r.filiale, 'Désignation': r.designation,
        'Catégorie': r.categorie, 'Taille': r.taille, 'Réf. Sycomore': r.refSycomore,
        'Quantité': r.quantite, 'Campagne': r.campagne, 'Date attribution': r.dateAttribution,
      })),
      'Bilan attributions',
      `bilan_attributions_epi_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  return (
    <Card>
      <CardHeader className="py-3 px-4 flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ClipboardList className="h-4 w-4" /> Historique des attributions
          <Badge variant="secondary" className="text-xs">{rows.length} attribution(s)</Badge>
        </CardTitle>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={rows.length === 0}>
          <Download className="h-3 w-3 mr-1" /> Export XLSX
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Aucune attribution enregistrée.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Collaborateur</TableHead>
                  <TableHead>Filiale</TableHead>
                  <TableHead>Désignation</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Taille</TableHead>
                  <TableHead>Réf.</TableHead>
                  <TableHead className="text-right">Qté</TableHead>
                  <TableHead>Campagne</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm">{r.collaborateur}</TableCell>
                    <TableCell className="text-xs">{r.filiale}</TableCell>
                    <TableCell className="text-sm">{r.designation}</TableCell>
                    <TableCell className="text-xs">{r.categorie}</TableCell>
                    <TableCell className="text-xs">{r.taille}</TableCell>
                    <TableCell className="font-mono text-xs">{r.refSycomore}</TableCell>
                    <TableCell className="text-right">{r.quantite}</TableCell>
                    <TableCell className="text-xs">{r.campagne}</TableCell>
                    <TableCell className="text-xs">{r.dateAttribution}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
