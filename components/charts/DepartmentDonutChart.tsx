'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface DepartmentDonutChartProps {
  data: { name: string; score: number }[];
}

export function DepartmentDonutChart({ data }: DepartmentDonutChartProps) {
  const cleanData = data.filter(d => d.score > 0);

  if (cleanData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 text-xs font-semibold">
        No department data recorded.
      </div>
    );
  }

  // Brand-aligned colors for slices
  const COLORS = ['#002366', '#FFBD00', '#D2143A', '#0d9488', '#4f46e5', '#db2777'];

  return (
    <div className="w-full h-80 flex flex-col justify-between">
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={cleanData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={4}
              dataKey="score"
            >
              {cleanData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 'bold' }}
              formatter={(value: any) => [`${value} Score`, 'Average']}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', fill: '#475569' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
