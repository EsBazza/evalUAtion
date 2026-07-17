'use client';

import { useEffect, useState } from 'react';
import { getDepartments, createDepartment } from '@/app/actions/admin';
import { EducationLevel } from '@prisma/client';
import { 
  getDepartmentDetails, 
  createSection, 
  createProfessor, 
  updateProfessor,
  deleteSection,
  deleteFaculty,
  createSubject,
  deleteSubject,
  updateSection,
  updateSubject,
  updateDepartment,
  deleteDepartment
} from '@/app/actions/management';
import Link from 'next/link';
import { FolderKanban, Plus, UserPlus, FileText, CheckSquare, Settings, ArrowUp, ArrowDown, Edit3, Trash2, BookOpen } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'sections' | 'subjects' | 'faculty'>('sections');
  
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Modal visibility states
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [isEditSectionModalOpen, setIsEditSectionModalOpen] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isEditSubjectModalOpen, setIsEditSubjectModalOpen] = useState(false);
  const [isFacultyModalOpen, setIsFacultyModalOpen] = useState(false);
  const [isEditFacultyModalOpen, setIsEditFacultyModalOpen] = useState(false);

  // Form input states
  const [newSectionName, setNewSectionName] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  
  const [newFacultyName, setNewFacultyName] = useState('');
  const [newFacultyEmail, setNewFacultyEmail] = useState('');
  const [newTeachingAssignments, setNewTeachingAssignments] = useState<{ sectionId: string; subjectId: string }[]>([]);
  const [isAddingNewMapping, setIsAddingNewMapping] = useState(false);
  const [newTempSectionId, setNewTempSectionId] = useState('');
  const [newTempSubjectId, setNewTempSubjectId] = useState('');

  const [editingFaculty, setEditingFaculty] = useState<any | null>(null);
  const [editFacultyName, setEditFacultyName] = useState('');
  const [editFacultyEmail, setEditFacultyEmail] = useState('');
  const [editTeachingAssignments, setEditTeachingAssignments] = useState<{ sectionId: string; subjectId: string }[]>([]);
  const [isAddingEditMapping, setIsAddingEditMapping] = useState(false);
  const [editTempSectionId, setEditTempSectionId] = useState('');
  const [editTempSubjectId, setEditTempSubjectId] = useState('');

  const [editingSection, setEditingSection] = useState<any | null>(null);
  const [editSectionName, setEditSectionName] = useState('');

  const [editingSubject, setEditingSubject] = useState<any | null>(null);
  const [editSubjectName, setEditSubjectName] = useState('');
  const [editSubjectCode, setEditSubjectCode] = useState('');

  // Department Form state
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptLevel, setNewDeptLevel] = useState<EducationLevel>('COLLEGE');

  // Edit Department Form state
  const [isEditDeptModalOpen, setIsEditDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<any | null>(null);
  const [editDeptName, setEditDeptName] = useState('');
  const [editDeptLevel, setEditDeptLevel] = useState<EducationLevel>('COLLEGE');

  const handleStartEditDept = (dep: any) => {
    setEditingDept(dep);
    setEditDeptName(dep.name);
    setEditDeptLevel(dep.level);
    setIsEditDeptModalOpen(true);
  };

  const handleSaveEditDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept || !editDeptName.trim()) return;
    try {
      await updateDepartment(editingDept.id, editDeptName.trim(), editDeptLevel);
      setEditingDept(null);
      setIsEditDeptModalOpen(false);
      toast.success("Division updated successfully!");
      await loadDeps();
      if (selectedDeptId === editingDept.id) {
        loadDeptDetails(editingDept.id);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update division");
    }
  };

  const handleDeleteDept = async (deptId: string, deptName: string) => {
    if (!confirm(`Are you sure you want to permanently delete the division "${deptName}"? This will delete all associated sections, courses, faculty, and evaluations!`)) return;
    try {
      await deleteDepartment(deptId);
      toast.success("Division deleted successfully!");
      if (selectedDeptId === deptId) {
        setSelectedDeptId(null);
      }
      await loadDeps();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete division");
    }
  };

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

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptId || !newSubjectName.trim() || !newSubjectCode.trim()) return;
    try {
      await createSubject(newSubjectName, newSubjectCode, selectedDeptId);
      setNewSubjectName('');
      setNewSubjectCode('');
      setIsSubjectModalOpen(false);
      toast.success("Subject created successfully!");
      loadDeptDetails(selectedDeptId);
    } catch (err: any) {
      toast.error(err.message || "Failed to create subject");
    }
  };

  const handleDeleteSubject = async (subjectId: string, subjectName: string) => {
    if (!confirm(`Are you sure you want to delete the subject/course "${subjectName}"?`)) return;
    try {
      await deleteSubject(subjectId);
      toast.success("Subject deleted successfully!");
      if (selectedDeptId) {
        loadDeptDetails(selectedDeptId);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete subject");
    }
  };

  const handleStartEditSection = (sec: any) => {
    setEditingSection(sec);
    setEditSectionName(sec.name);
    setIsEditSectionModalOpen(true);
  };

  const handleSaveEditSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSection || !editSectionName.trim()) return;
    try {
      await updateSection(editingSection.id, editSectionName);
      setEditingSection(null);
      setIsEditSectionModalOpen(false);
      toast.success("Section updated successfully!");
      if (selectedDeptId) {
        loadDeptDetails(selectedDeptId);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update section");
    }
  };

  const handleStartEditSubject = (sub: any) => {
    setEditingSubject(sub);
    setEditSubjectName(sub.name);
    setEditSubjectCode(sub.code || '');
    setIsEditSubjectModalOpen(true);
  };

  const handleSaveEditSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject || !editSubjectName.trim() || !editSubjectCode.trim()) return;
    try {
      await updateSubject(editingSubject.id, editSubjectName, editSubjectCode);
      setEditingSubject(null);
      setIsEditSubjectModalOpen(false);
      toast.success("Subject/Course updated successfully!");
      if (selectedDeptId) {
        loadDeptDetails(selectedDeptId);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update subject");
    }
  };

  const handleAddFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptId || !newFacultyName.trim() || !newFacultyEmail.trim()) return;
    try {
      await createProfessor(newFacultyName, newFacultyEmail, selectedDeptId, newTeachingAssignments);
      setNewFacultyName('');
      setNewFacultyEmail('');
      setNewTeachingAssignments([]);
      setIsAddingNewMapping(false);
      setNewTempSectionId('');
      setNewTempSubjectId('');
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
    setEditTeachingAssignments(
      prof.teachingAssignments?.map((a: any) => ({
        sectionId: a.sectionId,
        subjectId: a.subjectId,
      })) || []
    );
    setIsAddingEditMapping(false);
    setEditTempSectionId('');
    setEditTempSubjectId('');
    setIsEditFacultyModalOpen(true);
  };

  const handleSaveEditFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaculty) return;
    try {
      await updateProfessor(
        editingFaculty.id,
        editFacultyName,
        editFacultyEmail,
        editTeachingAssignments
      );
      setEditingFaculty(null);
      setIsEditFacultyModalOpen(false);
      toast.success("Faculty details and teaching mappings updated!");
      if (selectedDeptId) {
        loadDeptDetails(selectedDeptId);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update faculty");
    }
  };

  const handleDeleteSection = async (sectionId: string, sectionName: string) => {
    if (!confirm(`Are you sure you want to delete the section "${sectionName}"? This will also delete any related evaluations.`)) return;
    try {
      await deleteSection(sectionId);
      toast.success("Section deleted successfully!");
      if (selectedDeptId) {
        loadDeptDetails(selectedDeptId);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete section");
    }
  };

  const handleDeleteFaculty = async (profId: string, profName: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${profName}"? This will delete the faculty profile and ALL associated evaluation records.`)) return;
    try {
      await deleteFaculty(profId);
      toast.success("Faculty member and all associated evaluations deleted successfully!");
      if (selectedDeptId) {
        loadDeptDetails(selectedDeptId);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete faculty member");
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
                      <li 
                        key={jdep.id} 
                        className={cn(
                          "group relative flex items-center hover:bg-muted/30 transition-all border-l-4 pr-3",
                          isActive 
                            ? 'bg-ua-navy/5 border-ua-gold text-ua-navy dark:text-ua-gold font-bold' 
                            : 'border-transparent text-foreground font-medium'
                        )}
                      >
                        <button 
                          onClick={() => {
                            setSelectedDeptId(jdep.id);
                            setEditingFaculty(null);
                          }}
                          className="flex-1 text-left p-5 outline-none"
                        >
                          <p className="text-sm">Junior High School</p>
                          <span className="inline-block text-[9px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold uppercase tracking-wider mt-1.5">
                            JHS Level
                          </span>
                        </button>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEditDept(jdep);
                            }}
                            uaVariant="ghost"
                            className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                          >
                            <Edit3 className="size-4" />
                          </Button>
                        </div>
                      </li>
                    );
                  })()
                )}
                {departments.find(d => d.level === 'SHS') && (
                  (() => {
                    const sdep = departments.find(d => d.level === 'SHS');
                    const isActive = selectedDeptId === sdep.id;
                    return (
                      <li 
                        key={sdep.id} 
                        className={cn(
                          "group relative flex items-center hover:bg-muted/30 transition-all border-l-4 pr-3",
                          isActive 
                            ? 'bg-ua-navy/5 border-ua-gold text-ua-navy dark:text-ua-gold font-bold' 
                            : 'border-transparent text-foreground font-medium'
                        )}
                      >
                        <button 
                          onClick={() => {
                            setSelectedDeptId(sdep.id);
                            setEditingFaculty(null);
                          }}
                          className="flex-1 text-left p-5 outline-none"
                        >
                          <p className="text-sm">Senior High School</p>
                          <span className="inline-block text-[9px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold uppercase tracking-wider mt-1.5">
                            SHS Level
                          </span>
                        </button>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEditDept(sdep);
                            }}
                            uaVariant="ghost"
                            className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                          >
                            <Edit3 className="size-4" />
                          </Button>
                        </div>
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
                      <li 
                        key={dep.id}
                        className={cn(
                          "group relative flex items-center hover:bg-muted/30 transition-all border-l-4 pr-3",
                          isActive 
                            ? 'bg-ua-navy/5 border-ua-gold text-ua-navy dark:text-ua-gold font-bold' 
                            : 'border-transparent text-foreground font-medium'
                        )}
                      >
                        <button 
                          onClick={() => {
                            setSelectedDeptId(dep.id);
                            setEditingFaculty(null);
                          }}
                          className="flex-1 text-left p-5 outline-none"
                        >
                          <p className="text-sm">{dep.name}</p>
                          <span className="inline-block text-[9px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold uppercase tracking-wider mt-1.5">
                            {dep.level}
                          </span>
                        </button>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEditDept(dep);
                            }}
                            uaVariant="ghost"
                            className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                          >
                            <Edit3 className="size-4" />
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDept(dep.id, dep.name);
                            }}
                            uaVariant="ghost"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
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
                    <>
                      <Button
                        onClick={() => {
                          const headers = ["Year and Section", "random-generated-code"];
                          const rows = (deptDetails.sections || []).map((sec: any) => [
                            sec.name,
                            sec.code || "N/A"
                          ]);
                          const csvContent = "data:text/csv;charset=utf-8," 
                            + [headers.join(","), ...rows.map((e: any) => e.join(","))].join("\n");
                          const encodedUri = encodeURI(csvContent);
                          const link = document.createElement("a");
                          link.setAttribute("href", encodedUri);
                          link.setAttribute("download", `${deptDetails.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_sections.csv`);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        disabled={!deptDetails.sections || deptDetails.sections.length === 0}
                        uaVariant="outline"
                        className="h-10 text-xs"
                      >
                        📤 Export Sections
                      </Button>
                      <Button 
                        onClick={() => setIsSectionModalOpen(true)}
                        uaVariant="primary"
                        className="h-10 text-xs"
                      >
                        <Plus className="size-4 mr-1.5" />
                        Add Year & Section
                      </Button>
                    </>
                  ) : activeTab === 'subjects' ? (
                    <>
                      <Button
                        onClick={() => {
                          const headers = ["Subject/Course Name", "Subject/Course Code"];
                          const rows = (deptDetails.subjects || []).map((sub: any) => [
                            sub.name,
                            sub.code || "N/A"
                          ]);
                          const csvContent = "data:text/csv;charset=utf-8," 
                            + [headers.join(","), ...rows.map((e: any) => e.join(","))].join("\n");
                          const encodedUri = encodeURI(csvContent);
                          const link = document.createElement("a");
                          link.setAttribute("href", encodedUri);
                          link.setAttribute("download", `${deptDetails.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_subjects.csv`);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        disabled={!deptDetails.subjects || deptDetails.subjects.length === 0}
                        uaVariant="outline"
                        className="h-10 text-xs"
                      >
                        📤 Export Subjects
                      </Button>
                      <Button 
                        onClick={() => setIsSubjectModalOpen(true)}
                        uaVariant="primary"
                        className="h-10 text-xs"
                      >
                        <Plus className="size-4 mr-1.5" />
                        Add Subject & Course
                      </Button>
                    </>
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
                  onClick={() => setActiveTab('subjects')}
                  uaVariant={activeTab === 'subjects' ? 'primary' : 'ghost'}
                  className="h-9 text-xs"
                >
                  Subject & Courses ({deptDetails.subjects?.length || 0})
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
                          <div key={sec.id} className="p-4 border border-border bg-card rounded-lg flex flex-col justify-between shadow-sm hover:shadow transition-all duration-200">
                            <div className="flex items-start justify-between">
                              <span className="font-bold text-foreground text-sm pr-2">{sec.name}</span>
                              <div className="flex items-center gap-1">
                                <Button
                                  onClick={() => handleStartEditSection(sec)}
                                  uaVariant="ghost"
                                  className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                >
                                  <Edit3 className="size-4" />
                                </Button>
                                <Button
                                  onClick={() => handleDeleteSection(sec.id, sec.name)}
                                  uaVariant="ghost"
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/40">
                              <span className="text-xs font-mono font-bold text-muted-foreground bg-muted/40 border border-border/80 px-2.5 py-1 rounded tracking-wider">
                                {sec.code || "NO CODE"}
                              </span>
                              <span className="text-[9px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold uppercase">
                                SEC
                              </span>
                            </div>                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. SUBJECTS TAB */}
                {activeTab === 'subjects' && (
                  <div className="space-y-6">
                    {(!deptDetails.subjects || deptDetails.subjects.length === 0) ? (
                      <div className="p-12 text-center flex flex-col items-center justify-center space-y-3 bg-muted/10 rounded-lg border border-dashed border-border">
                        <BookOpen className="size-8 text-muted-foreground/30 mb-2" />
                        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">No subjects or courses added to this department yet.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {deptDetails.subjects.map((sub: any) => (
                          <div key={sub.id} className="p-4 border border-border bg-card rounded-lg flex flex-col justify-between shadow-sm hover:shadow transition-all duration-200">
                            <div className="flex items-start justify-between">
                              <span className="font-bold text-foreground text-sm pr-2">{sub.name}</span>
                              <div className="flex items-center gap-1">
                                <Button
                                  onClick={() => handleStartEditSubject(sub)}
                                  uaVariant="ghost"
                                  className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                >
                                  <Edit3 className="size-4" />
                                </Button>
                                <Button
                                  onClick={() => handleDeleteSubject(sub.id, sub.name)}
                                  uaVariant="ghost"
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/40">
                              <span className="text-xs font-mono font-bold text-muted-foreground bg-muted/40 border border-border/80 px-2.5 py-1 rounded tracking-wider">
                                {sub.code || "NO CODE"}
                              </span>
                              <span className="text-[9px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold uppercase">
                                SUBJ
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. FACULTY TAB */}
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
                                  {prof.teachingAssignments && prof.teachingAssignments.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {prof.teachingAssignments.map((a: any) => (
                                        <span key={a.id} className="px-2.5 py-0.5 bg-ua-navy/5 border border-ua-navy/10 text-ua-navy dark:bg-ua-gold/15 dark:text-ua-gold dark:border-ua-gold/20 rounded-full font-bold text-[9px]">
                                          {a.section?.name} → {a.subject?.code || a.subject?.name}
                                        </span>
                                      ))}
                                    </div>
                                  ) : prof.sections?.length > 0 ? (
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
                                  <div className="flex gap-2 justify-end">
                                    <Button 
                                      onClick={() => handleStartEditFaculty(prof)}
                                      uaVariant="outline"
                                      className="h-8 text-xs px-2.5 font-bold"
                                    >
                                      <Edit3 className="size-3 mr-1" />
                                      Edit
                                    </Button>
                                    <Button 
                                      onClick={() => handleDeleteFaculty(prof.id, prof.name)}
                                      uaVariant="destructive"
                                      className="h-8 text-xs px-2.5 font-bold"
                                    >
                                      <Trash2 className="size-3 mr-1" />
                                      Delete
                                    </Button>
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

      {/* Edit Department Modal */}
      {editingDept && (
        <Modal
          isOpen={isEditDeptModalOpen}
          onClose={() => setIsEditDeptModalOpen(false)}
          title="Edit Division / Department"
          footer={
            <>
              <Button uaVariant="ghost" onClick={() => setIsEditDeptModalOpen(false)}>Cancel</Button>
              <Button uaVariant="primary" onClick={handleSaveEditDept}>Save Changes</Button>
            </>
          }
        >
          <form onSubmit={handleSaveEditDept} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Department Name</label>
              <input 
                type="text"
                value={editDeptName}
                onChange={(e) => setEditDeptName(e.target.value)}
                placeholder="e.g. Computer Studies"
                className="w-full h-11 px-3 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-semibold"
                required
                autoFocus
              />
            </div>
            {editingDept.level !== 'JHS' && editingDept.level !== 'SHS' && (
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Education Level</label>
                <select 
                  value={editDeptLevel}
                  onChange={(e) => setEditDeptLevel(e.target.value as EducationLevel)}
                  className="w-full h-11 px-3 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-bold"
                >
                  <option value="COLLEGE">COLLEGE</option>
                  <option value="GRADUATE">GRADUATE</option>
                </select>
              </div>
            )}
          </form>
        </Modal>
      )}

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

            <div className="space-y-3">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">Teaching Assignments</label>
              
              {/* List of current assignments */}
              <div className="space-y-1.5 max-h-36 overflow-y-auto border border-border rounded-lg p-2 bg-muted/10">
                {newTeachingAssignments.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic p-2">No sections or subjects assigned yet.</p>
                ) : (
                  newTeachingAssignments.map((assignment, index) => {
                    const sectionName = deptDetails.sections.find((s: any) => s.id === assignment.sectionId)?.name || 'Unknown Section';
                    const subjectName = deptDetails.subjects.find((s: any) => s.id === assignment.subjectId)?.name || 'Unknown Subject';
                    const subjectCode = deptDetails.subjects.find((s: any) => s.id === assignment.subjectId)?.code || '';
                    return (
                      <div key={index} className="flex justify-between items-center bg-card border border-border p-2 rounded shadow-sm text-xs">
                        <span className="font-semibold text-foreground">
                          {sectionName} &rarr; {subjectName} {subjectCode && `(${subjectCode})`}
                        </span>
                        <Button
                          type="button"
                          onClick={() => {
                            setNewTeachingAssignments(prev => prev.filter((_, i) => i !== index));
                          }}
                          uaVariant="ghost"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          &times;
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Mapping Controls */}
              {!isAddingNewMapping ? (
                <Button
                  type="button"
                  onClick={() => {
                    setIsAddingNewMapping(true);
                    setNewTempSectionId('');
                    setNewTempSubjectId('');
                  }}
                  uaVariant="outline"
                  className="w-full text-xs h-9 border-dashed"
                >
                  <Plus className="size-3.5 mr-1.5" />
                  Add Teaching Assignment
                </Button>
              ) : (
                <div className="p-3 bg-muted/20 border border-border rounded-lg space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">1. Select Year & Section</label>
                    <select
                      value={newTempSectionId}
                      onChange={(e) => {
                        setNewTempSectionId(e.target.value);
                        setNewTempSubjectId('');
                      }}
                      className="w-full h-9 px-2 border border-border rounded-lg text-xs bg-card text-foreground focus:ring-1 focus:ring-ua-gold/30 outline-none font-semibold"
                    >
                      <option value="">-- Choose Section --</option>
                      {deptDetails.sections.map((sec: any) => (
                        <option key={sec.id} value={sec.id}>{sec.name}</option>
                      ))}
                    </select>
                  </div>

                  {newTempSectionId && (
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">2. Associate Subject/Course</label>
                      <select
                        value={newTempSubjectId}
                        onChange={(e) => setNewTempSubjectId(e.target.value)}
                        className="w-full h-9 px-2 border border-border rounded-lg text-xs bg-card text-foreground focus:ring-1 focus:ring-ua-gold/30 outline-none font-semibold"
                      >
                        <option value="">-- Choose Subject --</option>
                        {deptDetails.subjects.map((sub: any) => (
                          <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex gap-2 justify-end pt-1">
                    <Button
                      type="button"
                      onClick={() => setIsAddingNewMapping(false)}
                      uaVariant="ghost"
                      className="h-8 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={!newTempSectionId || !newTempSubjectId}
                      onClick={() => {
                        const exists = newTeachingAssignments.some(
                          a => a.sectionId === newTempSectionId && a.subjectId === newTempSubjectId
                        );
                        if (exists) {
                          toast.error("This section and subject association is already added.");
                        } else {
                          setNewTeachingAssignments(prev => [
                            ...prev,
                            { sectionId: newTempSectionId, subjectId: newTempSubjectId }
                          ]);
                          setIsAddingNewMapping(false);
                          setNewTempSectionId('');
                          setNewTempSubjectId('');
                        }
                      }}
                      uaVariant="primary"
                      className="h-8 text-xs font-bold"
                    >
                      Confirm
                    </Button>
                  </div>
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

            <div className="space-y-3">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">Teaching Assignments</label>
              
              {/* List of current assignments */}
              <div className="space-y-1.5 max-h-36 overflow-y-auto border border-border rounded-lg p-2 bg-muted/10">
                {editTeachingAssignments.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic p-2">No sections or subjects assigned yet.</p>
                ) : (
                  editTeachingAssignments.map((assignment, index) => {
                    const sectionName = deptDetails.sections.find((s: any) => s.id === assignment.sectionId)?.name || 'Unknown Section';
                    const subjectName = deptDetails.subjects.find((s: any) => s.id === assignment.subjectId)?.name || 'Unknown Subject';
                    const subjectCode = deptDetails.subjects.find((s: any) => s.id === assignment.subjectId)?.code || '';
                    return (
                      <div key={index} className="flex justify-between items-center bg-card border border-border p-2 rounded shadow-sm text-xs">
                        <span className="font-semibold text-foreground">
                          {sectionName} &rarr; {subjectName} {subjectCode && `(${subjectCode})`}
                        </span>
                        <Button
                          type="button"
                          onClick={() => {
                            setEditTeachingAssignments(prev => prev.filter((_, i) => i !== index));
                          }}
                          uaVariant="ghost"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          &times;
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Mapping Controls */}
              {!isAddingEditMapping ? (
                <Button
                  type="button"
                  onClick={() => {
                    setIsAddingEditMapping(true);
                    setEditTempSectionId('');
                    setEditTempSubjectId('');
                  }}
                  uaVariant="outline"
                  className="w-full text-xs h-9 border-dashed"
                >
                  <Plus className="size-3.5 mr-1.5" />
                  Add Teaching Assignment
                </Button>
              ) : (
                <div className="p-3 bg-muted/20 border border-border rounded-lg space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">1. Select Year & Section</label>
                    <select
                      value={editTempSectionId}
                      onChange={(e) => {
                        setEditTempSectionId(e.target.value);
                        setEditTempSubjectId('');
                      }}
                      className="w-full h-9 px-2 border border-border rounded-lg text-xs bg-card text-foreground focus:ring-1 focus:ring-ua-gold/30 outline-none font-semibold"
                    >
                      <option value="">-- Choose Section --</option>
                      {deptDetails.sections.map((sec: any) => (
                        <option key={sec.id} value={sec.id}>{sec.name}</option>
                      ))}
                    </select>
                  </div>

                  {editTempSectionId && (
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">2. Associate Subject/Course</label>
                      <select
                        value={editTempSubjectId}
                        onChange={(e) => setEditTempSubjectId(e.target.value)}
                        className="w-full h-9 px-2 border border-border rounded-lg text-xs bg-card text-foreground focus:ring-1 focus:ring-ua-gold/30 outline-none font-semibold"
                      >
                        <option value="">-- Choose Subject --</option>
                        {deptDetails.subjects.map((sub: any) => (
                          <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex gap-2 justify-end pt-1">
                    <Button
                      type="button"
                      onClick={() => setIsAddingEditMapping(false)}
                      uaVariant="ghost"
                      className="h-8 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={!editTempSectionId || !editTempSubjectId}
                      onClick={() => {
                        const exists = editTeachingAssignments.some(
                          a => a.sectionId === editTempSectionId && a.subjectId === editTempSubjectId
                        );
                        if (exists) {
                          toast.error("This section and subject association is already added.");
                        } else {
                          setEditTeachingAssignments(prev => [
                            ...prev,
                            { sectionId: editTempSectionId, subjectId: editTempSubjectId }
                          ]);
                          setIsAddingEditMapping(false);
                          setEditTempSectionId('');
                          setEditTempSubjectId('');
                        }
                      }}
                      uaVariant="primary"
                      className="h-8 text-xs font-bold"
                    >
                      Confirm
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </form>
        </Modal>
      )}

      {/* 5. Add Subject Modal */}
      {deptDetails && (
        <Modal
          isOpen={isSubjectModalOpen}
          onClose={() => {
            setIsSubjectModalOpen(false);
            setNewSubjectName('');
            setNewSubjectCode('');
          }}
          title={`Add New Subject/Course`}
          footer={
            <>
              <Button uaVariant="ghost" onClick={() => {
                setIsSubjectModalOpen(false);
                setNewSubjectName('');
                setNewSubjectCode('');
              }}>Cancel</Button>
              <Button uaVariant="primary" onClick={handleAddSubject}>Create Subject</Button>
            </>
          }
        >
          <form onSubmit={handleAddSubject} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Subject/Course Name</label>
              <input 
                type="text"
                placeholder="e.g. Software Engineering"
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Subject/Course Code</label>
              <input 
                type="text"
                placeholder="e.g. IT-312"
                value={newSubjectCode}
                onChange={(e) => setNewSubjectCode(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-bold"
                required
              />
            </div>
          </form>
        </Modal>
      )}

      {/* 6. Edit Section Modal */}
      {deptDetails && editingSection && (
        <Modal
          isOpen={isEditSectionModalOpen}
          onClose={() => {
            setIsEditSectionModalOpen(false);
            setEditingSection(null);
            setEditSectionName('');
          }}
          title="Edit Year & Section"
          footer={
            <>
              <Button uaVariant="ghost" onClick={() => {
                setIsEditSectionModalOpen(false);
                setEditingSection(null);
                setEditSectionName('');
              }}>Cancel</Button>
              <Button uaVariant="primary" onClick={handleSaveEditSection}>Save Changes</Button>
            </>
          }
        >
          <form onSubmit={handleSaveEditSection} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Section Name</label>
              <input 
                type="text"
                value={editSectionName}
                onChange={(e) => setEditSectionName(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-bold"
                required
              />
            </div>
          </form>
        </Modal>
      )}

      {/* 7. Edit Subject Modal */}
      {deptDetails && editingSubject && (
        <Modal
          isOpen={isEditSubjectModalOpen}
          onClose={() => {
            setIsEditSubjectModalOpen(false);
            setEditingSubject(null);
            setEditSubjectName('');
            setEditSubjectCode('');
          }}
          title="Edit Subject/Course"
          footer={
            <>
              <Button uaVariant="ghost" onClick={() => {
                setIsEditSubjectModalOpen(false);
                setEditingSubject(null);
                setEditSubjectName('');
                setEditSubjectCode('');
              }}>Cancel</Button>
              <Button uaVariant="primary" onClick={handleSaveEditSubject}>Save Changes</Button>
            </>
          }
        >
          <form onSubmit={handleSaveEditSubject} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Subject/Course Name</label>
              <input 
                type="text"
                value={editSubjectName}
                onChange={(e) => setEditSubjectName(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Subject/Course Code</label>
              <input 
                type="text"
                value={editSubjectCode}
                onChange={(e) => setEditSubjectCode(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-bold"
                required
              />
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
