'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface HistoricalTrendChartProps {
  data: { term: string; score: number }[];
  disableAnimation?: boolean;
}

export function HistoricalTrendChart({ data, disableAnimation = false }: HistoricalTrendChartProps) {
  if (data.length <= 1) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs font-semibold border border-dashed border-slate-200 bg-slate-50/50 rounded-2xl">
        <div className="text-xl mb-1.5 font-bold">📈</div>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Insufficient Historical Data</p>
        <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] leading-relaxed">
          Trend analysis requires statistics across multiple terms. Complete future semesters to unlock.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="term" 
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
            contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 'bold' }}
            formatter={(value: any) => [`${value} / 100`, 'Composite Score']}
          />
          <Line 
            type="monotone" 
            dataKey="score" 
            stroke="#002366" 
            strokeWidth={3}
            activeDot={{ r: 6 }}
            dot={{ stroke: '#002366', strokeWidth: 2, r: 4, fill: '#ffffff' }}
            isAnimationActive={!disableAnimation}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
