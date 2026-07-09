'use client';

import { useEffect, useState } from 'react';
import { getDepartments, createDepartment } from '@/app/actions/admin';
import { EducationLevel } from '@prisma/client';
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
  const [newFacultySelectedSections, setNewFacultySelectedSections] = useState<string[]>([]);

  const [editingFaculty, setEditingFaculty] = useState<any | null>(null);
  const [editFacultyName, setEditFacultyName] = useState('');
  const [editFacultyEmail, setEditFacultyEmail] = useState('');
  const [editSelectedSections, setEditSelectedSections] = useState<string[]>([]);

  // Department Form state
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptLevel, setNewDeptLevel] = useState<EducationLevel>('COLLEGE');

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
  const loadDeps = async () => {
    setLoading(true);
    const data = await getDepartments();
    setDepartments(data);
    setLoading(false);
  };

  // Load departments on mount
  useEffect(() => {
    loadDeps();
  }, []);

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    setErrorMessage('');
    setMessage('');
    try {
      await createDepartment(newDeptName.trim(), newDeptLevel);
      setNewDeptName('');
      setShowDeptForm(false);
      setMessage("Department created successfully!");
      await loadDeps();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create department");
    }
  };
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
      await createProfessor(newFacultyName, newFacultyEmail, selectedDeptId, newFacultySelectedSections);
      setNewFacultyName('');
      setNewFacultyEmail('');
      setNewFacultySelectedSections([]);
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
            Faculty & Dept Management
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-semibold">
            Configure year levels, sections, and link faculty instructors to courses
          </p>
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
          <div className="p-5 border-b border-slate-100 bg-slate-50/40 flex justify-between items-center">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Select Department</h2>
            <button 
              onClick={() => setShowDeptForm(!showDeptForm)}
              className="text-[11px] font-bold text-ua-blue hover:text-indigo-850 hover:underline cursor-pointer"
            >
              {showDeptForm ? 'Cancel' : '+ Add'}
            </button>
          </div>

          {showDeptForm && (
            <form onSubmit={handleAddDepartment} className="p-4 border-b border-slate-150 bg-slate-50/70 space-y-3 animate-fade-in">
              <div>
                <label className="block text-[9px] font-bold text-slate-450 uppercase tracking-wider mb-1">Department Name</label>
                <input 
                  type="text"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="e.g. Computer Studies"
                  className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-ua-blue transition-all outline-none font-semibold text-slate-800"
                  required
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-450 uppercase tracking-wider mb-1">Education Level</label>
                <select 
                  value={newDeptLevel}
                  onChange={(e) => setNewDeptLevel(e.target.value as EducationLevel)}
                  className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-white outline-none font-bold text-slate-700"
                >
                  <option value="COLLEGE">COLLEGE</option>
                  <option value="GRADUATE">GRADUATE</option>
                  <option value="SHS">SHS</option>
                  <option value="JHS">JHS</option>
                </select>
              </div>
              <div className="flex justify-end gap-1.5 pt-1">
                <button 
                  type="button" 
                  onClick={() => setShowDeptForm(false)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 font-bold text-[10px] rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button type="submit" className="px-2.5 py-1.5 bg-ua-blue hover:bg-ua-blue-dark text-white font-bold text-[10px] rounded-lg shadow-sm cursor-pointer">
                  Save
                </button>
              </div>
            </form>
          )}

          <ul className="divide-y divide-slate-100">
            {loading ? (
              <li className="p-8 text-center text-slate-400 font-semibold animate-pulse">Syncing...</li>
            ) : (
              <>
                {/* Standard JHS/SHS Levels (Not customizable departments) */}
                {departments.find(d => d.level === 'JHS') && (
                  (() => {
                    const jdep = departments.find(d => d.level === 'JHS');
                    const isActive = selectedDeptId === jdep.id;
                    return (
                      <li key={jdep.id}>
                        <button 
                          onClick={() => {
                            setSelectedDeptId(jdep.id);
                            setEditingFaculty(null);
                          }}
                          className={`w-full text-left p-5 hover:bg-slate-50/50 transition-all border-l-4 ${
                            isActive 
                              ? 'bg-ua-blue/5 border-ua-blue pl-4 text-ua-blue font-bold shadow-inner' 
                              : 'border-transparent pl-5 text-slate-700 font-medium'
                          }`}
                        >
                          <p className="font-bold text-sm">Junior High School</p>
                          <span className="inline-block text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider mt-1.5">
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
                    const isActive = selectedDeptId === sdep.id;
                    return (
                      <li key={sdep.id}>
                        <button 
                          onClick={() => {
                            setSelectedDeptId(sdep.id);
                            setEditingFaculty(null);
                          }}
                          className={`w-full text-left p-5 hover:bg-slate-50/50 transition-all border-l-4 ${
                            isActive 
                              ? 'bg-ua-blue/5 border-ua-blue pl-4 text-ua-blue font-bold shadow-inner' 
                              : 'border-transparent pl-5 text-slate-700 font-medium'
                          }`}
                        >
                          <p className="font-bold text-sm">Senior High School</p>
                          <span className="inline-block text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider mt-1.5">
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
                  .map(dep => {
                    const isActive = selectedDeptId === dep.id;
                    return (
                      <li key={dep.id}>
                        <button 
                          onClick={() => {
                            setSelectedDeptId(dep.id);
                            setEditingFaculty(null);
                          }}
                          className={`w-full text-left p-5 hover:bg-slate-50/50 transition-all border-l-4 ${
                            isActive 
                              ? 'bg-ua-blue/5 border-ua-blue pl-4 text-ua-blue font-bold shadow-inner' 
                              : 'border-transparent pl-5 text-slate-700 font-medium'
                          }`}
                        >
                          <p className="font-bold text-sm">{dep.name}</p>
                          <span className="inline-block text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider mt-1.5">
                            {dep.level}
                          </span>
                        </button>
                      </li>
                    );
                  })}
              </>
            )}
          </ul>
        </div>

        {/* Right Column: Selected Department Hub */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedDeptId ? (
            <div className="h-[450px] border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center p-8 bg-white shadow-sm">
              <div className="w-16 h-16 bg-slate-100 text-ua-blue/30 rounded-full flex items-center justify-center text-xs font-bold mb-4 shadow-inner">DEPT</div>
              <h3 className="font-bold text-slate-800 text-base">No Department Selected</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
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
                  <h2 className="text-xl font-black text-slate-900">{deptDetails.name}</h2>
                  <span className="inline-block text-[10px] bg-ua-blue/5 border border-ua-blue/10 text-ua-blue px-3 py-1 rounded-full font-bold uppercase mt-1">
                    Level: {deptDetails.level}
                  </span>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                  {activeTab === 'sections' ? (
                    <button 
                      onClick={() => setShowSectionForm(true)}
                      className="px-4 py-2.5 bg-ua-blue hover:bg-ua-blue-dark text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-ua-blue/10 cursor-pointer"
                    >
                      + Add Year & Section
                    </button>
                  ) : (
                    <button 
                      onClick={() => setShowFacultyForm(true)}
                      className="px-4 py-2.5 bg-ua-blue hover:bg-ua-blue-dark text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-ua-blue/10 cursor-pointer"
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
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
                    activeTab === 'sections' 
                      ? 'bg-ua-blue border-ua-blue text-white shadow-sm font-bold' 
                      : 'bg-white border-slate-200/60 text-slate-655 hover:text-slate-800'
                  }`}
                >
                  Year & Sections ({deptDetails.sections?.length || 0})
                </button>
                <button 
                  onClick={() => setActiveTab('faculty')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
                    activeTab === 'faculty' 
                      ? 'bg-ua-blue border-ua-blue text-white shadow-sm font-bold' 
                      : 'bg-white border-slate-200/60 text-slate-655 hover:text-slate-800'
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
                      <form onSubmit={handleAddSection} className="p-4 border border-ua-blue/10 bg-ua-blue/5 rounded-xl space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-ua-blue-dark">Add Section to {deptDetails.name}</h4>
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            value={newSectionName}
                            onChange={(e) => setNewSectionName(e.target.value)}
                            placeholder="e.g. 4-A or Grade 11-STEM B"
                            className="flex-grow p-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-ua-blue/20 focus:border-ua-blue transition-all"
                            required
                          />
                          <button type="submit" className="px-4 py-2 bg-ua-blue hover:bg-ua-blue-dark text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer">
                            Save
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setShowSectionForm(false)}
                            className="px-3 py-2 bg-white border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Sections List */}
                    {deptDetails.sections.length === 0 ? (
                      <div className="p-12 text-center flex flex-col items-center justify-center space-y-3 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-400 mb-2 shadow-inner">SEC</div>
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">No sections added to this department yet.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {deptDetails.sections.map((sec: any) => (
                          <div key={sec.id} className="p-4 border border-slate-200/60 bg-slate-50/50 rounded-xl flex items-center justify-between shadow-sm hover:shadow transition-all duration-200 bg-white">
                            <span className="font-bold text-slate-800 text-sm">{sec.name}</span>
                            <span className="text-[9px] bg-slate-200/60 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase">
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
                      <form onSubmit={handleAddFaculty} className="p-4 border border-ua-blue/10 bg-ua-blue/5 rounded-xl space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-ua-blue-dark">Add Faculty to {deptDetails.name}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Faculty Name</label>
                            <input 
                              type="text"
                              value={newFacultyName}
                              onChange={(e) => setNewFacultyName(e.target.value)}
                              placeholder="e.g. Ms. Alice Cooper"
                              className="w-full p-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-ua-blue/20 focus:border-ua-blue transition-all font-semibold"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Email (@ua.edu.ph)</label>
                            <input 
                              type="email"
                              value={newFacultyEmail}
                              onChange={(e) => setNewFacultyEmail(e.target.value)}
                              placeholder="alice.cooper@ua.edu.ph"
                              className="w-full p-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-ua-blue/20 focus:border-ua-blue transition-all font-semibold"
                              required
                            />
                          </div>
                        </div>
                        <div className="space-y-2 text-left">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assign Year & Sections</label>
                          {deptDetails.sections.length === 0 ? (
                            <p className="text-xs text-slate-450 italic">No sections exist in this department. Create sections first.</p>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-white border border-slate-200/60 rounded-xl max-h-40 overflow-y-auto">
                              {deptDetails.sections.map((sec: any) => (
                                <label key={sec.id} className="flex items-center space-x-2.5 cursor-pointer p-1.5 hover:bg-slate-50 rounded-lg transition-all text-slate-700">
                                  <input 
                                    type="checkbox"
                                    checked={newFacultySelectedSections.includes(sec.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setNewFacultySelectedSections(prev => [...prev, sec.id]);
                                      } else {
                                        setNewFacultySelectedSections(prev => prev.filter(id => id !== sec.id));
                                      }
                                    }}
                                    className="h-4 w-4 text-[#002366] rounded border-slate-300 focus:ring-[#002366]"
                                  />
                                  <span className="text-xs font-bold">{sec.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex justify-end gap-2">
                          <button 
                            type="button" 
                            onClick={() => setShowFacultyForm(false)}
                            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button type="submit" className="px-4 py-2.5 bg-ua-blue hover:bg-ua-blue-dark text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer">
                            Add Faculty Member
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Edit Modal (Inline/Overlay display) */}
                    {editingFaculty && (
                      <form onSubmit={handleSaveEditFaculty} className="p-6 border-2 border-ua-gold bg-ua-blue text-white rounded-xl space-y-5 shadow-xl">
                        <div className="border-b border-ua-blue-dark/50 pb-3 flex justify-between items-center">
                          <h4 className="text-sm font-bold uppercase tracking-wider text-ua-gold">Edit Faculty & Sections</h4>
                          <span className="text-[10px] text-white/50 font-mono">ID: {editingFaculty.id}</span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">Faculty Name</label>
                            <input 
                              type="text"
                              value={editFacultyName}
                              onChange={(e) => setEditFacultyName(e.target.value)}
                              className="w-full p-2.5 text-sm border border-white/10 rounded-xl bg-ua-blue-dark/50 text-white focus:ring-2 focus:ring-ua-gold/30 focus:border-ua-gold font-bold"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">Email Address</label>
                            <input 
                              type="email"
                              value={editFacultyEmail}
                              onChange={(e) => setEditFacultyEmail(e.target.value)}
                              className="w-full p-2.5 text-sm border border-white/10 rounded-xl bg-ua-blue-dark/50 text-white focus:ring-2 focus:ring-ua-gold/30 focus:border-ua-gold font-bold"
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider">Map Teaching Sections</label>
                          {deptDetails.sections.length === 0 ? (
                            <p className="text-xs text-white/50 italic">No sections exist in this department. Create sections first.</p>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-ua-blue-dark/40 rounded-xl max-h-40 overflow-y-auto border border-white/5">
                              {deptDetails.sections.map((sec: any) => (
                                <label key={sec.id} className="flex items-center space-x-2.5 cursor-pointer p-1.5 hover:bg-ua-blue-dark/30 rounded-lg transition-all">
                                  <input 
                                    type="checkbox"
                                    checked={editSelectedSections.includes(sec.id)}
                                    onChange={(e) => handleCheckboxChange(sec.id, e.target.checked)}
                                    className="h-4 w-4 text-ua-gold rounded bg-ua-blue-dark/50 border-white/20 focus:ring-ua-gold/50"
                                  />
                                  <span className="text-xs font-bold text-slate-200">{sec.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                          <button 
                            type="button" 
                            onClick={() => setEditingFaculty(null)}
                            className="px-4 py-2 bg-transparent text-white/70 hover:text-white font-bold text-xs rounded-xl transition cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button type="submit" className="px-4 py-2.5 bg-ua-gold hover:bg-ua-gold-dark text-ua-blue-dark font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer">
                            Save Changes
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Faculty Table list */}
                    {deptDetails.professors.length === 0 ? (
                      <div className="p-12 text-center flex flex-col items-center justify-center space-y-3 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-400 mb-2 shadow-inner">PROF</div>
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">No faculty members registered in this department yet.</p>
                      </div>
                    ) : (
                      <div className="overflow-visible border border-slate-100 rounded-xl">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-655 font-bold">
                            <tr>
                              <th 
                                onClick={() => handleSort('name')}
                                className="p-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-200/50 select-none text-slate-600"
                              >
                                Name {sortField === 'name' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                              </th>
                              <th 
                                onClick={() => handleSort('email')}
                                className="p-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-200/50 select-none text-slate-600"
                              >
                                Email {sortField === 'email' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                              </th>
                              <th className="p-4 text-xs font-bold uppercase tracking-wider select-none text-slate-500">Assigned Sections</th>
                              <th className="p-4 text-xs font-bold uppercase tracking-wider text-right select-none text-slate-500">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {[...(deptDetails.professors || [])].sort((a, b) => {
                              let valA = (sortField === 'name' ? a.name : a.email) || '';
                              let valB = (sortField === 'name' ? b.name : b.email) || '';
                              if (valA.toLowerCase() < valB.toLowerCase()) return sortDirection === 'asc' ? -1 : 1;
                              if (valA.toLowerCase() > valB.toLowerCase()) return sortDirection === 'asc' ? 1 : -1;
                              return 0;
                            }).map((prof: any) => (
                              <tr key={prof.id} className="hover:bg-slate-50/50">
                                <td className="p-4 font-bold text-slate-900">
                                  <Link 
                                    href={`/admin/faculty/${prof.id}`}
                                    className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                                  >
                                    {prof.name}
                                  </Link>
                                </td>
                                <td className="p-4 text-slate-600 text-xs font-semibold">{prof.email}</td>
                                <td className="p-4 text-slate-600 text-xs">
                                  {prof.sections?.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {prof.sections.map((s: any) => (
                                        <span key={s.id} className="px-2.5 py-0.5 bg-ua-blue/5 border border-ua-blue/10 text-ua-blue rounded-full font-bold text-[9px]">
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
                                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition-all font-bold text-xs cursor-pointer"
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
                                            className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
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
  );
}
