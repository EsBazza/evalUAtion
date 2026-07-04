'use client';

import { useEffect, useState } from 'react';
import { getDepartments } from '@/app/actions/admin';
import { 
  getDepartmentDetails, 
  createSection, 
  createProfessor, 
  updateProfessor 
} from '@/app/actions/management';
import Link from 'next/link';

export default function FacultyDepartmentManagement() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [deptDetails, setDeptDetails] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'sections' | 'faculty'>('sections');
  
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Modals / Inline Forms states
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  const [showFacultyForm, setShowFacultyForm] = useState(false);
  const [newFacultyName, setNewFacultyName] = useState('');
  const [newFacultyEmail, setNewFacultyEmail] = useState('');

  const [editingFaculty, setEditingFaculty] = useState<any | null>(null);
  const [editFacultyName, setEditFacultyName] = useState('');
  const [editFacultyEmail, setEditFacultyEmail] = useState('');
  const [editSelectedSections, setEditSelectedSections] = useState<string[]>([]);

  // Sorting and kebab states
  const [activeKebabId, setActiveKebabId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Load departments on mount
  useEffect(() => {
    async function loadDeps() {
      setLoading(true);
      const data = await getDepartments();
      setDepartments(data);
      setLoading(false);
    }
    loadDeps();
  }, []);

  // Load selected department details
  const loadDeptDetails = async (id: string) => {
    setDetailsLoading(true);
    setErrorMessage('');
    setMessage('');
    try {
      const data = await getDepartmentDetails(id);
      setDeptDetails(data);
    } catch (err: any) {
      setErrorMessage("Failed to load department details");
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDeptId) {
      loadDeptDetails(selectedDeptId);
    } else {
      setDeptDetails(null);
    }
  }, [selectedDeptId]);

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptId || !newSectionName.trim()) return;
    setErrorMessage('');
    setMessage('');
    try {
      await createSection(newSectionName, selectedDeptId);
      setNewSectionName('');
      setShowSectionForm(false);
      setMessage("Section created successfully!");
      loadDeptDetails(selectedDeptId);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create section");
    }
  };

  const handleAddFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptId || !newFacultyName.trim() || !newFacultyEmail.trim()) return;
    setErrorMessage('');
    setMessage('');
    try {
      await createProfessor(newFacultyName, newFacultyEmail, selectedDeptId);
      setNewFacultyName('');
      setNewFacultyEmail('');
      setShowFacultyForm(false);
      setMessage("Faculty created successfully!");
      loadDeptDetails(selectedDeptId);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create faculty");
    }
  };

  const handleStartEditFaculty = (prof: any) => {
    setEditingFaculty(prof);
    setEditFacultyName(prof.name);
    setEditFacultyEmail(prof.email);
    setEditSelectedSections(prof.sections.map((s: any) => s.id));
    setErrorMessage('');
    setMessage('');
  };

  const handleCheckboxChange = (sectionId: string, checked: boolean) => {
    if (checked) {
      setEditSelectedSections(prev => [...prev, sectionId]);
    } else {
      setEditSelectedSections(prev => prev.filter(id => id !== sectionId));
    }
  };

  const handleSaveEditFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaculty) return;
    setErrorMessage('');
    setMessage('');
    try {
      await updateProfessor(
        editingFaculty.id,
        editFacultyName,
        editFacultyEmail,
        editSelectedSections
      );
      setEditingFaculty(null);
      setMessage("Faculty details and section mappings updated!");
      if (selectedDeptId) {
        loadDeptDetails(selectedDeptId);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update faculty");
    }
  };

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
              <p className="text-sm text-slate-500 mt-1.5">Configure year levels, sections, and link faculty instructors to courses</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100/80">
            {[
              { id: 'rankings', label: 'Rankings Ledger', href: '/admin' },
              { id: 'departments', label: 'Faculty & Dept Manage', active: true },
              { id: 'templates', label: 'Manage Templates', href: '/admin/templates' },
              { id: 'logs', label: 'Activity Logs', href: '/admin?tab=logs' },
              { id: 'settings', label: 'System Settings', href: '/admin?tab=settings' }
            ].map((tab) => {
              if (tab.active) {
                return (
                  <button 
                    key={tab.id}
                    className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 border bg-slate-900 border-slate-900 text-white shadow-sm"
                  >
                    {tab.label}
                  </button>
                );
              }
              return (
                <Link 
                  key={tab.id}
                  href={tab.href || '#'}
                  className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 border bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 flex items-center"
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Global Messages */}
        {message && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-sm font-semibold shadow-sm animate-fade-in">
            {message}
          </div>
        )}
        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-100 text-red-800 rounded-xl text-sm font-semibold shadow-sm animate-fade-in">
            {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Departments List */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden h-fit">
            <div className="p-5 border-b border-slate-100 bg-slate-50/40">
              <h2 className="text-md font-bold text-slate-800">Select Department</h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {loading ? (
                <li className="p-8 text-center text-slate-400 font-semibold animate-pulse">Syncing...</li>
              ) : (
                <>
                  {/* Standard JHS/SHS Levels (Not customizable departments) */}
                  {departments.find(d => d.level === 'JHS') && (
                    (() => {
                      const jdep = departments.find(d => d.level === 'JHS');
                      return (
                        <li key={jdep.id}>
                          <button 
                            onClick={() => {
                              setSelectedDeptId(jdep.id);
                              setEditingFaculty(null);
                            }}
                            className={`w-full text-left p-5 hover:bg-slate-50/50 transition-all ${
                              selectedDeptId === jdep.id ? 'bg-indigo-50/40 border-l-4 border-indigo-600 pl-4' : ''
                            }`}
                          >
                            <p className="font-bold text-slate-900">Junior High School</p>
                            <span className="inline-block text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider mt-1.5">
                              JHS Level
                            </span>
                          </button>
                        </li>
                      );
                    })()
                  )}
                  {departments.find(d => d.level === 'SHS') && (
                    (() => {
                      const sdep = departments.find(d => d.level === 'SHS');
                      return (
                        <li key={sdep.id}>
                          <button 
                            onClick={() => {
                              setSelectedDeptId(sdep.id);
                              setEditingFaculty(null);
                            }}
                            className={`w-full text-left p-5 hover:bg-slate-50/50 transition-all ${
                              selectedDeptId === sdep.id ? 'bg-indigo-50/40 border-l-4 border-indigo-600 pl-4' : ''
                            }`}
                          >
                            <p className="font-bold text-slate-900">Senior High School</p>
                            <span className="inline-block text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider mt-1.5">
                              SHS Level
                            </span>
                          </button>
                        </li>
                      );
                    })()
                  )}

                  {/* College and Graduate customizable departments */}
                  {departments
                    .filter(d => d.level === 'COLLEGE' || d.level === 'GRADUATE')
                    .map(dep => (
                      <li key={dep.id}>
                        <button 
                          onClick={() => {
                            setSelectedDeptId(dep.id);
                            setEditingFaculty(null);
                          }}
                          className={`w-full text-left p-5 hover:bg-slate-50/50 transition-all ${
                            selectedDeptId === dep.id ? 'bg-indigo-50/40 border-l-4 border-indigo-600 pl-4' : ''
                          }`}
                        >
                          <p className="font-bold text-slate-900">{dep.name}</p>
                          <span className="inline-block text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider mt-1.5">
                            {dep.level}
                          </span>
                        </button>
                      </li>
                    ))}
                </>
              )}
            </ul>
          </div>

          {/* Right Column: Selected Department Hub */}
          <div className="lg:col-span-2 space-y-6">
            {!selectedDeptId ? (
              <div className="h-[450px] border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center p-8 bg-white/50">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-2xl mb-4 text-slate-400">📂</div>
                <h3 className="font-bold text-slate-800 text-lg">No Department Selected</h3>
                <p className="text-sm text-slate-500 max-w-sm mt-1">
                  Please select a department from the left column to configure its sections and faculty.
                </p>
              </div>
            ) : detailsLoading ? (
              <div className="h-[450px] bg-white border border-slate-200/85 rounded-2xl flex items-center justify-center animate-pulse">
                <p className="text-slate-400 font-semibold">Loading department data workspace...</p>
              </div>
            ) : deptDetails ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-visible">
                
                {/* Department Header */}
                <div className="p-6 border-b border-slate-100 bg-slate-50/40 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{deptDetails.name}</h2>
                    <span className="inline-block text-xs bg-slate-100 border border-slate-200 text-slate-600 px-3 py-1 rounded-full font-bold uppercase mt-1">
                      Level: {deptDetails.level}
                    </span>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {activeTab === 'sections' ? (
                      <button 
                        onClick={() => setShowSectionForm(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10"
                      >
                        + Add Year & Section
                      </button>
                    ) : (
                      <button 
                        onClick={() => setShowFacultyForm(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10"
                      >
                        + Add Faculty
                      </button>
                    )}
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-100/50 border-b border-slate-100 p-2 gap-2">
                  <button 
                    onClick={() => setActiveTab('sections')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border ${
                      activeTab === 'sections' 
                        ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
                        : 'bg-white border-slate-200/60 text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    Year & Sections ({deptDetails.sections?.length || 0})
                  </button>
                  <button 
                    onClick={() => setActiveTab('faculty')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border ${
                      activeTab === 'faculty' 
                        ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
                        : 'bg-white border-slate-200/60 text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    Faculty Management ({deptDetails.professors?.length || 0})
                  </button>
                </div>

                {/* Tab content */}
                <div className="p-6">
                  
                  {/* 1. SECTIONS TAB */}
                  {activeTab === 'sections' && (
                    <div className="space-y-6">
                      
                      {/* Inline Section Add Form */}
                      {showSectionForm && (
                        <form onSubmit={handleAddSection} className="p-4 border border-indigo-100 bg-indigo-50/30 rounded-xl space-y-3">
                          <h4 className="text-sm font-bold text-indigo-950">Add Section to {deptDetails.name}</h4>
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              value={newSectionName}
                              onChange={(e) => setNewSectionName(e.target.value)}
                              placeholder="e.g. 4-A or Grade 11-STEM B"
                              className="flex-grow p-2 text-sm border rounded-lg bg-white"
                              required
                            />
                            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-lg hover:bg-indigo-700">
                              Save
                            </button>
                            <button 
                              type="button" 
                              onClick={() => setShowSectionForm(false)}
                              className="px-3 py-2 bg-white border text-slate-600 font-bold text-xs rounded-lg hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Sections List */}
                      {deptDetails.sections.length === 0 ? (
                        <p className="text-center text-slate-400 text-sm py-12">No sections added to this department yet.</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {deptDetails.sections.map((sec: any) => (
                            <div key={sec.id} className="p-4 border border-slate-200/60 bg-slate-50/50 rounded-xl flex items-center justify-between">
                              <span className="font-bold text-slate-800 text-sm">{sec.name}</span>
                              <span className="text-[10px] bg-slate-200/60 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase">
                                SEC
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. FACULTY TAB */}
                  {activeTab === 'faculty' && (
                    <div className="space-y-6">
                      
                      {/* Inline Faculty Add Form */}
                      {showFacultyForm && (
                        <form onSubmit={handleAddFaculty} className="p-4 border border-indigo-100 bg-indigo-50/30 rounded-xl space-y-4">
                          <h4 className="text-sm font-bold text-indigo-950">Add Faculty to {deptDetails.name}</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Faculty Name</label>
                              <input 
                                type="text"
                                value={newFacultyName}
                                onChange={(e) => setNewFacultyName(e.target.value)}
                                placeholder="e.g. Ms. Alice Cooper"
                                className="w-full p-2 text-sm border rounded-lg bg-white"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Email (@ua.edu.ph)</label>
                              <input 
                                type="email"
                                value={newFacultyEmail}
                                onChange={(e) => setNewFacultyEmail(e.target.value)}
                                placeholder="alice.cooper@ua.edu.ph"
                                className="w-full p-2 text-sm border rounded-lg bg-white"
                                required
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button 
                              type="button" 
                              onClick={() => setShowFacultyForm(false)}
                              className="px-4 py-2 bg-white border text-slate-600 font-bold text-xs rounded-lg hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-lg hover:bg-indigo-700">
                              Add Faculty Member
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Edit Modal (Inline/Overlay display) */}
                      {editingFaculty && (
                        <form onSubmit={handleSaveEditFaculty} className="p-5 border-2 border-indigo-600 bg-slate-900 text-white rounded-xl space-y-5">
                          <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
                            <h4 className="text-md font-bold text-slate-200">Edit Faculty & Sections</h4>
                            <span className="text-xs text-slate-500 font-mono">ID: {editingFaculty.id}</span>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-slate-400 mb-1.5">Faculty Name</label>
                              <input 
                                type="text"
                                value={editFacultyName}
                                onChange={(e) => setEditFacultyName(e.target.value)}
                                className="w-full p-2.5 text-sm border border-slate-800 rounded-lg bg-slate-950 text-slate-200"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-400 mb-1.5">Email Address</label>
                              <input 
                                type="email"
                                value={editFacultyEmail}
                                onChange={(e) => setEditFacultyEmail(e.target.value)}
                                className="w-full p-2.5 text-sm border border-slate-800 rounded-lg bg-slate-950 text-slate-200"
                                required
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-400">Map Teaching Sections</label>
                            {deptDetails.sections.length === 0 ? (
                              <p className="text-xs text-slate-500 italic">No sections exist in this department. Create sections first.</p>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-950 rounded-lg max-h-40 overflow-y-auto">
                                {deptDetails.sections.map((sec: any) => (
                                  <label key={sec.id} className="flex items-center space-x-2 cursor-pointer p-1.5 hover:bg-slate-900 rounded-md transition-all">
                                    <input 
                                      type="checkbox"
                                      checked={editSelectedSections.includes(sec.id)}
                                      onChange={(e) => handleCheckboxChange(sec.id, e.target.checked)}
                                      className="h-4 w-4 text-indigo-600 rounded bg-slate-900 border-slate-700"
                                    />
                                    <span className="text-xs font-semibold text-slate-300">{sec.name}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                            <button 
                              type="button" 
                              onClick={() => setEditingFaculty(null)}
                              className="px-4 py-2 bg-transparent text-slate-400 hover:text-white font-bold text-xs rounded-lg transition"
                            >
                              Cancel
                            </button>
                            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-lg hover:bg-indigo-700 transition">
                              Save Changes
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Faculty Table list */}
                      {deptDetails.professors.length === 0 ? (
                        <p className="text-center text-slate-400 text-sm py-12">No faculty members registered in this department yet.</p>
                      ) : (
                        <div className="overflow-visible border border-slate-100 rounded-xl">
                          <table className="w-full text-left border-collapse text-sm">
                            <thead className="bg-slate-50">
                              <tr className="border-b">
                                <th 
                                  onClick={() => handleSort('name')}
                                  className="p-4 font-bold text-slate-700 cursor-pointer hover:bg-slate-150 select-none"
                                >
                                  Name {sortField === 'name' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                                </th>
                                <th 
                                  onClick={() => handleSort('email')}
                                  className="p-4 font-bold text-slate-700 cursor-pointer hover:bg-slate-150 select-none"
                                >
                                  Email {sortField === 'email' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                                </th>
                                <th className="p-4 font-bold text-slate-700 select-none">Assigned Sections</th>
                                <th className="p-4 font-bold text-slate-700 text-right select-none">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {[...(deptDetails.professors || [])].sort((a, b) => {
                                let valA = (sortField === 'name' ? a.name : a.email) || '';
                                let valB = (sortField === 'name' ? b.name : b.email) || '';
                                if (valA.toLowerCase() < valB.toLowerCase()) return sortDirection === 'asc' ? -1 : 1;
                                if (valA.toLowerCase() > valB.toLowerCase()) return sortDirection === 'asc' ? 1 : -1;
                                return 0;
                              }).map((prof: any) => (
                                <tr key={prof.id} className="hover:bg-slate-50/50">
                                  <td className="p-4 font-bold text-slate-900">{prof.name}</td>
                                  <td className="p-4 text-slate-600 text-xs">{prof.email}</td>
                                  <td className="p-4 text-slate-600 text-xs">
                                    {prof.sections?.length > 0 ? (
                                      <div className="flex flex-wrap gap-1.5">
                                        {prof.sections.map((s: any) => (
                                          <span key={s.id} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full font-bold text-[10px]">
                                            {s.name}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 italic">No assigned classes</span>
                                    )}
                                  </td>
                                  <td className="p-4 text-right relative">
                                    <div className="inline-block text-left">
                                      <button 
                                        onClick={() => setActiveKebabId(activeKebabId === prof.id ? null : prof.id)}
                                        className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition-all font-bold text-xs"
                                      >
                                        Actions ⋮
                                      </button>
                                      
                                      {activeKebabId === prof.id && (
                                        <>
                                          <div className="fixed inset-0 z-10" onClick={() => setActiveKebabId(null)} />
                                          <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-20 animate-fade-in text-left">
                                            <button 
                                              onClick={() => {
                                                setActiveKebabId(null);
                                                handleStartEditFaculty(prof);
                                              }}
                                              className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                                            >
                                              Edit / Link Sections
                                            </button>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
