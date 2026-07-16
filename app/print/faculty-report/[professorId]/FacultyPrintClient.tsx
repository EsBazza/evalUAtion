'use client';

import { RadarClusterChart } from '@/components/charts/RadarClusterChart';
import { BarChart3, BrainCircuit } from 'lucide-react';
import { cn } from '@/lib/utils';

// UA Primitives
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui-ua/card';

interface FacultyPrintClientProps {
  data: any;
  academicYear: string;
  semester: string;
}

export default function FacultyPrintClient({ data, academicYear, semester }: FacultyPrintClientProps) {
  if (!data) return null;

  const { professor, scoreCache, clusterScores, aiSummary, comments, evaluationLog } = data;
  const commentsList = comments || [];

  return (
    <div className="relative min-h-screen bg-white text-slate-800 p-6 max-w-[800px] mx-auto print:p-0">
      {/* Watermark Logo (Centered overlay, repeated on every printed page via CSS fixed position, pointer-events-none so it doesn't block interactions/selections) */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center z-[9999] opacity-[0.035] print:opacity-[0.035]">
        <img 
          src="/ua-logo.png" 
          alt="UA Seal Watermark" 
          className="w-[520px] h-[520px] object-contain animate-fade-in"
        />
      </div>

      {/* 1. Profile / Header Info Block */}
      <div className="border-b-2 border-slate-200 pb-4 mb-6 print-card">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="font-serif text-3xl font-bold text-slate-900 leading-tight">
              {professor.name}
            </h1>
            <p className="text-sm font-semibold text-slate-500 mt-1">
              {professor.email}
            </p>
          </div>
          <div className="text-right">
            <span className="inline-block px-3 py-1 bg-slate-100 border border-slate-200 text-slate-800 rounded-full font-bold text-[10px] uppercase tracking-wider">
              {professor.level} · {professor.department}
            </span>
            <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase tracking-wide">
              Term: {academicYear} — {semester} Sem
            </p>
          </div>
        </div>
        {professor.sections && (
          <p className="text-xs text-slate-600 mt-2 font-medium">
            <span className="font-bold text-slate-700">Assigned Sections:</span> {professor.sections}
          </p>
        )}
      </div>

      {/* 2. Metric Cards Row (Composite, Math, AI scores with enhanced brand colors) */}
      <div className="grid grid-cols-3 gap-4 mb-6 print-card">
        {/* Composite Score Card - styled in full University Navy with Gold score */}
        <div className="bg-[#0B2F64] text-white rounded-xl p-4 flex flex-col justify-between border border-[#0B2F64] shadow-sm">
          <div>
            <span className="block text-[9px] font-bold text-slate-200 uppercase tracking-widest leading-none">
              Composite Score
            </span>
            <h2 className="text-3xl font-extrabold font-sans text-[#D4AF37] mt-2">
              {scoreCache?.compositeScore !== null && scoreCache?.compositeScore !== undefined ? (
                `${scoreCache.compositeScore.toFixed(1)}%`
              ) : 'N/A'}
            </h2>
          </div>
          {scoreCache && scoreCache.compositeScore !== null && scoreCache.compositeScore !== undefined && (
            <span className={cn(
              "inline-block self-start px-2 py-0.5 rounded text-[8px] font-bold uppercase mt-3 tracking-wide border",
              scoreCache.compositeScore >= 80 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' :
              scoreCache.compositeScore >= 60 ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 
              'bg-rose-500/10 border-rose-500/20 text-rose-300'
            )}>
              {scoreCache.compositeScore >= 80 ? 'Excellent' : scoreCache.compositeScore >= 60 ? 'Satisfactory' : 'Needs Work'}
            </span>
          )}
        </div>

        {/* Mathematical Score Card - Highlighted with Gold top border */}
        <div className="border border-slate-200 border-t-4 border-t-[#D4AF37] rounded-xl p-4 flex flex-col justify-center bg-slate-50/50">
          <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">
            Math Score (70%)
          </span>
          <h2 className="text-2xl font-bold font-sans text-slate-700 mt-2">
            {scoreCache?.scaleScore !== null && scoreCache?.scaleScore !== undefined ? (
              `${scoreCache.scaleScore.toFixed(1)}%`
            ) : 'N/A'}
          </h2>
        </div>

        {/* AI Sentiment Score Card - Highlighted with Navy top border */}
        <div className="border border-slate-200 border-t-4 border-t-[#0B2F64] rounded-xl p-4 flex flex-col justify-center bg-slate-50/50">
          <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">
            AI Sentiment (30%)
          </span>
          <h2 className="text-2xl font-bold font-sans text-slate-700 mt-2">
            {scoreCache?.aiQualityScore !== null && scoreCache?.aiQualityScore !== undefined ? (
              `${scoreCache.aiQualityScore.toFixed(1)}%`
            ) : 'N/A'}
          </h2>
        </div>
      </div>

      {/* 3. Graphs Grid (Radar Chart & Evaluation Log side-by-side) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Radar Chart (takes 2 cols) */}
        <Card className="md:col-span-2 border border-slate-200 border-t-4 border-t-[#0B2F64] print-card">
          <CardHeader className="border-b border-slate-100 pb-3">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Cluster Breakdown (Radar)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex items-center justify-center">
            <RadarClusterChart data={clusterScores} disableAnimation={true} />
          </CardContent>
        </Card>

        {/* Evaluations Card (takes 1 col) */}
        <Card className="border border-slate-200 border-t-4 border-t-[#D4AF37] print-card">
          <CardHeader className="border-b border-slate-100 pb-3">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <BarChart3 className="size-3.5 text-slate-400" />
              Evaluations ({evaluationLog.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="max-h-60 overflow-hidden divide-y divide-slate-100 pr-1">
              {evaluationLog.length === 0 ? (
                <p className="text-[10px] text-slate-400 font-semibold italic text-center py-8">
                  No responses logged.
                </p>
              ) : (
                evaluationLog.slice(0, 10).map((log: any) => (
                  <div key={log.id} className="py-2 flex justify-between items-center text-[10px]">
                    <div>
                      <p className="font-bold text-slate-800">Section {log.sectionName}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-[8px] bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                      SUBMITTED
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Average Score Per Cluster Styled Table */}
      <Card className="border border-slate-200 border-t-4 border-t-[#0B2F64] mb-6 print-card">
        <CardHeader className="border-b border-slate-100 pb-3">
          <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Average Score Per Cluster
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0B2F64] text-white text-[10px] uppercase tracking-wider font-bold border-b border-slate-200">
                <th className="p-3 pl-6 text-[#D4AF37]">Cluster Domain Description</th>
                <th className="p-3 pr-6 text-right w-36 text-white">Average Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {clusterScores && clusterScores.length > 0 ? (
                clusterScores.map((item: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/40 odd:bg-slate-50/20">
                    <td className="p-3 pl-6 text-slate-800 font-semibold">{item.title || item.subject}</td>
                    <td className="p-3 pr-6 text-right font-bold text-slate-900">
                      {item.score !== null ? `${item.score.toFixed(1)}%` : 'N/A'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="text-center py-6 text-slate-400 italic font-semibold">
                    No cluster scores available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* 5. Gemini AI Evaluation Sentiment Analysis */}
      <Card className="border border-slate-200 border-t-4 border-t-[#D4AF37] relative overflow-hidden mb-6 print-card">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-[#0B2F64]" />
        <CardHeader className="border-b border-slate-100 pb-3 bg-slate-50/30 pl-6 pr-6 flex flex-row justify-between items-center">
          <CardTitle className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 text-slate-700">
            <BrainCircuit className="size-4 text-[#0B2F64]" />
            Gemini AI Sentiment Analysis
          </CardTitle>
          {aiSummary && (
            <span className="text-[9px] bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Rating Score: {aiSummary.ratingScore} / 100
            </span>
          )}
        </CardHeader>
        <CardContent className="p-6 pl-6 pr-6">
          {aiSummary ? (
            <blockquote className="border-l-4 border-[#D4AF37] pl-4 py-1 italic font-serif text-base text-slate-700 leading-relaxed">
              "{aiSummary.summaryText}"
            </blockquote>
          ) : (
            <p className="text-xs text-slate-400 italic font-semibold text-center py-4">
              No AI summary generated for this term.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 6. Anonymous Student Comments */}
      <Card className="border border-slate-200 border-t-4 border-t-[#0B2F64] print-card">
        <CardHeader className="border-b border-slate-100 pb-3">
          <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Anonymous Student Comments
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          {commentsList.length === 0 ? (
            <p className="text-xs text-slate-400 font-semibold italic text-center py-6">
              No student comments submitted for this term.
            </p>
          ) : (
            commentsList.map((comment: string, i: number) => (
              <div 
                key={i} 
                className="p-3 border border-slate-150 rounded-lg text-xs leading-relaxed text-slate-700 font-medium bg-slate-50/50 shadow-inner break-inside-avoid print:break-inside-avoid"
              >
                "{comment}"
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
