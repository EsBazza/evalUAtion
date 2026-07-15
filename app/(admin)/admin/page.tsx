'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  getDepartments, 
  createDepartment, 
  getTemplates, 
  createTemplate, 
  getFacultyRankings,
  getEvaluationAttendanceLogs,
  getEvaluationAttendanceLogsForExport,
  getEvaluationReceiptFilters,
  recalculateStaleScoreCaches,
  getAdminSessionUser
} from '@/app/actions/admin';
import dynamic from 'next/dynamic';

const Modal = dynamic(() => import('@/components/ui-ua/modal').then((mod) => mod.Modal), { ssr: false });
const FacultyRankingChart = dynamic(() => import('@/components/charts/FacultyRankingChart').then((mod) => mod.FacultyRankingChart), { ssr: false });
const DepartmentDonutChart = dynamic(() => import('@/components/charts/DepartmentDonutChart').then((mod) => mod.DepartmentDonutChart), { ssr: false });
import { EducationLevel, Role } from '@prisma/client';
import Link from 'next/link';
import { Search, Filter, Download, RefreshCw, SlidersHorizontal } from 'lucide-react';
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

function UAPremiumLoader({ message = "Syncing database parameters...", submessage = "Please wait while we fetch ledger records..." }: { message?: string; submessage?: string }) {
  return (
    <div className="py-24 flex flex-col items-center justify-center space-y-4 bg-card border border-border/80 rounded-lg shadow-sm w-full">
      <div className="relative flex items-center justify-center">
        <div className="absolute size-14 border-2 border-ua-gold/20 rounded-full animate-ping"></div>
        <div className="size-10 border-4 border-ua-navy dark:border-ua-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
      <div className="flex flex-col items-center space-y-1 text-center px-4">
        <span className="text-xs font-bold text-slate-800 dark:text-ua-gold uppercase tracking-widest animate-pulse">
          {message}
        </span>
        <span className="text-[10px] text-muted-foreground font-medium">
          {submessage}
        </span>
      </div>
    </div>
  );
}

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const requestedView = (searchParams.get('tab') || 'rankings') as ActiveView;
  const [currentUser, setCurrentUser] = useState<any>(null);
  const activeView = (currentUser?.role === 'SUB_ADMIN') ? 'rankings' : requestedView;
  
  useEffect(() => {
    getAdminSessionUser().then(user => {
      setCurrentUser(user);
      if (user?.role === 'SUB_ADMIN' && user.departmentId) {
        setSelectedLedgerDept(user.departmentId);
      }
    });
  }, []);

  const [receipts, setReceipts] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [nestedLogTab, setNestedLogTab] = useState<'audit' | 'attendance'>('audit');
  
  // Rebuilt Attendance search states
  const [receiptSearch, setReceiptSearch] = useState('');
  const [attendancePage, setAttendancePage] = useState(1);
  const [attendanceItemsPerPage, setAttendanceItemsPerPage] = useState(25);
  const [attendanceTotalPages, setAttendanceTotalPages] = useState(1);
  const [attendanceTotalCount, setAttendanceTotalCount] = useState(0);

  // Advanced search multi-select states
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedSems, setSelectedSems] = useState<string[]>([]);
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);

  // Dynamic values loaded from database receipts
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [availableSems, setAvailableSems] = useState<string[]>([]);

  // CSV Export Modal states
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportScope, setExportScope] = useState<'current' | 'department'>('current');
  const [exportAllFields, setExportAllFields] = useState(false);
  const [exportSelectedDeptId, setExportSelectedDeptId] = useState('');

  const [rankings, setRankings] = useState<any[]>([]);
  const [selectedLedgerDept, setSelectedLedgerDept] = useState<string>('All');
  const [departments, setDepartments] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  // Sorting states for rankings
  const [sortField, setSortField] = useState('score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [ledgerPage, setLedgerPage] = useState(1);
  const ledgerItemsPerPage = 10;

  useEffect(() => {
    setLedgerPage(1);
  }, [selectedLedgerDept]);

  useEffect(() => {
    setAttendancePage(1);
  }, [receiptSearch, selectedDepts, selectedSections, selectedYears, selectedSems, attendanceItemsPerPage]);

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
  const [newAdminRole, setNewAdminRole] = useState<'ADMIN' | 'SUB_ADMIN'>('ADMIN');
  const [newAdminDeptId, setNewAdminDeptId] = useState('');

  const [sysYear, setSysYear] = useState('2026-2027');
  const [sysSem, setSysSem] = useState('1st');
  const [sysFacultyPageEnabled, setSysFacultyPageEnabled] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeView === 'rankings') {
        const subAdminDeptId = currentUser?.role === 'SUB_ADMIN' ? currentUser.departmentId : undefined;
        const data = await getFacultyRankings(undefined, undefined, subAdminDeptId);
        setRankings(data);
      } else if (activeView === 'departments') {
        const data = await getDepartments();
        setDepartments(data);
      } else if (activeView === 'templates') {
        const data = await getTemplates();
        setTemplates(data);
      } else if (activeView === 'logs') {
        const audits = await getAuditLogs();
        setAuditLogs(audits);
        
        const deps = await getDepartments();
        setDepartments(deps);

        const filterOptions = await getEvaluationReceiptFilters();
        setAvailableYears(filterOptions.academicYears);
        setAvailableSems(filterOptions.semesters);

        // Fetch logs for the first time on tab switch
        const attendanceData = await getEvaluationAttendanceLogs({
          search: receiptSearch,
          departments: selectedDepts,
          sections: selectedSections,
          academicYears: selectedYears,
          semesters: selectedSems,
          page: attendancePage,
          pageSize: attendanceItemsPerPage
        });
        setReceipts(attendanceData.logs);
        setAttendanceTotalPages(attendanceData.totalPages);
        setAttendanceTotalCount(attendanceData.totalCount);
      } else if (activeView === 'settings') {
        const settings = await getSystemSettings();
        setSysYear(settings.academicYear);
        setSysSem(settings.semester);
        setSysFacultyPageEnabled(settings.isFacultyPageEnabled);
        const adminUsers = await getAdmins();
        setAdmins(adminUsers);
        const deps = await getDepartments();
        setDepartments(deps);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async () => {
    setLogsLoading(true);
    try {
      const attendanceData = await getEvaluationAttendanceLogs({
        search: receiptSearch,
        departments: selectedDepts,
        sections: selectedSections,
        academicYears: selectedYears,
        semesters: selectedSems,
        page: attendancePage,
        pageSize: attendanceItemsPerPage
      });
      setReceipts(attendanceData.logs);
      setAttendanceTotalPages(attendanceData.totalPages);
      setAttendanceTotalCount(attendanceData.totalCount);
    } catch (err) {
      console.error("Failed to load attendance logs silently", err);
    } finally {
      setLogsLoading(false);
    }
  };

  // Run full data fetch only on view change
  useEffect(() => {
    loadData();
  }, [activeView]);

  // Live sync: silently refresh rankings every 15 seconds
  useEffect(() => {
    if (activeView !== 'rankings') return;

    const interval = setInterval(async () => {
      try {
        const data = await getFacultyRankings();
        setRankings(data);
      } catch (err) {
        // Silently ignore refresh errors
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [activeView]);

  // Run silent updates for filters and pages
  useEffect(() => {
    if (activeView === 'logs') {
      fetchAttendance();
    }
  }, [attendancePage, attendanceItemsPerPage, receiptSearch, selectedDepts, selectedSections, selectedYears, selectedSems]);

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
    if (newAdminRole === 'SUB_ADMIN' && !newAdminDeptId) {
      toast.error('Please select a department for the sub admin.');
      return;
    }
    try {
      await elevateUserToAdmin(newAdminEmail, newAdminUsername, newAdminPassword, newAdminRole, newAdminDeptId);
      setNewAdminEmail('');
      setNewAdminUsername('');
      setNewAdminPassword('');
      setNewAdminRole('ADMIN');
      setNewAdminDeptId('');
      setShowAddAdminForm(false);
      toast.success(`Successfully elevated ${newAdminEmail} to ${newAdminRole}!`);
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
      await updateSystemSettings(sysYear, sysSem, sysFacultyPageEnabled);
      toast.success("System academic term settings updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update system settings");
    }
  };

  const handleExportCSV = async () => {
    try {
      let dataToExport = [];
      if (exportScope === 'current') {
        dataToExport = await getEvaluationAttendanceLogsForExport({
          search: receiptSearch,
          departments: selectedDepts,
          sections: selectedSections,
          academicYears: selectedYears,
          semesters: selectedSems
        });
      } else {
        if (!exportSelectedDeptId) {
          toast.error("Please select a department to export.");
          return;
        }
        dataToExport = await getEvaluationAttendanceLogsForExport({
          departments: [exportSelectedDeptId]
        });
      }

      if (dataToExport.length === 0) {
        toast.error("No records found to export.");
        return;
      }

      let headers = [];
      let rows = [];

      if (exportAllFields) {
        headers = ["Name", "Email", "First Submitted", "Most Recent Submitted", "Department", "Section"];
        rows = dataToExport.map(r => [
          r.studentName || 'Not Set',
          r.studentEmail,
          new Date(r.firstSubmitted).toLocaleString(),
          new Date(r.mostRecentSubmitted).toLocaleString(),
          r.departmentName || 'N/A',
          r.sectionName || 'N/A'
        ]);
      } else {
        headers = ["Name", "Email", "Section"];
        rows = dataToExport.map(r => [
          r.studentName || 'Not Set',
          r.studentEmail,
          r.sectionName || 'N/A'
        ]);
      }

      const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
        + [headers.join(","), ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      
      const filename = exportScope === 'current' 
        ? `evaluation_attendance_current_${new Date().toISOString().slice(0,10)}.csv`
        : `evaluation_attendance_dept_${exportSelectedDeptId}.csv`;
        
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsExportModalOpen(false);
      toast.success("CSV exported successfully!");
    } catch (err: any) {
      toast.error("Failed to generate CSV file.");
    }
  };

  const handleSort = (field: string) => {
    setLedgerPage(1);
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

        {activeView === 'rankings' && (
          <Button
            onClick={async () => {
              const id = toast.loading("Recalculating ledger scores...");
              try {
                const res = await recalculateStaleScoreCaches();
                toast.success(`Ledger updated! Recalculated ${res.updatedCount} stale score caches.`, undefined, { id });
                loadData();
              } catch (err) {
                toast.error("Failed to recalculate scores.", undefined, { id });
              }
            }}
            uaVariant="primary"
            className="h-10 text-xs flex items-center gap-1.5 shrink-0 self-start sm:self-center font-bold"
          >
            <RefreshCw className="size-3.5" />
            Refresh Scores
          </Button>
        )}
      </div>

      {/* Dynamic Panel */}
      {loading ? (
        <UAPremiumLoader />
      ) : (
        <>
          {activeView === 'rankings' && (() => {
            const isSubAdmin = currentUser?.role === 'SUB_ADMIN';
            // Rankings are already filtered server-side for SUB_ADMIN — sortedRankings is the source of truth
            const effectiveRankings = sortedRankings;

            const uniqueDepts = Array.from(
              new Set(effectiveRankings.map(r => r.level === 'COLLEGE' ? 'College' : r.department))
            ).filter(Boolean).sort();
            
            const filteredRankings = (isSubAdmin || selectedLedgerDept === 'All')
              ? effectiveRankings 
              : effectiveRankings.filter(r => (r.level === 'COLLEGE' ? 'College' : r.department) === selectedLedgerDept);

            const totalItems = filteredRankings.length;
            const totalPages = Math.ceil(totalItems / ledgerItemsPerPage);
            const startIndex = (ledgerPage - 1) * ledgerItemsPerPage;
            const paginatedRankings = filteredRankings.slice(startIndex, startIndex + ledgerItemsPerPage);

            const rankingChartData = effectiveRankings.map((r) => ({
              name: r.name,
              score: r.averageScore || 0,
              department: r.department,
            }));

            const deptAverageMap = new Map<string, { total: number; count: number }>();
            effectiveRankings.forEach((r) => {
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

            // Calc avgScore across the filtered dataset
            const validScores = effectiveRankings.filter(r => typeof r.averageScore === 'number' && r.averageScore >= 0);
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
                        <CountUp end={effectiveRankings.length} />
                      </h2>
                      <span className="text-xs text-muted-foreground">Registered instructors</span>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-6 flex flex-col space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        {isSubAdmin ? 'Department Average' : 'Institutional Average'}
                      </span>
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
                  <CardHeader className="border-b border-border/45 bg-muted/10 pb-4 flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-800 dark:text-ua-gold">Faculty Ratings Ledger</CardTitle>
                      <CardDescription>Aggregated rating scores computed directly from submitted evaluations</CardDescription>
                    </div>

                    {/* Department Tabs */}
                    {!isSubAdmin && uniqueDepts.length > 0 && (
                      <div className="flex flex-wrap bg-muted p-1 rounded-lg gap-1 self-start md:self-center">
                        <button
                          onClick={() => setSelectedLedgerDept('All')}
                          className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
                            selectedLedgerDept === 'All'
                              ? 'bg-card text-foreground shadow-sm border-l-2 border-ua-gold font-bold'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          All
                        </button>
                        {uniqueDepts.map((dept) => (
                          <button
                            key={dept}
                            onClick={() => setSelectedLedgerDept(dept)}
                            className={cn(
                              "px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
                              selectedLedgerDept === dept
                                ? 'bg-card text-foreground shadow-sm border-l-2 border-ua-gold font-bold'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            {dept}
                          </button>
                        ))}
                      </div>
                    )}
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
                        {paginatedRankings.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-12 text-center text-muted-foreground font-semibold italic">
                              No evaluations recorded yet.
                            </td>
                          </tr>
                        ) : (
                          paginatedRankings.map((rank) => (
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

                  {totalPages > 1 && (
                    <CardFooter className="border-t border-border/60 bg-muted/5 p-4 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground font-medium">
                        Showing <span className="font-semibold text-foreground">{startIndex + 1}</span> to{" "}
                        <span className="font-semibold text-foreground">
                          {Math.min(startIndex + ledgerItemsPerPage, totalItems)}
                        </span>{" "}
                        of <span className="font-semibold text-foreground">{totalItems}</span> faculty members
                      </p>
                      <div className="flex gap-1">
                        <Button
                          uaVariant="outline"
                          onClick={() => setLedgerPage(p => Math.max(p - 1, 1))}
                          disabled={ledgerPage === 1}
                          className="h-8 px-3 text-xs font-semibold"
                        >
                          Previous
                        </Button>
                        {Array.from({ length: totalPages }).map((_, index) => {
                          const pageNum = index + 1;
                          return (
                            <Button
                              key={pageNum}
                              onClick={() => setLedgerPage(pageNum)}
                              uaVariant={ledgerPage === pageNum ? "primary" : "outline"}
                              className={cn(
                                "h-8 w-8 p-0 text-xs font-semibold",
                                ledgerPage === pageNum ? "bg-ua-gold text-ua-navy border-ua-gold" : ""
                              )}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                        <Button
                          uaVariant="outline"
                          onClick={() => setLedgerPage(p => Math.min(p + 1, totalPages))}
                          disabled={ledgerPage === totalPages}
                          className="h-8 px-3 text-xs font-semibold"
                        >
                          Next
                        </Button>
                      </div>
                    </CardFooter>
                  )}
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
                    <div className="flex flex-col lg:flex-row gap-3 justify-between items-start lg:items-center bg-muted/20 p-4 rounded-lg border border-border/60">
                      <div className="flex flex-wrap gap-2 w-full lg:w-auto items-center">
                        <div className="relative flex-grow sm:flex-grow-0">
                          <input
                            type="text"
                            value={receiptSearch}
                            onChange={(e) => setReceiptSearch(e.target.value)}
                            placeholder="Search student name or email..."
                            className="p-2 pl-8 border border-border rounded-lg text-xs bg-card focus:ring-2 focus:ring-ua-gold/30 focus:border-ua-navy dark:focus:border-ua-gold transition-all font-semibold outline-none w-full sm:w-64 text-foreground"
                          />
                          <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-3" />
                        </div>
                        
                        {/* Advanced Search Toggle */}
                        <Button
                          type="button"
                          uaVariant={isAdvancedSearchOpen ? "accent" : "outline"}
                          onClick={() => setIsAdvancedSearchOpen(!isAdvancedSearchOpen)}
                          className="h-9 text-xs font-semibold px-3 flex items-center gap-1.5"
                        >
                          <SlidersHorizontal className="size-3.5" />
                          Advanced Search
                        </Button>

                        {/* Clear Filters (Only show if filters active) */}
                        {(selectedDepts.length > 0 || selectedSections.length > 0 || selectedYears.length > 0 || selectedSems.length > 0 || receiptSearch) && (
                          <Button
                            type="button"
                            uaVariant="ghost"
                            onClick={() => {
                              setReceiptSearch('');
                              setSelectedDepts([]);
                              setSelectedSections([]);
                              setSelectedYears([]);
                              setSelectedSems([]);
                              setAttendancePage(1);
                              toast.success("Filters cleared");
                            }}
                            className="h-9 text-xs font-semibold text-ua-crimson hover:bg-ua-crimson/5"
                          >
                            <RefreshCw className="size-3 mr-1" />
                            Reset Filters
                          </Button>
                        )}
                      </div>

                      <div className="flex gap-2 items-center w-full lg:w-auto justify-between lg:justify-end">
                        {/* Page Size Selector */}
                        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                          <span>Show:</span>
                          <select
                            value={attendanceItemsPerPage}
                            onChange={(e) => {
                              setAttendanceItemsPerPage(Number(e.target.value));
                              setAttendancePage(1);
                            }}
                            className="p-1 border border-border rounded bg-card text-foreground outline-none focus:ring-2 focus:ring-ua-gold/30"
                          >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                          </select>
                        </div>

                        {/* Export Button */}
                        <Button
                          type="button"
                          uaVariant="primary"
                          onClick={() => setIsExportModalOpen(true)}
                          disabled={receipts.length === 0}
                          className="h-9 text-xs flex items-center gap-1.5"
                        >
                          <Download className="size-3.5" />
                          Export CSV
                        </Button>
                      </div>
                    </div>

                    {/* Advanced Search Collapsible Panel */}
                    {isAdvancedSearchOpen && (
                      <div className="bg-card border border-border/80 rounded-lg p-5 space-y-5 animate-fade-in shadow-sm">
                        <div className="border-b border-border/40 pb-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-ua-navy dark:text-ua-gold">Filter specification options</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          
                          {/* Department Multi-Select */}
                          <div className="space-y-2">
                            <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Departments</span>
                            <div className="border border-border rounded-lg p-2 max-h-32 overflow-y-auto space-y-1.5 bg-muted/5">
                              {departments.map((dept) => {
                                const checked = selectedDepts.includes(dept.id);
                                return (
                                  <label key={dept.id} className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none text-foreground/80 hover:text-foreground">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        if (checked) {
                                          setSelectedDepts(prev => prev.filter(id => id !== dept.id));
                                          const deptSections = (dept.sections || []).map((s: any) => s.id);
                                          setSelectedSections(prev => prev.filter(id => !deptSections.includes(id)));
                                        } else {
                                          setSelectedDepts(prev => [...prev, dept.id]);
                                        }
                                        setAttendancePage(1);
                                      }}
                                      className="rounded border-border text-ua-gold focus:ring-ua-gold/30"
                                    />
                                    <span>{dept.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>

                          {/* Section Multi-Select (Cascaded) */}
                          <div className="space-y-2">
                            <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sections</span>
                            <div className="border border-border rounded-lg p-2 max-h-32 overflow-y-auto space-y-1.5 bg-muted/5">
                              {(() => {
                                const filteredSecs = departments
                                  .filter(d => selectedDepts.length === 0 || selectedDepts.includes(d.id))
                                  .flatMap(d => d.sections || []);

                                if (filteredSecs.length === 0) {
                                  return <p className="text-[10px] text-muted-foreground italic p-2">No sections available.</p>;
                                }

                                return filteredSecs.map((sec) => {
                                  const checked = selectedSections.includes(sec.id);
                                  return (
                                    <label key={sec.id} className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none text-foreground/80 hover:text-foreground">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          if (checked) {
                                            setSelectedSections(prev => prev.filter(id => id !== sec.id));
                                          } else {
                                            setSelectedSections(prev => [...prev, sec.id]);
                                          }
                                          setAttendancePage(1);
                                        }}
                                        className="rounded border-border text-ua-gold focus:ring-ua-gold/30"
                                      />
                                      <span>{sec.name}</span>
                                    </label>
                                  );
                                });
                              })()}
                            </div>
                          </div>

                          {/* Academic Year Multi-Select */}
                          <div className="space-y-2">
                            <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Academic Years</span>
                            <div className="border border-border rounded-lg p-2 max-h-32 overflow-y-auto space-y-1.5 bg-muted/5">
                              {availableYears.length === 0 ? (
                                <p className="text-[10px] text-muted-foreground italic p-2">No data yet.</p>
                              ) : (
                                availableYears.map((year) => {
                                  const checked = selectedYears.includes(year);
                                  return (
                                    <label key={year} className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none text-foreground/80 hover:text-foreground">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          if (checked) {
                                            setSelectedYears(prev => prev.filter(y => y !== year));
                                          } else {
                                            setSelectedYears(prev => [...prev, year]);
                                          }
                                          setAttendancePage(1);
                                        }}
                                        className="rounded border-border text-ua-gold focus:ring-ua-gold/30"
                                      />
                                      <span>{year}</span>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* Semester Multi-Select */}
                          <div className="space-y-2">
                            <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Semesters</span>
                            <div className="border border-border rounded-lg p-2 max-h-32 overflow-y-auto space-y-1.5 bg-muted/5">
                              {availableSems.length === 0 ? (
                                <p className="text-[10px] text-muted-foreground italic p-2">No data yet.</p>
                              ) : (
                                availableSems.map((sem) => {
                                  const checked = selectedSems.includes(sem);
                                  return (
                                    <label key={sem} className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none text-foreground/80 hover:text-foreground">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          if (checked) {
                                            setSelectedSems(prev => prev.filter(s => s !== sem));
                                          } else {
                                            setSelectedSems(prev => [...prev, sem]);
                                          }
                                          setAttendancePage(1);
                                        }}
                                        className="rounded border-border text-ua-gold focus:ring-ua-gold/30"
                                      />
                                      <span>{sem} Semester</span>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          </div>

                        </div>
                      </div>
                    )}

                    {/* Table View */}
                    <div className="border border-border rounded-lg overflow-hidden bg-card relative">
                      {logsLoading && (
                        <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center z-10 transition-all duration-150">
                          <div className="w-8 h-8 border-4 border-ua-gold border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-muted/30 border-b border-border/50 text-muted-foreground">
                          <tr>
                            <th className="p-4 font-bold uppercase tracking-wider">Student Name</th>
                            <th className="p-4 font-bold uppercase tracking-wider">Student Email</th>
                            <th className="p-4 font-bold uppercase tracking-wider">First Submitted</th>
                            <th className="p-4 font-bold uppercase tracking-wider">Most Recent Submitted</th>
                            <th className="p-4 font-bold uppercase tracking-wider">Department</th>
                            <th className="p-4 font-bold uppercase tracking-wider">Section</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 text-foreground">
                          {receipts.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-12 text-center text-muted-foreground font-semibold italic">No unique attendance records found matching current criteria.</td>
                            </tr>
                          ) : (
                            receipts.map((rec) => (
                              <tr key={rec.id} className="hover:bg-muted/10 transition-all">
                                <td className="p-4 font-bold text-foreground">{rec.studentName || 'Not Set'}</td>
                                <td className="p-4 font-semibold text-muted-foreground">{rec.studentEmail}</td>
                                <td className="p-4 text-muted-foreground font-medium">{new Date(rec.firstSubmitted).toLocaleString()}</td>
                                <td className="p-4 text-foreground font-semibold">{new Date(rec.mostRecentSubmitted).toLocaleString()}</td>
                                <td className="p-4 font-semibold text-muted-foreground">{rec.departmentName || 'N/A'}</td>
                                <td className="p-4 text-muted-foreground font-medium">
                                  {rec.sectionName || 'N/A'}
                                  <span className="inline-block ml-2 text-[9px] bg-muted border text-muted-foreground px-1.5 py-0.5 rounded-full font-mono font-bold uppercase">
                                    {rec.level}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {attendanceTotalPages > 1 && (
                      <div className="border border-border rounded-lg bg-muted/5 p-4 flex items-center justify-between mt-4">
                        <p className="text-xs text-muted-foreground font-medium">
                          Showing <span className="font-semibold text-foreground">{((attendancePage - 1) * attendanceItemsPerPage) + 1}</span> to{" "}
                          <span className="font-semibold text-foreground">
                            {Math.min(attendancePage * attendanceItemsPerPage, attendanceTotalCount)}
                          </span>{" "}
                          of <span className="font-semibold text-foreground">{attendanceTotalCount}</span> records
                        </p>
                        <div className="flex gap-1">
                          <Button
                            uaVariant="outline"
                            onClick={() => setAttendancePage(p => Math.max(p - 1, 1))}
                            disabled={attendancePage === 1}
                            className="h-8 px-3 text-xs font-semibold"
                          >
                            Previous
                          </Button>
                          {Array.from({ length: attendanceTotalPages }).map((_, index) => {
                            const pageNum = index + 1;
                            if (attendanceTotalPages > 6 && Math.abs(attendancePage - pageNum) > 2 && pageNum !== 1 && pageNum !== attendanceTotalPages) {
                              if (pageNum === 2 || pageNum === attendanceTotalPages - 1) {
                                return <span key={pageNum} className="px-1 text-muted-foreground text-xs self-center">...</span>;
                              }
                              return null;
                            }
                            return (
                              <Button
                                key={pageNum}
                                onClick={() => setAttendancePage(pageNum)}
                                uaVariant={attendancePage === pageNum ? "primary" : "outline"}
                                className={cn(
                                  "h-8 w-8 p-0 text-xs font-semibold",
                                  attendancePage === pageNum ? "bg-ua-gold text-ua-navy border-ua-gold" : ""
                                )}
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                          <Button
                            uaVariant="outline"
                            onClick={() => setAttendancePage(p => Math.min(p + 1, attendanceTotalPages))}
                            disabled={attendancePage === attendanceTotalPages}
                            className="h-8 px-3 text-xs font-semibold"
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* CSV Export Scope Modal */}
                    <Modal
                      isOpen={isExportModalOpen}
                      onClose={() => setIsExportModalOpen(false)}
                      title="Export Attendance Ledger"
                      description="Choose the scope and columns to include in the exported CSV."
                    >
                      <div className="space-y-6">
                        {/* Scope Radio Selection */}
                        <div className="space-y-3">
                          <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">Export Scope</span>
                          <div className="space-y-2">
                            <label className="flex items-center gap-3 p-3 border border-border rounded-lg bg-muted/10 cursor-pointer select-none hover:bg-muted/20">
                              <input
                                type="radio"
                                name="exportScope"
                                value="current"
                                checked={exportScope === 'current'}
                                onChange={() => setExportScope('current')}
                                className="text-ua-gold focus:ring-ua-gold/30"
                              />
                              <div>
                                <span className="block text-xs font-bold text-foreground">Current Filtered View</span>
                                <span className="block text-[10px] text-muted-foreground mt-0.5">Exports exactly the matching records currently visible under active filters.</span>
                              </div>
                            </label>

                            <label className="flex items-center gap-3 p-3 border border-border rounded-lg bg-muted/10 cursor-pointer select-none hover:bg-muted/20">
                              <input
                                type="radio"
                                name="exportScope"
                                value="department"
                                checked={exportScope === 'department'}
                                onChange={() => setExportScope('department')}
                                className="text-ua-gold focus:ring-ua-gold/30"
                              />
                              <div className="flex-grow">
                                <span className="block text-xs font-bold text-foreground">Whole Department</span>
                                <span className="block text-[10px] text-muted-foreground mt-0.5">Ignores search/term filters to extract all unique students for a single department.</span>
                              </div>
                            </label>
                          </div>
                        </div>

                        {/* Cascading Department Dropdown for Scope */}
                        {exportScope === 'department' && (
                          <div className="space-y-2 animate-fade-in p-3 bg-muted/20 border border-border rounded-lg">
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Select Department</label>
                            <select
                              value={exportSelectedDeptId}
                              onChange={(e) => setExportSelectedDeptId(e.target.value)}
                              className="w-full h-10 p-2 border border-border rounded-lg text-sm bg-card text-foreground font-semibold outline-none focus:ring-2 focus:ring-ua-gold/30"
                            >
                              <option value="">-- Choose a Department --</option>
                              {departments.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Column Field Schema Decoupling Options */}
                        <div className="space-y-3">
                          <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">Export Details</span>
                          <label className="flex items-start gap-3 p-3 border border-border rounded-lg bg-muted/10 cursor-pointer select-none hover:bg-muted/20">
                            <input
                              type="checkbox"
                              checked={exportAllFields}
                              onChange={(e) => setExportAllFields(e.target.checked)}
                              className="rounded border-border text-ua-gold focus:ring-ua-gold/30 mt-0.5"
                            />
                            <div>
                              <span className="block text-xs font-bold text-foreground">Include all metadata fields</span>
                              <span className="block text-[10px] text-muted-foreground mt-0.5">Includes full fields (First Submitted, Most Recent, Department, Section) instead of just Name, Email, and Section.</span>
                            </div>
                          </label>
                        </div>

                        <div className="flex gap-2 pt-2 justify-end border-t border-border/50">
                          <Button
                            type="button"
                            uaVariant="outline"
                            onClick={() => setIsExportModalOpen(false)}
                            className="h-10 text-xs font-semibold px-4"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            uaVariant="primary"
                            onClick={handleExportCSV}
                            className="h-10 text-xs font-bold px-4"
                          >
                            Export &amp; Download
                          </Button>
                        </div>
                      </div>
                    </Modal>

                  </div>
                )}              </CardContent>
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
                    <div className="flex items-center justify-between p-3 border border-border/85 rounded-lg bg-muted/20">
                      <div>
                        <label className="block text-xs font-bold text-foreground uppercase tracking-wider">Faculty Portal Access</label>
                        <span className="text-[10px] text-muted-foreground">Enable or disable faculty page access</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          checked={sysFacultyPageEnabled}
                          onChange={(e) => setSysFacultyPageEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ua-gold"></div>
                      </label>
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
                          <div>
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Role</label>
                            <select
                              value={newAdminRole}
                              onChange={(e) => setNewAdminRole(e.target.value as 'ADMIN' | 'SUB_ADMIN')}
                              className="w-full h-8 px-2 text-xs border rounded bg-card text-foreground font-semibold"
                            >
                              <option value="ADMIN">System Admin</option>
                              <option value="SUB_ADMIN">Sub Admin</option>
                            </select>
                          </div>
                          {newAdminRole === 'SUB_ADMIN' && (
                            <div className="sm:col-span-2">
                              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Department</label>
                              <select
                                value={newAdminDeptId}
                                onChange={(e) => setNewAdminDeptId(e.target.value)}
                                className="w-full h-8 px-2 text-xs border rounded bg-card text-foreground font-semibold"
                                required={newAdminRole === 'SUB_ADMIN'}
                              >
                                <option value="">Select Department...</option>
                                {departments.map((d: any) => (
                                  <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
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
                    <UAPremiumLoader message="Syncing system administrators..." submessage="Fetching authentication privileges..." />
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
                            <th className="p-4 font-bold text-xs uppercase tracking-wider text-muted-foreground">Role</th>
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
                              <td className="p-4 text-muted-foreground font-semibold">
                                {u.role === 'SUB_ADMIN' ? (
                                  <span className="text-ua-gold">Sub Admin {u.department ? `(${u.department.name})` : ''}</span>
                                ) : (
                                  <span className="text-ua-navy dark:text-ua-gold">System Admin</span>
                                )}
                              </td>
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
      <UAPremiumLoader message="Loading Admin Dashboard" submessage="Initializing application console..." />
    }>
      <AdminDashboardContent />
    </Suspense>
  );
}
