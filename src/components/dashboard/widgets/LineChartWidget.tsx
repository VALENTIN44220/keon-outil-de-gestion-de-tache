import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { TimelineDataPoint } from '../types';

interface LineChartWidgetProps {
  data: TimelineDataPoint[];
}

export function LineChartWidget({ data }: LineChartWidgetProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 10, fill: '#6b7280' }}
          axisLine={{ stroke: '#e5e7eb' }}
          tickLine={false}
        />
        <YAxis 
          tick={{ fontSize: 10, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
          labelStyle={{ fontWeight: 600, color: '#414648' }}
        />
        <Legend 
          verticalAlign="top" 
          height={36}
          formatter={(value) => <span className="text-xs text-keon-700">{value}</span>}
        />
        <Line
          type="monotone"
          dataKey="created"
          name="Créées"
          stroke="#4DBEC8"
          strokeWidth={2}
          dot={{ fill: '#4DBEC8', strokeWidth: 2, r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="completed"
          name="Terminées"
          stroke="#78C050"
          strokeWidth={2}
          dot={{ fill: '#78C050', strokeWidth: 2, r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="inProgress"
          name="En cours"
          stroke="#FF9432"
          strokeWidth={2}
          dot={{ fill: '#FF9432', strokeWidth: 2, r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
