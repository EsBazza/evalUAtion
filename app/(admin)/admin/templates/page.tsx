'use client';

import { useEffect, useState } from 'react';
import { getTemplates, getDepartments } from '@/app/actions/admin';
import { createTemplateAction, deleteTemplateAction, setActiveTemplateAction, deactivateTemplateAction } from '@/app/actions/templates';
import { EducationLevel } from '@prisma/client';
import Link from 'next/link';
import { Trash2, Edit, Play, Power, HelpCircle, FileText, Upload, Plus, ChevronRight, Layers } from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';

// UA Primitives
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui-ua/card';
import { Button } from '@/components/ui-ua/button';
import { toast } from '@/components/ui-ua/toast';
import { Modal } from '@/components/ui-ua/modal';
import { cn } from '@/lib/utils';

export default function TemplatesDashboard() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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
      toast.error("Failed to load template data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.kebab-container')) {
        setActiveKebabId(null);
      }
    };

    if (activeKebabId) {
      document.addEventListener('click', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [activeKebabId]);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const newTemp = await createTemplateAction(title, level, departmentId || undefined);
      setTitle('');
      setDepartmentId('');
      setShowCreateForm(false);
      toast.success("Template created successfully! Redirecting to editor...");
      loadTemplates();
      setTimeout(() => {
        window.location.href = `/admin/templates/${newTemp.id}`;
      }, 1000);
    } catch (err: any) {
      toast.error(err.message || "Failed to create template");
    }
  };

  const handleImportTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile || !importTitle.trim() || !importLevel) return;

    const fileName = importFile.name.toLowerCase();
    if (!fileName.endsWith('.docx') && !fileName.endsWith('.txt')) {
      toast.error("Unsupported file type. Only .docx and .txt files are accepted.");
      return;
    }

    if (importFile.size > 5 * 1024 * 1024) {
      toast.error("File is too large. Maximum allowed size is 5 MB.");
      return;
    }

    setImportLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('title', importTitle);
      formData.append('level', importLevel);

      const response = await fetch('/api/templates/import', {
        method: 'POST',
        body: formData,
      });
      const res = await response.json();
      if (!response.ok) {
        throw new Error(res.error || "Failed to parse document using AI");
      }
      
      if (res.success) {
        setShowImportModal(false);
        setImportTitle('');
        setImportFile(null);
        toast.success("Document parsed successfully by AI! Redirecting to editor...");
        loadTemplates();
        setTimeout(() => {
          window.location.href = `/admin/templates/${res.templateId}`;
        }, 1000);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to parse document using AI");
    } finally {
      setImportLoading(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template? All nested questions will be lost.")) return;
    try {
      await deleteTemplateAction(id);
      toast.success("Template deleted successfully!");
      loadTemplates();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete template");
    }
  };

  const handleOpenSetActiveModal = (temp: any) => {
    setActiveModalTemplate(temp);
    setActivationType('GLOBAL');
    setOverrideDeptId('');
  };

  const handleConfirmActivation = async () => {
    if (!activeModalTemplate) return;
    try {
      await setActiveTemplateAction(
        activeModalTemplate.id, 
        activationType, 
        activationType === 'OVERRIDE' ? overrideDeptId : undefined
      );
      if (activationType === 'OVERRIDE') {
        toast.success("Template cloned and activated for department.");
      } else {
        toast.success(`Template activated globally!`);
      }
      setActiveModalTemplate(null);
      loadTemplates();
    } catch (err: any) {
      toast.error(err.message || "Failed to activate template");
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this template?")) return;
    try {
      await deactivateTemplateAction(id);
      toast.success("Template successfully deactivated.");
      loadTemplates();
    } catch (err: any) {
      toast.error(err.message || "Failed to deactivate template");
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
    <LayoutGroup>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border/80 bg-transparent">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground tracking-wide uppercase">
              Evaluation Templates
            </h1>
            <p className="text-xs text-muted-foreground mt-1 font-semibold">
              Build and customize dynamic evaluation sheets for JHS, SHS, and College
            </p>
          </div>
          {/* Action Buttons */}
          <div className="flex gap-2 self-stretch sm:self-auto justify-end">
            <Button 
              uaVariant="accent"
              onClick={() => setShowImportModal(true)}
              className="h-10 text-xs"
            >
              <Upload className="size-4 mr-2" />
              AI Import
            </Button>
            <Button 
              uaVariant="primary"
              onClick={() => setShowCreateForm(true)}
              className="h-10 text-xs"
            >
              <Plus className="size-4 mr-2" />
              Create Template
            </Button>
          </div>
        </div>

        {/* Inline Create Form Modal */}
        <Modal
          isOpen={showCreateForm}
          onClose={() => setShowCreateForm(false)}
          title="New Evaluation Template"
          footer={
            <>
              <Button uaVariant="ghost" onClick={() => setShowCreateForm(false)}>Cancel</Button>
              <Button uaVariant="primary" onClick={handleCreateTemplate}>Initialize & Open Editor</Button>
            </>
          }
        >
          <form onSubmit={handleCreateTemplate} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Template Title</label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. COLLEGE OF COMPUTER STUDIES - SEMESTER 1" 
                className="w-full h-11 px-3 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-semibold"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Education Level</label>
              <select 
                value={level}
                onChange={(e) => {
                  const nextLvl = e.target.value as EducationLevel;
                  setLevel(nextLvl);
                  setDepartmentId('');
                }}
                className="w-full h-11 px-3 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-bold"
              >
                <option value="JHS">JHS (Junior High School)</option>
                <option value="SHS">SHS (Senior High School)</option>
                <option value="COLLEGE">COLLEGE</option>
                <option value="GRADUATE">GRADUATE</option>
              </select>
            </div>
            {(level === 'COLLEGE' || level === 'GRADUATE') && (
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Department (Optional)</label>
                <select 
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full h-11 px-3 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-bold"
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
          </form>
        </Modal>

        {/* AI Import Modal */}
        <Modal
          isOpen={showImportModal}
          onClose={() => { if (!importLoading) setShowImportModal(false); }}
          title="AI-Powered Document Import"
          footer={
            !importLoading && (
              <>
                <Button uaVariant="ghost" onClick={() => setShowImportModal(false)}>Cancel</Button>
                <Button uaVariant="primary" onClick={handleImportTemplate}>Start AI Parsing</Button>
              </>
            )
          }
        >
          <form onSubmit={handleImportTemplate} className="space-y-4 text-left">
            {importLoading ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-ua-navy border-t-transparent dark:border-ua-gold" />
                <p className="text-sm font-bold text-foreground">AI is analyzing document...</p>
                <p className="text-xs text-muted-foreground max-w-xs text-center leading-relaxed">
                  Extracting evaluation clusters, questions, and scoring fields using Gemini.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Template Title</label>
                  <input 
                    type="text" 
                    value={importTitle}
                    onChange={(e) => setImportTitle(e.target.value)}
                    placeholder="e.g. COLLEGE OF COMPUTER STUDIES - EVALUATION SHEET" 
                    className="w-full h-11 px-3 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-semibold"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Education Level</label>
                    <select 
                      value={importLevel}
                      onChange={(e) => setImportLevel(e.target.value as EducationLevel)}
                      className="w-full h-11 px-3 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-bold"
                    >
                      <option value="JHS">JHS (Junior High School)</option>
                      <option value="SHS">SHS (Senior High School)</option>
                      <option value="COLLEGE">COLLEGE</option>
                      <option value="GRADUATE">GRADUATE</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Select File (.docx or .txt only, max 5 MB)</label>
                    <input 
                      type="file" 
                      accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,application/msword,.txt,text/plain"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          setImportFile(e.target.files[0]);
                        }
                      }}
                      className="w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-muted file:text-foreground hover:file:bg-muted/80 file:cursor-pointer border rounded-lg p-1 bg-card focus:outline-none"
                      required
                    />
                  </div>
                </div>
              </>
            )}
          </form>
        </Modal>

        {/* Templates List */}
        {loading ? (
          <div className="py-20 text-center text-muted-foreground font-semibold animate-pulse bg-card border border-border/80 rounded-lg shadow-sm">
            Syncing templates...
          </div>
        ) : templates.length === 0 ? (
          <div className="h-[250px] border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center text-center p-8 bg-card shadow-sm">
            <Layers className="size-10 text-muted-foreground/30 mb-4" />
            <h3 className="font-bold text-foreground text-base">No Templates Configured</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">
              Add your first evaluation template using the "+ Create Template" button at the top right.
            </p>
          </div>
        ) : (
          <Card className="overflow-hidden border border-border/85">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-muted/30 border-b border-border/50 text-muted-foreground font-bold">
                  <tr>
                    <th 
                      onClick={() => handleSort('title')}
                      className="p-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-muted/50 select-none"
                    >
                      Template Name {sortField === 'title' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                    </th>
                    <th 
                      onClick={() => handleSort('level')}
                      className="p-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-muted/50 select-none"
                    >
                      Education Level {sortField === 'level' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                    </th>
                    <th 
                      onClick={() => handleSort('department')}
                      className="p-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-muted/50 select-none"
                    >
                      Department {sortField === 'department' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                    </th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider select-none">
                      Criterion Clusters
                    </th>
                    <th 
                      onClick={() => handleSort('status')}
                      className="p-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-muted/50 select-none"
                    >
                      Status {sortField === 'status' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                    </th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-right select-none">Actions</th>
                  </tr>
                </thead>
                <motion.tbody className="divide-y divide-border/40 text-foreground">
                  <AnimatePresence initial={false}>
                    {sortedTemplates.map((temp, index) => {
                      const isLastRow = index === sortedTemplates.length - 1;
                      return (
                        <motion.tr 
                          key={temp.id} 
                          layout
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ duration: 0.15 }}
                          className="hover:bg-muted/10 transition-all"
                        >
                          <td className="p-4 font-bold text-foreground">{temp.title}</td>
                          <td className="p-4 text-muted-foreground font-bold uppercase text-xs">{temp.level}</td>
                          <td className="p-4 text-muted-foreground font-semibold">
                            {temp.department?.name || <span className="text-muted-foreground/60 italic text-xs font-medium">Global</span>}
                          </td>
                          <td className="p-4">
                            <span className="inline-block px-2.5 py-0.5 bg-ua-navy/5 border border-ua-navy/10 text-ua-navy dark:bg-ua-gold/15 dark:text-ua-gold dark:border-ua-gold/20 rounded-full font-bold text-xs">
                              {temp.clusters?.length || 0} Clusters
                            </span>
                          </td>
                          <td className="p-4">
                            {temp.isActive ? (
                              <span className="inline-block px-2.5 py-0.5 bg-emerald-50 border border-emerald-150 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400 rounded-full font-bold text-xs shadow-sm">Active</span>
                            ) : (
                              <span className="inline-block px-2.5 py-0.5 bg-muted border border-border text-muted-foreground rounded-full font-semibold text-xs">Draft</span>
                            )}
                          </td>
                          <td className="p-4 text-right relative">
                            <div className="inline-block text-left kebab-container">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveKebabId(activeKebabId === temp.id ? null : temp.id);
                                }}
                                className="px-2.5 py-1.5 bg-card hover:bg-muted border border-border rounded-lg text-muted-foreground hover:text-foreground transition-all font-bold text-xs cursor-pointer select-none"
                              >
                                Actions ⋮
                              </button>
                              
                              {activeKebabId === temp.id && (
                                <div className={cn(
                                  "absolute right-0 w-44 bg-card border border-border rounded-xl shadow-lg py-1.5 z-20 animate-fade-in text-left",
                                  isLastRow && sortedTemplates.length > 1 ? 'bottom-full mb-1' : 'mt-1'
                                )}>
                                  <Link 
                                    href={`/admin/templates/${temp.id}`}
                                    className="block w-full text-left px-4 py-2 text-xs font-bold text-foreground hover:bg-muted/80 transition"
                                  >
                                    Open Builder
                                  </Link>
                                  
                                  {temp.isActive ? (
                                    <button 
                                      onClick={() => {
                                        setActiveKebabId(null);
                                        handleDeactivate(temp.id);
                                      }}
                                      className="w-full text-left px-4 py-2 text-xs font-bold text-ua-crimson hover:bg-ua-crimson/5 transition cursor-pointer"
                                    >
                                      Deactivate
                                    </button>
                                  ) : (
                                    <button 
                                      onClick={() => {
                                        setActiveKebabId(null);
                                        handleOpenSetActiveModal(temp);
                                      }}
                                      className="w-full text-left px-4 py-2 text-xs font-bold text-ua-navy dark:text-ua-gold hover:bg-muted/80 transition cursor-pointer"
                                    >
                                      Set Active
                                    </button>
                                  )}
                                  
                                  <div className="border-t border-border/40 my-1" />
                                  
                                  <button 
                                    onClick={() => {
                                      setActiveKebabId(null);
                                      handleDeleteTemplate(temp.id);
                                    }}
                                    className="w-full text-left px-4 py-2 text-xs font-bold text-ua-crimson hover:bg-ua-crimson/5 transition cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </motion.tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Activation Target Selection Modal */}
        {activeModalTemplate && (
          <Modal
            isOpen={!!activeModalTemplate}
            onClose={() => setActiveModalTemplate(null)}
            title="Activate Form Template"
            footer={
              <>
                <Button uaVariant="ghost" onClick={() => setActiveModalTemplate(null)}>Cancel</Button>
                <Button 
                  uaVariant="primary" 
                  onClick={handleConfirmActivation}
                  disabled={activationType === 'OVERRIDE' && !overrideDeptId}
                >
                  Confirm Activation
                </Button>
              </>
            }
          >
            <div className="space-y-4 text-left">
              <h4 className="font-serif text-sm font-bold text-foreground">{activeModalTemplate.title}</h4>
              
              {/* JHS or SHS Flow */}
              {(activeModalTemplate.level === 'JHS' || activeModalTemplate.level === 'SHS') ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This template is configured for <strong className="text-ua-navy dark:text-ua-gold font-bold uppercase text-[10px] px-2 py-0.5 bg-muted border border-border rounded-full">{activeModalTemplate.level}</strong> level.
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Activating this will automatically set it as the active evaluation form for <strong>all {activeModalTemplate.level}</strong> students. Any currently active template for this level will be deactivated.
                  </p>
                </div>
              ) : (
                
                /* College or Graduate Flow */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Activation Scope</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setActivationType('GLOBAL');
                          setOverrideDeptId('');
                        }}
                        className={cn(
                          "p-3 border rounded-xl text-left transition cursor-pointer outline-none",
                          activationType === 'GLOBAL' 
                            ? 'border-ua-navy bg-ua-navy/5 dark:border-ua-gold dark:bg-ua-gold/5 ring-1 ring-ua-gold/20' 
                            : 'border-border hover:bg-muted'
                        )}
                      >
                        <span className="font-bold text-xs text-foreground block">Global Activation</span>
                        <span className="text-[10px] text-muted-foreground mt-1 block leading-relaxed">Active across all departments in the level</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivationType('OVERRIDE')}
                        className={cn(
                          "p-3 border rounded-xl text-left transition cursor-pointer outline-none",
                          activationType === 'OVERRIDE' 
                            ? 'border-ua-navy bg-ua-navy/5 dark:border-ua-gold dark:bg-ua-gold/5 ring-1 ring-ua-gold/20' 
                            : 'border-border hover:bg-muted'
                        )}
                      >
                        <span className="font-bold text-xs text-foreground block">Department Override</span>
                        <span className="text-[10px] text-muted-foreground mt-1 block leading-relaxed">Create a cloned copy assigned strictly to one department</span>
                      </button>
                    </div>
                  </div>

                  {activationType === 'OVERRIDE' && (
                    <div className="space-y-2 pt-2">
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">Select Override Department</label>
                      <select 
                        value={overrideDeptId}
                        onChange={(e) => setOverrideDeptId(e.target.value)}
                        className="w-full h-11 px-3 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-bold"
                      >
                        <option value="">Choose department...</option>
                        {departments
                          .filter(d => d.level === activeModalTemplate.level)
                          .map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))
                        }
                      </select>
                      <p className="text-[10px] text-ua-crimson leading-relaxed font-bold">
                        This will create a cloned copy of this template, append the department name to its title, and mark it active specifically for that department.
                      </p>
                    </div>
                  )}

                  {activationType === 'GLOBAL' && (
                    <p className="text-xs text-muted-foreground leading-relaxed bg-muted/20 p-3 rounded-lg border border-border">
                      This template will become the base default form for all students under the {activeModalTemplate.level} level. Any currently active templates for this level that do not have specific department overrides will be deactivated.
                    </p>
                  )}
                </div>
              )}
            </div>
          </Modal>
        )}
      </div>
    </LayoutGroup>
  );
}
