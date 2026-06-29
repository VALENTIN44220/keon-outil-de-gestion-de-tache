/**
 * Carte de gestion du référentiel TJM IT/DIGITAL (it_tjm_referentiel) :
 * TJM €/jour par profil FDR, utilisé pour valoriser la charge build dans le ROI.
 *
 * Chaque profil FDR peut être relié à une fonction du référentiel TJM BE
 * (be_tjm_fonctions, taux horaire) : le TJM €/j est alors dérivé
 * automatiquement (= taux horaire × 8 h). On peut toujours saisir un TJM
 * manuel à la place (le lien à la fonction est alors retiré).
 *
 * Composant partagé entre Paramètres FDR (IT/DIGITAL) et la page Référentiels TJM.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Coins, Save, X, Loader2, Pencil } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import { useFdrProfils } from '@/hooks/useFdrSettings';
import { useITTjmReferentiel, useUpsertITTjmReferentiel } from '@/hooks/useITTjmReferentiel';
import { useBETjmFonctions } from '@/hooks/useBEAffaireTemps';
import type { ITTjmReferentiel } from '@/types/itProject';

/** Heures par jour pour convertir un taux horaire BE (€/h) en TJM journalier (€/j). */
const HEURES_PAR_JOUR = 8;
const NONE = '__none__';

export function ITTjmReferentielCard() {
  const { data: profils = [], isLoading: profilsLoading } = useFdrProfils();
  const { data: tjmList = [], isLoading: tjmLoading } = useITTjmReferentiel();
  const { data: beFonctions = [], isLoading: fonctionsLoading } = useBETjmFonctions();
  const upsert = useUpsertITTjmReferentiel();

  const [editMap, setEditMap] = useState<Record<string, string>>({});
  const isLoading = profilsLoading || tjmLoading || fonctionsLoading;

  const rowByCode: Record<string, ITTjmReferentiel> = Object.fromEntries(tjmList.map(t => [t.profil_code, t]));
  const rateByFonction = new Map(beFonctions.map(f => [f.fonction, Number(f.taux_horaire) || 0]));
  const fonctionsSorted = [...beFonctions].sort((a, b) => a.fonction.localeCompare(b.fonction));

  /** TJM €/j effectif = valeur stockée (= celle consommée par le ROI). */
  const effectiveTjm = (row?: ITTjmReferentiel): number => row?.tjm_eur ?? 0;

  const saveError = (e: unknown) =>
    toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });

  /** Lier (ou délier) un profil à une fonction du référentiel BE. */
  const onSelectFonction = async (code: string, value: string) => {
    const current = rowByCode[code];
    try {
      if (value === NONE) {
        await upsert.mutateAsync({ profil_code: code, tjm_eur: current?.tjm_eur ?? 0, be_fonction: null });
        toast({ title: 'Lien retiré', description: 'TJM repassé en saisie manuelle.' });
      } else {
        const rate = rateByFonction.get(value) ?? 0;
        const tjm = Math.round(rate * HEURES_PAR_JOUR);
        await upsert.mutateAsync({ profil_code: code, tjm_eur: tjm, be_fonction: value });
        toast({ title: 'TJM mis à jour', description: `${value} → ${tjm.toLocaleString('fr-FR')} €/j` });
      }
    } catch (e) { saveError(e); }
  };

  /** Saisie manuelle : retire le lien à la fonction. */
  const startEdit = (code: string, cur: number) => setEditMap(m => ({ ...m, [code]: String(cur) }));
  const cancelEdit = (code: string) => setEditMap(m => { const n = { ...m }; delete n[code]; return n; });
  const saveEdit = async (code: string) => {
    const val = parseFloat(editMap[code]);
    if (isNaN(val) || val < 0) { toast({ title: 'TJM invalide', variant: 'destructive' }); return; }
    try {
      await upsert.mutateAsync({ profil_code: code, tjm_eur: val, be_fonction: null });
      toast({ title: 'TJM mis à jour' });
      cancelEdit(code);
    } catch (e) { saveError(e); }
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
          TJM (Taux Journalier Moyen) par profil FDR, utilisé pour valoriser la charge build IT dans le calcul ROI.
          Choisissez une <strong>fonction du référentiel TJM</strong> pour dériver le TJM automatiquement
          (taux horaire × {HEURES_PAR_JOUR} h), ou saisissez un montant manuel. Accès admin uniquement.
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
                  <TableHead className="w-[260px]">Fonction (référentiel TJM)</TableHead>
                  <TableHead className="text-right w-[170px]">TJM (€/j)</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeProfils.map(p => {
                  const row = rowByCode[p.code];
                  const linked = !!row?.be_fonction;
                  const tjm = effectiveTjm(row);
                  const editing = editMap[p.code] != null;
                  return (
                    <TableRow key={p.code} className={editing ? 'bg-amber-500/5' : ''}>
                      <TableCell className="text-sm font-medium">{p.nom}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{p.code}</TableCell>
                      <TableCell>
                        <Select
                          value={row?.be_fonction ?? NONE}
                          onValueChange={(v) => onSelectFonction(p.code, v)}
                          disabled={upsert.isPending}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="— Saisie manuelle —" />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            <SelectItem value={NONE}>— Saisie manuelle —</SelectItem>
                            {fonctionsSorted.map(f => (
                              <SelectItem key={f.fonction} value={f.fonction}>
                                {f.fonction} · {Math.round(Number(f.taux_horaire))} €/h
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        {editing ? (
                          <Input
                            type="number" min={0} step={10}
                            value={editMap[p.code]}
                            onChange={e => setEditMap(m => ({ ...m, [p.code]: e.target.value }))}
                            className="h-7 text-sm text-right w-28 ml-auto"
                            autoFocus
                          />
                        ) : (
                          <div className="flex flex-col items-end">
                            <span className={`tabular-nums text-sm font-semibold ${tjm === 0 ? 'text-muted-foreground' : ''}`}>
                              {tjm > 0 ? `${tjm.toLocaleString('fr-FR')} €/j` : '—'}
                            </span>
                            {linked && <span className="text-[10px] text-muted-foreground">via référentiel</span>}
                          </div>
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
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Saisir un TJM manuel"
                            onClick={() => startEdit(p.code, tjm)}>
                            <Pencil className="h-3 w-3" />
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
        <p className="text-[11px] text-muted-foreground">
          Astuce : si un taux du référentiel BE change, re-sélectionnez la fonction pour rafraîchir le TJM dérivé.
        </p>
      </CardContent>
    </Card>
  );
}
