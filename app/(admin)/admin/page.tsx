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
import { signOut } from 'next-auth/react';
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

type ActiveView = 'rankings' | 'departments' | 'templates' | 'logs' | 'settings';

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

  const [message, setMessage] = useState('');

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
      setMessage('Department created successfully!');
      loadData();
    } catch (err: any) {
      setMessage(err.message || 'Error creating department');
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempTitle) return;
    try {
      await createTemplate(tempTitle, tempLevel, tempDepId || undefined);
      setTempTitle('');
      setTempDepId('');
      setMessage('Template created successfully!');
      loadData();
    } catch (err: any) {
      setMessage(err.message || 'Error creating template');
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
      setMessage(`Successfully elevated ${newAdminEmail} to System Administrator!`);
      loadData();
    } catch (err: any) {
      setMessage(err.message || 'Failed to elevate user to admin');
    }
  };

  const handleRevokeAdmin = async (userId: string) => {
    if (!confirm("Are you sure you want to revoke administrative privileges for this user? They will be demoted to faculty role.")) return;
    try {
      await revokeAdminAction(userId);
      setMessage("Administrative privileges revoked successfully.");
      loadData();
    } catch (err: any) {
      setMessage(err.message || 'Failed to revoke admin privileges');
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSystemSettings(sysYear, sysSem);
      setMessage("System academic term settings updated successfully!");
    } catch (err: any) {
      setMessage(err.message || "Failed to update system settings");
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
            {activeView === 'rankings' 
              ? 'Faculty Performance Ledger' 
              : activeView === 'logs' 
              ? 'Activity & Audit Console' 
              : 'System Settings'}
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-semibold">
            {activeView === 'rankings' 
              ? 'Aggregated rating scores computed directly from submitted student evaluations' 
              : activeView === 'logs' 
              ? 'Monitor security logs and evaluation attendance parameters' 
              : 'Configure school terms and administration permissions'}
          </p>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold shadow-sm animate-fade-in">
          {message}
        </div>
      )}

      {/* Dynamic Panel */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 font-semibold animate-pulse bg-white border border-slate-200/80 rounded-2xl shadow-sm">
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

            return (
              <>
                {/* Visual Analytics Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                  <div className="lg:col-span-2 bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-800 text-sm border-b pb-2">Top 10 Faculty Rankings (Bar Chart)</h3>
                    <FacultyRankingChart data={rankingChartData} />
                  </div>
                  <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-800 text-sm border-b pb-2">Department Averages Comparison</h3>
                    <DepartmentDonutChart data={departmentData} />
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">

              <div className="p-6 border-b border-slate-100 bg-slate-50/40">
                <h2 className="text-lg font-bold text-slate-800">Faculty Ratings Ledger</h2>
                <p className="text-xs text-slate-500 mt-0.5">Aggregated rating scores computed directly from submitted evaluations</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th 
                        onClick={() => handleSort('name')}
                        className="p-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-200/50 select-none"
                      >
                        Faculty Name {sortField === 'name' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                      </th>
                      <th 
                        onClick={() => handleSort('email')}
                        className="p-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-200/50 select-none"
                      >
                        Email Address {sortField === 'email' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                      </th>
                      <th 
                        onClick={() => handleSort('department')}
                        className="p-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-200/50 select-none"
                      >
                        Department {sortField === 'department' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                      </th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider select-none text-slate-500">
                        Assigned Sections
                      </th>
                      <th 
                        onClick={() => handleSort('score')}
                        className="p-4 text-xs font-bold uppercase tracking-wider text-center cursor-pointer hover:bg-slate-200/50 select-none"
                      >
                        Score {sortField === 'score' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedRankings.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-12">
                          <div className="p-12 text-center flex flex-col items-center justify-center max-w-md mx-auto space-y-4">
                            <div className="w-16 h-16 bg-slate-100 text-ua-blue/30 rounded-full flex items-center justify-center text-sm font-black shadow-inner">
                              N/A
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-800 text-base">No Evaluations Recorded</h3>
                              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                Faculty ratings will be calculated here once students begin submitting evaluations.
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      sortedRankings.map((rank) => (
                        <tr key={rank.id} className="hover:bg-slate-50/50 transition-all">
                          <td className="p-4 text-sm font-semibold text-slate-900">{rank.name}</td>
                          <td className="p-4 text-sm text-slate-655 font-medium">{rank.email}</td>
                          <td className="p-4 text-sm text-slate-655 font-medium">{rank.department}</td>
                          <td className="p-4 text-sm text-slate-500 max-w-xs truncate">{rank.sections || "None"}</td>
                          <td className="p-4 text-sm text-center">
                            {rank.averageScore !== null ? (
                              <span className="inline-block px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full font-bold text-xs shadow-sm">
                                {rank.averageScore}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">N/A</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
                </div>
              </>
            );
          })()}

          {activeView === 'logs' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden space-y-6 p-6">
              <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-slate-50/20 -m-6 p-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Activity & Audit Console</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Monitor system events and evaluation attendance</p>
                </div>
                
                {/* Nested Tabs Selection */}
                <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-center">
                  <button
                    onClick={() => setNestedLogTab('audit')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      nestedLogTab === 'audit' 
                        ? 'bg-white text-slate-900 shadow-sm border-l-2 border-ua-gold' 
                        : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    System Audit Logs
                  </button>
                  <button
                    onClick={() => setNestedLogTab('attendance')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      nestedLogTab === 'attendance' 
                        ? 'bg-white text-slate-900 shadow-sm border-l-2 border-ua-gold' 
                        : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    Evaluation Attendance
                  </button>
                </div>
              </div>
              {nestedLogTab === 'audit' ? (
                <div className="space-y-4 pt-2">
                  <div className="flex justify-between items-center pb-2">
                    <h3 className="text-sm font-bold text-slate-700">Recent Security & Configuration Events</h3>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-bold">Encrypted Audit Logs</span>
                  </div>
                  <div className="border border-slate-200/60 rounded-xl divide-y divide-slate-100 bg-slate-50/30 overflow-hidden font-mono text-xs text-slate-600">
                    {auditLogs.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 font-semibold text-xs bg-white">No decrypted audit entries logged yet.</div>
                    ) : (
                      auditLogs.map((log: any, index: number) => (
                        <div key={log.id || index} className="p-4 hover:bg-white transition-all flex items-start gap-4">
                          <span className="text-slate-400 select-none shrink-0">{new Date(log.createdAt).toLocaleString()}</span>
                          <span className="bg-ua-blue/5 border border-ua-blue/10 text-ua-blue font-bold px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider shrink-0">{log.eventType}</span>
                          <div className="space-y-0.5 flex-grow">
                            <p className="text-slate-800 font-semibold">{log.details?.desc || log.details?.message || JSON.stringify(log.details)}</p>
                            <p className="text-[10px] text-slate-450">Triggered by: {log.actorEmail}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  {/* Filters Toolbar */}
                  <div className="flex flex-col xl:flex-row gap-3 justify-between items-start xl:items-center bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                    <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                      <input
                        type="text"
                        value={receiptSearch}
                        onChange={(e) => setReceiptSearch(e.target.value)}
                        placeholder="Search email, section, or prof..."
                        className="p-2.5 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-ua-blue/20 focus:border-ua-blue transition-all font-semibold outline-none w-full sm:w-48 text-slate-850"
                      />
                      
                      {/* Cascading Level Dropdown */}
                      <select
                        value={receiptLevelFilter}
                        onChange={(e) => {
                          setReceiptLevelFilter(e.target.value);
                          setReceiptDepFilter('');
                          setReceiptSecFilter('');
                        }}
                        className="p-2.5 border border-slate-200 rounded-xl text-xs bg-white font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-ua-blue/20 focus:border-ua-blue"
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
                        className="p-2.5 border border-slate-200 rounded-xl text-xs bg-white font-semibold text-slate-700 outline-none max-w-[180px] focus:ring-2 focus:ring-ua-blue/20 focus:border-ua-blue"
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
                        className="p-2.5 border border-slate-200 rounded-xl text-xs bg-white font-semibold text-slate-700 outline-none max-w-[150px] focus:ring-2 focus:ring-ua-blue/20 focus:border-ua-blue"
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
                        className="p-2.5 border border-slate-200 rounded-xl text-xs bg-white font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-ua-blue/20 focus:border-ua-blue"
                      >
                        <option value="">All Years</option>
                        <option value="2026-2027">2026-2027</option>
                        <option value="2027-2028">2027-2028</option>
                      </select>
                      
                      <select
                        value={receiptSemFilter}
                        onChange={(e) => setReceiptSemFilter(e.target.value)}
                        className="p-2.5 border border-slate-200 rounded-xl text-xs bg-white font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-ua-blue/20 focus:border-ua-blue"
                      >
                        <option value="">All Terms</option>
                        <option value="1st">1st Sem</option>
                        <option value="2nd">2nd Sem</option>
                        <option value="Summer">Summer Term</option>
                      </select>
                    </div>
                    <button
                      type="button"
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
                      className="px-4 py-2.5 bg-ua-blue hover:bg-ua-blue-dark text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50 cursor-pointer w-full xl:w-auto text-center"
                    >
                      📤 Export Attendance (.csv)
                    </button>
                  </div>

                  {/* Table View */}
                  <div className="border border-slate-200/60 rounded-2xl overflow-hidden bg-white">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600">
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
                      <tbody className="divide-y divide-slate-100 text-slate-700">
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
                                <td colSpan={7} className="p-12 text-center text-slate-400 font-semibold italic">No attendance records found matching criteria.</td>
                              </tr>
                            );
                          }

                          return finalFiltered.map((rec) => (
                            <tr key={rec.id} className="hover:bg-slate-50/20 transition-all">
                              <td className="p-4 font-bold text-slate-900">{rec.studentEmail}</td>
                              <td className="p-4 font-bold uppercase text-slate-500 text-[10px]">{rec.level}</td>
                              <td className="p-4 font-semibold text-slate-655">{rec.departmentName}</td>
                              <td className="p-4 text-slate-655 font-medium">{rec.sectionName}</td>
                              <td className="p-4 font-semibold">{rec.professorName}</td>
                              <td className="p-4 uppercase font-bold text-[10px]">
                                <span className="px-2.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-full font-mono">
                                  {rec.academicYear} | {rec.semester}
                                </span>
                              </td>
                              <td className="p-4 text-slate-500 font-medium">{new Date(rec.createdAt).toLocaleString()}</td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeView === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Global Registrar Terms settings */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm h-fit space-y-5">
                <h2 className="text-lg font-bold text-slate-800 border-b pb-3 font-black">Registrar Settings</h2>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Configure the global active Academic Year and Term. All submitted student evaluations will be cataloged under these specific details.
                </p>
                <form onSubmit={handleUpdateSettings} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Academic Year</label>
                    <input 
                      type="text" 
                      value={sysYear}
                      onChange={(e) => setSysYear(e.target.value)}
                      placeholder="e.g. 2026-2027" 
                      className="w-full p-2.5 border rounded-xl text-sm bg-slate-55 bg-white focus:ring-2 focus:ring-ua-blue/20 focus:border-ua-blue transition-all font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Current Semester</label>
                    <select 
                      value={sysSem}
                      onChange={(e) => setSysSem(e.target.value)}
                      className="w-full p-2.5 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-ua-blue/20 focus:border-ua-blue transition-all font-bold text-slate-700"
                    >
                      <option value="1st">1st Semester</option>
                      <option value="2nd">2nd Semester</option>
                      <option value="Summer">Summer Term</option>
                    </select>
                  </div>
                  <button type="submit" className="w-full py-3 bg-ua-blue hover:bg-ua-blue-dark text-white rounded-xl text-sm font-bold shadow-lg shadow-ua-blue/10 hover:shadow-ua-blue/20 transition-all cursor-pointer">
                    Update System Terms
                  </button>
                </form>
              </div>

              {/* System Administrators Management */}
              <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 font-black">System Administrators</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Elevate users or revoke system administration roles</p>
                  </div>
                  <div className="w-full sm:w-auto">
                    {showAddAdminForm ? (
                      <form onSubmit={handleElevateAdmin} className="p-4 border border-slate-200 bg-slate-50/50 rounded-xl space-y-3 w-full text-left">
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Elevate User to Admin</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Email</label>
                            <input 
                              type="email"
                              value={newAdminEmail}
                              onChange={(e) => setNewAdminEmail(e.target.value)}
                              placeholder="staff@ua.edu.ph"
                              className="w-full p-2 text-xs border rounded-lg bg-white font-semibold"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Username</label>
                            <input 
                              type="text"
                              value={newAdminUsername}
                              onChange={(e) => setNewAdminUsername(e.target.value)}
                              placeholder="staff_admin"
                              className="w-full p-2 text-xs border rounded-lg bg-white font-semibold"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Password</label>
                            <input 
                              type="password"
                              value={newAdminPassword}
                              onChange={(e) => setNewAdminPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full p-2 text-xs border rounded-lg bg-white font-semibold"
                              required
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <button type="submit" className="px-3.5 py-2 bg-ua-blue hover:bg-ua-blue-dark text-white font-bold text-xs rounded-xl transition-all cursor-pointer">
                            Add Admin
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setShowAddAdminForm(false)}
                            className="px-3 py-2 bg-white border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button 
                        onClick={() => setShowAddAdminForm(true)}
                        className="px-4 py-2.5 bg-ua-blue text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-ua-blue-dark transition-all shadow-md shadow-ua-blue/10 cursor-pointer"
                      >
                        + Add System Admin
                      </button>
                    )}
                  </div>
                </div>

                {admins.length === 0 ? (
                  <div className="text-center text-slate-400 font-semibold py-8 animate-pulse">Syncing system administrators...</div>
                ) : (
                  <div className="overflow-visible border border-slate-100 rounded-xl">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead className="bg-slate-50">
                        <tr className="border-b">
                          <th 
                            onClick={() => {
                              if (adminSortField === 'email') {
                                setAdminSortDirection(adminSortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setAdminSortField('email');
                                setAdminSortDirection('asc');
                              }
                            }}
                            className="p-4 font-bold text-slate-750 cursor-pointer hover:bg-slate-100 select-none text-xs uppercase tracking-wider"
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
                            className="p-4 font-bold text-slate-750 cursor-pointer hover:bg-slate-100 select-none text-xs uppercase tracking-wider"
                          >
                            Name {adminSortField === 'name' ? (adminSortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                          </th>
                          <th className="p-4 font-bold text-slate-750 text-right text-xs uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {[...admins].sort((a, b) => {
                          let valA = (adminSortField === 'email' ? a.email : a.name) || '';
                          let valB = (adminSortField === 'email' ? b.email : b.name) || '';
                          if (valA.toLowerCase() < valB.toLowerCase()) return adminSortDirection === 'asc' ? -1 : 1;
                          if (valA.toLowerCase() > valB.toLowerCase()) return adminSortDirection === 'asc' ? 1 : -1;
                          return 0;
                        }).map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50/50">
                            <td className="p-4 font-bold text-slate-900">{u.email}</td>
                            <td className="p-4 text-slate-600 font-semibold">{u.name || "Pending login"}</td>
                            <td className="p-4 text-right">
                              <button 
                                onClick={() => handleRevokeAdmin(u.id)}
                                className="px-2.5 py-1.5 bg-ua-red/5 hover:bg-ua-red/10 text-ua-red border border-ua-red/20 text-xs font-bold rounded-lg transition cursor-pointer"
                              >
                                Revoke Admin
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

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
      <div className="py-20 text-center text-slate-450 text-slate-450 text-slate-400 font-semibold animate-pulse bg-white border border-slate-200/80 rounded-2xl shadow-sm">
        Loading admin dashboard ledger...
      </div>
    }>
      <AdminDashboardContent />
    </Suspense>
  );
}
