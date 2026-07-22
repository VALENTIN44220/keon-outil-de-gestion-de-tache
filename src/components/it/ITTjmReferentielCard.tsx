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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Coins, Save, X, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import { Switch } from '@/components/ui/switch';
import { useFdrProfils, useAddFdrProfil, useUpdateFdrProfil, useDeleteFdrProfil } from '@/hooks/useFdrSettings';
import { useITTjmReferentiel, useUpsertITTjmReferentiel, useDeleteITTjmReferentiel } from '@/hooks/useITTjmReferentiel';
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
  const addProfil = useAddFdrProfil();
  const updateProfil = useUpdateFdrProfil();
  const deleteProfil = useDeleteFdrProfil();
  const deleteTjm = useDeleteITTjmReferentiel();

  const [editMap, setEditMap] = useState<Record<string, string>>({});
  const [nameEdit, setNameEdit] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<{ id: string; code: string; nom: string } | null>(null);
  const [newNom, setNewNom] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newTjm, setNewTjm] = useState('');
  const isLoading = profilsLoading || tjmLoading || fonctionsLoading;

  const slugify = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

  const createProfil = async () => {
    const nom = newNom.trim();
    const code = (newCode.trim() || slugify(nom));
    const tjm = parseFloat(newTjm);
    if (!nom) { toast({ title: 'Libellé requis', variant: 'destructive' }); return; }
    if (!code) { toast({ title: 'Code requis', variant: 'destructive' }); return; }
    if (isNaN(tjm) || tjm < 0) { toast({ title: 'TJM invalide', variant: 'destructive' }); return; }
    try {
      const maxOrdre = Math.max(0, ...profils.map(p => (p as any).ordre ?? 0));
      await addProfil.mutateAsync({ code, nom, actif: true, ordre: maxOrdre + 1, capacite_j_mois: 18, note: null } as any);
      await upsert.mutateAsync({ profil_code: code, tjm_eur: tjm, be_fonction: null });
      toast({ title: 'Profil ajouté', description: `${nom} → ${tjm.toLocaleString('fr-FR')} €/j` });
      setNewNom(''); setNewCode(''); setNewTjm('');
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    }
  };

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

  // On affiche TOUS les profils (actifs + inactifs) : l'interrupteur « Actif »
  // pilote ceux qui apparaissent dans le menu « Profil de salaire » du budget RH.
  const sortedProfils = [...profils].sort(
    (a, b) => Number(b.actif) - Number(a.actif) || ((a as any).ordre ?? 0) - ((b as any).ordre ?? 0),
  );

  const toggleActif = async (p: (typeof profils)[number]) => {
    try {
      await updateProfil.mutateAsync({ id: (p as any).id, actif: !p.actif });
      toast({ title: p.actif ? 'Profil masqué' : 'Profil activé',
        description: p.actif ? `${p.nom} n'apparaîtra plus dans le budget RH.` : `${p.nom} est disponible dans le budget RH.` });
    } catch (e) { saveError(e); }
  };

  const startRename = (code: string, nom: string) => setNameEdit(m => ({ ...m, [code]: nom }));
  const cancelRename = (code: string) => setNameEdit(m => { const n = { ...m }; delete n[code]; return n; });
  const saveRename = async (p: (typeof profils)[number]) => {
    const nom = (nameEdit[p.code] ?? '').trim();
    if (!nom) { toast({ title: 'Libellé requis', variant: 'destructive' }); return; }
    try {
      await updateProfil.mutateAsync({ id: (p as any).id, nom });
      toast({ title: 'Profil renommé', description: nom });
      cancelRename(p.code);
    } catch (e) { saveError(e); }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      // On retire d'abord le TJM (référentiel IT) puis le profil FDR.
      await deleteTjm.mutateAsync(toDelete.code);
      await deleteProfil.mutateAsync(toDelete.id);
      toast({ title: 'Profil supprimé', description: toDelete.nom });
      setToDelete(null);
    } catch (e) { saveError(e); }
  };

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
          <br />
          L'interrupteur <strong>Actif</strong> pilote les profils proposés dans le menu
          « Profil de salaire » du budget RH : désactivez un profil pour le retirer de la liste
          (sans supprimer son TJM).
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Ajout d'un profil (rend le référentiel extensible) */}
        <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/20 p-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Nouveau profil (libellé)</label>
            <Input
              value={newNom}
              onChange={(e) => setNewNom(e.target.value)}
              placeholder="Ex : Stagiaire, Ingénieur data…"
              className="h-8 text-sm w-48"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Code</label>
            <Input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder={newNom ? slugify(newNom) : 'auto'}
              className="h-8 text-sm w-40 font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">TJM (€/j)</label>
            <Input
              type="number" min={0} step={10}
              value={newTjm}
              onChange={(e) => setNewTjm(e.target.value)}
              placeholder="0"
              className="h-8 text-sm w-28"
            />
          </div>
          <Button size="sm" className="h-8 gap-1.5" onClick={createProfil} disabled={addProfil.isPending || upsert.isPending || !newNom.trim()}>
            {(addProfil.isPending) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Ajouter un profil
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : sortedProfils.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun profil — créez-en un ci-dessus.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-[130px]">Actif (budget RH)</TableHead>
                  <TableHead>Profil</TableHead>
                  <TableHead className="font-mono">Code</TableHead>
                  <TableHead className="w-[260px]">Fonction (référentiel TJM)</TableHead>
                  <TableHead className="text-right w-[170px]">TJM (€/j)</TableHead>
                  <TableHead className="w-[90px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProfils.map(p => {
                  const row = rowByCode[p.code];
                  const linked = !!row?.be_fonction;
                  const tjm = effectiveTjm(row);
                  const editing = editMap[p.code] != null;
                  return (
                    <TableRow key={p.code} className={editing ? 'bg-amber-500/5' : (!p.actif ? 'opacity-55' : '')}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={p.actif} onCheckedChange={() => toggleActif(p)} disabled={updateProfil.isPending} />
                          <span className="text-[11px] text-muted-foreground">{p.actif ? 'Visible' : 'Masqué'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {nameEdit[p.code] != null ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={nameEdit[p.code]}
                              onChange={(e) => setNameEdit(m => ({ ...m, [p.code]: e.target.value }))}
                              className="h-7 text-sm w-40"
                              autoFocus
                              onKeyDown={(e) => { if (e.key === 'Enter') saveRename(p); if (e.key === 'Escape') cancelRename(p.code); }}
                            />
                            <Button size="icon" className="h-7 w-7" onClick={() => saveRename(p)} disabled={updateProfil.isPending}>
                              {updateProfil.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cancelRename(p.code)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="group inline-flex items-center gap-1.5 text-left hover:text-primary"
                            title="Renommer le profil"
                            onClick={() => startRename(p.code, p.nom)}
                          >
                            {p.nom}
                            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60" />
                          </button>
                        )}
                      </TableCell>
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
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Saisir un TJM manuel"
                              onClick={() => startEdit(p.code, tjm)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              title="Supprimer le profil"
                              onClick={() => setToDelete({ id: (p as any).id, code: p.code, nom: p.nom })}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
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

      <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le profil « {toDelete?.nom} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le profil et son TJM sont supprimés définitivement du référentiel (et du référentiel
              capacitaire FDR). Les lignes de budget RH déjà rattachées à ce profil conservent leur
              coût saisi mais perdront le lien. Pour le retirer temporairement, préférez l'interrupteur
              <strong> Actif</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); void confirmDelete(); }}
              disabled={deleteProfil.isPending || deleteTjm.isPending}
            >
              {(deleteProfil.isPending || deleteTjm.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
