/**
 * ITRHTab — onglet RH du suivi budgétaire IT.
 *
 * Affiche les lignes RH (salariés IT) avec leurs salaires Q1 / Q2-Q4,
 * ancienneté, bonus, charges patronales et coût annuel chargé.
 * Permet l'édition inline + ajout de nouvelles lignes.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Plus, Edit2, Trash2, Loader2, Users } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';

interface RhLine {
  id: string;
  annee: number;
  metier: string | null;
  fonction: string | null;
  salarie: string;
  profile_id: string | null;
  salaire_q1: number;
  anciennete_q1: number;
  bonus_q1: number;
  salaire_q2_q4: number;
  anciennete_q2_q4: number;
  bonus_q2_q4: number;
  charges_pct: number;
  cout_brut_annuel?: number;
  cout_charge_annuel?: number;
  commentaire: string | null;
}

interface Props {
  annee: number;
}

const fmtEur = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export function ITRHTab({ annee }: Props) {
  const [rows, setRows] = useState<RhLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<RhLine | null>(null);
  const [profiles, setProfiles] = useState<{ id: string; display_name: string | null; job_title: string | null }[]>([]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('profiles').select('id, display_name, job_title').order('display_name');
      setProfiles((data ?? []).filter((p: any) => p.display_name) as any);
    })();
  }, []);

  const profileOptions = useMemo(
    () => profiles.map(p => ({ value: p.id, label: p.job_title ? `${p.display_name} — ${p.job_title}` : (p.display_name ?? '') })),
    [profiles],
  );

  const reload = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('v_it_rh_cout' as any)
      .select('*')
      .eq('annee', annee)
      .order('salarie');
    if (error) {
      toast({ title: 'Erreur chargement RH', description: error.message, variant: 'destructive' });
    } else {
      setRows((data ?? []) as unknown as RhLine[]);
    }
    setIsLoading(false);
  };

  useEffect(() => { void reload(); }, [annee]);

  const totalCharge = useMemo(
    () => rows.reduce((acc, r) => acc + (Number(r.cout_charge_annuel) || 0), 0),
    [rows]
  );
  const totalBrut = useMemo(
    () => rows.reduce((acc, r) => acc + (Number(r.cout_brut_annuel) || 0), 0),
    [rows]
  );

  const onAdd = () => {
    setEditing({
      id: '', annee, metier: 'IT', fonction: '', salarie: '', profile_id: null,
      salaire_q1: 0, anciennete_q1: 0, bonus_q1: 0,
      salaire_q2_q4: 0, anciennete_q2_q4: 0, bonus_q2_q4: 0,
      charges_pct: 0.4, commentaire: null,
    });
    setIsOpen(true);
  };

  const onEdit = async (id: string) => {
    const { data } = await supabase.from('it_rh_lines').select('*').eq('id', id).maybeSingle();
    if (data) { setEditing(data as unknown as RhLine); setIsOpen(true); }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Supprimer cette ligne RH ?')) return;
    const { error } = await supabase.from('it_rh_lines').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erreur suppression', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Ligne supprimée' });
      void reload();
    }
  };

  const onSave = async () => {
    if (!editing) return;
    if (!editing.salarie.trim()) {
      toast({ title: 'Nom du salarié obligatoire', variant: 'destructive' });
      return;
    }
    const payload = {
      annee: editing.annee,
      metier: editing.metier,
      fonction: editing.fonction,
      salarie: editing.salarie.trim(),
      profile_id: editing.profile_id,
      salaire_q1: Number(editing.salaire_q1) || 0,
      anciennete_q1: Number(editing.anciennete_q1) || 0,
      bonus_q1: Number(editing.bonus_q1) || 0,
      salaire_q2_q4: Number(editing.salaire_q2_q4) || 0,
      anciennete_q2_q4: Number(editing.anciennete_q2_q4) || 0,
      bonus_q2_q4: Number(editing.bonus_q2_q4) || 0,
      charges_pct: Number(editing.charges_pct) || 0,
      commentaire: editing.commentaire,
    };
    const op = editing.id
      ? supabase.from('it_rh_lines').update(payload).eq('id', editing.id)
      : supabase.from('it_rh_lines').insert(payload);
    const { error } = await op;
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editing.id ? 'Ligne RH mise à jour' : 'Ligne RH créée' });
      setIsOpen(false);
      setEditing(null);
      void reload();
    }
  };

  const [copying, setCopying] = useState(false);
  const copyFromPrevYear = async () => {
    const src = annee - 1;
    if (rows.length > 0 &&
        !confirm(`L'année ${annee} contient déjà ${rows.length} ligne(s) RH. Copier quand même les salariés de ${src} ?`)) return;
    setCopying(true);
    try {
      const cols = 'metier,fonction,salarie,profile_id,salaire_q1,anciennete_q1,bonus_q1,'
        + 'salaire_q2_q4,anciennete_q2_q4,bonus_q2_q4,charges_pct,'
        + 'mois_01,mois_02,mois_03,mois_04,mois_05,mois_06,mois_07,mois_08,mois_09,mois_10,mois_11,mois_12,commentaire';
      const { data, error } = await supabase.from('it_rh_lines').select(cols).eq('annee', src);
      if (error) throw error;
      if (!data || data.length === 0) {
        toast({ title: `Aucune ligne RH en ${src}`, description: 'Rien à copier.' });
        return;
      }
      const copies = (data as any[]).map(r => ({ ...r, annee }));
      const { error: insErr } = await supabase.from('it_rh_lines').insert(copies);
      if (insErr) throw insErr;
      toast({ title: `${copies.length} salarié(s) copié(s) depuis ${src}`, description: 'Adaptez les montants si besoin.' });
      void reload();
    } catch (e: any) {
      toast({ title: 'Erreur de copie', description: e.message, variant: 'destructive' });
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-100 text-violet-700">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Coût RH IT — {annee}</h2>
            <p className="text-xs text-muted-foreground">
              Salaires bruts + ancienneté + bonus + charges patronales
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            Total brut : <strong className="ml-1">{fmtEur(totalBrut)}</strong>
          </Badge>
          <Badge className="text-sm bg-violet-100 text-violet-800 hover:bg-violet-100">
            Total chargé : <strong className="ml-1">{fmtEur(totalCharge)}</strong>
          </Badge>
          <Button size="sm" variant="outline" onClick={copyFromPrevYear} disabled={copying}>
            {copying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Users className="h-4 w-4 mr-1" />}
            Copier depuis {annee - 1}
          </Button>
          <Button size="sm" onClick={onAdd}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter un salarié
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          Aucune ligne RH pour {annee}. Clique sur "Ajouter un salarié".
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Salarié</TableHead>
                <TableHead>Fonction</TableHead>
                <TableHead className="text-right">Salaire Q1</TableHead>
                <TableHead className="text-right">Salaire Q2-Q4</TableHead>
                <TableHead className="text-right">Bonus annuel</TableHead>
                <TableHead className="text-right">Charges</TableHead>
                <TableHead className="text-right">Brut annuel</TableHead>
                <TableHead className="text-right">Coût chargé</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const bonus = (Number(r.bonus_q1) || 0) / 4 + (Number(r.bonus_q2_q4) || 0) * 3 / 4;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.salarie}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.fonction ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtEur(Number(r.salaire_q1))}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtEur(Number(r.salaire_q2_q4))}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtEur(bonus)}</TableCell>
                    <TableCell className="text-right text-xs">{Math.round(Number(r.charges_pct) * 100)} %</TableCell>
                    <TableCell className="text-right font-mono">{fmtEur(Number(r.cout_brut_annuel) || 0)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {fmtEur(Number(r.cout_charge_annuel) || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(r.id)}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(r.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={(o) => { if (!o) { setIsOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Modifier la ligne RH' : 'Nouveau salarié IT'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label>Profil (référentiel)</Label>
                <SearchableSelect
                  value={editing.profile_id ?? ''}
                  options={profileOptions}
                  placeholder="Choisir un salarié dans le référentiel…"
                  searchPlaceholder="Rechercher un salarié…"
                  onValueChange={(id) => {
                    const p = profiles.find(x => x.id === id);
                    setEditing({
                      ...editing,
                      profile_id: id || null,
                      salarie: p?.display_name ?? editing.salarie,
                      fonction: editing.fonction || p?.job_title || '',
                    });
                  }}
                />
                <p className="text-[11px] text-muted-foreground">
                  Sélectionner un profil renseigne le nom et la fonction. Le champ ci-dessous reste modifiable (ex : intérimaire hors référentiel).
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Salarié *</Label>
                  <Input value={editing.salarie} onChange={(e) => setEditing({ ...editing, salarie: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Fonction</Label>
                  <Input value={editing.fonction ?? ''} onChange={(e) => setEditing({ ...editing, fonction: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Salaire Q1 (jan-mar)</Label>
                  <Input type="number" step="0.01" value={editing.salaire_q1} onChange={(e) => setEditing({ ...editing, salaire_q1: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ancienneté Q1</Label>
                  <Input type="number" step="0.01" value={editing.anciennete_q1} onChange={(e) => setEditing({ ...editing, anciennete_q1: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bonus Q1</Label>
                  <Input type="number" step="0.01" value={editing.bonus_q1} onChange={(e) => setEditing({ ...editing, bonus_q1: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Salaire Q2-Q4 (avr-dec)</Label>
                  <Input type="number" step="0.01" value={editing.salaire_q2_q4} onChange={(e) => setEditing({ ...editing, salaire_q2_q4: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ancienneté Q2-Q4</Label>
                  <Input type="number" step="0.01" value={editing.anciennete_q2_q4} onChange={(e) => setEditing({ ...editing, anciennete_q2_q4: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bonus Q2-Q4</Label>
                  <Input type="number" step="0.01" value={editing.bonus_q2_q4} onChange={(e) => setEditing({ ...editing, bonus_q2_q4: Number(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Charges patronales (ex: 0.4 = 40%)</Label>
                <Input type="number" step="0.01" value={editing.charges_pct} onChange={(e) => setEditing({ ...editing, charges_pct: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Commentaire</Label>
                <Input value={editing.commentaire ?? ''} onChange={(e) => setEditing({ ...editing, commentaire: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsOpen(false); setEditing(null); }}>Annuler</Button>
            <Button onClick={onSave}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
