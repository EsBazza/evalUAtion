'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getFacultyProfileData } from '@/app/actions/management';
import { processFacultyEvaluationSummary } from '@/app/actions/ai';
import { getSystemSettings } from '@/app/actions/settings';
import { RadarClusterChart } from '@/components/charts/RadarClusterChart';
import { SectionBarChart } from '@/components/charts/SectionBarChart';
import { HistoricalTrendChart } from '@/components/charts/HistoricalTrendChart';
import { ChevronLeft, BrainCircuit, RefreshCw, BarChart3, ShieldAlert } from 'lucide-react';

// UA Primitives
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui-ua/card';
import { Button } from '@/components/ui-ua/button';
import { toast } from '@/components/ui-ua/toast';
import { cn } from '@/lib/utils';

interface FacultyPreviewClientProps {
  professorId: string;
}

// Frame-synchronized count-up animation component
function CountUp({ end, duration = 0.8, suffix = "" }: { end: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      setCount(end);
      return;
    }

    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1);
      setCount(progress * end);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [end, duration]);

  const isDecimal = end % 1 !== 0;
  return (
    <span>
      {isDecimal ? count.toFixed(1) : Math.floor(count)}
      {suffix}
    </span>
  );
}

export default function FacultyPreviewClient({ professorId }: FacultyPreviewClientProps) {
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [semester, setSemester] = useState('1st');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFacultyPageEnabled, setIsFacultyPageEnabled] = useState(true);

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
    async function loadSettings() {
      try {
        const settings = await getSystemSettings();
        setIsFacultyPageEnabled(settings.isFacultyPageEnabled);
      } catch (err) {
        console.error("Failed to load settings in faculty preview", err);
      }
    }
    loadSettings();
  }, []);

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
        toast.success("AI analysis narrative generated successfully!");
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
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-ua-navy border-t-transparent dark:border-ua-gold dark:border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">Syncing Faculty Workspace...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { professor, scoreCache, clusterScores, sectionScores, historicalScores, aiSummary, comments, evaluationLog } = data;
  const commentsList = comments || [];

  return (
    <div className="space-y-6">
      
      {/* Admin Warning Banner */}
      <div className="bg-ua-gold/10 border border-ua-gold/25 text-foreground px-5 py-3 rounded-lg flex items-center justify-between text-xs font-semibold shadow-sm flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-ua-gold shrink-0" />
          <span>ADMIN PREVIEW: You are viewing this faculty performance report as a system administrator. Student identities are hidden.</span>
        </div>
        <Link href="/admin/management">
          <Button uaVariant="outline" className="h-8 text-xs flex items-center justify-center">
            <ChevronLeft className="size-3.5 mr-1" />
            Back to Management
          </Button>
        </Link>
      </div>

      {!isFacultyPageEnabled && (
        <div className="bg-ua-crimson/10 border border-ua-crimson/25 text-ua-crimson px-5 py-3 rounded-lg flex items-center gap-2 text-xs font-semibold shadow-sm animate-pulse">
          <ShieldAlert className="size-4 shrink-0" />
          <span>PORTAL SUSPENDED: Faculty Page access is currently DISABLED in System Settings. Faculty members will not see any of this dashboard information and will only see a suspension notice when they log in.</span>
        </div>
      )}

      {/* Header Block */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-4 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-serif text-2xl font-bold text-foreground">{professor.name}</h1>
            <span className="px-2.5 py-0.5 bg-ua-navy/5 border border-ua-navy/10 text-ua-navy dark:bg-ua-gold/15 dark:text-ua-gold dark:border-ua-gold/20 rounded-full font-bold text-[10px] uppercase">
              {professor.level} - {professor.department}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-semibold">
            {professor.email} · Classes: {professor.sections || 'None'}
          </p>
        </div>
        
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
          <div className="flex gap-2">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Academic Year</label>
              <input 
                type="text" 
                value={academicYear} 
                onChange={(e) => setAcademicYear(e.target.value)} 
                className="h-10 px-3 border border-border rounded-lg text-xs bg-card font-semibold w-28 text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Semester</label>
              <select 
                value={semester} 
                onChange={(e) => setSemester(e.target.value)} 
                className="h-10 px-3 border border-border rounded-lg text-xs bg-card font-semibold w-28 text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none"
              >
                <option value="1st">1st Sem</option>
                <option value="2nd">2nd Sem</option>
                <option value="Summer">Summer</option>
              </select>
            </div>
          </div>

          <Button 
            onClick={handleGenerateSummary} 
            disabled={isProcessing}
            uaVariant="primary"
            className="h-10 text-xs self-end"
          >
            <RefreshCw className={cn("size-3.5 mr-1.5", isProcessing && "animate-spin")} />
            {isProcessing ? "Analyzing..." : "Regenerate AI Analysis"}
          </Button>
        </div>
      </div>

      {/* 1. Analytics (Metric Cards Row) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Composite Score</span>
              <h2 className="text-3xl font-bold font-sans text-ua-navy dark:text-ua-gold">
                {scoreCache?.compositeScore !== null && scoreCache?.compositeScore !== undefined ? (
                  <CountUp end={scoreCache.compositeScore} suffix="%" />
                ) : 'N/A'}
              </h2>
            </div>
            {scoreCache && scoreCache.compositeScore !== null && scoreCache.compositeScore !== undefined && (
              <span className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase",
                scoreCache.compositeScore >= 80 ? 'bg-emerald-50 border border-emerald-150 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' :
                scoreCache.compositeScore >= 60 ? 'bg-ua-gold/10 border border-ua-gold/25 text-ua-gold' : 'bg-ua-crimson/5 border border-ua-crimson/15 text-ua-crimson'
              )}>
                {scoreCache.compositeScore >= 80 ? 'Excellent' : scoreCache.compositeScore >= 60 ? 'Satisfactory' : 'Needs Work'}
              </span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex flex-col justify-center space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Mathematical Score (70%)</span>
            <h2 className="text-3xl font-bold font-sans text-muted-foreground">
              {scoreCache?.scaleScore !== null && scoreCache?.scaleScore !== undefined ? (
                <CountUp end={scoreCache.scaleScore} suffix="%" />
              ) : 'N/A'}
            </h2>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex flex-col justify-center space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">AI Sentiment Score (30%)</span>
            <h2 className="text-3xl font-bold font-sans text-muted-foreground">
              {scoreCache?.aiQualityScore !== null && scoreCache?.aiQualityScore !== undefined ? (
                <CountUp end={scoreCache.aiQualityScore} suffix="%" />
              ) : 'N/A'}
            </h2>
          </CardContent>
        </Card>
      </div>

      {/* 2. Graphs Section */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="border-b border-border/40 pb-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Cluster Breakdown (Radar)</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <RadarClusterChart data={clusterScores} />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="border-b border-border/40 pb-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Section Performance (Bar)</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <SectionBarChart data={sectionScores} />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="border-b border-border/40 pb-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Historical Composite Trends</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <HistoricalTrendChart data={historicalScores} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/40 pb-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <BarChart3 className="size-4" />
                Recent Evaluations ({evaluationLog.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="max-h-64 overflow-y-auto divide-y divide-border/40 pr-1">
                {evaluationLog.length === 0 ? (
                  <p className="text-xs text-muted-foreground font-semibold italic text-center py-8">No responses logged for this term.</p>
                ) : (
                  evaluationLog.map((log: any) => (
                    <div key={log.id} className="py-2.5 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-bold text-foreground">Section {log.sectionName}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(log.createdAt).toLocaleDateString()}</p>
                      </div>
                      <span className="text-[9px] bg-muted border border-border text-muted-foreground px-2 py-0.5 rounded font-bold">SUBMITTED</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 3. Average Score Per Cluster */}
      <Card>
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Average Score Per Cluster</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="divide-y divide-border/40">
            {clusterScores && clusterScores.length > 0 ? (
              clusterScores.map((item: any, i: number) => (
                <div key={i} className="py-3.5 flex justify-between items-center text-xs">
                  <span className="font-semibold text-foreground pr-4 leading-normal">{item.subject}</span>
                  <span className="font-bold text-ua-navy dark:text-ua-gold bg-muted px-2.5 py-1 rounded border border-border shrink-0">
                    {item.score}%
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground italic py-4 text-center font-semibold">No cluster scores available.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 4. Anonymous Student Comments */}
      <Card>
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Anonymous Student Comments</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
            {commentsList.length === 0 ? (
              <p className="text-xs text-muted-foreground font-semibold italic text-center py-8">No comments submitted for this term.</p>
            ) : (
              commentsList.map((comment: string, i: number) => (
                <div key={i} className="p-4 bg-muted/40 border border-border/60 rounded-lg text-xs leading-relaxed text-foreground font-medium shadow-inner">
                  "{comment}"
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* 5. Gemini AI Evaluation Sentiment Analysis */}
      <Card className="relative overflow-hidden border-border/60">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-ua-navy dark:bg-ua-gold" />
        <CardHeader className="border-b border-border/40 bg-muted/10 pb-4 flex flex-row justify-between items-center">
          <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <BrainCircuit className="size-4 text-ua-navy dark:text-ua-gold" />
            Gemini AI Evaluation Sentiment Analysis
          </CardTitle>
          {aiSummary && (
            <span className="text-xs bg-ua-navy/5 border border-ua-navy/10 text-ua-navy dark:bg-ua-gold/15 dark:text-ua-gold dark:border-ua-gold/20 px-3 py-1 rounded-full font-bold uppercase">
              Rating Sentiment: {aiSummary.ratingScore} / 100
            </span>
          )}
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <p className="text-muted-foreground font-medium animate-pulse py-4">Syncing insights with Gemini...</p>
          ) : aiSummary ? (
            <blockquote className="border-l-4 border-ua-gold/40 pl-4 py-1 italic font-serif text-lg text-ua-navy dark:text-ua-gold leading-relaxed">
              "{aiSummary.summaryText}"
            </blockquote>
          ) : (
            <div className="py-6 text-center text-muted-foreground">
              <p className="font-semibold mb-2">No summary generated yet.</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Click the "Regenerate AI Analysis" button above to evaluate student comments.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
