import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QUESTIONS, PILIERS, PilierCode } from '@/config/questionnaireConfig';
import { BEProject } from '@/types/beProject';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Leaf, Flame, MapPin, Building2, Settings2, Recycle, BarChart3 } from 'lucide-react';

interface Props {
  project: BEProject;
  qstData: Record<string, string>;
}

const PILIER_COLORS: Record<string, string> = {
  '00': 'hsl(210, 60%, 50%)',
  '02': 'hsl(260, 50%, 55%)',
  '04': 'hsl(25, 80%, 55%)',
  '05': 'hsl(10, 75%, 55%)',
  '06': 'hsl(140, 50%, 45%)',
  '07': 'hsl(170, 55%, 45%)',
};

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'];

function computePilierCompletion(pilierCode: PilierCode, qstData: Record<string, string>) {
  const questions = QUESTIONS.filter(q => q.pilier === pilierCode);
  if (questions.length === 0) return 0;
  const filled = questions.filter(q => {
    const v = qstData[q.champ_id];
    return v !== undefined && v !== null && v !== '';
  }).length;
  return Math.round((filled / questions.length) * 100);
}

function getGaugeColor(pct: number) {
  if (pct <= 30) return 'hsl(0, 72%, 51%)';
  if (pct <= 70) return 'hsl(38, 92%, 50%)';
  return 'hsl(142, 71%, 45%)';
}

function ProgressGauge({ label, percent, size = 90 }: { label: string; percent: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;
  const color = getGaugeColor(percent);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative inline-flex items-center justify-center">
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth} />
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <span className="absolute text-lg font-bold" style={{ color }}>{percent}%</span>
      </div>
      <span className="text-xs font-medium text-muted-foreground text-center">{label}</span>
    </div>
  );
}

function KpiCard({ label, value, badge, badgeClass }: { label: string; value?: string; badge?: boolean; badgeClass?: string }) {
  return (
    <Card className="flex-1 min-w-[140px]">
      <CardContent className="p-4 flex flex-col items-center justify-center gap-1 text-center">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        {badge ? (
          <Badge className={badgeClass || ''}>{value || '—'}</Badge>
        ) : (
          <span className="text-xl font-bold text-foreground">{value || '—'}</span>
        )}
      </CardContent>
    </Card>
  );
}

export function BEProjectKeonSyntheseTab({ project, qstData }: Props) {
  const pilierCompletions = useMemo(() =>
    PILIERS.map(p => ({
      code: p.code,
      label: p.shortLabel,
      fullLabel: p.label,
      completion: computePilierCompletion(p.code as PilierCode, qstData),
    })), [qstData]
  );

  const radarData = useMemo(() =>
    pilierCompletions.map(p => ({ subject: p.label, value: p.completion, fullMark: 100 })),
    [pilierCompletions]
  );

  // Gisement pie data
  const gisementPieData = useMemo(() => {
    const fields = [
      { key: '06_GEN_pct_effluents', label: 'Effluents élevage' },
      { key: '06_GEN_pct_cultures', label: 'Cultures' },
      { key: '06_GEN_pct_dechets_iaa', label: 'Déchets IAA / Biodéchets' },
      { key: '06_GEN_pct_maitrise_actionnaires', label: 'Maîtrisé actionnaires' },
    ];
    const data = fields
      .map(f => ({ name: f.label, value: parseFloat(qstData[f.key]) || 0 }))
      .filter(d => d.value > 0);
    // Add "Autre" if total < 100
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total < 100 && total > 0) data.push({ name: 'Autre', value: 100 - total });
    return data;
  }, [qstData]);

  const totalGisement = qstData['06_GEN_quantite_totale'] || '—';
  const spvValue = qstData['02_GEN_spv_cree'] || '—';
  const typologieValue = qstData['00_GEN_typologie'] || '—';
  const keonPct = qstData['02_CAPI_keon_pct'];
  const cmax1 = qstData['05_GEN_cmax1'];

  // Location data
  const commune = qstData['04_GEN_commune'] || '—';
  const departement = qstData['04_GEN_departement_nom'] || '—';
  const region = qstData['04_GEN_region'] || '—';
  const statutAgricole = qstData['06_GEN_statut_agricole'] || '—';

  return (
    <div className="space-y-6">
      {/* KPI Band */}
      <div className="flex flex-wrap gap-3">
        <KpiCard label="Typologie" value={typologieValue} badge badgeClass="bg-primary/10 text-primary border border-primary/20" />
        <KpiCard
          label="SPV créée ?"
          value={spvValue}
          badge
          badgeClass={spvValue === 'OUI'
            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
            : 'bg-red-500/10 text-red-600 border border-red-500/20'}
        />
        <KpiCard label="Keon.co KS (%)" value={keonPct ? `${keonPct}%` : '—'} badge badgeClass="bg-blue-500/10 text-blue-600 border border-blue-500/20" />
        <KpiCard label="Gisement total" value={totalGisement !== '—' ? `${totalGisement} tMB/an` : '—'} />
        <KpiCard label="Cmax 1" value={cmax1 ? `${cmax1} Nm³/h` : '—'} />
      </div>

      {/* Radar + Gauges */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Complétude par pilier
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar name="Complétude" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.25} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Progress Gauges */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Avancement par section</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6 py-4">
              {pilierCompletions.map(p => (
                <ProgressGauge key={p.code} label={p.label} percent={p.completion} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Localisation + Gisement + Gaz */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Localisation */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Localisation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <InfoRow label="Commune" value={commune} />
              <InfoRow label="Département" value={departement} />
              <InfoRow label="Région" value={region} />
              <InfoRow label="Statut agricole" value={statutAgricole} />
              <InfoRow label="Type de foncier" value={qstData['04_GEN_type_foncier'] || '—'} />
              <InfoRow label="Code postal" value={qstData['04_GEN_code_postal'] || '—'} />
            </div>
          </CardContent>
        </Card>

        {/* Gisement Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Leaf className="h-4 w-4 text-emerald-600" />
              Répartition du gisement
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {gisementPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={gisementPieData}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80}
                    dataKey="value"
                    nameKey="name"
                    paddingAngle={2}
                  >
                    {gisementPieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-8">Aucune donnée de gisement</p>
            )}
            <span className="text-sm font-medium text-muted-foreground mt-2">
              Total : <span className="font-bold text-foreground">{totalGisement} tMB/an</span>
            </span>
          </CardContent>
        </Card>

        {/* Gaz */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              Gaz & Injection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-center py-3">
                <span className="text-3xl font-bold text-foreground">{cmax1 || '—'}</span>
                <p className="text-xs text-muted-foreground mt-1">Cmax 1 (Nm³CH4/h)</p>
              </div>
              <InfoRow label="Cmax 2" value={qstData['05_GEN_cmax2'] ? `${qstData['05_GEN_cmax2']} Nm³/h` : '—'} />
              <InfoRow label="Cmax 3" value={qstData['05_GEN_cmax3'] ? `${qstData['05_GEN_cmax3']} Nm³/h` : '—'} />
              <InfoRow label="Gestionnaire réseau" value={qstData['05_GEN_gestionnaire_reseau'] || '—'} />
              <InfoRow label="Étiage (%)" value={qstData['05_INJ_etiage_pct'] ? `${qstData['05_INJ_etiage_pct']}%` : '—'} />
              <InfoRow label="Mécanisme tarifaire" value={qstData['05_CONTRAT_mecanisme1'] || '—'} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
