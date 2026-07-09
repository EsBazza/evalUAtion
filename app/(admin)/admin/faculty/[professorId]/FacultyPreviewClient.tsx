'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getFacultyProfileData } from '@/app/actions/management';
import { processFacultyEvaluationSummary } from '@/app/actions/ai';
import { RadarClusterChart } from '@/components/charts/RadarClusterChart';
import { SectionBarChart } from '@/components/charts/SectionBarChart';
import { HistoricalTrendChart } from '@/components/charts/HistoricalTrendChart';
import { toast } from 'sonner';

interface FacultyPreviewClientProps {
  professorId: string;
}

export default function FacultyPreviewClient({ professorId }: FacultyPreviewClientProps) {
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [semester, setSemester] = useState('1st');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchProfileData = async (id: string, year: string, sem: string) => {
    setLoading(true);
    try {
      const res = await getFacultyProfileData(id, year, sem);
      setData(res);
    } catch (err: any) {
      toast.error(err.message || "Failed to load faculty preview details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (professorId) {
      fetchProfileData(professorId, academicYear, semester);
    }
  }, [professorId, academicYear, semester]);

  const handleGenerateSummary = async () => {
    if (!professorId) return;
    setIsProcessing(true);
    try {
      const res = await processFacultyEvaluationSummary(professorId, academicYear, semester);
      if (res.success) {
        toast.success("AI analysis narrative generated and cache updated!");
        await fetchProfileData(professorId, academicYear, semester);
      } else {
        toast.error(res.message || "Failed to process qualitative summary.");
      }
    } catch (e: any) {
      toast.error(e.message || "Gemini processing error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Syncing Faculty Workspace...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { professor, scoreCache, clusterScores, sectionScores, historicalScores, aiSummary, evaluationLog } = data;

  return (
    <div className="min-h-screen bg-slate-50/50 py-10 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Admin Warning Banner */}
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-5 py-3 rounded-2xl flex items-center justify-between text-xs font-bold shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-sm">🛡️</span>
            <span>ADMIN PREVIEW: You are viewing this faculty performance report as a system administrator. Student identities are hidden.</span>
          </div>
          <Link href="/admin/management" className="text-indigo-700 hover:text-indigo-850 hover:underline">
            Back to Management
          </Link>
        </div>

        {/* Header Block */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">{professor.name}</h1>
              <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full font-bold text-[10px] uppercase">
                {professor.level} - {professor.department}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1 font-semibold">{professor.email} · Classes: {professor.sections || 'None'}</p>
          </div>
          
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
            <div className="flex gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Academic Year</label>
                <input 
                  type="text" 
                  value={academicYear} 
                  onChange={(e) => setAcademicYear(e.target.value)} 
                  className="p-2.5 border border-slate-200 rounded-xl text-xs bg-white font-semibold w-28 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600/10"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Semester</label>
                <select 
                  value={semester} 
                  onChange={(e) => setSemester(e.target.value)} 
                  className="p-2.5 border border-slate-200 rounded-xl text-xs bg-white font-semibold w-28 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600/10"
                >
                  <option value="1st">1st Sem</option>
                  <option value="2nd">2nd Sem</option>
                  <option value="Summer">Summer</option>
                </select>
              </div>
            </div>

            <button 
              onClick={handleGenerateSummary} 
              disabled={isProcessing}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 disabled:opacity-50 transition-all self-end cursor-pointer"
            >
              {isProcessing ? "Processing..." : "Regenerate AI Analysis"}
            </button>
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Composite Evaluation Score</p>
              <h2 className="text-3xl font-black text-slate-900">
                {scoreCache?.compositeScore !== null && scoreCache?.compositeScore !== undefined ? `${scoreCache.compositeScore}%` : 'N/A'}
              </h2>
            </div>
            {scoreCache?.compositeScore !== null && (
              <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                scoreCache.compositeScore >= 80 ? 'bg-emerald-50 text-emerald-700' :
                scoreCache.compositeScore >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
              }`}>
                {scoreCache.compositeScore >= 80 ? 'Excellent' : scoreCache.compositeScore >= 60 ? 'Satisfactory' : 'Needs Work'}
              </span>
            )}
          </div>

          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mathematical Scale Score (70%)</p>
            <h2 className="text-3xl font-black text-slate-700">
              {scoreCache?.scaleScore !== null && scoreCache?.scaleScore !== undefined ? `${scoreCache.scaleScore}%` : 'N/A'}
            </h2>
          </div>

          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AI Sentiment Score (30%)</p>
            <h2 className="text-3xl font-black text-slate-700">
              {scoreCache?.aiQualityScore !== null && scoreCache?.aiQualityScore !== undefined ? `${scoreCache.aiQualityScore}%` : 'N/A'}
            </h2>
          </div>
        </div>

        {/* AI Narrative Section */}
        <div className="bg-white border border-indigo-100 rounded-2xl p-6 shadow-sm shadow-indigo-100/30 space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <h2 className="text-lg font-extrabold text-indigo-950 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-ping" />
              Gemini AI Evaluation Sentiment Analysis
            </h2>
            {aiSummary && (
              <span className="text-xs bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider">
                Rating Sentiment: {aiSummary.ratingScore} / 100
              </span>
            )}
          </div>

          {loading ? (
            <p className="text-slate-400 font-medium animate-pulse py-4">Syncing insights with Gemini...</p>
          ) : aiSummary ? (
            <div className="space-y-4">
              <p className="text-slate-700 leading-relaxed text-base italic">
                "{aiSummary.summaryText}"
              </p>
            </div>
          ) : (
            <div className="py-6 text-center text-slate-400">
              <p className="font-semibold mb-2">No summary generated yet.</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Click the "Regenerate AI Analysis" button above to evaluate student comments.
              </p>
            </div>
          )}
        </div>

        {/* Visual Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm border-b pb-2">Cluster Breakdown (Radar)</h3>
            <RadarClusterChart data={clusterScores} />
          </div>
          
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm border-b pb-2">Section Performance (Bar)</h3>
            <SectionBarChart data={sectionScores} />
          </div>
        </div>

        {/* Lower Grid: Trends & Audit Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Trend Analysis */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-4 lg:col-span-2">
            <h3 className="font-bold text-slate-800 text-sm border-b pb-2">Historical Composite Trends</h3>
            <HistoricalTrendChart data={historicalScores} />
          </div>

          {/* Anonymized Evaluation Log */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm border-b pb-2">Recent Evaluations ({evaluationLog.length})</h3>
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 pr-1">
              {evaluationLog.length === 0 ? (
                <p className="text-xs text-slate-400 font-semibold italic text-center py-8">No responses logged for this term.</p>
              ) : (
                evaluationLog.map((log: any, idx: number) => (
                  <div key={log.id} className="py-2.5 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-slate-800">Section {log.sectionName}</p>
                      <p className="text-[10px] text-slate-450 mt-0.5">{new Date(log.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold">SUBMITTED</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
