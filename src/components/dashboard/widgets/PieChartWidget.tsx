import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChartDataPoint } from '../types';

interface PieChartWidgetProps {
  data: ChartDataPoint[];
  isDonut?: boolean;
}

const COLORS = ['#4DBEC8', '#78C050', '#FF9432', '#8b5cf6', '#ef4444', '#f97316'];

function renderCustomLabel(props: any) {
  const { name, percent, x, y, midAngle } = props;
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = 12;
  const nx = x + radius * Math.cos(-midAngle * RADIAN);
  const ny = y + radius * Math.sin(-midAngle * RADIAN);
  const anchor = midAngle > 90 && midAngle < 270 ? 'end' : 'start';
  const pct = (percent * 100).toFixed(0);
  return (
    <text x={nx} y={ny} textAnchor={anchor} dominantBaseline="central" fontSize={11} fill="#374151">
      {`${name} (${pct}%)`}
    </text>
  );
}

export function PieChartWidget({ data, isDonut = true }: PieChartWidgetProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={isDonut ? '45%' : 0}
          outerRadius="65%"
          paddingAngle={2}
          dataKey="value"
          label={renderCustomLabel}
          labelLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color || COLORS[index % COLORS.length]}
              stroke="white"
              strokeWidth={2}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
          formatter={(value: number) => [`${value} (${((value / total) * 100).toFixed(1)}%)`, 'Tâches']}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => <span className="text-xs text-keon-700">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
