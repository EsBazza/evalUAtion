'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface SectionBarChartProps {
  data: { name: string; score: number }[];
}

export function SectionBarChart({ data }: SectionBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 text-xs font-semibold">
        No section evaluations recorded for this term.
      </div>
    );
  }

  // Get color based on threshold
  const getBarColor = (score: number) => {
    if (score >= 80) return '#10b981'; // Emerald
    if (score >= 60) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="name" 
            tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            domain={[0, 100]} 
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip 
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 'bold' }}
            formatter={(value: any) => [`${value} / 100`, 'Score']}
          />
          <Bar dataKey="score" radius={[8, 8, 0, 0]} maxBarSize={45}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.score)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
