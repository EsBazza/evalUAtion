'use client';

import { useEffect, useState } from 'react';
import { getTemplates, getDepartments } from '@/app/actions/admin';
import { createTemplateAction, deleteTemplateAction, setActiveTemplateAction, deactivateTemplateAction } from '@/app/actions/templates';
import { importTemplateFromFile } from '@/app/actions/importTemplate';
import { EducationLevel } from '@prisma/client';
import Link from 'next/link';

export default function TemplatesDashboard() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Form states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState<EducationLevel>('COLLEGE');
  const [departmentId, setDepartmentId] = useState('');

  // AI Import Form states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTitle, setImportTitle] = useState('');
  const [importLevel, setImportLevel] = useState<EducationLevel>('COLLEGE');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  
  // Activation modal states
  const [activeModalTemplate, setActiveModalTemplate] = useState<any | null>(null);
  const [activationType, setActivationType] = useState<'GLOBAL' | 'OVERRIDE'>('GLOBAL');
  const [overrideDeptId, setOverrideDeptId] = useState('');

  // Sorting states
  const [sortField, setSortField] = useState<string>('title');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Kebab state
  const [activeKebabId, setActiveKebabId] = useState<string | null>(null);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await getTemplates();
      setTemplates(data);
      const deps = await getDepartments();
      setDepartments(deps);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setErrorMessage('');
    setMessage('');
    try {
      const newTemp = await createTemplateAction(title, level, departmentId || undefined);
      setTitle('');
      setDepartmentId('');
      setShowCreateForm(false);
      setMessage("Template created successfully! Redirecting to editor...");
      loadTemplates();
      // Redirect to the newly created template editor after a brief delay
      setTimeout(() => {
        window.location.href = `/admin/templates/${newTemp.id}`;
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create template");
    }
  };

  const handleImportTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile || !importTitle.trim() || !importLevel) return;

    const fileName = importFile.name.toLowerCase();
    if (!fileName.endsWith('.docx') && !fileName.endsWith('.pdf') && !fileName.endsWith('.txt')) {
      setErrorMessage("Unsupported file type. Please upload a .docx, .pdf, or .txt file.");
      return;
    }

    setImportLoading(true);
    setErrorMessage('');
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('title', importTitle);
      formData.append('level', importLevel);

      const res = await importTemplateFromFile(formData);
      if (res.success) {
        setShowImportModal(false);
        setImportTitle('');
        setImportFile(null);
        setMessage("Document parsed successfully by AI! Redirecting to editor...");
        loadTemplates();
        setTimeout(() => {
          window.location.href = `/admin/templates/${res.templateId}`;
        }, 1000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to parse document using AI");
    } finally {
      setImportLoading(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template? All nested questions and criteria will be lost.")) return;
    setErrorMessage('');
    setMessage('');
    try {
      await deleteTemplateAction(id);
      setMessage("Template deleted successfully!");
      loadTemplates();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to delete template");
    }
  };

  const handleOpenSetActiveModal = (temp: any) => {
    setActiveModalTemplate(temp);
    setActivationType('GLOBAL');
    setOverrideDeptId('');
  };

  const handleConfirmActivation = async () => {
    if (!activeModalTemplate) return;
    setErrorMessage('');
    setMessage('');
    try {
      await setActiveTemplateAction(
        activeModalTemplate.id, 
        activationType, 
        activationType === 'OVERRIDE' ? overrideDeptId : undefined
      );
      if (activationType === 'OVERRIDE') {
        setMessage("Template successfully cloned and activated for the selected department.");
      } else {
        setMessage(`Template "${activeModalTemplate.title}" activated globally successfully!`);
      }
      setActiveModalTemplate(null);
      loadTemplates();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to activate template");
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this template? Students will not be able to evaluate under this template until another is activated.")) return;
    setErrorMessage('');
    setMessage('');
    try {
      await deactivateTemplateAction(id);
      setMessage("Template successfully deactivated.");
      loadTemplates();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to deactivate template");
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

  const sortedTemplates = [...templates].sort((a, b) => {
    let valA = '';
    let valB = '';

    if (sortField === 'title') {
      valA = a.title || '';
      valB = b.title || '';
    } else if (sortField === 'level') {
      valA = a.level || '';
      valB = b.level || '';
    } else if (sortField === 'department') {
      valA = a.department?.name || '';
      valB = b.department?.name || '';
    } else if (sortField === 'status') {
      valA = a.isActive ? 'active' : 'draft';
      valB = b.isActive ? 'active' : 'draft';
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
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-gray-200">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="bg-indigo-600 text-white px-3 py-1 rounded-xl text-2xl font-extrabold shadow-sm">UA</span>
              evalUAtion Templates
            </h1>
            <p className="text-sm text-slate-500 mt-1.5 font-medium">Build and customize dynamic evaluation sheets for JHS, SHS, and College</p>
          </div>
          <div className="flex gap-2">
            <Link 
              href="/admin"
              className="px-4 py-2.5 text-xs font-bold bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 uppercase tracking-wider transition-all flex items-center"
            >
              Back to Dashboard
            </Link>
            <button 
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <span>✨ AI Import (.docx)</span>
            </button>
            <button 
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
            >
              + Create Template
            </button>
          </div>
        </div>

        {/* Global Notifications */}
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

        {/* Inline Create Form */}
        {showCreateForm && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm max-w-xl mx-auto space-y-5">
            <h2 className="text-lg font-bold text-slate-800 border-b pb-3">New Evaluation Template</h2>
            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Template Title</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. COLLEGE OF COMPUTER STUDIES - SEMESTER 1" 
                  className="w-full p-2.5 border rounded-xl text-sm bg-slate-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Education Level</label>
                <select 
                  value={level}
                  onChange={(e) => {
                    const nextLvl = e.target.value as EducationLevel;
                    setLevel(nextLvl);
                    setDepartmentId('');
                  }}
                  className="w-full p-2.5 border rounded-xl text-sm bg-slate-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                >
                  <option value="JHS">JHS (Junior High School)</option>
                  <option value="SHS">SHS (Senior High School)</option>
                  <option value="COLLEGE">COLLEGE</option>
                  <option value="GRADUATE">GRADUATE</option>
                </select>
              </div>
              {(level === 'COLLEGE' || level === 'GRADUATE') && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Department (Optional)</label>
                  <select 
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-sm bg-slate-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                  >
                    <option value="">Global Template (No Department)</option>
                    {departments
                      .filter((d) => d.level === level)
                      .map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 bg-transparent text-slate-500 hover:text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all">
                  Initialize & Open Editor
                </button>
              </div>
            </form>
          </div>
        )}

        {/* AI Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">✨ AI-Powered Document Import</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Upload a .docx, .pdf, or .txt evaluation sheet to parse automatically using Gemini AI</p>
                </div>
                <button 
                  onClick={() => { if (!importLoading) setShowImportModal(false); }}
                  className="text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 rounded-full w-7 h-7 flex items-center justify-center transition"
                  disabled={importLoading}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleImportTemplate} className="p-6 space-y-4">
                {importLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600" />
                    <p className="text-sm font-bold text-slate-700">AI is analyzing document...</p>
                    <p className="text-xs text-slate-400">Extracting evaluation clusters, questions, and scoring fields using Gemini.</p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Template Title</label>
                      <input 
                        type="text" 
                        value={importTitle}
                        onChange={(e) => setImportTitle(e.target.value)}
                        placeholder="e.g. COLLEGE OF COMPUTER STUDIES - EVALUATION SHEET" 
                        className="w-full p-2.5 border rounded-xl text-sm bg-slate-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Education Level</label>
                        <select 
                          value={importLevel}
                          onChange={(e) => setImportLevel(e.target.value as EducationLevel)}
                          className="w-full p-2.5 border rounded-xl text-sm bg-slate-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                        >
                          <option value="JHS">JHS (Junior High School)</option>
                          <option value="SHS">SHS (Senior High School)</option>
                          <option value="COLLEGE">COLLEGE</option>
                          <option value="GRADUATE">GRADUATE</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Select File (.docx, .pdf, .txt)</label>
                        <input 
                          type="file" 
                          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,application/pdf,.txt,text/plain"
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              setImportFile(e.target.files[0]);
                            }
                          }}
                          className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 file:cursor-pointer cursor-pointer border rounded-xl p-1 bg-slate-50/50"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                      <button 
                        type="button"
                        onClick={() => setShowImportModal(false)}
                        className="px-4 py-2 bg-transparent text-slate-500 hover:text-slate-700 font-bold text-xs rounded-xl transition"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer"
                      >
                        Start AI Parsing
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Templates List */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 font-semibold animate-pulse">Syncing templates...</div>
        ) : templates.length === 0 ? (
          <div className="h-[250px] border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center p-8 bg-white">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-xl mb-4 text-slate-400">📝</div>
            <h3 className="font-bold text-slate-800 text-base">No Templates Configured</h3>
            <p className="text-sm text-slate-500 max-w-sm mt-1">
              Add your first evaluation template using the "+ Create Template" button at the top right.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-visible">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th 
                    onClick={() => handleSort('title')}
                    className="p-4 font-bold text-slate-700 uppercase tracking-wider text-xs cursor-pointer hover:bg-slate-100 select-none"
                  >
                    Template Name {sortField === 'title' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                  </th>
                  <th 
                    onClick={() => handleSort('level')}
                    className="p-4 font-bold text-slate-700 uppercase tracking-wider text-xs cursor-pointer hover:bg-slate-100 select-none"
                  >
                    Education Level {sortField === 'level' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                  </th>
                  <th 
                    onClick={() => handleSort('department')}
                    className="p-4 font-bold text-slate-700 uppercase tracking-wider text-xs cursor-pointer hover:bg-slate-100 select-none"
                  >
                    Department {sortField === 'department' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                  </th>
                  <th className="p-4 font-bold text-slate-700 uppercase tracking-wider text-xs select-none">
                    Criterion Clusters
                  </th>
                  <th 
                    onClick={() => handleSort('status')}
                    className="p-4 font-bold text-slate-700 uppercase tracking-wider text-xs cursor-pointer hover:bg-slate-100 select-none"
                  >
                    Status {sortField === 'status' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                  </th>
                  <th className="p-4 font-bold text-slate-700 uppercase tracking-wider text-xs text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedTemplates.map((temp) => (
                  <tr key={temp.id} className="hover:bg-slate-50/30 transition-all">
                    <td className="p-4 font-bold text-slate-900">{temp.title}</td>
                    <td className="p-4 text-slate-600 font-semibold uppercase text-xs">{temp.level}</td>
                    <td className="p-4 text-slate-600">{temp.department?.name || <span className="text-slate-400 italic text-xs">Global</span>}</td>
                    <td className="p-4">
                      <span className="inline-block px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full font-bold text-xs">
                        {temp.clusters?.length || 0} Clusters
                      </span>
                    </td>
                    <td className="p-4">
                      {temp.isActive ? (
                        <span className="inline-block px-2.5 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-full font-bold text-xs">Active</span>
                      ) : (
                        <span className="inline-block px-2.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-full font-semibold text-xs">Draft</span>
                      )}
                    </td>
                    <td className="p-4 text-right relative">
                      <div className="inline-block text-left">
                        <button 
                          onClick={() => setActiveKebabId(activeKebabId === temp.id ? null : temp.id)}
                          className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition-all font-bold text-xs"
                        >
                          Actions ⋮
                        </button>
                        
                        {activeKebabId === temp.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setActiveKebabId(null)} />
                            <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-20 animate-fade-in text-left">
                              <Link 
                                href={`/admin/templates/${temp.id}`}
                                className="block w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                              >
                                Open Builder
                              </Link>
                              
                              {temp.isActive ? (
                                <button 
                                  onClick={() => {
                                    setActiveKebabId(null);
                                    handleDeactivate(temp.id);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 transition"
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button 
                                  onClick={() => {
                                    setActiveKebabId(null);
                                    handleOpenSetActiveModal(temp);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition"
                                >
                                  Set Active
                                </button>
                              )}
                              
                              <div className="border-t border-slate-100 my-1" />
                              
                              <button 
                                onClick={() => {
                                  setActiveKebabId(null);
                                  handleDeleteTemplate(temp.id);
                                }}
                                className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 transition"
                              >
                                Delete
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

        {/* Activation Target Selection Modal */}
        {activeModalTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
              
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">Activate Form Template</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{activeModalTemplate.title}</p>
                </div>
                <button 
                  onClick={() => setActiveModalTemplate(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 rounded-full w-7 h-7 flex items-center justify-center transition"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-5 flex-grow">
                
                {/* JHS or SHS Flow */}
                {(activeModalTemplate.level === 'JHS' || activeModalTemplate.level === 'SHS') ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600 leading-relaxed font-semibold">
                      This template is configured for <strong className="text-slate-800 font-bold uppercase text-[10px] px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full">{activeModalTemplate.level}</strong> level.
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Activating this will automatically set it as the active evaluation form for <strong>all {activeModalTemplate.level}</strong> students. Any currently active template for this level will be deactivated.
                    </p>
                  </div>
                ) : (
                  
                  /* College or Graduate Flow */
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Activation Type</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setActivationType('GLOBAL');
                            setOverrideDeptId('');
                          }}
                          className={`p-3 border rounded-xl text-left transition cursor-pointer ${
                            activationType === 'GLOBAL' 
                              ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-500/10' 
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className="font-extrabold text-xs text-slate-900 block">🌍 Global Activation</span>
                          <span className="text-[10px] text-slate-500 mt-1 block">Active across all departments in the level</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActivationType('OVERRIDE')}
                          className={`p-3 border rounded-xl text-left transition cursor-pointer ${
                            activationType === 'OVERRIDE' 
                              ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-500/10' 
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className="font-extrabold text-xs text-slate-900 block">🏢 Department Override (Clone)</span>
                          <span className="text-[10px] text-slate-500 mt-1 block">Create a cloned copy assigned strictly to one department</span>
                        </button>
                      </div>
                    </div>

                    {activationType === 'OVERRIDE' && (
                      <div className="space-y-2 pt-2 animate-fade-in">
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Select Override Department</label>
                        <select 
                          value={overrideDeptId}
                          onChange={(e) => setOverrideDeptId(e.target.value)}
                          className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold text-slate-800"
                        >
                          <option value="">Choose department...</option>
                          {departments
                            .filter(d => d.level === activeModalTemplate.level)
                            .map((d) => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))
                          }
                        </select>
                        <p className="text-[10px] text-amber-600 leading-relaxed font-medium">
                          ⚠️ This will create a cloned copy of this template, append the department name to its title, and mark it active specifically for that department.
                        </p>
                      </div>
                    )}

                    {activationType === 'GLOBAL' && (
                      <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 font-semibold">
                        This template will become the base default form for all students under the {activeModalTemplate.level} level. Any currently active templates for this level that do not have specific department overrides will be deactivated.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t flex justify-end gap-2">
                <button 
                  onClick={() => setActiveModalTemplate(null)}
                  className="px-4 py-2 bg-transparent text-slate-500 hover:text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmActivation}
                  disabled={activationType === 'OVERRIDE' && !overrideDeptId}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-md shadow-indigo-600/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Confirm Activation
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
