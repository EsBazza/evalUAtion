'use client';

import { useEffect, useState } from 'react';
import { processFacultyEvaluationSummary, getFacultySummary, getFacultyProfessorId } from '@/app/actions/ai';

export default function FacultyDashboard() {
  const [professorId, setProfessorId] = useState<string | null>(null);
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [semester, setSemester] = useState('1st');
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  useEffect(() => {
    async function init() {
      const id = await getFacultyProfessorId();
      setProfessorId(id);
    }
    init();
  }, []);

  const fetchSummary = async (id: string, year: string, sem: string) => {
    setIsLoading(true);
    const data = await getFacultySummary(id, year, sem);
    setSummary(data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (professorId) {
      fetchSummary(professorId, academicYear, semester);
    }
  }, [professorId, academicYear, semester]);

  const handleGenerateSummary = async () => {
    if (!professorId) return;
    setIsProcessing(true);
    const res = await processFacultyEvaluationSummary(professorId, academicYear, semester);
    if (res.success) {
      await fetchSummary(professorId, academicYear, semester);
    } else {
      alert(res.message || "Failed to process summary");
      setSummary(null);
    }
    setIsProcessing(false);
  };

  if (professorId === null && !isLoading) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <h1 className="text-3xl font-black text-red-600 mt-20">Access Denied</h1>
        <p className="text-slate-600 leading-relaxed">
          Your logged-in account is not registered as a Faculty member in the database.
        </p>
        <p className="text-sm text-slate-500">Please contact the Administrator to link your email address.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 py-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-gray-200">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="bg-indigo-600 text-white px-3 py-1 rounded-xl text-2xl font-extrabold shadow-sm">UA</span>
              Faculty Analytics Dashboard
            </h1>
            <p className="text-sm text-slate-500 mt-1.5 font-medium">View your evaluation performance and AI-generated text summary insights</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            <div className="flex gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Academic Year</label>
                <input 
                  type="text" 
                  value={academicYear} 
                  onChange={(e) => setAcademicYear(e.target.value)} 
                  className="p-2 border rounded-xl text-xs bg-white font-semibold w-28"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Semester</label>
                <select 
                  value={semester} 
                  onChange={(e) => setSemester(e.target.value)} 
                  className="p-2 border rounded-xl text-xs bg-white font-semibold w-28"
                >
                  <option value="1st">1st Sem</option>
                  <option value="2nd">2nd Sem</option>
                  <option value="Summer">Summer</option>
                </select>
              </div>
            </div>

            <button 
              onClick={handleGenerateSummary} 
              disabled={isProcessing || !professorId}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 disabled:opacity-50 transition-all self-end"
            >
              {isProcessing ? "Processing..." : "Regenerate AI"}
            </button>
          </div>
        </div>
        
        {/* AI Summary Card */}
        <div className="bg-white border border-indigo-100 rounded-2xl p-6 shadow-sm shadow-indigo-100/30 space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <h2 className="text-lg font-extrabold text-indigo-950 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-ping" />
              Gemini AI-Generated Narrative Breakdown
            </h2>
            {summary && (
              <span className="text-xs bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider">
                Rating Sentiment: {summary.ratingScore} / 100
              </span>
            )}
          </div>

          {isLoading ? (
            <p className="text-slate-400 font-medium animate-pulse py-4">Syncing insights with Gemini...</p>
          ) : summary ? (
            <div className="space-y-4">
              <p className="text-slate-700 leading-relaxed text-base italic">
                "{summary.summaryText}"
              </p>
            </div>
          ) : (
            <div className="py-6 text-center text-slate-400">
              <p className="font-semibold mb-2">No summary generated yet.</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Click the "Regenerate AI Summary" button at the top to process qualitative student text feedback.
              </p>
            </div>
          )}
        </div>

        {/* Analytics Breakdown Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-3">
            <h3 className="font-bold text-slate-800">Section Performance</h3>
            <div className="h-40 bg-slate-50 border border-dashed rounded-xl flex items-center justify-center text-slate-400 text-sm font-semibold">
              Chart Display Placeholder
            </div>
          </div>
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-3">
            <h3 className="font-bold text-slate-800">Historical Rating Trends</h3>
            <div className="h-40 bg-slate-50 border border-dashed rounded-xl flex items-center justify-center text-slate-400 text-sm font-semibold">
              Radar Graph Display Placeholder
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
