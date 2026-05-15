/**
 * SMQChartsPanel — Indicateurs visuels du module SMQ (Non-conformités).
 *
 * 4 graphiques :
 *  1. Évolution mensuelle : NC créées vs clôturées sur les 12 derniers mois
 *  2. Répartition par identification (Pie) — NC qualité, fournisseur, axe…
 *  3. Top 5 processus avec le plus de NC ouvertes (Bar)
 *  4. Répartition par société (Bar horizontal)
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';
import { parseISO, format, startOfMonth, subMonths, isAfter, isBefore } from 'date-fns';
import { fr } from 'date-fns/locale';
import { NC_IDENTIFICATION_LABELS, NC_PROCESSUS, type NCDeclaration } from '@/types/smqNC';

interface Props { items: NCDeclaration[] }

const IDENT_COLORS: Record<string, string> = {
  points_vigilance:  '#94a3b8',  // slate
  nc_qualite:        '#ef4444',  // red
  axe_amelioration:  '#10b981',  // emerald
  nc_fournisseur:    '#f97316',  // orange
  incident_site:     '#a855f7',  // purple
};

export function SMQChartsPanel({ items }: Props) {

  // ── 1. Évolution mensuelle (12 derniers mois) ────────────────────────────
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string; created: number; closed: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const m = startOfMonth(subMonths(now, i));
      months.push({
        key: format(m, 'yyyy-MM'),
        label: format(m, 'MMM yy', { locale: fr }),
        created: 0,
        closed: 0,
      });
    }
    const indexByKey = new Map(months.map((m, i) => [m.key, i]));

    items.forEach(nc => {
      const ck = format(parseISO(nc.created_at), 'yyyy-MM');
      const idx = indexByKey.get(ck);
      if (idx !== undefined) months[idx].created++;
      if (nc.cloturee_at) {
        const ck2 = format(parseISO(nc.cloturee_at), 'yyyy-MM');
        const idx2 = indexByKey.get(ck2);
        if (idx2 !== undefined) months[idx2].closed++;
      }
    });
    return months;
  }, [items]);

  // ── 2. Répartition par identification (Pie) ──────────────────────────────
  const identData = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach(nc => {
      const k = nc.identification ?? 'non_renseigne';
      counts[k] = (counts[k] ?? 0) + 1;
    });
    return Object.entries(counts).map(([k, value]) => ({
      name: NC_IDENTIFICATION_LABELS[k as keyof typeof NC_IDENTIFICATION_LABELS] ?? 'Non renseigné',
      value,
      color: IDENT_COLORS[k] ?? '#cbd5e1',
    }));
  }, [items]);

  // ── 3. Top 5 processus avec le plus de NC ouvertes ───────────────────────
  const topProcessus = useMemo(() => {
    const counts: Record<string, number> = {};
    items
      .filter(nc => nc.status !== 'cloturee')
      .forEach(nc => {
        if (!nc.processus_code) return;
        counts[nc.processus_code] = (counts[nc.processus_code] ?? 0) + 1;
      });
    return Object.entries(counts)
      .map(([code, count]) => ({
        code,
        label: NC_PROCESSUS.find(p => p.code === code)?.label.slice(0, 35) ?? code,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [items]);

  // ── 4. Répartition par société ───────────────────────────────────────────
  const bySociete = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach(nc => {
      const k = nc.societe_code ?? '—';
      counts[k] = (counts[k] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([k, count]) => ({ societe: k, count }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

      {/* 1. Évolution mensuelle */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Évolution sur 12 mois</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyData} margin={{ top: 5, right: 15, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="created" name="Créées" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="closed"  name="Clôturées" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 2. Identification (Pie) */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Répartition par type</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={identData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={(e) => `${e.value}`}>
                {identData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="bottom" height={28} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 3. Top 5 processus avec NC ouvertes */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Top 5 processus avec NC ouvertes</CardTitle></CardHeader>
        <CardContent className="h-64">
          {topProcessus.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Aucune NC ouverte
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProcessus} layout="vertical" margin={{ top: 5, right: 15, left: 5, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="code" tick={{ fontSize: 11 }} width={70} />
                <Tooltip formatter={(v: number, _n, p) => [v, (p.payload as any).label]} />
                <Bar dataKey="count" fill="#f59e0b" name="NC ouvertes" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 4. Par société */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Répartition par société</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bySociete} margin={{ top: 5, right: 15, left: -10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="societe" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" name="NC" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

    </div>
  );
}
