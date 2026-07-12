'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  getDepartments, 
  createDepartment, 
  getTemplates, 
  createTemplate, 
  getFacultyRankings,
  getEvaluationReceipts
} from '@/app/actions/admin';
import { EducationLevel, Role } from '@prisma/client';
import Link from 'next/link';
import { FacultyRankingChart } from '@/components/charts/FacultyRankingChart';
import { DepartmentDonutChart } from '@/components/charts/DepartmentDonutChart';
import { getAuditLogs } from '@/app/actions/audit';
import { 
  getSystemSettings, 
  updateSystemSettings,
  getAdmins,
  elevateUserToAdmin,
  revokeAdminAction
} from '@/app/actions/settings';

// UA UI Primitives
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui-ua/card';
import { Button } from '@/components/ui-ua/button';
import { toast } from '@/components/ui-ua/toast';
import { cn } from '@/lib/utils';

type ActiveView = 'rankings' | 'departments' | 'templates' | 'logs' | 'settings';

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

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const activeView = (searchParams.get('tab') || 'rankings') as ActiveView;
  
  const [receipts, setReceipts] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [nestedLogTab, setNestedLogTab] = useState<'audit' | 'attendance'>('audit');
  const [receiptSearch, setReceiptSearch] = useState('');
  const [receiptYearFilter, setReceiptYearFilter] = useState('');
  const [receiptSemFilter, setReceiptSemFilter] = useState('');
  const [receiptLevelFilter, setReceiptLevelFilter] = useState('');
  const [receiptDepFilter, setReceiptDepFilter] = useState('');
  const [receiptSecFilter, setReceiptSecFilter] = useState('');
  const [rankings, setRankings] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Sorting states for rankings
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Sorting states for admins
  const [adminSortField, setAdminSortField] = useState('email');
  const [adminSortDirection, setAdminSortDirection] = useState<'asc' | 'desc'>('asc');

  // Sorting and searching states for audit logs
  const [logSortField, setLogSortField] = useState<'date' | 'type' | 'actor'>('date');
  const [logSortDirection, setLogSortDirection] = useState<'asc' | 'desc'>('desc');
  const [logSearch, setLogSearch] = useState('');

  // Form states
  const [depName, setDepName] = useState('');
  const [depLevel, setDepLevel] = useState<EducationLevel>('COLLEGE');

  const [tempTitle, setTempTitle] = useState('');
  const [tempLevel, setTempLevel] = useState<EducationLevel>('COLLEGE');
  const [tempDepId, setTempDepId] = useState('');

  // Admin addition states
  const [showAddAdminForm, setShowAddAdminForm] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  const [sysYear, setSysYear] = useState('2026-2027');
  const [sysSem, setSysSem] = useState('1st');

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeView === 'rankings') {
        const data = await getFacultyRankings();
        setRankings(data);
      } else if (activeView === 'departments') {
        const data = await getDepartments();
        setDepartments(data);
      } else if (activeView === 'templates') {
        const data = await getTemplates();
        setTemplates(data);
      } else if (activeView === 'logs') {
        const data = await getEvaluationReceipts();
        setReceipts(data);
        const audits = await getAuditLogs();
        setAuditLogs(audits);
        const deps = await getDepartments();
        setDepartments(deps);
      } else if (activeView === 'settings') {
        const settings = await getSystemSettings();
        setSysYear(settings.academicYear);
        setSysSem(settings.semester);
        const adminUsers = await getAdmins();
        setAdmins(adminUsers);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeView]);

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depName) return;
    try {
      await createDepartment(depName, depLevel);
      setDepName('');
      toast.success('Department created successfully!');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Error creating department');
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempTitle) return;
    try {
      await createTemplate(tempTitle, tempLevel, tempDepId || undefined);
      setTempTitle('');
      setTempDepId('');
      toast.success('Template created successfully!');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Error creating template');
    }
  };

  const handleElevateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim() || !newAdminUsername.trim() || !newAdminPassword.trim()) return;
    try {
      await elevateUserToAdmin(newAdminEmail, newAdminUsername, newAdminPassword);
      setNewAdminEmail('');
      setNewAdminUsername('');
      setNewAdminPassword('');
      setShowAddAdminForm(false);
      toast.success(`Successfully elevated ${newAdminEmail} to Admin!`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to elevate user to admin');
    }
  };

  const handleRevokeAdmin = async (userId: string) => {
    if (!confirm("Are you sure you want to revoke administrative privileges?")) return;
    try {
      await revokeAdminAction(userId);
      toast.success("Administrative privileges revoked successfully.");
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke admin privileges');
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSystemSettings(sysYear, sysSem);
      toast.success("System academic term settings updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update system settings");
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedRankings = [...rankings].sort((a, b) => {
    let valA = '';
    let valB = '';

    if (sortField === 'name') {
      valA = a.name || '';
      valB = b.name || '';
    } else if (sortField === 'email') {
      valA = a.email || '';
      valB = b.email || '';
    } else if (sortField === 'department') {
      valA = a.department || '';
      valB = b.department || '';
    } else if (sortField === 'score') {
      const numA = a.averageScore !== null ? a.averageScore : -1;
      const numB = b.averageScore !== null ? b.averageScore : -1;
      return sortDirection === 'asc' ? numA - numB : numB - numA;
    }

    const cleanA = valA.toLowerCase();
    const cleanB = valB.toLowerCase();
    if (cleanA < cleanB) return sortDirection === 'asc' ? -1 : 1;
    if (cleanA > cleanB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border/80">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground tracking-wide uppercase">
            {activeView === 'rankings' 
              ? 'Faculty Performance Ledger' 
              : activeView === 'logs' 
              ? 'Activity & Audit Console' 
              : 'System Settings'}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-medium">
            {activeView === 'rankings' 
              ? 'Aggregated rating scores computed directly from submitted student evaluations' 
              : activeView === 'logs' 
              ? 'Monitor security logs and evaluation attendance parameters' 
              : 'Configure school terms and administration permissions'}
          </p>
        </div>
      </div>

      {/* Dynamic Panel */}
      {loading ? (
        <div className="py-20 text-center text-muted-foreground font-semibold animate-pulse bg-card border border-border/80 rounded-lg shadow-sm">
          Syncing database parameters...
        </div>
      ) : (
        <>
          {activeView === 'rankings' && (() => {
            const rankingChartData = sortedRankings.map((r) => ({
              name: r.name,
              score: r.averageScore || 0,
              department: r.department,
            }));

            const deptAverageMap = new Map<string, { total: number; count: number }>();
            rankings.forEach((r) => {
              if (r.averageScore === null || r.averageScore === undefined) return;
              const val = deptAverageMap.get(r.department) || { total: 0, count: 0 };
              val.total += r.averageScore;
              val.count += 1;
              deptAverageMap.set(r.department, val);
            });

            const departmentData = Array.from(deptAverageMap.entries()).map(([name, val]) => ({
              name,
              score: Number((val.total / val.count).toFixed(1)),
            }));

            // Calc avgScore across entire institute
            const validScores = rankings.filter(r => typeof r.averageScore === 'number' && r.averageScore >= 0);
            const avgScore = validScores.length > 0 
              ? Number((validScores.reduce((acc, curr) => acc + curr.averageScore, 0) / validScores.length).toFixed(1))
              : 0;

            return (
              <>
                {/* 3 Stat Cards (Branded, animate numbers once on mount) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <CardContent className="p-6 flex flex-col space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Faculty</span>
                      <h2 className="text-3xl font-bold font-sans text-ua-navy dark:text-ua-gold">
                        <CountUp end={rankings.length} />
                      </h2>
                      <span className="text-xs text-muted-foreground">Registered instructors</span>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-6 flex flex-col space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Institutional Average</span>
                      <h2 className="text-3xl font-bold font-sans text-ua-navy dark:text-ua-gold">
                        <CountUp end={avgScore} suffix="%" />
                      </h2>
                      <span className="text-xs text-muted-foreground">Composite score rating</span>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6 flex flex-col space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active Departments</span>
                      <h2 className="text-3xl font-bold font-sans text-ua-navy dark:text-ua-gold">
                        <CountUp end={departmentData.length} />
                      </h2>
                      <span className="text-xs text-muted-foreground">Participating divisions</span>
                    </CardContent>
                  </Card>
                </div>

                {/* Visual Analytics Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2">
                    <CardHeader className="border-b border-border/40 pb-4">
                      <CardTitle className="text-sm font-bold uppercase tracking-wider text-ua-navy dark:text-ua-gold">
                        Top 10 Faculty Rankings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <FacultyRankingChart data={rankingChartData} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="border-b border-border/40 pb-4">
                      <CardTitle className="text-sm font-bold uppercase tracking-wider text-ua-navy dark:text-ua-gold">
                        Department Averages
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <DepartmentDonutChart data={departmentData} />
                    </CardContent>
                  </Card>
                </div>

                {/* Performance ledger table */}
                <Card className="border border-border/80">
                  <CardHeader className="border-b border-border/45 bg-muted/10 pb-4">
                    <CardTitle className="text-base font-bold text-slate-800 dark:text-ua-gold">Faculty Ratings Ledger</CardTitle>
                    <CardDescription>Aggregated rating scores computed directly from submitted evaluations</CardDescription>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-muted/30 border-b border-border/60 text-muted-foreground">
                        <tr>
                          <th 
                            onClick={() => handleSort('name')}
                            className="p-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-muted/50 select-none"
                          >
                            Faculty Name {sortField === 'name' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                          </th>
                          <th 
                            onClick={() => handleSort('email')}
                            className="p-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-muted/50 select-none"
                          >
                            Email Address {sortField === 'email' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                          </th>
                          <th 
                            onClick={() => handleSort('department')}
                            className="p-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-muted/50 select-none"
                          >
                            Department {sortField === 'department' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                          </th>
                          <th className="p-4 text-xs font-bold uppercase tracking-wider select-none text-muted-foreground">
                            Assigned Sections
                          </th>
                          <th 
                            onClick={() => handleSort('score')}
                            className="p-4 text-xs font-bold uppercase tracking-wider text-center cursor-pointer hover:bg-muted/50 select-none"
                          >
                            Score {sortField === 'score' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {sortedRankings.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-12 text-center text-muted-foreground font-semibold italic">
                              No evaluations recorded yet.
                            </td>
                          </tr>
                        ) : (
                          sortedRankings.map((rank) => (
                            <tr key={rank.id} className="hover:bg-muted/10 transition-all">
                              <td className="p-4 text-sm font-bold text-foreground">{rank.name}</td>
                              <td className="p-4 text-sm text-muted-foreground font-medium">{rank.email}</td>
                              <td className="p-4 text-sm text-muted-foreground font-medium">{rank.department}</td>
                              <td className="p-4 text-sm text-muted-foreground/80 max-w-xs truncate">{rank.sections || "None"}</td>
                              <td className="p-4 text-sm text-center">
                                {rank.averageScore !== null ? (
                                  <span className="inline-block px-3 py-1 bg-ua-navy/5 border border-ua-navy/10 text-ua-navy dark:bg-ua-gold/10 dark:border-ua-gold/20 dark:text-ua-gold rounded-full font-bold text-xs shadow-sm">
                                    {rank.averageScore}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">N/A</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            );
          })()}

          {activeView === 'logs' && (
            <Card className="border border-border/80">
              <CardHeader className="border-b border-border/45 bg-muted/10 pb-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <CardTitle className="text-base font-bold text-slate-800 dark:text-ua-gold">Activity & Audit Console</CardTitle>
                  <CardDescription>Monitor system events and evaluation attendance</CardDescription>
                </div>
                
                {/* Nested Tabs Selection */}
                <div className="flex bg-muted p-1 rounded-lg self-start sm:self-center">
                  <button
                    onClick={() => setNestedLogTab('audit')}
                    className={cn(
                      "px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer",
                      nestedLogTab === 'audit' 
                        ? 'bg-card text-foreground shadow-sm border-l-2 border-ua-gold' 
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    System Audit Logs
                  </button>
                  <button
                    onClick={() => setNestedLogTab('attendance')}
                    className={cn(
                      "px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer",
                      nestedLogTab === 'attendance' 
                        ? 'bg-card text-foreground shadow-sm border-l-2 border-ua-gold' 
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Evaluation Attendance
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {nestedLogTab === 'audit' ? (
                  <div className="space-y-4 pt-2">
                    {/* Audit Logs Filter Toolbar */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-muted/20 p-4 rounded-lg border border-border/60">
                      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        <input
                          type="text"
                          value={logSearch}
                          onChange={(e) => setLogSearch(e.target.value)}
                          placeholder="Search logs by actor, event, description..."
                          className="p-2 border border-border rounded-lg text-xs bg-card focus:ring-2 focus:ring-ua-gold/30 outline-none w-full sm:w-64 text-foreground font-semibold"
                        />
                        <select
                          value={logSortField}
                          onChange={(e) => setLogSortField(e.target.value as any)}
                          className="p-2 border border-border rounded-lg text-xs bg-card font-semibold text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none"
                        >
                          <option value="date">Sort by Date</option>
                          <option value="type">Sort by Event Type</option>
                          <option value="actor">Sort by Actor</option>
                        </select>
                        <Button
                          type="button"
                          uaVariant="outline"
                          onClick={() => setLogSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                          className="h-8 text-xs font-semibold px-2.5"
                        >
                          {logSortDirection === 'asc' ? 'Ascending ▴' : 'Descending ▾'}
                        </Button>
                      </div>
                      <span className="text-[10px] bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full font-bold">Encrypted Audit Logs</span>
                    </div>

                    <div className="border border-border/60 rounded-lg divide-y divide-border/45 bg-muted/10 overflow-hidden font-mono text-xs text-muted-foreground">
                      {(() => {
                        const filteredAndSortedLogs = [...auditLogs]
                          .filter(log => {
                            const search = logSearch.toLowerCase();
                            const eventType = (log.eventType || '').toLowerCase();
                            const actor = (log.actorEmail || '').toLowerCase();
                            const desc = (log.details?.desc || log.details?.message || JSON.stringify(log.details) || '').toLowerCase();
                            return eventType.includes(search) || actor.includes(search) || desc.includes(search);
                          })
                          .sort((a, b) => {
                            let comparison = 0;
                            if (logSortField === 'date') {
                              const timeA = new Date(a.createdAt).getTime();
                              const timeB = new Date(b.createdAt).getTime();
                              comparison = timeA - timeB;
                            } else if (logSortField === 'type') {
                              const valA = (a.eventType || '').toLowerCase();
                              const valB = (b.eventType || '').toLowerCase();
                              comparison = valA.localeCompare(valB);
                            } else if (logSortField === 'actor') {
                              const valA = (a.actorEmail || '').toLowerCase();
                              const valB = (b.actorEmail || '').toLowerCase();
                              comparison = valA.localeCompare(valB);
                            }
                            return logSortDirection === 'asc' ? comparison : -comparison;
                          });

                        if (filteredAndSortedLogs.length === 0) {
                          return (
                            <div className="p-8 text-center text-muted-foreground font-semibold text-xs bg-card">
                              {logSearch ? "No matching audit log entries found." : "No decrypted audit entries logged yet."}
                            </div>
                          );
                        }

                        return filteredAndSortedLogs.map((log: any, index: number) => (
                          <div key={log.id || index} className="p-4 hover:bg-card transition-all flex items-start gap-4">
                            <span className="text-muted-foreground select-none shrink-0">{new Date(log.createdAt).toLocaleString()}</span>
                            <span className="bg-ua-navy/5 border border-ua-navy/10 text-ua-navy dark:bg-ua-gold/15 dark:text-ua-gold dark:border-ua-gold/20 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider shrink-0">{log.eventType}</span>
                            <div className="space-y-0.5 flex-grow">
                              <p className="text-foreground font-semibold">{log.details?.desc || log.details?.message || JSON.stringify(log.details)}</p>
                              <p className="text-[10px] text-muted-foreground">Actor: {log.actorEmail}</p>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 pt-2">
                    {/* Filters Toolbar */}
                    <div className="flex flex-col xl:flex-row gap-3 justify-between items-start xl:items-center bg-muted/20 p-4 rounded-lg border border-border/60">
                      <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                        <input
                          type="text"
                          value={receiptSearch}
                          onChange={(e) => setReceiptSearch(e.target.value)}
                          placeholder="Search email, section, or prof..."
                          className="p-2 border border-border rounded-lg text-xs bg-card focus:ring-2 focus:ring-ua-gold/30 focus:border-ua-navy dark:focus:border-ua-gold transition-all font-semibold outline-none w-full sm:w-48 text-foreground"
                        />
                        
                        {/* Cascading Level Dropdown */}
                        <select
                          value={receiptLevelFilter}
                          onChange={(e) => {
                            setReceiptLevelFilter(e.target.value);
                            setReceiptDepFilter('');
                            setReceiptSecFilter('');
                          }}
                          className="p-2 border border-border rounded-lg text-xs bg-card font-semibold text-foreground outline-none focus:ring-2 focus:ring-ua-gold/30"
                        >
                          <option value="">All Levels</option>
                          <option value="JHS">JHS</option>
                          <option value="SHS">SHS</option>
                          <option value="COLLEGE">COLLEGE</option>
                          <option value="GRADUATE">GRADUATE</option>
                        </select>

                        {/* Cascading Dept Dropdown */}
                        <select
                          value={receiptDepFilter}
                          onChange={(e) => {
                            setReceiptDepFilter(e.target.value);
                            setReceiptSecFilter('');
                          }}
                          className="p-2 border border-border rounded-lg text-xs bg-card font-semibold text-foreground outline-none max-w-[180px] focus:ring-2 focus:ring-ua-gold/30"
                        >
                          <option value="">All Departments</option>
                          {departments
                            .filter(d => !receiptLevelFilter || d.level === receiptLevelFilter)
                            .map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))
                          }
                        </select>

                        {/* Cascading Section Dropdown */}
                        <select
                          value={receiptSecFilter}
                          onChange={(e) => setReceiptSecFilter(e.target.value)}
                          className="p-2 border border-border rounded-lg text-xs bg-card font-semibold text-foreground outline-none max-w-[150px] focus:ring-2 focus:ring-ua-gold/30"
                        >
                          <option value="">All Sections</option>
                          {departments
                            .filter(d => (!receiptLevelFilter || d.level === receiptLevelFilter) && (!receiptDepFilter || d.id === receiptDepFilter))
                            .flatMap(d => d.sections || [])
                            .map((s: any) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))
                          }
                        </select>

                        <select
                          value={receiptYearFilter}
                          onChange={(e) => setReceiptYearFilter(e.target.value)}
                          className="p-2 border border-border rounded-lg text-xs bg-card font-semibold text-foreground outline-none focus:ring-2 focus:ring-ua-gold/30"
                        >
                          <option value="">All Years</option>
                          <option value="2026-2027">2026-2027</option>
                          <option value="2027-2028">2027-2028</option>
                        </select>
                        
                        <select
                          value={receiptSemFilter}
                          onChange={(e) => setReceiptSemFilter(e.target.value)}
                          className="p-2 border border-border rounded-lg text-xs bg-card font-semibold text-foreground outline-none focus:ring-2 focus:ring-ua-gold/30"
                        >
                          <option value="">All Terms</option>
                          <option value="1st">1st Sem</option>
                          <option value="2nd">2nd Sem</option>
                          <option value="Summer">Summer Term</option>
                        </select>
                      </div>
                      <Button
                        type="button"
                        uaVariant="primary"
                        onClick={() => {
                          const selectedDeptObj = departments.find(d => d.id === receiptDepFilter);
                          const selectedSecObj = departments.flatMap(d => d.sections || []).find((s: any) => s.id === receiptSecFilter);
                          const headers = ["Student Email", "Level", "Department", "Section", "Professor", "Academic Year", "Semester", "Timestamp"];
                          const rows = receipts
                            .filter(r => {
                              const matchesSearch = r.studentEmail.toLowerCase().includes(receiptSearch.toLowerCase()) ||
                                                    r.professorName.toLowerCase().includes(receiptSearch.toLowerCase()) ||
                                                    r.sectionName.toLowerCase().includes(receiptSearch.toLowerCase()) ||
                                                    r.departmentName.toLowerCase().includes(receiptSearch.toLowerCase()) ||
                                                    r.level.toLowerCase().includes(receiptSearch.toLowerCase());
                              const matchesYear = receiptYearFilter ? r.academicYear === receiptYearFilter : true;
                              const matchesSem = receiptSemFilter ? r.semester === receiptSemFilter : true;
                              const matchesLevel = receiptLevelFilter ? r.level === receiptLevelFilter : true;
                              const matchesDept = receiptDepFilter ? r.departmentName === selectedDeptObj?.name : true;
                              const matchesSec = receiptSecFilter ? r.sectionName === selectedSecObj?.name : true;
                              return matchesSearch && matchesYear && matchesSem && matchesLevel && matchesDept && matchesSec;
                            })
                            .map(r => [
                              r.studentEmail,
                              r.level,
                              r.departmentName,
                              r.sectionName,
                              r.professorName,
                              r.academicYear,
                              r.semester,
                              new Date(r.createdAt).toLocaleString()
                            ]);
                          const csvContent = "data:text/csv;charset=utf-8," 
                            + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
                          const encodedUri = encodeURI(csvContent);
                          const link = document.createElement("a");
                          link.setAttribute("href", encodedUri);
                          link.setAttribute("download", `evaluation_attendance_${sysYear}_${sysSem}.csv`);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        disabled={receipts.length === 0}
                        className="h-10 text-xs w-full xl:w-auto"
                      >
                        📤 Export Attendance (.csv)
                      </Button>
                    </div>

                    {/* Table View */}
                    <div className="border border-border rounded-lg overflow-hidden bg-card">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-muted/30 border-b border-border/50 text-muted-foreground">
                          <tr>
                            <th className="p-4 font-bold uppercase tracking-wider">Student Email</th>
                            <th className="p-4 font-bold uppercase tracking-wider">Level</th>
                            <th className="p-4 font-bold uppercase tracking-wider">Department</th>
                            <th className="p-4 font-bold uppercase tracking-wider">Section</th>
                            <th className="p-4 font-bold uppercase tracking-wider">Professor</th>
                            <th className="p-4 font-bold uppercase tracking-wider">Academic Term</th>
                            <th className="p-4 font-bold uppercase tracking-wider">Submitted Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 text-foreground">
                          {(() => {
                            const selectedDeptObj = departments.find(d => d.id === receiptDepFilter);
                            const selectedSecObj = departments.flatMap(d => d.sections || []).find((s: any) => s.id === receiptSecFilter);
                            const finalFiltered = receipts.filter(r => {
                              const matchesSearch = r.studentEmail.toLowerCase().includes(receiptSearch.toLowerCase()) ||
                                                    r.professorName.toLowerCase().includes(receiptSearch.toLowerCase()) ||
                                                    r.sectionName.toLowerCase().includes(receiptSearch.toLowerCase()) ||
                                                    r.departmentName.toLowerCase().includes(receiptSearch.toLowerCase()) ||
                                                    r.level.toLowerCase().includes(receiptSearch.toLowerCase());
                              const matchesYear = receiptYearFilter ? r.academicYear === receiptYearFilter : true;
                              const matchesSem = receiptSemFilter ? r.semester === receiptSemFilter : true;
                              const matchesLevel = receiptLevelFilter ? r.level === receiptLevelFilter : true;
                              const matchesDept = receiptDepFilter ? r.departmentName === selectedDeptObj?.name : true;
                              const matchesSec = receiptSecFilter ? r.sectionName === selectedSecObj?.name : true;
                              return matchesSearch && matchesYear && matchesSem && matchesLevel && matchesDept && matchesSec;
                            });

                            if (finalFiltered.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={7} className="p-12 text-center text-muted-foreground font-semibold italic">No attendance records found matching criteria.</td>
                                </tr>
                              );
                            }

                            return finalFiltered.map((rec) => (
                              <tr key={rec.id} className="hover:bg-muted/10 transition-all">
                                <td className="p-4 font-bold text-foreground">{rec.studentEmail}</td>
                                <td className="p-4 font-bold uppercase text-muted-foreground text-[10px]">{rec.level}</td>
                                <td className="p-4 font-semibold text-muted-foreground">{rec.departmentName}</td>
                                <td className="p-4 text-muted-foreground font-medium">{rec.sectionName}</td>
                                <td className="p-4 font-semibold">{rec.professorName}</td>
                                <td className="p-4 uppercase font-bold text-[10px]">
                                  <span className="px-2.5 py-0.5 bg-muted border border-border text-muted-foreground rounded-full font-mono">
                                    {rec.academicYear} | {rec.semester}
                                  </span>
                                </td>
                                <td className="p-4 text-muted-foreground font-medium">{new Date(rec.createdAt).toLocaleString()}</td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeView === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Global Registrar Terms settings */}
              <Card className="h-fit">
                <CardHeader className="border-b border-border/40 pb-4">
                  <CardTitle className="text-base font-bold text-slate-800 dark:text-ua-gold">Registrar Settings</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                    Configure the global active Academic Year and Term. All submitted student evaluations will be cataloged under these specific details.
                  </p>
                  <form onSubmit={handleUpdateSettings} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Academic Year</label>
                      <input 
                        type="text" 
                        value={sysYear}
                        onChange={(e) => setSysYear(e.target.value)}
                        placeholder="e.g. 2026-2027" 
                        className="w-full h-10 p-2.5 border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Current Semester</label>
                      <select 
                        value={sysSem}
                        onChange={(e) => setSysSem(e.target.value)}
                        className="w-full h-10 p-2 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none"
                      >
                        <option value="1st">1st Semester</option>
                        <option value="2nd">2nd Semester</option>
                        <option value="Summer">Summer Term</option>
                      </select>
                    </div>
                    <Button type="submit" uaVariant="primary" className="w-full">
                      Update System Terms
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* System Administrators Management */}
              <Card className="lg:col-span-2">
                <CardHeader className="border-b border-border/45 pb-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-800 dark:text-ua-gold">System Administrators</CardTitle>
                    <CardDescription>Elevate users or revoke system administration roles</CardDescription>
                  </div>
                  <div className="w-full sm:w-auto">
                    {showAddAdminForm ? (
                      <form onSubmit={handleElevateAdmin} className="p-4 border border-border bg-muted/20 rounded-lg space-y-3 w-full text-left">
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Elevate User to Admin</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Email</label>
                            <input 
                              type="email"
                              value={newAdminEmail}
                              onChange={(e) => setNewAdminEmail(e.target.value)}
                              placeholder="staff@ua.edu.ph"
                              className="w-full h-8 px-2 text-xs border rounded bg-card text-foreground font-semibold"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Username</label>
                            <input 
                              type="text"
                              value={newAdminUsername}
                              onChange={(e) => setNewAdminUsername(e.target.value)}
                              placeholder="staff_admin"
                              className="w-full h-8 px-2 text-xs border rounded bg-card text-foreground font-semibold"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Password</label>
                            <input 
                              type="password"
                              value={newAdminPassword}
                              onChange={(e) => setNewAdminPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full h-8 px-2 text-xs border rounded bg-card text-foreground font-semibold"
                              required
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <Button type="submit" uaVariant="primary" className="h-8 px-3 text-xs">
                            Add Admin
                          </Button>
                          <Button 
                            type="button" 
                            uaVariant="ghost"
                            onClick={() => setShowAddAdminForm(false)}
                            className="h-8 px-3 text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <Button 
                        onClick={() => setShowAddAdminForm(true)}
                        uaVariant="primary"
                        className="h-10 text-xs"
                      >
                        + Add System Admin
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {admins.length === 0 ? (
                    <div className="text-center text-muted-foreground font-semibold py-8 animate-pulse">Syncing system administrators...</div>
                  ) : (
                    <div className="overflow-visible border border-border rounded-lg bg-card">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead className="bg-muted/30 border-b border-border/50 text-muted-foreground">
                          <tr className="border-b border-border/50">
                            <th 
                              onClick={() => {
                                if (adminSortField === 'email') {
                                  setAdminSortDirection(adminSortDirection === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setAdminSortField('email');
                                  setAdminSortDirection('asc');
                                }
                              }}
                              className="p-4 font-bold cursor-pointer hover:bg-muted/50 select-none text-xs uppercase tracking-wider"
                            >
                              Email {adminSortField === 'email' ? (adminSortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                            </th>
                            <th 
                              onClick={() => {
                                if (adminSortField === 'name') {
                                  setAdminSortDirection(adminSortDirection === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setAdminSortField('name');
                                  setAdminSortDirection('asc');
                                }
                              }}
                              className="p-4 font-bold cursor-pointer hover:bg-muted/50 select-none text-xs uppercase tracking-wider"
                            >
                              Name {adminSortField === 'name' ? (adminSortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                            </th>
                            <th className="p-4 font-bold text-right text-xs uppercase tracking-wider text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 text-foreground">
                          {[...admins].sort((a, b) => {
                            let valA = (adminSortField === 'email' ? a.email : a.name) || '';
                            let valB = (adminSortField === 'email' ? b.email : b.name) || '';
                            if (valA.toLowerCase() < valB.toLowerCase()) return adminSortDirection === 'asc' ? -1 : 1;
                            if (valA.toLowerCase() > valB.toLowerCase()) return adminSortDirection === 'asc' ? 1 : -1;
                            return 0;
                          }).map((u) => (
                            <tr key={u.id} className="hover:bg-muted/10 transition-all">
                              <td className="p-4 font-bold text-foreground">{u.email}</td>
                              <td className="p-4 text-muted-foreground font-semibold">{u.name || "Pending login"}</td>
                              <td className="p-4 text-right">
                                <Button 
                                  onClick={() => handleRevokeAdmin(u.id)}
                                  uaVariant="destructive"
                                  className="h-8 px-2.5 text-xs font-semibold"
                                >
                                  Revoke Admin
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <Suspense fallback={
      <div className="py-20 text-center text-muted-foreground font-semibold animate-pulse bg-card border border-border/80 rounded-lg shadow-sm">
        Loading admin dashboard ledger...
      </div>
    }>
      <AdminDashboardContent />
    </Suspense>
  );
}
