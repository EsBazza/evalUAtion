'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface FacultyRankingChartProps {
  data: { name: string; score: number; department: string }[];
}

export function FacultyRankingChart({ data }: FacultyRankingChartProps) {
  // Sort and limit to top 10 for clean presentation
  const sortedData = [...data]
    .filter(d => d.score !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (sortedData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 text-xs font-semibold">
        No rankings data available to display.
      </div>
    );
  }

  // Generate deterministic color based on department name
  const getDeptColor = (dept: string) => {
    const hash = dept.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    const colors = ['#002366', '#FFBD00', '#D2143A', '#0f766e', '#1e1b4b', '#0369a1'];
    return colors[hash % colors.length];
  };

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={sortedData}
          margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
          <XAxis 
            type="number" 
            domain={[0, 100]}
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            type="category" 
            dataKey="name" 
            tick={{ fill: '#0f172a', fontSize: 11, fontWeight: 700 }}
            axisLine={false}
            tickLine={false}
            width={120}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 'bold' }}
            formatter={(value: any, name: any, props: any) => [
              `${value} / 100`,
              `${props.payload.department}`
            ]}
          />
          <Bar dataKey="score" radius={[0, 8, 8, 0]} maxBarSize={20}>
            {sortedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getDeptColor(entry.department)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
