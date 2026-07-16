'use client';

import { useEffect, useState, Suspense } from 'react';
import { processFacultyEvaluationSummary, getFacultyProfessorId } from '@/app/actions/ai';
import { getFacultyProfileData } from '@/app/actions/management';
import { getSystemSettings } from '@/app/actions/settings';
import { RadarClusterChart } from '@/components/charts/RadarClusterChart';
import { SectionBarChart } from '@/components/charts/SectionBarChart';
import { HistoricalTrendChart } from '@/components/charts/HistoricalTrendChart';
import { Award, BrainCircuit, RefreshCw, BarChart3, AlertCircle, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { exportFacultyCSV, exportFacultyPDF } from '@/lib/exports';

// UA Primitives
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui-ua/card';
import { Button } from '@/components/ui-ua/button';
import { toast } from '@/components/ui-ua/toast';
import { Footer } from '@/components/layout/Footer';
import { cn } from '@/lib/utils';

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

function FacultyDashboardContent() {
  const [professorId, setProfessorId] = useState<string | null>(null);
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [semester, setSemester] = useState('1st');
  const [selectedSubjectId, setSelectedSubjectId] = useState('all');
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPageEnabled, setIsPageEnabled] = useState<boolean | null>(null);
  
  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const settings = await getSystemSettings();
        setIsPageEnabled(settings.isFacultyPageEnabled);
        
        if (settings.isFacultyPageEnabled) {
          const id = await getFacultyProfessorId();
          setProfessorId(id);
        }
      } catch (err) {
        toast.error("Failed to authenticate faculty session.");
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const fetchProfileData = async (id: string, year: string, sem: string, subjectId: string) => {
    setIsLoading(true);
    try {
      const data = await getFacultyProfileData(id, year, sem, subjectId);
      setProfileData(data);
    } catch (err: any) {
      toast.error("Failed to sync evaluation profile parameters.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (professorId) {
      fetchProfileData(professorId, academicYear, semester, selectedSubjectId);
    }
  }, [professorId, academicYear, semester, selectedSubjectId]);

  const handleGenerateSummary = async () => {
    if (!professorId) return;
    setIsProcessing(true);
    try {
      const res = await processFacultyEvaluationSummary(professorId, academicYear, semester);
      if (res.success) {
        toast.success("AI analysis narrative generated successfully!");
        await fetchProfileData(professorId, academicYear, semester, selectedSubjectId);
      } else {
        toast.error(res.message || "Failed to process qualitative summary.");
      }
    } catch (e: any) {
      toast.error(e.message || "Gemini processing error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (isPageEnabled === false && !isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-border/80 shadow-lg">
          <CardHeader className="text-center pb-2">
            <AlertCircle className="size-12 text-ua-gold mx-auto mb-2" />
            <CardTitle className="font-serif text-xl font-bold uppercase tracking-wider text-slate-800 dark:text-ua-gold">Portal Suspended</CardTitle>
            <CardDescription className="text-xs uppercase font-bold text-muted-foreground">System Notice</CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground space-y-4 py-4">
            <p className="leading-relaxed">
              The Faculty Analytics portal has been temporarily disabled by the system administrator.
            </p>
            <p className="text-xs font-semibold italic text-muted-foreground">
              Please check back later or contact the administration for details.
            </p>
            <div className="pt-4">
              <Button onClick={() => signOut({ callbackUrl: "/" })} uaVariant="destructive" className="w-full font-bold text-xs uppercase tracking-wider">
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (professorId === null && !isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-border/80">
          <CardHeader className="text-center pb-2">
            <AlertCircle className="size-12 text-ua-crimson mx-auto mb-2" />
            <CardTitle className="font-serif text-xl font-bold">Access Denied</CardTitle>
            <CardDescription>Faculty registration error</CardDescription>
          </CardHeader>
          <CardContent className="text-center text-xs text-muted-foreground space-y-4">
            <p className="leading-relaxed">
              Your logged-in account is not registered as a Faculty member in the database.
            </p>
            <p>Please contact the School Administrator to link your email address.</p>
            <div className="pt-2">
              <Button onClick={() => signOut({ callbackUrl: "/" })} uaVariant="destructive" className="w-full font-bold text-xs uppercase tracking-wider">
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }


  if (isLoading && !profileData) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">
        {/* Responsive Header without Sidebar */}
        <header className="sticky top-0 z-40 w-full flex items-center justify-between bg-ua-navy text-ua-warm-white px-5 py-3 shadow-md md:px-8">
          <div className="flex items-center gap-3">
            <img
              src="/ua-logo.png"
              alt="UA Logo"
              className="w-10 h-10 object-contain rounded-full border border-white/20 bg-white"
            />
            <div>
              <h1 className="text-[10px] font-semibold tracking-wider text-ua-warm-white/80 leading-none">UNIVERSITY OF THE</h1>
              <h2 className="text-sm font-bold tracking-wide text-ua-gold uppercase leading-tight">Assumption</h2>
              <span className="inline-block text-[8px] font-semibold text-white/40 tracking-wider uppercase leading-none">
                Faculty Console
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block px-3 py-1 bg-ua-navy-black/30 rounded-md border border-white/5">
              <p className="text-[8px] text-white/40 font-bold uppercase tracking-wider leading-none">Role</p>
              <p className="text-[10px] font-bold text-ua-gold tracking-wide uppercase">FACULTY MEMBER</p>
            </div>
            <Button
              uaVariant="destructive"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="h-9 px-3 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5"
            >
              <LogOut className="size-3.5" />
              Sign Out
            </Button>
          </div>
        </header>

        <div className="flex-1 flex flex-col min-w-0 bg-background">
          <main className="flex-grow p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
            <div className="min-h-[60vh] flex items-center justify-center p-8 bg-background">
              <div className="text-center space-y-3">
                <div className="w-10 h-10 border-4 border-ua-navy border-t-transparent dark:border-ua-gold dark:border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">Syncing Faculty Workspace...</p>
              </div>
            </div>
          </main>
          <Footer />
        </div>
      </div>
    );
  }

  if (!profileData) return null;

  const { professor, scoreCache, clusterScores, sectionScores, historicalScores, aiSummary, comments, evaluationLog } = profileData;
  const commentsList = comments || [];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">
      {/* Responsive Header without Sidebar */}
      <header className="sticky top-0 z-40 w-full flex items-center justify-between bg-ua-navy text-ua-warm-white px-5 py-3 shadow-md md:px-8">
        <div className="flex items-center gap-3">
          <img
            src="/ua-logo.png"
            alt="UA Logo"
            className="w-10 h-10 object-contain rounded-full border border-white/20 bg-white"
          />
          <div>
            <h1 className="text-[10px] font-semibold tracking-wider text-ua-warm-white/80 leading-none">UNIVERSITY OF THE</h1>
            <h2 className="text-sm font-bold tracking-wide text-ua-gold uppercase leading-tight">Assumption</h2>
            <span className="inline-block text-[8px] font-semibold text-white/40 tracking-wider uppercase leading-none">
              Faculty Console
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:block px-3 py-1 bg-ua-navy-black/30 rounded-md border border-white/5">
            <p className="text-[8px] text-white/40 font-bold uppercase tracking-wider leading-none">Role</p>
            <p className="text-[10px] font-bold text-ua-gold tracking-wide uppercase">FACULTY MEMBER</p>
          </div>
          <Button
            uaVariant="destructive"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="h-9 px-3 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5"
          >
            <LogOut className="size-3.5" />
            Sign Out
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <main className="flex-grow p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
      <div className="space-y-6">
        
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
                  className="h-10 px-3 border border-border rounded-lg text-xs bg-card font-semibold w-28 text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-bold"
                >
                  <option value="1st">1st Sem</option>
                  <option value="2nd">2nd Sem</option>
                  <option value="Summer">Summer</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Subject Course</label>
                <select 
                  value={selectedSubjectId} 
                  onChange={(e) => setSelectedSubjectId(e.target.value)} 
                  className="h-10 px-3 border border-border rounded-lg text-xs bg-card font-semibold w-44 text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-bold"
                >
                  <option value="all">All Subjects</option>
                  {profileData?.professor?.subjects?.map((sub: any) => (
                    <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 self-end">
              <Button
                onClick={() => {
                  if (professorId) {
                    fetchProfileData(professorId, academicYear, semester, selectedSubjectId);
                    toast.success("Dashboard data refreshed!");
                  }
                }}
                uaVariant="outline"
                className="h-10 text-xs flex items-center"
                disabled={isLoading}
              >
                <RefreshCw className={cn("size-3.5 mr-1.5", isLoading && "animate-spin")} />
                Refresh Data
              </Button>
              <Button
                onClick={() => exportFacultyCSV({
                  professor,
                  academicYear,
                  semester,
                  scoreCache,
                  clusterScores,
                  sectionScores,
                  commentsList
                })}
                uaVariant="outline"
                className="h-10 text-xs flex items-center"
              >
                Export CSV
              </Button>
              <Button
                onClick={() => exportFacultyPDF({
                  professor,
                  academicYear,
                  semester
                })}
                uaVariant="outline"
                className="h-10 text-xs flex items-center"
              >
                Export PDF
              </Button>
            </div>
          </div>
        </div>

        <div id="faculty-report-content" className="space-y-6 bg-background p-4 rounded-xl">

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
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Cluster Breakdown (Radar)</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <RadarClusterChart data={clusterScores} />
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
                    <span className="font-semibold text-foreground pr-4 leading-normal">{item.title || item.subject} - Average Score</span>
                    <span className="font-bold text-ua-navy dark:text-ua-gold bg-muted px-2.5 py-1 rounded border border-border shrink-0">
                      {item.score !== null ? `${item.score}%` : 'N/A'}
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
          <CardHeader className="border-b border-border/40 bg-muted/10 pb-4 flex flex-row justify-between items-center flex-wrap gap-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <BrainCircuit className="size-4 text-ua-navy dark:text-ua-gold" />
              Gemini AI Evaluation Sentiment Analysis
            </CardTitle>
            <div className="flex items-center gap-3">
              {aiSummary && (
                <span className="text-xs bg-ua-navy/5 border border-ua-navy/10 text-ua-navy dark:bg-ua-gold/15 dark:text-ua-gold dark:border-ua-gold/20 px-3 py-1 rounded-full font-bold uppercase">
                  Rating Sentiment: {aiSummary.ratingScore} / 100
                </span>
              )}
              <Button 
                onClick={handleGenerateSummary} 
                disabled={isProcessing || !professorId}
                uaVariant="primary"
                className="h-8 text-xs font-semibold px-3 uppercase tracking-wider"
              >
                <RefreshCw className={cn("size-3 mr-1.5", isProcessing && "animate-spin")} />
                {isProcessing ? "Analyzing..." : "Regenerate AI Analysis"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
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
      </div>
    </main>
    <Footer />
  </div>
</div>
  );
}

export default function FacultyDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <div className="text-center space-y-3 animate-pulse">
          <div className="w-10 h-10 border-4 border-ua-navy border-t-transparent dark:border-ua-gold dark:border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">Syncing Faculty Workspace...</p>
        </div>
      </div>
    }>
      <FacultyDashboardContent />
    </Suspense>
  );
}

