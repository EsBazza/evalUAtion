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
import { FolderKanban, Plus, UserPlus, FileText, CheckSquare, Settings, ArrowUp, ArrowDown, Edit3 } from 'lucide-react';

// UA Primitives
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui-ua/card';
import { Button } from '@/components/ui-ua/button';
import { toast } from '@/components/ui-ua/toast';
import { Modal } from '@/components/ui-ua/modal';
import { cn } from '@/lib/utils';

export default function FacultyDepartmentManagement() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [deptDetails, setDeptDetails] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'sections' | 'faculty'>('sections');
  
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Modal visibility states
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [isFacultyModalOpen, setIsFacultyModalOpen] = useState(false);
  const [isEditFacultyModalOpen, setIsEditFacultyModalOpen] = useState(false);

  // Form input states
  const [newSectionName, setNewSectionName] = useState('');
  
  const [newFacultyName, setNewFacultyName] = useState('');
  const [newFacultyEmail, setNewFacultyEmail] = useState('');
  const [newSelectedSections, setNewSelectedSections] = useState<string[]>([]);

  const [editingFaculty, setEditingFaculty] = useState<any | null>(null);
  const [editFacultyName, setEditFacultyName] = useState('');
  const [editFacultyEmail, setEditFacultyEmail] = useState('');
  const [editSelectedSections, setEditSelectedSections] = useState<string[]>([]);

  // Department Form state
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptLevel, setNewDeptLevel] = useState<EducationLevel>('COLLEGE');

  // Sorting and action menus
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
    try {
      const data = await getDepartments();
      setDepartments(data);
    } catch (err) {
      toast.error("Failed to load departments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeps();
  }, []);

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    try {
      await createDepartment(newDeptName.trim(), newDeptLevel);
      setNewDeptName('');
      setIsDeptModalOpen(false);
      toast.success("Department created successfully!");
      await loadDeps();
    } catch (err: any) {
      toast.error(err.message || "Failed to create department");
    }
  };

  const loadDeptDetails = async (id: string) => {
    setDetailsLoading(true);
    try {
      const data = await getDepartmentDetails(id);
      setDeptDetails(data);
    } catch (err: any) {
      toast.error("Failed to load department details");
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
    try {
      await createSection(newSectionName, selectedDeptId);
      setNewSectionName('');
      setIsSectionModalOpen(false);
      toast.success("Section created successfully!");
      loadDeptDetails(selectedDeptId);
    } catch (err: any) {
      toast.error(err.message || "Failed to create section");
    }
  };

  const handleAddFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptId || !newFacultyName.trim() || !newFacultyEmail.trim()) return;
    try {
      await createProfessor(newFacultyName, newFacultyEmail, selectedDeptId, newSelectedSections);
      setNewFacultyName('');
      setNewFacultyEmail('');
      setNewSelectedSections([]);
      setIsFacultyModalOpen(false);
      toast.success("Faculty created successfully!");
      loadDeptDetails(selectedDeptId);
    } catch (err: any) {
      toast.error(err.message || "Failed to create faculty");
    }
  };

  const handleStartEditFaculty = (prof: any) => {
    setEditingFaculty(prof);
    setEditFacultyName(prof.name);
    setEditFacultyEmail(prof.email);
    setEditSelectedSections(prof.sections.map((s: any) => s.id));
    setIsEditFacultyModalOpen(true);
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
    try {
      await updateProfessor(
        editingFaculty.id,
        editFacultyName,
        editFacultyEmail,
        editSelectedSections
      );
      setEditingFaculty(null);
      setIsEditFacultyModalOpen(false);
      toast.success("Faculty details and sections updated!");
      if (selectedDeptId) {
        loadDeptDetails(selectedDeptId);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update faculty");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border/80 bg-transparent">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground tracking-wide uppercase">
            Faculty & Dept Management
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-semibold">
            Configure year levels, sections, and link faculty instructors to courses
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Departments List */}
        <Card className="h-fit">
          <CardHeader className="p-5 border-b border-border/40 bg-muted/10 flex flex-row justify-between items-center">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Division</CardTitle>
            <Button 
              uaVariant="ghost" 
              onClick={() => setIsDeptModalOpen(true)}
              className="h-8 px-2 text-xs text-ua-navy dark:text-ua-gold"
            >
              + Add
            </Button>
          </CardHeader>
          <ul className="divide-y divide-border/40">
            {loading ? (
              <li className="p-8 text-center text-muted-foreground font-semibold animate-pulse">Syncing...</li>
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
                          className={cn(
                            "w-full text-left p-5 hover:bg-muted/30 transition-all border-l-4 outline-none",
                            isActive 
                              ? 'bg-ua-navy/5 border-ua-gold pl-4 text-ua-navy dark:text-ua-gold font-bold' 
                              : 'border-transparent pl-5 text-foreground font-medium'
                          )}
                        >
                          <p className="text-sm">Junior High School</p>
                          <span className="inline-block text-[9px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold uppercase tracking-wider mt-1.5">
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
                          className={cn(
                            "w-full text-left p-5 hover:bg-muted/30 transition-all border-l-4 outline-none",
                            isActive 
                              ? 'bg-ua-navy/5 border-ua-gold pl-4 text-ua-navy dark:text-ua-gold font-bold' 
                              : 'border-transparent pl-5 text-foreground font-medium'
                          )}
                        >
                          <p className="text-sm">Senior High School</p>
                          <span className="inline-block text-[9px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold uppercase tracking-wider mt-1.5">
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
                          className={cn(
                            "w-full text-left p-5 hover:bg-muted/30 transition-all border-l-4 outline-none",
                            isActive 
                              ? 'bg-ua-navy/5 border-ua-gold pl-4 text-ua-navy dark:text-ua-gold font-bold' 
                              : 'border-transparent pl-5 text-foreground font-medium'
                          )}
                        >
                          <p className="text-sm">{dep.name}</p>
                          <span className="inline-block text-[9px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold uppercase tracking-wider mt-1.5">
                            {dep.level}
                          </span>
                        </button>
                      </li>
                    );
                  })}
              </>
            )}
          </ul>
        </Card>

        {/* Right Column: Selected Department Hub */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedDeptId ? (
            <div className="h-[450px] border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center text-center p-8 bg-card shadow-sm">
              <FolderKanban className="size-10 text-muted-foreground/30 mb-4" />
              <h3 className="font-bold text-foreground text-base">No Division Selected</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">
                Please select a department or level from the left column to configure its sections and faculty.
              </p>
            </div>
          ) : detailsLoading ? (
            <div className="h-[450px] bg-card border border-border rounded-lg flex items-center justify-center animate-pulse shadow-sm">
              <p className="text-muted-foreground font-semibold">Loading department data workspace...</p>
            </div>
          ) : deptDetails ? (
            <Card className="overflow-visible border border-border/80">
              
              {/* Department Header */}
              <CardHeader className="p-6 border-b border-border/40 bg-muted/10 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <h2 className="font-serif text-xl font-bold text-foreground">{deptDetails.name}</h2>
                  <span className="inline-block text-[10px] bg-ua-navy/5 border border-ua-navy/10 text-ua-navy dark:bg-ua-gold/15 dark:text-ua-gold dark:border-ua-gold/20 px-3 py-1 rounded-full font-bold uppercase mt-1">
                    Level: {deptDetails.level}
                  </span>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                  {activeTab === 'sections' ? (
                    <Button 
                      onClick={() => setIsSectionModalOpen(true)}
                      uaVariant="primary"
                      className="h-10 text-xs"
                    >
                      <Plus className="size-4 mr-1.5" />
                      Add Year & Section
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => setIsFacultyModalOpen(true)}
                      uaVariant="primary"
                      className="h-10 text-xs"
                    >
                      <UserPlus className="size-4 mr-1.5" />
                      Add Faculty
                    </Button>
                  )}
                </div>
              </CardHeader>

              {/* Tab Selector */}
              <div className="flex bg-muted/40 border-b border-border/45 p-2 gap-2">
                <Button 
                  onClick={() => setActiveTab('sections')}
                  uaVariant={activeTab === 'sections' ? 'primary' : 'ghost'}
                  className="h-9 text-xs"
                >
                  Year & Sections ({deptDetails.sections?.length || 0})
                </Button>
                <Button 
                  onClick={() => setActiveTab('faculty')}
                  uaVariant={activeTab === 'faculty' ? 'primary' : 'ghost'}
                  className="h-9 text-xs"
                >
                  Faculty Management ({deptDetails.professors?.length || 0})
                </Button>
              </div>

              {/* Tab content */}
              <CardContent className="p-6">
                
                {/* 1. SECTIONS TAB */}
                {activeTab === 'sections' && (
                  <div className="space-y-6">
                    {deptDetails.sections.length === 0 ? (
                      <div className="p-12 text-center flex flex-col items-center justify-center space-y-3 bg-muted/10 rounded-lg border border-dashed border-border">
                        <FolderKanban className="size-8 text-muted-foreground/30 mb-2" />
                        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">No sections added to this department yet.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {deptDetails.sections.map((sec: any) => (
                          <div key={sec.id} className="p-4 border border-border bg-card rounded-lg flex items-center justify-between shadow-sm hover:shadow transition-all duration-200">
                            <span className="font-bold text-foreground text-sm">{sec.name}</span>
                            <span className="text-[9px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold uppercase">
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
                    {deptDetails.professors.length === 0 ? (
                      <div className="p-12 text-center flex flex-col items-center justify-center space-y-3 bg-muted/10 rounded-lg border border-dashed border-border">
                        <UserPlus className="size-8 text-muted-foreground/30 mb-2" />
                        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">No faculty members registered in this department yet.</p>
                      </div>
                    ) : (
                      <div className="overflow-visible border border-border rounded-lg bg-card">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead className="bg-muted/30 border-b border-border/50 text-muted-foreground font-bold">
                            <tr>
                              <th 
                                onClick={() => handleSort('name')}
                                className="p-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-muted/50 select-none"
                              >
                                Name {sortField === 'name' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                              </th>
                              <th 
                                onClick={() => handleSort('email')}
                                className="p-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-muted/50 select-none"
                              >
                                Email {sortField === 'email' ? (sortDirection === 'asc' ? '▴' : '▾') : '⇅'}
                              </th>
                              <th className="p-4 text-xs font-bold uppercase tracking-wider select-none">Assigned Sections</th>
                              <th className="p-4 text-xs font-bold uppercase tracking-wider text-right select-none">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40 text-foreground">
                            {[...(deptDetails.professors || [])].sort((a, b) => {
                              let valA = (sortField === 'name' ? a.name : a.email) || '';
                              let valB = (sortField === 'name' ? b.name : b.email) || '';
                              if (valA.toLowerCase() < valB.toLowerCase()) return sortDirection === 'asc' ? -1 : 1;
                              if (valA.toLowerCase() > valB.toLowerCase()) return sortDirection === 'asc' ? 1 : -1;
                              return 0;
                            }).map((prof: any) => (
                              <tr key={prof.id} className="hover:bg-muted/10 transition-all">
                                <td className="p-4 font-bold">
                                  <Link 
                                    href={`/admin/faculty/${prof.id}`}
                                    className="text-ua-navy dark:text-ua-gold hover:underline cursor-pointer"
                                  >
                                    {prof.name}
                                  </Link>
                                </td>
                                <td className="p-4 text-muted-foreground text-xs font-semibold">{prof.email}</td>
                                <td className="p-4 text-muted-foreground text-xs">
                                  {prof.sections?.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {prof.sections.map((s: any) => (
                                        <span key={s.id} className="px-2.5 py-0.5 bg-ua-navy/5 border border-ua-navy/10 text-ua-navy dark:bg-ua-gold/15 dark:text-ua-gold dark:border-ua-gold/20 rounded-full font-bold text-[9px]">
                                          {s.name}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground/60 italic">No assigned classes</span>
                                  )}
                                </td>
                                <td className="p-4 text-right relative kebab-container">
                                  <Button 
                                    onClick={() => handleStartEditFaculty(prof)}
                                    uaVariant="outline"
                                    className="h-8 text-xs px-2.5"
                                  >
                                    <Edit3 className="size-3 mr-1" />
                                    Edit
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {/* ==================================================== */}
      {/* MODALS FOR INTERACTION */}
      {/* ==================================================== */}

      {/* 1. Add Department Modal */}
      <Modal
        isOpen={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        title="Add Department / Level"
        footer={
          <>
            <Button uaVariant="ghost" onClick={() => setIsDeptModalOpen(false)}>Cancel</Button>
            <Button uaVariant="primary" onClick={handleAddDepartment}>Save Department</Button>
          </>
        }
      >
        <form onSubmit={handleAddDepartment} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Department Name</label>
            <input 
              type="text"
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              placeholder="e.g. Computer Studies"
              className="w-full h-11 px-3 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-semibold"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Education Level</label>
            <select 
              value={newDeptLevel}
              onChange={(e) => setNewDeptLevel(e.target.value as EducationLevel)}
              className="w-full h-11 px-3 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-bold"
            >
              <option value="COLLEGE">COLLEGE</option>
              <option value="GRADUATE">GRADUATE</option>
              <option value="SHS">SHS (Senior High)</option>
              <option value="JHS">JHS (Junior High)</option>
            </select>
          </div>
        </form>
      </Modal>

      {/* 2. Add Section Modal */}
      {deptDetails && (
        <Modal
          isOpen={isSectionModalOpen}
          onClose={() => setIsSectionModalOpen(false)}
          title={`Add Section to ${deptDetails.name}`}
          footer={
            <>
              <Button uaVariant="ghost" onClick={() => setIsSectionModalOpen(false)}>Cancel</Button>
              <Button uaVariant="primary" onClick={handleAddSection}>Save Section</Button>
            </>
          }
        >
          <form onSubmit={handleAddSection} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Section Name</label>
              <input 
                type="text"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="e.g. BSCS 4-A or Grade 11-STEM B"
                className="w-full h-11 px-3 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-semibold"
                required
                autoFocus
              />
            </div>
          </form>
        </Modal>
      )}

      {/* 3. Add Faculty Modal */}
      {deptDetails && (
        <Modal
          isOpen={isFacultyModalOpen}
          onClose={() => setIsFacultyModalOpen(false)}
          title={`Add Faculty to ${deptDetails.name}`}
          footer={
            <>
              <Button uaVariant="ghost" onClick={() => setIsFacultyModalOpen(false)}>Cancel</Button>
              <Button uaVariant="primary" onClick={handleAddFaculty}>Add Faculty Member</Button>
            </>
          }
        >
          <form onSubmit={handleAddFaculty} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Faculty Name</label>
              <input 
                type="text"
                value={newFacultyName}
                onChange={(e) => setNewFacultyName(e.target.value)}
                placeholder="e.g. Ms. Alice Cooper"
                className="w-full h-11 px-3 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-semibold"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Email (@ua.edu.ph)</label>
              <input 
                type="email"
                value={newFacultyEmail}
                onChange={(e) => setNewFacultyEmail(e.target.value)}
                placeholder="alice.cooper@ua.edu.ph"
                className="w-full h-11 px-3 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-semibold"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">Map Teaching Sections</label>
              {deptDetails.sections.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No sections exist in this department. Create sections first.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/20 border border-border rounded-lg max-h-48 overflow-y-auto">
                  {deptDetails.sections.map((sec: any) => (
                    <label key={sec.id} className="flex items-center space-x-2.5 cursor-pointer p-1.5 hover:bg-muted/40 rounded transition-all">
                      <input 
                        type="checkbox"
                        checked={newSelectedSections.includes(sec.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (checked) {
                            setNewSelectedSections(prev => [...prev, sec.id]);
                          } else {
                            setNewSelectedSections(prev => prev.filter(id => id !== sec.id));
                          }
                        }}
                        className="h-4 w-4 text-ua-navy dark:text-ua-gold rounded bg-card border-border focus:ring-ua-gold/30"
                      />
                      <span className="text-xs font-bold text-foreground">{sec.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </form>
        </Modal>
      )}

      {/* 4. Edit Faculty Details / Link Sections Modal */}
      {deptDetails && editingFaculty && (
        <Modal
          isOpen={isEditFacultyModalOpen}
          onClose={() => setIsEditFacultyModalOpen(false)}
          title="Edit Faculty & Section Mappings"
          footer={
            <>
              <Button uaVariant="ghost" onClick={() => setIsEditFacultyModalOpen(false)}>Cancel</Button>
              <Button uaVariant="primary" onClick={handleSaveEditFaculty}>Save Changes</Button>
            </>
          }
        >
          <form onSubmit={handleSaveEditFaculty} className="space-y-4 text-left">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Faculty Name</label>
                <input 
                  type="text"
                  value={editFacultyName}
                  onChange={(e) => setEditFacultyName(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Email Address</label>
                <input 
                  type="email"
                  value={editFacultyEmail}
                  onChange={(e) => setEditFacultyEmail(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-bold"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">Map Teaching Sections</label>
              {deptDetails.sections.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No sections exist in this department. Create sections first.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/20 border border-border rounded-lg max-h-48 overflow-y-auto">
                  {deptDetails.sections.map((sec: any) => (
                    <label key={sec.id} className="flex items-center space-x-2.5 cursor-pointer p-1.5 hover:bg-muted/40 rounded transition-all">
                      <input 
                        type="checkbox"
                        checked={editSelectedSections.includes(sec.id)}
                        onChange={(e) => handleCheckboxChange(sec.id, e.target.checked)}
                        className="h-4 w-4 text-ua-navy dark:text-ua-gold rounded bg-card border-border focus:ring-ua-gold/30"
                      />
                      <span className="text-xs font-bold text-foreground">{sec.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
