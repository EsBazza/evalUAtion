'use client';

import { useEffect, useState, Suspense } from 'react';
import { processFacultyEvaluationSummary, getFacultyProfessorId } from '@/app/actions/ai';
import { getFacultyProfileData } from '@/app/actions/management';
import { getSystemSettings } from '@/app/actions/settings';
import { RadarClusterChart } from '@/components/charts/RadarClusterChart';
import { SectionBarChart } from '@/components/charts/SectionBarChart';
import { Award, BrainCircuit, RefreshCw, BarChart3, AlertCircle } from 'lucide-react';

// UA Primitives
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui-ua/card';
import { Button } from '@/components/ui-ua/button';
import { toast } from '@/components/ui-ua/toast';
import { AppShell } from '@/components/ui-ua/app-shell';
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
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
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

  const fetchProfileData = async (id: string, year: string, sem: string) => {
    setIsLoading(true);
    try {
      const data = await getFacultyProfileData(id, year, sem);
      setProfileData(data);
    } catch (err: any) {
      toast.error("Failed to sync evaluation profile parameters.");
    } finally {
      setIsLoading(false);
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
        toast.success("AI analysis generated successfully!");
        await fetchProfileData(professorId, academicYear, semester);
      } else {
        toast.error(res.message || "Failed to process summary");
        setProfileData(null);
      }
    } catch (e) {
      toast.error("Failed to connect with Gemini AI endpoint.");
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
              <Button onClick={() => window.location.href = "/"} uaVariant="outline" className="w-full font-bold text-xs uppercase tracking-wider">
                Return to Login
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
              <Button onClick={() => window.location.href = "/"} uaVariant="outline" className="w-full">
                Return to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const aiSummary = profileData?.aiSummary;
  const scoreCache = profileData?.scoreCache;

  const navItems = [
    { id: 'dashboard', label: 'Faculty Analytics', href: '/faculty', icon: Award }
  ];

  return (
    <AppShell
      navItems={navItems}
      role="FACULTY MEMBER"
      title="Assumption"
      subtitle="Faculty Console"
    >
      <div className="space-y-6">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-4 border-b border-border/80">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground tracking-wide uppercase">
              Faculty Analytics
            </h1>
            <p className="text-xs text-muted-foreground mt-1 font-semibold">
              View your evaluation performance metrics and AI-generated narrative insights
            </p>
          </div>
          
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
            </div>

            <Button 
              onClick={handleGenerateSummary} 
              disabled={isProcessing || !professorId}
              uaVariant="primary"
              className="h-10 text-xs self-end"
            >
              <RefreshCw className={cn("size-3.5 mr-1.5", isProcessing && "animate-spin")} />
              {isProcessing ? "Processing..." : "Regenerate AI"}
            </Button>
          </div>
        </div>

        {/* Metric Overview Cards */}
        {scoreCache && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6 flex flex-col justify-center space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Composite Performance</span>
                <h2 className="text-3xl font-bold font-sans text-ua-navy dark:text-ua-gold">
                  <CountUp end={scoreCache.compositeScore} suffix="%" />
                </h2>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 flex flex-col justify-center space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Scale Questions Score (70%)</span>
                <h2 className="text-3xl font-bold font-sans text-muted-foreground">
                  <CountUp end={scoreCache.scaleScore} suffix="%" />
                </h2>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 flex flex-col justify-center space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">AI Sentiment Score (30%)</span>
                <h2 className="text-3xl font-bold font-sans text-muted-foreground">
                  <CountUp end={scoreCache.aiQualityScore} suffix="%" />
                </h2>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* AI Summary Card */}
        <Card className="relative overflow-hidden border-border/60">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-ua-navy dark:bg-ua-gold" />
          <CardHeader className="border-b border-border/40 bg-muted/10 pb-4 flex flex-row justify-between items-center">
            <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <BrainCircuit className="size-4 text-ua-navy dark:text-ua-gold" />
              Gemini AI-Generated Narrative Breakdown
            </CardTitle>
            {aiSummary && (
              <span className="text-xs bg-ua-navy/5 border border-ua-navy/10 text-ua-navy dark:bg-ua-gold/15 dark:text-ua-gold dark:border-ua-gold/20 px-3 py-1 rounded-full font-bold uppercase">
                Rating Sentiment: {aiSummary.ratingScore} / 100
              </span>
            )}
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
                  Click the "Regenerate AI" button at the top to process qualitative student text feedback.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Analytics Breakdown Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="border-b border-border/40 pb-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <BarChart3 className="size-4 text-ua-navy dark:text-ua-gold" />
                Section Performance (Bar)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <SectionBarChart data={profileData?.sectionScores || []} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/40 pb-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Award className="size-4 text-ua-navy dark:text-ua-gold" />
                Cluster Metrics (Radar)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <RadarClusterChart data={profileData?.clusterScores || []} />
            </CardContent>
          </Card>
        </div>

      </div>
    </AppShell>
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
