/**
 * JuridiquePlanning — plan de charge du service juridique (onglet).
 *
 * Vue simple : lignes = membres du service (+ « À affecter »), colonnes =
 * 8 prochaines semaines, cellule = somme des charges estimées (h) des demandes
 * non terminées dont l'échéance tombe dans la semaine. Coloration si la charge
 * dépasse la capacité hebdo indicative.
 */
import { useMemo } from 'react';
import { addWeeks, startOfWeek, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  JuridiqueRequest, JURIDIQUE_MEMBERS, JURIDIQUE_TERMINAL_STATUSES,
} from '@/hooks/useJuridiqueRequests';

const WEEKS = 8;
const CAPACITY_PER_WEEK = 35; // h — capacité hebdo indicative

const ROWS = [
  ...JURIDIQUE_MEMBERS.map(m => ({ id: m.id, name: m.name })),
  { id: '__unassigned__', name: 'À affecter' },
];

function weekKey(d: Date) {
  return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

export function JuridiquePlanning({ requests }: { requests: JuridiqueRequest[] }) {
  const weeks = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: WEEKS }, (_, i) => {
      const start = addWeeks(base, i);
      return { key: weekKey(start), label: format(start, "'S'w", { locale: fr }), start };
    });
  }, []);

  // charge[rowId][weekKey] = heures ; + colonne "non planifié"
  const { charge, unplanned, totalsByWeek } = useMemo(() => {
    const charge = new Map<string, Map<string, number>>();
    const unplanned = new Map<string, number>();
    const totalsByWeek = new Map<string, number>();
    ROWS.forEach(r => charge.set(r.id, new Map()));

    const weekKeys = new Set(weeks.map(w => w.key));

    for (const r of requests) {
      if (JURIDIQUE_TERMINAL_STATUSES.includes(r.status)) continue;
      const rowId = r.assignee_id && charge.has(r.assignee_id) ? r.assignee_id : '__unassigned__';
      const h = r.duration_hours ?? 0;
      if (!r.due_date) {
        unplanned.set(rowId, (unplanned.get(rowId) ?? 0) + h);
        continue;
      }
      const wk = weekKey(new Date(r.due_date));
      if (!weekKeys.has(wk)) {
        // échéance hors fenêtre (passée ou lointaine) → non planifié dans la vue
        unplanned.set(rowId, (unplanned.get(rowId) ?? 0) + h);
        continue;
      }
      const row = charge.get(rowId)!;
      row.set(wk, (row.get(wk) ?? 0) + h);
      totalsByWeek.set(wk, (totalsByWeek.get(wk) ?? 0) + h);
    }
    return { charge, unplanned, totalsByWeek };
  }, [requests, weeks]);

  const cellClass = (h: number) => {
    if (h === 0) return 'text-muted-foreground/40';
    if (h > CAPACITY_PER_WEEK) return 'bg-red-100 text-red-800 font-semibold';
    if (h > CAPACITY_PER_WEEK * 0.75) return 'bg-amber-100 text-amber-800 font-medium';
    return 'bg-emerald-50 text-emerald-800';
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Charge estimée (h) des demandes en cours par membre et par semaine. Capacité hebdo indicative : {CAPACITY_PER_WEEK} h.
      </p>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background min-w-[160px]">Membre</TableHead>
              {weeks.map(w => (
                <TableHead key={w.key} className="text-center whitespace-nowrap">
                  {w.label}
                  <div className="text-[10px] font-normal text-muted-foreground">
                    {format(w.start, 'dd/MM', { locale: fr })}
                  </div>
                </TableHead>
              ))}
              <TableHead className="text-center">Non planifié</TableHead>
              <TableHead className="text-center font-semibold">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROWS.map(row => {
              const rowCharge = charge.get(row.id)!;
              const rowTotal =
                weeks.reduce((s, w) => s + (rowCharge.get(w.key) ?? 0), 0) + (unplanned.get(row.id) ?? 0);
              return (
                <TableRow key={row.id}>
                  <TableCell className={cn('sticky left-0 bg-background font-medium', row.id === '__unassigned__' && 'text-amber-700')}>
                    {row.name}
                  </TableCell>
                  {weeks.map(w => {
                    const h = rowCharge.get(w.key) ?? 0;
                    return (
                      <TableCell key={w.key} className={cn('text-center text-sm', cellClass(h))}>
                        {h > 0 ? h : '·'}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {unplanned.get(row.id) ? unplanned.get(row.id) : '·'}
                  </TableCell>
                  <TableCell className="text-center text-sm font-semibold">{rowTotal || '·'}</TableCell>
                </TableRow>
              );
            })}
            <TableRow className="border-t-2">
              <TableCell className="sticky left-0 bg-background font-semibold">Total équipe</TableCell>
              {weeks.map(w => (
                <TableCell key={w.key} className="text-center text-sm font-semibold">
                  {totalsByWeek.get(w.key) ? totalsByWeek.get(w.key) : '·'}
                </TableCell>
              ))}
              <TableCell />
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
