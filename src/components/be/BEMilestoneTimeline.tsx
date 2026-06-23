/**
 * BEMilestoneTimeline — Vue visuelle des jalons d'un projet BE.
 *
 * Pensée pour le suivi rapide d'une affaire : on voit en un coup d'œil
 * où en est le projet sur sa ligne de temps, quelles étapes-clés sont
 * passées (vert), en cours (bleu/ambre), à venir (gris), en retard (rouge).
 *
 * Chaque jalon est cliquable → ouvre un popover d'édition des dates :
 *   - Date cible (date_prevue) : éditable
 *   - Date réelle (date_reelle) : éditable, par défaut today à la complétion
 *     mais ajustable en cas de validation tardive sur l'app.
 */
import { useMemo, useState } from 'react';
import { format, parseISO, differenceInDays, isAfter, isBefore } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Flag, CheckCircle2, Clock, AlertTriangle, Calendar, Pencil, Loader2, Plus, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useBEProjectMilestones, BEProjectMilestone } from '@/hooks/useBEProjectMilestones';

type Status = 'a_venir' | 'en_cours' | 'termine' | 'retarde';

/** Jalons réglementaires standard (ajout rapide pour les affaires anciennes). */
const STANDARD_MILESTONES: { group: string; titres: string[] }[] = [
  { group: 'ICPE', titres: ['ICPE — Dépôt dossier', 'ICPE — Complétude obtenue', 'ICPE — Purge', 'ICPE — Arrêté'] },
  { group: 'Permis de construire', titres: ['Permis de construire — Dépôt', 'Permis de construire — Arrêté', 'Permis de construire — Purge'] },
  { group: 'Agrément sanitaire', titres: ['Agrément sanitaire — Dépôt', 'Agrément sanitaire — Agrément provisoire', 'Agrément sanitaire — Agrément définitif'] },
];

const STATUS_META: Record<Status, { label: string; dot: string; ring: string; badge: string; icon: any }> = {
  termine:  { label: 'Terminé',  dot: 'bg-emerald-500', ring: 'ring-emerald-200', badge: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  en_cours: { label: 'En cours', dot: 'bg-blue-500',    ring: 'ring-blue-200',    badge: 'bg-blue-100 text-blue-700',       icon: Clock },
  retarde:  { label: 'En retard',dot: 'bg-red-500',     ring: 'ring-red-200',     badge: 'bg-red-100 text-red-700',         icon: AlertTriangle },
  a_venir:  { label: 'À venir',  dot: 'bg-slate-300',   ring: 'ring-slate-200',   badge: 'bg-slate-100 text-slate-600',     icon: Flag },
};

interface Props {
  beProjectId: string;
  /** Limite le nombre de jalons affichés (compact mode). Affiche tout si non défini. */
  maxItems?: number;
}

export function BEMilestoneTimeline({ beProjectId, maxItems }: Props) {
  const { milestones, isLoading, updateDates, addMilestone, deleteMilestone } = useBEProjectMilestones(beProjectId);

  // Détecte les retards : statut !== 'termine' && date_prevue < today
  const enriched = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return milestones.map((m) => {
      const target = m.date_prevue ? parseISO(m.date_prevue) : null;
      const isLate = m.statut !== 'termine' && target && isBefore(target, today);
      const effectiveStatus: Status = isLate ? 'retarde' : (m.statut as Status);
      const daysUntil = target ? differenceInDays(target, today) : null;
      return { ...m, effectiveStatus, daysUntil };
    });
  }, [milestones]);

  const display = maxItems ? enriched.slice(0, maxItems) : enriched;
  const hidden = enriched.length - display.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement des jalons…
      </div>
    );
  }

  if (enriched.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
        <Flag className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Aucun jalon défini pour ce projet.
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1 mb-3">
          Les étapes flaggées « Jalon » dans le paramétrage des prestations apparaissent ici
          automatiquement. Pour une affaire ancienne, ajoutez les jalons à la main :
        </p>
        <div className="flex justify-center">
          <AddMilestone onAdd={addMilestone} existing={[]} />
        </div>
      </div>
    );
  }

  const existingTitres = enriched.map((m) => m.titre);

  return (
    <div className="space-y-4">
      {/* Timeline horizontale */}
      <div className="relative pt-6 pb-2">
        {/* Ligne de base */}
        <div className="absolute left-3 right-3 top-9 h-0.5 bg-gradient-to-r from-emerald-200 via-blue-200 to-slate-200 rounded-full" />

        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${display.length}, minmax(0, 1fr))` }}>
          {display.map((m) => (
            <MilestoneNode
              key={m.id}
              milestone={m}
              onSave={(patch) => updateDates(m.id, patch)}
              onDelete={m.source_task_id ? undefined : () => deleteMilestone(m.id)}
            />
          ))}
        </div>
      </div>

      {/* Ajout manuel d'un jalon */}
      <div className="flex justify-end">
        <AddMilestone onAdd={addMilestone} existing={existingTitres} />
      </div>

      {hidden > 0 && (
        <p className="text-xs text-center text-muted-foreground">
          +{hidden} autre{hidden > 1 ? 's' : ''} jalon{hidden > 1 ? 's' : ''} non affiché{hidden > 1 ? 's' : ''}
        </p>
      )}

      {/* Légende */}
      <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground border-t pt-3">
        {(Object.entries(STATUS_META) as [Status, typeof STATUS_META.termine][]).map(([k, m]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full', m.dot)} />
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Un nœud de la timeline (jalon individuel) — cliquable, popover d'édition
// ════════════════════════════════════════════════════════════════════════
function MilestoneNode({
  milestone,
  onSave,
  onDelete,
}: {
  milestone: BEProjectMilestone & { effectiveStatus: Status; daysUntil: number | null };
  onSave: (patch: { date_prevue?: string | null; date_reelle?: string | null }) => Promise<boolean>;
  onDelete?: () => Promise<boolean>;
}) {
  const meta = STATUS_META[milestone.effectiveStatus];
  const Icon = meta.icon;

  const [open, setOpen] = useState(false);
  const [datePrevue, setDatePrevue] = useState(milestone.date_prevue ?? '');
  const [dateReelle, setDateReelle] = useState(milestone.date_reelle ?? '');
  const [saving, setSaving] = useState(false);

  const handleOpen = (o: boolean) => {
    if (o) {
      setDatePrevue(milestone.date_prevue ?? '');
      setDateReelle(milestone.date_reelle ?? '');
    }
    setOpen(o);
  };

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave({
      date_prevue: datePrevue || null,
      date_reelle: dateReelle || null,
    });
    setSaving(false);
    if (ok) setOpen(false);
  };

  const dateTarget = milestone.date_prevue ? parseISO(milestone.date_prevue) : null;
  const dateReal   = milestone.date_reelle ? parseISO(milestone.date_reelle) : null;

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'group flex flex-col items-center gap-1.5 text-center transition-all',
            'hover:scale-105 cursor-pointer'
          )}
        >
          {/* Pastille */}
          <div className={cn(
            'relative z-10 w-7 h-7 rounded-full flex items-center justify-center ring-4 ring-background',
            'shadow-sm border-2 border-white',
            meta.dot,
            milestone.effectiveStatus === 'termine'  && 'text-white',
            milestone.effectiveStatus === 'en_cours' && 'text-white',
            milestone.effectiveStatus === 'retarde'  && 'text-white',
            milestone.effectiveStatus === 'a_venir'  && 'text-slate-600',
          )}>
            <Icon className="h-3.5 w-3.5" />
          </div>

          {/* Label + date */}
          <div className="space-y-0.5 min-w-0 w-full">
            <p className="text-[11px] font-medium leading-tight line-clamp-2">
              {milestone.titre}
            </p>
            {dateReal ? (
              <p className="text-[10px] font-semibold text-emerald-700 tabular-nums">
                ✓ {format(dateReal, 'dd MMM', { locale: fr })}
              </p>
            ) : dateTarget ? (
              <p className={cn(
                'text-[10px] tabular-nums',
                milestone.effectiveStatus === 'retarde' ? 'text-red-600 font-semibold' : 'text-muted-foreground',
              )}>
                {format(dateTarget, 'dd MMM yyyy', { locale: fr })}
                {milestone.daysUntil !== null && milestone.effectiveStatus !== 'termine' && (
                  <span className="ml-1">
                    ({milestone.daysUntil >= 0 ? `J–${milestone.daysUntil}` : `+${Math.abs(milestone.daysUntil)}j`})
                  </span>
                )}
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">— date à définir —</p>
            )}
            {milestone.is_auto_delayed && (
              <Badge variant="outline" className="text-[9px] px-1 py-0">auto</Badge>
            )}
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-72" align="center">
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <Icon className={cn('h-4 w-4 mt-0.5 shrink-0',
              milestone.effectiveStatus === 'termine'  && 'text-emerald-600',
              milestone.effectiveStatus === 'en_cours' && 'text-blue-600',
              milestone.effectiveStatus === 'retarde'  && 'text-red-600',
              milestone.effectiveStatus === 'a_venir'  && 'text-slate-600',
            )} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{milestone.titre}</p>
              <Badge className={cn('text-[10px] mt-1', meta.badge)}>{meta.label}</Badge>
            </div>
          </div>

          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Date cible
              </Label>
              <Input
                type="date"
                value={datePrevue}
                onChange={(e) => setDatePrevue(e.target.value)}
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground/80">
                Date à laquelle le jalon doit être atteint
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Date réelle
              </Label>
              <Input
                type="date"
                value={dateReelle}
                onChange={(e) => setDateReelle(e.target.value)}
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground/80">
                Renseignée auto à la validation. Modifiable si validation tardive.
              </p>
            </div>
          </div>

          <div className="flex justify-between gap-2 pt-1">
            {onDelete ? (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1.5"
                disabled={saving}
                onClick={async () => { setSaving(true); const ok = await onDelete(); setSaving(false); if (ok) setOpen(false); }}>
                <Trash2 className="h-3.5 w-3.5" />Supprimer
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
                Annuler
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Ajout manuel d'un jalon (presets réglementaires + saisie libre)
// ════════════════════════════════════════════════════════════════════════
function AddMilestone({
  onAdd,
  existing,
}: {
  onAdd: (p: { titre: string; date_prevue?: string | null; date_reelle?: string | null }) => Promise<boolean>;
  existing: string[];
}) {
  const [open, setOpen] = useState(false);
  const [titre, setTitre] = useState('');
  const [datePrevue, setDatePrevue] = useState('');
  const [dateReelle, setDateReelle] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitre(''); setDatePrevue(''); setDateReelle(''); };

  const handleAdd = async () => {
    if (!titre.trim()) return;
    setSaving(true);
    const ok = await onAdd({ titre: titre.trim(), date_prevue: datePrevue || null, date_reelle: dateReelle || null });
    setSaving(false);
    if (ok) { reset(); setOpen(false); }
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" />Ajouter un jalon
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <p className="text-sm font-semibold">Ajouter un jalon</p>

          {/* Presets réglementaires */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Jalons standard</Label>
            {STANDARD_MILESTONES.map((grp) => (
              <div key={grp.group} className="flex flex-wrap gap-1">
                {grp.titres.map((t) => {
                  const used = existing.includes(t);
                  return (
                    <button key={t} type="button" disabled={used}
                      onClick={() => setTitre(t)}
                      className={cn('text-[10px] px-1.5 py-0.5 rounded border',
                        used ? 'opacity-40 cursor-not-allowed line-through' : 'hover:bg-accent',
                        titre === t && 'border-violet-400 bg-violet-50')}>
                      {t.replace(/^.*— /, '')}
                      <span className="text-muted-foreground/60 ml-1">{grp.group.slice(0, 4)}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Libellé</Label>
            <Input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Intitulé du jalon" className="h-8 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Date cible</Label>
              <Input type="date" value={datePrevue} onChange={(e) => setDatePrevue(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Date réelle</Label>
              <Input type="date" value={dateReelle} onChange={(e) => setDateReelle(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>Annuler</Button>
            <Button size="sm" onClick={handleAdd} disabled={saving || !titre.trim()} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}Ajouter
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
