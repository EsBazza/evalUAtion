'use client';

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface RadarClusterChartProps {
  data: { subject: string; score: number }[];
  disableAnimation?: boolean;
}

export function RadarClusterChart({ data, disableAnimation = false }: RadarClusterChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 text-xs font-semibold">
        No evaluation clusters generated for this term.
      </div>
    );
  }

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart 
          cx="50%" 
          cy="50%" 
          outerRadius="50%" 
          data={data}
          margin={{ top: 15, right: 40, bottom: 20, left: 40 }}
        >
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: '#475569', fontSize: 9, fontWeight: 700 }}
          />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 8 }} />
          <Radar
            name="Score"
            dataKey="score"
            stroke="#002366"
            fill="#002366"
            fillOpacity={0.15}
            isAnimationActive={!disableAnimation}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
