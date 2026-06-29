import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Save, X, Plus, Trash2, Settings2, Users, CalendarDays, Tags, Coins } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import {
  useFdrSettings, useUpdateFdrSettings,
  useFdrProfils, useUpdateFdrProfil, useAddFdrProfil, useDeleteFdrProfil,
} from '@/hooks/useFdrSettings';
import { useITProjectTypes, type ITProjectTypeOption } from '@/hooks/useITProjectTypes';
import { useITActivites, type ITActiviteOption } from '@/hooks/useITActivites';
import { useITTjmReferentiel, useUpsertITTjmReferentiel } from '@/hooks/useITTjmReferentiel';
import type { FdrProfil } from '@/types/fdr';

export default function ITAdminFDR() {
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  if (roleLoading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    </Layout>
  );
  if (!isAdmin) return <Navigate to="/" replace />;
  return <ITAdminFDRContent />;
}

function ITAdminFDRContent() {
  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/10">
              <Settings2 className="h-7 w-7 text-violet-500" />
            </div>
            Paramètres — Feuille de Route
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Paramètres globaux du plan de charge et profils capacitaires.
            Toute modification est prise en compte au prochain recalcul.
          </p>
        </div>

        <GlobalSettingsCard />
        <ProfilsCard />
        <TjmReferentielCard />
        <ProjectTypesCard />
        <ActivitesCard />
      </div>
    </Layout>
  );
}

// ---- Paramètres globaux ----

function GlobalSettingsCard() {
  const { data: settings, isLoading } = useFdrSettings();
  const update = useUpdateFdrSettings();

  const [editing, setEditing] = useState(false);
  const [joursP, setJoursP] = useState('');
  const [echeanceStd, setEcheanceStd] = useState('');
  const [horizonDebut, setHorizonDebut] = useState('');
  const [horizonDuree, setHorizonDuree] = useState('');

  const startEdit = () => {
    setJoursP(String(settings?.jours_productifs_mois ?? 18));
    setEcheanceStd(settings?.echeance_standard_permanentes?.slice(0, 10) ?? '2030-12-31');
    setHorizonDebut(settings?.horizon_debut?.slice(0, 10) ?? '2026-06-01');
    setHorizonDuree(String(settings?.horizon_duree_mois ?? 19));
    setEditing(true);
  };

  const save = async () => {
    const j = parseInt(joursP);
    const d = parseInt(horizonDuree);
    if (isNaN(j) || j < 1 || j > 31) {
      toast({ title: 'Jours productifs invalides (1–31)', variant: 'destructive' }); return;
    }
    if (isNaN(d) || d < 1) {
      toast({ title: 'Durée horizon invalide', variant: 'destructive' }); return;
    }
    try {
      await update.mutateAsync({
        jours_productifs_mois: j,
        echeance_standard_permanentes: echeanceStd,
        horizon_debut: horizonDebut,
        horizon_duree_mois: d,
      });
      toast({ title: 'Paramètres mis à jour' });
      setEditing(false);
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarDays className="h-5 w-5 text-muted-foreground" />
          Paramètres globaux
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Ces valeurs pilotent le moteur de calcul du plan de charge pour tous les projets.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
        ) : editing ? (
          <div className="space-y-4 max-w-md">
            <div className="space-y-1">
              <Label htmlFor="joursP">Jours productifs / mois / ETP</Label>
              <Input id="joursP" type="number" min={1} max={31} value={joursP}
                onChange={e => setJoursP(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="echeanceStd">Échéance standard des tâches permanentes</Label>
              <Input id="echeanceStd" type="date" value={echeanceStd}
                onChange={e => setEcheanceStd(e.target.value)} className="w-48" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="horizonDebut">Début de l'horizon de planification</Label>
              <Input id="horizonDebut" type="date" value={horizonDebut}
                onChange={e => setHorizonDebut(e.target.value)} className="w-48" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="horizonDuree">Durée de l'horizon (mois)</Label>
              <Input id="horizonDuree" type="number" min={1} max={60} value={horizonDuree}
                onChange={e => setHorizonDuree(e.target.value)} className="w-40" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={save} disabled={update.isPending} className="gap-2">
                {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)} className="gap-2">
                <X className="h-4 w-4" />Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableBody>
                  <ParamRow label="Jours productifs / mois / ETP" value={`${settings?.jours_productifs_mois ?? 18} j/mois`} />
                  <ParamRow label="Échéance standard (tâches permanentes)" value={fmtDate(settings?.echeance_standard_permanentes)} />
                  <ParamRow label="Début de l'horizon" value={fmtDate(settings?.horizon_debut)} />
                  <ParamRow label="Durée de l'horizon" value={`${settings?.horizon_duree_mois ?? 19} mois`} />
                </TableBody>
              </Table>
            </div>
            <Button variant="outline" size="sm" onClick={startEdit} className="gap-2">
              <Settings2 className="h-4 w-4" />Modifier
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ParamRow({ label, value }: { label: string; value: string }) {
  return (
    <TableRow>
      <TableCell className="text-sm text-muted-foreground">{label}</TableCell>
      <TableCell className="text-sm font-semibold tabular-nums text-right">{value}</TableCell>
    </TableRow>
  );
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR'); } catch { return d; }
}

// ---- Profils capacitaires ----

function ProfilsCard() {
  const { data: profils = [], isLoading } = useFdrProfils();
  const updateProfil = useUpdateFdrProfil();
  const addProfil = useAddFdrProfil();
  const deleteProfil = useDeleteFdrProfil();

  // Édition inline par profil
  const [editMap, setEditMap] = useState<Record<string, Partial<FdrProfil>>>({});
  const editing = (id: string) => editMap[id] != null;

  const startEdit = (p: FdrProfil) => setEditMap(m => ({
    ...m, [p.id]: { nom: p.nom, capacite_j_mois: p.capacite_j_mois, note: p.note ?? '', actif: p.actif },
  }));
  const cancelEdit = (id: string) => setEditMap(m => { const n = { ...m }; delete n[id]; return n; });

  const saveEdit = async (id: string) => {
    const patch = editMap[id];
    if (!patch) return;
    const cap = Number(patch.capacite_j_mois);
    if (isNaN(cap) || cap < 0) {
      toast({ title: 'Capacité invalide', variant: 'destructive' }); return;
    }
    try {
      await updateProfil.mutateAsync({ id, ...patch, capacite_j_mois: cap });
      toast({ title: 'Profil mis à jour' });
      cancelEdit(id);
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    }
  };

  // Nouveau profil
  const [showAdd, setShowAdd] = useState(false);
  const [newNom, setNewNom] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newCap, setNewCap] = useState('18');
  const [newNote, setNewNote] = useState('');

  const addNew = async () => {
    if (!newNom.trim() || !newCode.trim()) {
      toast({ title: 'Nom et code obligatoires', variant: 'destructive' }); return;
    }
    const cap = Number(newCap);
    if (isNaN(cap) || cap < 0) {
      toast({ title: 'Capacité invalide', variant: 'destructive' }); return;
    }
    try {
      await addProfil.mutateAsync({
        nom: newNom.trim(),
        code: newCode.trim().toLowerCase().replace(/\s+/g, '_'),
        capacite_j_mois: cap,
        note: newNote.trim() || null,
        ordre: profils.length + 1,
        actif: true,
      });
      toast({ title: `Profil « ${newNom} » ajouté` });
      setNewNom(''); setNewCode(''); setNewCap('18'); setNewNote(''); setShowAdd(false);
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    }
  };

  const handleDelete = async (p: FdrProfil) => {
    if (!confirm(`Supprimer le profil « ${p.nom} » ? Cette action peut bloquer les projets qui l'utilisent.`)) return;
    try {
      await deleteProfil.mutateAsync(p.id);
      toast({ title: `Profil « ${p.nom} » supprimé` });
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-muted-foreground" />
          Profils & capacités
          {!isLoading && <Badge variant="secondary" className="ml-1 text-xs">{profils.length} profils</Badge>}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          La capacité (j/mois) représente la disponibilité nette par profil sur l'horizon de planification.
          La colonne <em>RSI</em> est le profil d'appui : sa disponibilité est automatiquement mobilisée
          pour résorber les déficits dev/IA et digital (cascade RSI).
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Profil</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="w-[130px] text-right">Capacité (j/mois)</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="w-[80px] text-center">Actif</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {profils.map(p => editing(p.id) ? (
                  <TableRow key={p.id} className="bg-blue-500/5">
                    <TableCell>
                      <Input value={editMap[p.id]?.nom ?? ''} onChange={e => setEditMap(m => ({ ...m, [p.id]: { ...m[p.id], nom: e.target.value } }))} className="h-8 text-sm" />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{p.code}</TableCell>
                    <TableCell>
                      <Input type="number" min={0} step={0.5} value={editMap[p.id]?.capacite_j_mois ?? ''} onChange={e => setEditMap(m => ({ ...m, [p.id]: { ...m[p.id], capacite_j_mois: parseFloat(e.target.value) } }))} className="h-8 text-sm text-right w-24 ml-auto" />
                    </TableCell>
                    <TableCell>
                      <Input value={editMap[p.id]?.note ?? ''} onChange={e => setEditMap(m => ({ ...m, [p.id]: { ...m[p.id], note: e.target.value } }))} className="h-8 text-sm" placeholder="Robin, Hugues…" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={!!editMap[p.id]?.actif} onCheckedChange={v => setEditMap(m => ({ ...m, [p.id]: { ...m[p.id], actif: v } }))} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" className="h-7 w-7" onClick={() => saveEdit(p.id)} disabled={updateProfil.isPending}>
                          {updateProfil.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cancelEdit(p.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={p.id} className={!p.actif ? 'opacity-40' : ''}>
                    <TableCell className="text-sm font-medium">{p.nom}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{p.code}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-semibold">{p.capacite_j_mois} j/mois</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.note ?? '—'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={p.actif ? 'default' : 'secondary'} className="text-[10px]">
                        {p.actif ? 'Actif' : 'Inactif'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(p)}>
                          <Settings2 className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(p)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Ajout d'un profil */}
        {showAdd ? (
          <div className="rounded-lg border p-4 bg-muted/20 space-y-3">
            <p className="text-sm font-medium">Nouveau profil</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="newNom" className="text-xs">Nom</Label>
                <Input id="newNom" value={newNom} onChange={e => setNewNom(e.target.value)} placeholder="Chef de projet…" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="newCode" className="text-xs">Code (identifiant unique)</Label>
                <Input id="newCode" value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="cp_nouveau" className="h-8 text-sm font-mono" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="newCap" className="text-xs">Capacité (j/mois)</Label>
                <Input id="newCap" type="number" min={0} step={0.5} value={newCap} onChange={e => setNewCap(e.target.value)} className="h-8 text-sm w-28" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="newNote" className="text-xs">Note (personne)</Label>
                <Input id="newNote" value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Prénom…" className="h-8 text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addNew} disabled={addProfil.isPending} className="gap-2">
                {addProfil.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Ajouter
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Annuler</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowAdd(true)} className="gap-2">
            <Plus className="h-4 w-4" />Ajouter un profil
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Types de projet ----

function ProjectTypesCard() {
  const { types, isLoading, add, update, remove } = useITProjectTypes();

  const [editMap, setEditMap] = useState<Record<string, Partial<ITProjectTypeOption>>>({});
  const editing = (id: string) => editMap[id] != null;
  const startEdit = (t: ITProjectTypeOption) => setEditMap(m => ({
    ...m, [t.id]: { label: t.label, icon: t.icon, ordre: t.ordre, actif: t.actif },
  }));
  const cancelEdit = (id: string) => setEditMap(m => { const n = { ...m }; delete n[id]; return n; });

  const saveEdit = async (id: string) => {
    const patch = editMap[id];
    if (!patch?.label?.trim()) { toast({ title: 'Libellé obligatoire', variant: 'destructive' }); return; }
    try {
      await update.mutateAsync({
        id,
        label: patch.label.trim(),
        icon: (patch.icon ?? '').trim() || '📦',
        ordre: Number(patch.ordre) || 0,
        actif: !!patch.actif,
      });
      toast({ title: 'Type mis à jour' });
      cancelEdit(id);
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    }
  };

  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState('📦');

  const addNew = async () => {
    if (!newLabel.trim()) { toast({ title: 'Libellé obligatoire', variant: 'destructive' }); return; }
    try {
      await add.mutateAsync({ label: newLabel.trim(), icon: newIcon.trim() || '📦', ordre: types.length + 1 });
      toast({ title: `Type « ${newLabel} » ajouté` });
      setNewLabel(''); setNewIcon('📦'); setShowAdd(false);
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    }
  };

  const handleDelete = async (t: ITProjectTypeOption) => {
    if (!confirm(`Supprimer le type « ${t.label} » ? Les projets existants conserveront la valeur « ${t.value} ».`)) return;
    try {
      await remove.mutateAsync(t.id);
      toast({ title: `Type « ${t.label} » supprimé` });
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Tags className="h-5 w-5 text-muted-foreground" />
          Types de projet
          {!isLoading && <Badge variant="secondary" className="ml-1 text-xs">{types.length} types</Badge>}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Liste paramétrable des types de projet proposés dans le formulaire. L'<em>identifiant</em> est généré
          automatiquement à la création et reste stable (les projets le réutilisent).
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-[70px] text-center">Icône</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="font-mono">Identifiant</TableHead>
                  <TableHead className="w-[90px] text-right">Ordre</TableHead>
                  <TableHead className="w-[80px] text-center">Actif</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map(t => editing(t.id) ? (
                  <TableRow key={t.id} className="bg-blue-500/5">
                    <TableCell className="text-center">
                      <Input value={editMap[t.id]?.icon ?? ''} onChange={e => setEditMap(m => ({ ...m, [t.id]: { ...m[t.id], icon: e.target.value } }))} className="h-8 text-sm text-center w-14 mx-auto" />
                    </TableCell>
                    <TableCell>
                      <Input value={editMap[t.id]?.label ?? ''} onChange={e => setEditMap(m => ({ ...m, [t.id]: { ...m[t.id], label: e.target.value } }))} className="h-8 text-sm" />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{t.value}</TableCell>
                    <TableCell>
                      <Input type="number" value={editMap[t.id]?.ordre ?? 0} onChange={e => setEditMap(m => ({ ...m, [t.id]: { ...m[t.id], ordre: parseInt(e.target.value) } }))} className="h-8 text-sm text-right w-20 ml-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={!!editMap[t.id]?.actif} onCheckedChange={v => setEditMap(m => ({ ...m, [t.id]: { ...m[t.id], actif: v } }))} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" className="h-7 w-7" onClick={() => saveEdit(t.id)} disabled={update.isPending}>
                          {update.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cancelEdit(t.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={t.id} className={!t.actif ? 'opacity-40' : ''}>
                    <TableCell className="text-center text-lg">{t.icon}</TableCell>
                    <TableCell className="text-sm font-medium">{t.label}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{t.value}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{t.ordre}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={t.actif ? 'default' : 'secondary'} className="text-[10px]">{t.actif ? 'Actif' : 'Inactif'}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(t)}>
                          <Settings2 className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(t)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {showAdd ? (
          <div className="rounded-lg border p-4 bg-muted/20 space-y-3">
            <p className="text-sm font-medium">Nouveau type</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="ntIcon" className="text-xs">Icône</Label>
                <Input id="ntIcon" value={newIcon} onChange={e => setNewIcon(e.target.value)} className="h-8 text-sm text-center w-16" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ntLabel" className="text-xs">Libellé</Label>
                <Input id="ntLabel" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Ex. Cybersécurité" className="h-8 text-sm w-64" />
              </div>
              <Button size="sm" onClick={addNew} disabled={add.isPending} className="gap-2">
                {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Ajouter
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Annuler</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowAdd(true)} className="gap-2">
            <Plus className="h-4 w-4" />Ajouter un type
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Activités métier ----

function ActivitesCard() {
  const { activites, isLoading, add, update, remove } = useITActivites();

  const [editMap, setEditMap] = useState<Record<string, Partial<ITActiviteOption>>>({});
  const editing = (id: string) => editMap[id] != null;
  const startEdit = (a: ITActiviteOption) => setEditMap(m => ({
    ...m, [a.id]: { libelle: a.libelle, ordre: a.ordre, actif: a.actif },
  }));
  const cancelEdit = (id: string) => setEditMap(m => { const n = { ...m }; delete n[id]; return n; });

  const saveEdit = async (id: string) => {
    const patch = editMap[id];
    if (!patch?.libelle?.trim()) { toast({ title: 'Libellé obligatoire', variant: 'destructive' }); return; }
    try {
      await update.mutateAsync({
        id,
        libelle: patch.libelle.trim(),
        ordre: Number(patch.ordre) || 0,
        actif: !!patch.actif,
      });
      toast({ title: 'Activité mise à jour' });
      cancelEdit(id);
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    }
  };

  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');

  const addNew = async () => {
    if (!newLabel.trim()) { toast({ title: 'Libellé obligatoire', variant: 'destructive' }); return; }
    try {
      await add.mutateAsync({ libelle: newLabel.trim(), ordre: activites.length + 1 });
      toast({ title: `Activité « ${newLabel} » ajoutée` });
      setNewLabel(''); setShowAdd(false);
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    }
  };

  const handleDelete = async (a: ITActiviteOption) => {
    if (!confirm(`Supprimer l'activité « ${a.libelle} » ? Les projets existants conserveront cette valeur.`)) return;
    try {
      await remove.mutateAsync(a.id);
      toast({ title: `Activité « ${a.libelle} » supprimée` });
    } catch (e) {
      toast({ title: 'Erreur', description: extractErrorMessage(e), variant: 'destructive' });
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Tags className="h-5 w-5 text-muted-foreground" />
          Activités métier
          {!isLoading && <Badge variant="secondary" className="ml-1 text-xs">{activites.length} activités</Badge>}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Liste paramétrable des activités métier proposées dans le formulaire et la grille des projets.
          Désactiver une activité la retire des listes sans toucher aux projets qui l'utilisent.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Libellé</TableHead>
                  <TableHead className="w-[90px] text-right">Ordre</TableHead>
                  <TableHead className="w-[80px] text-center">Actif</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {activites.map(a => editing(a.id) ? (
                  <TableRow key={a.id} className="bg-blue-500/5">
                    <TableCell>
                      <Input value={editMap[a.id]?.libelle ?? ''} onChange={e => setEditMap(m => ({ ...m, [a.id]: { ...m[a.id], libelle: e.target.value } }))} className="h-8 text-sm" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={editMap[a.id]?.ordre ?? 0} onChange={e => setEditMap(m => ({ ...m, [a.id]: { ...m[a.id], ordre: parseInt(e.target.value) } }))} className="h-8 text-sm text-right w-20 ml-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={!!editMap[a.id]?.actif} onCheckedChange={v => setEditMap(m => ({ ...m, [a.id]: { ...m[a.id], actif: v } }))} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" className="h-7 w-7" onClick={() => saveEdit(a.id)} disabled={update.isPending}>
                          {update.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cancelEdit(a.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={a.id} className={!a.actif ? 'opacity-40' : ''}>
                    <TableCell className="text-sm font-medium">{a.libelle}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{a.ordre}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={a.actif ? 'default' : 'secondary'} className="text-[10px]">{a.actif ? 'Actif' : 'Inactif'}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(a)}>
                          <Settings2 className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(a)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {showAdd ? (
          <div className="rounded-lg border p-4 bg-muted/20 space-y-3">
            <p className="text-sm font-medium">Nouvelle activité</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="naLabel" className="text-xs">Libellé</Label>
                <Input id="naLabel" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Ex. QUALITE / HSE" className="h-8 text-sm w-64" onKeyDown={e => e.key === 'Enter' && addNew()} />
              </div>
              <Button size="sm" onClick={addNew} disabled={add.isPending} className="gap-2">
                {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Ajouter
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Annuler</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowAdd(true)} className="gap-2">
            <Plus className="h-4 w-4" />Ajouter une activité
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── TJM Référentiel (admin only — données sensibles) ──────────────────────

function TjmReferentielCard() {
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
          Référentiel TJM — Calcul ROI
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
          <p className="text-sm text-muted-foreground">Aucun profil actif — créer des profils dans la section ci-dessus.</p>
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
