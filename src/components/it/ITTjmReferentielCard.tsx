/**
 * Carte de gestion du référentiel TJM IT/DIGITAL (it_tjm_referentiel) :
 * TJM €/jour par profil FDR, utilisé pour valoriser la charge build dans le ROI.
 * Données sensibles — à n'afficher que sur des écrans réservés aux admins.
 *
 * Composant partagé entre Paramètres FDR (IT/DIGITAL) et la page Référentiel TJM.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Coins, Save, X, Loader2, Settings2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import { useFdrProfils } from '@/hooks/useFdrSettings';
import { useITTjmReferentiel, useUpsertITTjmReferentiel } from '@/hooks/useITTjmReferentiel';

export function ITTjmReferentielCard() {
  const { data: profils = [], isLoading: profilsLoading } = useFdrProfils();
  const { data: tjmList = [], isLoading: tjmLoading } = useITTjmReferentiel();
  const upsert = useUpsertITTjmReferentiel();

  const [editMap, setEditMap] = useState<Record<string, string>>({});
  const isLoading = profilsLoading || tjmLoading;

  const tjmByCode = Object.fromEntries(tjmList.map(t => [t.profil_code, t.tjm_eur]));

  const startEdit = (code: string, cur: number) =>
    setEditMap(m => ({ ...m, [code]: String(cur) }));
  const cancelEdit = (code: string) =>
    setEditMap(m => { const n = { ...m }; delete n[code]; return n; });

  const saveEdit = async (code: string) => {
    const val = parseFloat(editMap[code]);
    if (isNaN(val) || val < 0) {
      toast({ title: 'TJM invalide', variant: 'destructive' }); return;
    }
    try {
      await upsert.mutateAsync({ profil_code: code, tjm_eur: val });
      toast({ title: 'TJM mis à jour' });
      cancelEdit(code);
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    }
  };

  const activeProfils = profils.filter(p => p.actif);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Coins className="h-5 w-5 text-amber-500" />
          Référentiel TJM IT/DIGITAL — Calcul ROI
          <Badge variant="secondary" className="text-xs">Confidentiel</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          TJM (Taux Journalier Moyen) par profil FDR, utilisé pour valoriser la charge build IT
          dans le calcul ROI. Données sensibles — accès admin uniquement.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : activeProfils.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun profil actif — créer des profils dans les Paramètres FDR.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Profil</TableHead>
                  <TableHead className="font-mono">Code</TableHead>
                  <TableHead className="text-right w-[180px]">TJM (€/j)</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeProfils.map(p => {
                  const cur = tjmByCode[p.code] ?? 0;
                  const editing = editMap[p.code] != null;
                  return (
                    <TableRow key={p.code} className={editing ? 'bg-amber-500/5' : ''}>
                      <TableCell className="text-sm font-medium">{p.nom}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{p.code}</TableCell>
                      <TableCell className="text-right">
                        {editing ? (
                          <Input
                            type="number"
                            min={0}
                            step={10}
                            value={editMap[p.code]}
                            onChange={e => setEditMap(m => ({ ...m, [p.code]: e.target.value }))}
                            className="h-7 text-sm text-right w-28 ml-auto"
                          />
                        ) : (
                          <span className={`tabular-nums text-sm font-semibold ${cur === 0 ? 'text-muted-foreground' : ''}`}>
                            {cur > 0 ? `${cur.toLocaleString('fr-FR')} €/j` : '—'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editing ? (
                          <div className="flex gap-1">
                            <Button size="icon" className="h-7 w-7" onClick={() => saveEdit(p.code)} disabled={upsert.isPending}>
                              {upsert.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cancelEdit(p.code)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(p.code, cur)}>
                            <Settings2 className="h-3 w-3" />
                          </Button>
                        )}
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
  );
}
