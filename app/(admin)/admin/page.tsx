'use client';

import { useEffect, useState } from 'react';
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
import { 
  getSystemSettings, 
  updateSystemSettings,
  getAdmins,
  elevateUserToAdmin,
  revokeAdminAction
} from '@/app/actions/settings';

type ActiveView = 'rankings' | 'departments' | 'templates' | 'logs' | 'settings';

export default function AdminDashboard() {
  const [activeView, setActiveView] = useState<ActiveView>('rankings');
  const [receipts, setReceipts] = useState<any[]>([]);
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
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'logs' || tab === 'settings' || tab === 'rankings') {
        setActiveView(tab as ActiveView);
      }
    }
  }, []);

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
    <div className="min-h-screen bg-slate-50/50 py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header & Navigation */}
        <div className="border-b border-slate-200 pb-4 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span className="bg-indigo-600 text-white px-3 py-1 rounded-xl text-2xl font-extrabold shadow-sm">UA</span>
                evalUAtion Admin Portal
              </h1>
              <p className="text-sm text-slate-500 mt-1.5">Manage institutional departments, templates, and faculty ratings</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100/80">
            {[
              { id: 'rankings', label: 'Rankings Ledger' },
              { id: 'departments', label: 'Faculty & Dept Manage', href: '/admin/management' },
              { id: 'templates', label: 'Manage Templates', href: '/admin/templates' },
              { id: 'logs', label: 'Activity Logs' },
              { id: 'settings', label: 'System Settings' }
            ].map((tab) => {
              if (tab.href) {
                return (
                  <Link 
                    key={tab.id}
                    href={tab.href}
                    className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 border bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 flex items-center"
                  >
                    {tab.label}
                  </Link>
                );
              }
              return (
                <button 
                  key={tab.id}
                  onClick={() => { 
                    setActiveView(tab.id as ActiveView); 
                    setMessage(''); 
                    if (typeof window !== 'undefined') {
                      const newUrl = tab.id === 'rankings' ? '/admin' : `/admin?tab=${tab.id}`;
                      window.history.pushState(null, '', newUrl);
                    }
                  }}
                  className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 border ${
                    activeView === tab.id 
                      ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
                      : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-sm font-medium shadow-sm animate-fade-in">
            {message}
          </div>
        )}

        {/* Dynamic Panel */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 font-semibold animate-pulse">
            Syncing database parameters...
          </div>
        ) : (
          <>
            {activeView === 'rankings' && (
              <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/40">
                  <h2 className="text-lg font-bold text-slate-800">Faculty Performance Ledger</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Aggregated rating scores computed directly from submitted evaluations</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/80 border-b border-slate-100">
                      <tr>
                        <th 
                          onClick={() => handleSort('name')}
                          className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none"
                        >
                          Faculty Name {sortField === 'name' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                        </th>
                        <th 
                          onClick={() => handleSort('email')}
                          className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none"
                        >
                          Email Address {sortField === 'email' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                        </th>
                        <th 
                          onClick={() => handleSort('department')}
                          className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none"
                        >
                          Department {sortField === 'department' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                        </th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider select-none">
                          Assigned Sections
                        </th>
                        <th 
                          onClick={() => handleSort('score')}
                          className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center cursor-pointer hover:bg-slate-100 select-none"
                        >
                          Score {sortField === 'score' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sortedRankings.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-12 text-center text-slate-400 font-medium">No faculty evaluations logged yet.</td>
                        </tr>
                      ) : (
                        sortedRankings.map((rank) => (
                          <tr key={rank.id} className="hover:bg-slate-50/30 transition-all">
                            <td className="p-4 text-sm font-semibold text-slate-900">{rank.name}</td>
                            <td className="p-4 text-sm text-slate-600">{rank.email}</td>
                            <td className="p-4 text-sm text-slate-600">{rank.department}</td>
                            <td className="p-4 text-sm text-slate-500 max-w-xs truncate">{rank.sections || "None"}</td>
                            <td className="p-4 text-sm text-center">
                              {rank.averageScore !== null ? (
                                <span className="inline-block px-3 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-full font-bold text-xs">
                                  {rank.averageScore}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">N/A</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeView === 'departments' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/40">
                    <h2 className="text-lg font-bold text-slate-800">Departments Overview</h2>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {departments.filter((d) => d.level === 'COLLEGE' || d.level === 'GRADUATE').length === 0 ? (
                      <li className="p-12 text-center text-slate-400 font-medium">No departments registered.</li>
                    ) : (
                      departments
                        .filter((d) => d.level === 'COLLEGE' || d.level === 'GRADUATE')
                        .map((dep) => (
                          <li key={dep.id} className="p-5 flex justify-between items-center hover:bg-slate-50/30 transition-all">
                            <div>
                              <p className="font-bold text-slate-800">{dep.name}</p>
                              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">Level: {dep.level}</p>
                            </div>
                            <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider">
                              {dep.professors?.length || 0} Faculty
                            </span>
                          </li>
                        ))
                    )}
                  </ul>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm h-fit space-y-5">
                  <h2 className="text-lg font-bold text-slate-800 border-b pb-3">New Department</h2>
                  <form onSubmit={handleCreateDepartment} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Department Name</label>
                      <input 
                        type="text" 
                        value={depName}
                        onChange={(e) => setDepName(e.target.value)}
                        placeholder="e.g. Computer Studies" 
                        className="w-full p-2.5 border rounded-xl text-sm bg-slate-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Education Level</label>
                      <select 
                        value={depLevel}
                        onChange={(e) => setDepLevel(e.target.value as EducationLevel)}
                        className="w-full p-2.5 border rounded-xl text-sm bg-slate-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      >
                        <option value="COLLEGE">COLLEGE</option>
                        <option value="GRADUATE">GRADUATE</option>
                      </select>
                    </div>
                    <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all">
                      Create Department
                    </button>
                  </form>
                </div>
              </div>
            )}

            {activeView === 'templates' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/40">
                    <h2 className="text-lg font-bold text-slate-800">Evaluation Templates</h2>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {templates.length === 0 ? (
                      <li className="p-12 text-center text-slate-400 font-medium">No templates configured.</li>
                    ) : (
                      templates.map((temp) => (
                        <li key={temp.id} className="p-5 flex justify-between items-center hover:bg-slate-50/30 transition-all">
                          <div>
                            <p className="font-bold text-slate-800">{temp.title}</p>
                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">
                              Level: {temp.level} {temp.department ? `| Dept: ${temp.department.name}` : ''}
                            </p>
                          </div>
                          <span className="text-xs bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider">
                            {temp.clusters?.length || 0} Clusters
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm h-fit space-y-5">
                  <h2 className="text-lg font-bold text-slate-800 border-b pb-3">New Template</h2>
                  <form onSubmit={handleCreateTemplate} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Template Title</label>
                      <input 
                        type="text" 
                        value={tempTitle}
                        onChange={(e) => setTempTitle(e.target.value)}
                        placeholder="e.g. SHS Evaluation Form 2026" 
                        className="w-full p-2.5 border rounded-xl text-sm bg-slate-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Education Level</label>
                      <select 
                        value={tempLevel}
                        onChange={(e) => setTempLevel(e.target.value as EducationLevel)}
                        className="w-full p-2.5 border rounded-xl text-sm bg-slate-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      >
                        <option value="JHS">JHS</option>
                        <option value="SHS">SHS</option>
                        <option value="COLLEGE">COLLEGE</option>
                        <option value="GRADUATE">GRADUATE</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Department (Optional)</label>
                      <select 
                        value={tempDepId}
                        onChange={(e) => setTempDepId(e.target.value)}
                        className="w-full p-2.5 border rounded-xl text-sm bg-slate-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      >
                        <option value="">Global Template (No Department)</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name} ({d.level})</option>
                        ))}
                      </select>
                    </div>
                    <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all">
                      Create Template
                    </button>
                  </form>
                </div>
              </div>
            )}

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
                          ? 'bg-white text-slate-900 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      🛡️ System Audit Logs
                    </button>
                    <button
                      onClick={() => setNestedLogTab('attendance')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        nestedLogTab === 'attendance' 
                          ? 'bg-white text-slate-900 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      📋 Evaluation Attendance
                    </button>
                  </div>
                </div>

                {nestedLogTab === 'audit' ? (
                  <div className="space-y-4 pt-2">
                    <div className="flex justify-between items-center pb-2">
                      <h3 className="text-sm font-bold text-slate-700">Recent Security & Configuration Events</h3>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">Mock System Log stream</span>
                    </div>
                    <div className="border border-slate-200/60 rounded-xl divide-y divide-slate-100 bg-slate-50/30 overflow-hidden font-mono text-xs text-slate-600">
                      {[
                        { time: "2026-07-04 22:15:33", user: "masteradmin", event: "SYSTEM_CONFIG_UPDATE", desc: "Updated system active terms to 2026-2027 1st Semester" },
                        { time: "2026-07-04 21:58:12", user: "masteradmin", event: "TEMPLATE_ACTIVATE", desc: "Activated global College Evaluation Template" },
                        { time: "2026-07-04 21:52:04", user: "masteradmin", event: "TEMPLATE_IMPORT", desc: "Successfully parsed evaluation template from docx via Gemini AI" },
                        { time: "2026-07-04 21:12:44", user: "masteradmin", event: "USER_ELEVATION", desc: "Elevated user admin@ua.edu.ph to System Administrator role" },
                        { time: "2026-07-04 20:45:12", user: "SYSTEM", event: "DB_SCHEMA_SYNC", desc: "Prisma client decoupled schema parameters synchronized successfully" }
                      ].map((log, index) => (
                        <div key={index} className="p-4 hover:bg-white transition-all flex items-start gap-4">
                          <span className="text-slate-400 select-none shrink-0">{log.time}</span>
                          <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider shrink-0">{log.event}</span>
                          <div className="space-y-0.5 flex-grow">
                            <p className="text-slate-800 font-semibold">{log.desc}</p>
                            <p className="text-[10px] text-slate-400">Triggered by: {log.user}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 pt-2">
                    {/* Filters Toolbar */}
                    <div className="flex flex-col xl:flex-row gap-3 justify-between items-start xl:items-center">
                      <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                        <input
                          type="text"
                          value={receiptSearch}
                          onChange={(e) => setReceiptSearch(e.target.value)}
                          placeholder="Search email, section, or prof..."
                          className="p-2 border border-slate-200 rounded-xl text-xs bg-slate-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold outline-none w-full sm:w-48 text-slate-800"
                        />
                        
                        {/* Cascading Level Dropdown */}
                        <select
                          value={receiptLevelFilter}
                          onChange={(e) => {
                            setReceiptLevelFilter(e.target.value);
                            setReceiptDepFilter('');
                            setReceiptSecFilter('');
                          }}
                          className="p-2 border border-slate-200 rounded-xl text-xs bg-slate-50/50 font-semibold text-slate-700 outline-none"
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
                          className="p-2 border border-slate-200 rounded-xl text-xs bg-slate-50/50 font-semibold text-slate-700 outline-none max-w-[180px]"
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
                          className="p-2 border border-slate-200 rounded-xl text-xs bg-slate-50/50 font-semibold text-slate-700 outline-none max-w-[150px]"
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
                          className="p-2 border border-slate-200 rounded-xl text-xs bg-slate-50/50 font-semibold text-slate-700 outline-none"
                        >
                          <option value="">All Years</option>
                          <option value="2026-2027">2026-2027</option>
                          <option value="2027-2028">2027-2028</option>
                        </select>
                        
                        <select
                          value={receiptSemFilter}
                          onChange={(e) => setReceiptSemFilter(e.target.value)}
                          className="p-2 border border-slate-200 rounded-xl text-xs bg-slate-50/50 font-semibold text-slate-700 outline-none"
                        >
                          <option value="">All Terms</option>
                          <option value="1st">1st Sem</option>
                          <option value="2nd">2nd Sem</option>
                          <option value="Summer">Summer</option>
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
                        className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer w-full xl:w-auto"
                      >
                        📤 Export Attendance (.csv)
                      </button>
                    </div>

                    {/* Table View */}
                    <div className="border border-slate-200/60 rounded-2xl overflow-hidden bg-white">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            <th className="p-4 font-bold text-slate-700 uppercase tracking-wider">Student Email</th>
                            <th className="p-4 font-bold text-slate-700 uppercase tracking-wider">Level</th>
                            <th className="p-4 font-bold text-slate-700 uppercase tracking-wider">Department</th>
                            <th className="p-4 font-bold text-slate-700 uppercase tracking-wider">Section</th>
                            <th className="p-4 font-bold text-slate-700 uppercase tracking-wider">Professor</th>
                            <th className="p-4 font-bold text-slate-700 uppercase tracking-wider">Academic Term</th>
                            <th className="p-4 font-bold text-slate-700 uppercase tracking-wider">Submitted Date</th>
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
                                <td className="p-4 font-semibold uppercase text-slate-500 text-[10px]">{rec.level}</td>
                                <td className="p-4 font-semibold text-slate-600">{rec.departmentName}</td>
                                <td className="p-4">{rec.sectionName}</td>
                                <td className="p-4 font-semibold">{rec.professorName}</td>
                                <td className="p-4 uppercase font-semibold text-[10px]"><span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-full">{rec.academicYear} | {rec.semester}</span></td>
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
                  <p className="text-xs text-slate-500 leading-relaxed">
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
                        className="w-full p-2.5 border rounded-xl text-sm bg-slate-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Current Semester</label>
                      <select 
                        value={sysSem}
                        onChange={(e) => setSysSem(e.target.value)}
                        className="w-full p-2.5 border rounded-xl text-sm bg-slate-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                      >
                        <option value="1st">1st Semester</option>
                        <option value="2nd">2nd Semester</option>
                        <option value="Summer">Summer Term</option>
                      </select>
                    </div>
                    <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all">
                      Update System Terms
                    </button>
                  </form>
                  <div className="border-t border-slate-200 pt-4 mt-2">
                    <button 
                      type="button"
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className="w-full py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                    >
                      Log Out Session
                    </button>
                  </div>
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
                            <button type="submit" className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all">
                              Add Admin
                            </button>
                            <button 
                              type="button" 
                              onClick={() => setShowAddAdminForm(false)}
                              className="px-3 py-2 bg-white border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button 
                          onClick={() => setShowAddAdminForm(true)}
                          className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/10"
                        >
                          + Add System Admin
                        </button>
                      )}
                    </div>
                  </div>

                  {admins.length === 0 ? (
                    <div className="text-center text-slate-400 font-semibold py-8">Syncing system administrators...</div>
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
                              className="p-4 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none text-xs uppercase tracking-wider"
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
                              className="p-4 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none text-xs uppercase tracking-wider"
                            >
                              Name {adminSortField === 'name' ? (adminSortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                            </th>
                            <th className="p-4 font-bold text-slate-700 text-right text-xs uppercase tracking-wider">Actions</th>
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
                                  className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 text-xs font-bold rounded-lg transition"
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
    </div>
  );
}
