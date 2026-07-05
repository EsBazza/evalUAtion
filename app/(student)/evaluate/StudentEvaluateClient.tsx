'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getDepartments, getSections, getProfessorsBySection, getEvaluationTemplate, submitProfessorEvaluation } from '@/app/actions/student';
import { DynamicQuestionRenderer } from '@/components/form/DynamicQuestionRenderer';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut } from 'next-auth/react';

const EducationLevelEnum = z.enum(["JHS", "SHS", "COLLEGE", "GRADUATE"]);

const selectionSchema = z.object({
  level: EducationLevelEnum,
  departmentId: z.string().optional(),
  sectionId: z.string().min(1, "Section is required"),
}).superRefine((data, ctx) => {
  if (data.level !== 'JHS' && data.level !== 'SHS' && !data.departmentId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Department is required for this level",
      path: ["departmentId"]
    });
  }
});

type SelectionFormValues = z.infer<typeof selectionSchema>;

interface StudentEvaluateClientProps {
  studentEmail: string;
}

// Custom Searchable Selector/Combobox Component
function SearchableSelector({ value, onChange, options, placeholder, emptyMessage, disabled }: {
  value: string;
  onChange: (val: string) => void;
  options: { id: string; name: string }[];
  placeholder: string;
  emptyMessage: string;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const filtered = options.filter(opt => 
    (opt.name || '').toLowerCase().includes(search.toLowerCase())
  );
  
  const selectedOption = options.find(o => o.id === value);
  
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50/50 hover:bg-slate-50 text-left flex justify-between items-center font-semibold disabled:opacity-50 disabled:cursor-not-allowed select-none transition-all"
      >
        <span className="truncate">{selectedOption ? selectedOption.name : placeholder}</span>
        <span className="text-slate-400 text-xs shrink-0 ml-2">▼</span>
      </button>
      
      {isOpen && !disabled && (
        <>
          <div className="fixed inset-0 z-35" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg p-2.5 z-40 space-y-2 animate-fade-in">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to search..."
              className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold outline-none text-slate-800"
              autoFocus
            />
            <ul className="max-h-40 overflow-y-auto divide-y divide-slate-100 text-xs">
              {filtered.length === 0 ? (
                <li className="p-3 text-slate-400 text-center font-medium">{emptyMessage}</li>
              ) : (
                filtered.map(opt => (
                  <li key={opt.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(opt.id);
                        setIsOpen(false);
                        setSearch('');
                      }}
                      className="w-full text-left p-2.5 hover:bg-indigo-50/40 font-bold text-slate-700 hover:text-indigo-950 transition rounded-lg"
                    >
                      {opt.name}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

export default function StudentEvaluateClient({ studentEmail }: StudentEvaluateClientProps) {
  const [departments, setDepartments] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [professors, setProfessors] = useState<any[]>([]);
  const [template, setTemplate] = useState<any>(null);
  const [completedProfs, setCompletedProfs] = useState<string[]>([]);
  
  // Wizard states
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1); // 1: Selection, 2: Questionnaire, 3: Summary
  const [questionnairePage, setQuestionnairePage] = useState(1); // Paginated questionnaire step
  const [selectedProf, setSelectedProf] = useState<any | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { control, watch, setValue, formState: { errors } } = useForm<SelectionFormValues>({
    resolver: zodResolver(selectionSchema),
    defaultValues: {
      departmentId: '',
      sectionId: '',
    }
  });

  const evaluationForm = useForm({
    mode: "onChange",
    shouldUnregister: true,
    defaultValues: {
      answers: {} as Record<string, { score?: number; textVal?: string; jsonVal?: any }>
    }
  });

  const selectedLevel = watch('level');
  const selectedDepartmentId = watch('departmentId');
  const selectedSectionId = watch('sectionId');

  useEffect(() => {
    if (selectedLevel) {
      setDepartments([]);
      setSections([]);
      setProfessors([]);
      setTemplate(null);
      setValue('departmentId', '');
      setValue('sectionId', '');
      evaluationForm.reset(); // Clear old answers!

      if (selectedLevel === 'JHS' || selectedLevel === 'SHS') {
        getDepartments(selectedLevel as any).then((deps) => {
          if (deps.length > 0) {
            getSections(deps[0].id).then(setSections);
          }
        });
      } else {
        getDepartments(selectedLevel as any).then(setDepartments);
      }
    }
  }, [selectedLevel, setValue]);

  useEffect(() => {
    if (selectedDepartmentId) {
      setSections([]);
      setProfessors([]);
      setTemplate(null);
      setValue('sectionId', '');
      evaluationForm.reset(); // Clear old answers!
      getSections(selectedDepartmentId).then(setSections);
    }
  }, [selectedDepartmentId, setValue]);

  useEffect(() => {
    if (selectedSectionId) {
      getProfessorsBySection(selectedSectionId).then(setProfessors);
      evaluationForm.reset(); // Clear old answers!
      
      if (selectedLevel === 'JHS' || selectedLevel === 'SHS') {
        getDepartments(selectedLevel as any).then((deps) => {
          if (deps.length > 0) {
            getEvaluationTemplate(selectedLevel as any, deps[0].id).then(setTemplate);
          }
        });
      } else {
        getEvaluationTemplate(selectedLevel as any, selectedDepartmentId).then(setTemplate);
      }
    }
  }, [selectedSectionId, selectedLevel, selectedDepartmentId]);

  const answers = evaluationForm.watch("answers") || {};

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    setWizardStep(3);
  };

  const handleFinalSubmit = async () => {
    if (!selectedProf || !template) return;
    setIsSubmitting(true);
    
    const formattedAnswers = Object.entries(answers).map(([critId, val]: any) => ({
      criterionId: critId,
      score: typeof val.score === 'number' ? val.score : undefined,
      textVal: val.textVal || undefined,
      jsonVal: val.jsonVal || undefined,
    }));

    try {
      await submitProfessorEvaluation({
        studentEmail,
        sectionId: selectedSectionId,
        professorId: selectedProf.id,
        departmentId: selectedDepartmentId || departments[0]?.id || "", 
        templateId: template.id,
        answers: formattedAnswers,
      });

      setCompletedProfs(prev => [...prev, selectedProf.id]);
      toast.success(`Evaluation for ${selectedProf.name} submitted successfully!`);
      
      // Reset flow
      evaluationForm.reset();
      setSelectedProf(null);
      setWizardStep(1);
      setQuestionnairePage(1);
      setShowConfirmModal(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit evaluation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 py-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-gray-200">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="bg-indigo-600 text-white px-3 py-1 rounded-xl text-2xl font-extrabold shadow-sm">UA</span>
              Student evalUAtion Portal
            </h1>
            <p className="text-sm text-slate-500 mt-1.5 font-medium">
              Anonymously submit feedback. Logged in as: <span className="font-semibold text-slate-800">{studentEmail}</span>
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Sign Out
          </button>
        </div>

        {/* Wizard Steps indicator */}
        <div className="flex items-center justify-between max-w-md mx-auto bg-white p-3 rounded-2xl border border-slate-200">
          {[
            { step: 1, label: 'Parameters' },
            { step: 2, label: 'Evaluate' },
            { step: 3, label: 'Review' }
          ].map((item) => (
            <div key={item.step} className="flex items-center gap-2">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition ${
                wizardStep === item.step 
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20' 
                  : wizardStep > item.step 
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-100 text-slate-400'
              }`}>
                {wizardStep > item.step ? '✓' : item.step}
              </span>
              <span className={`text-xs font-bold ${
                wizardStep === item.step ? 'text-indigo-600' : 'text-slate-500'
              }`}>{item.label}</span>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 1: Select parameters and choose professor */}
          {wizardStep === 1 && (
            <motion.div 
              key="step-1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
                <h2 className="text-lg font-bold text-slate-800 border-b pb-3">Course Parameters</h2>
                
                {/* Level Select Cards */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Education Level</label>
                  <Controller
                    name="level"
                    control={control}
                    render={({ field }) => (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { id: 'JHS', title: 'Junior High', desc: 'JHS Grade Levels' },
                          { id: 'SHS', title: 'Senior High', desc: 'SHS Grade Levels' },
                          { id: 'COLLEGE', title: 'College', desc: 'Undergraduate Depts' },
                          { id: 'GRADUATE', title: 'Graduate School', desc: 'Postgraduate Programs' }
                        ].map((option) => {
                          const isActive = field.value === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => field.onChange(option.id)}
                              className={`p-4 border rounded-2xl text-left transition-all cursor-pointer ${
                                isActive 
                                  ? 'border-indigo-600 bg-indigo-50/30 ring-2 ring-indigo-500/10' 
                                  : 'border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <span className="font-extrabold text-sm text-slate-900 block">{option.title}</span>
                              <span className="text-[10px] text-slate-500 mt-1 font-semibold block">{option.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  />
                  {errors.level && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.level.message}</p>}
                </div>

                {/* Department and Section dropdowns */}
                {selectedLevel && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                    {selectedLevel !== 'JHS' && selectedLevel !== 'SHS' && (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Department</label>
                        <Controller
                          name="departmentId"
                          control={control}
                          render={({ field }) => (
                            <SearchableSelector
                              value={field.value || ''}
                              onChange={field.onChange}
                              options={departments}
                              placeholder="Search & select department..."
                              emptyMessage="No departments found matching search."
                              disabled={!departments.length}
                            />
                          )}
                        />
                        {errors.departmentId && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.departmentId.message}</p>}
                      </div>
                    )}

                    <div className={(selectedLevel === 'JHS' || selectedLevel === 'SHS') ? 'md:col-span-2 space-y-1.5' : 'space-y-1.5'}>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Assigned Section</label>
                      <Controller
                        name="sectionId"
                        control={control}
                        render={({ field }) => (
                          <SearchableSelector
                            value={field.value}
                            onChange={field.onChange}
                            options={sections}
                            placeholder="Search & select section..."
                            emptyMessage="No sections found matching search."
                            disabled={!sections.length}
                          />
                        )}
                      />
                      {errors.sectionId && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.sectionId.message}</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* Professor Selection Cards */}
              {selectedSectionId && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Assigned Instructors</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Choose an instructor to begin or complete their evaluation.</p>
                  </div>

                  {professors.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 border rounded-xl font-semibold text-slate-400">No instructors assigned to this section.</div>
                  ) : !template ? (
                    <div className="p-8 text-center bg-amber-50 border border-amber-200 rounded-xl text-amber-800 font-semibold space-y-2">
                      <p>⚠️ No active evaluation form template registered for this level.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {professors.map((prof) => {
                        const isCompleted = completedProfs.includes(prof.id);
                        return (
                          <button
                            key={prof.id}
                            type="button"
                            onClick={() => {
                              if (!isCompleted) {
                                setSelectedProf(prof);
                                setWizardStep(2);
                                setQuestionnairePage(1);
                              }
                            }}
                            className={`p-4 border rounded-2xl text-left transition-all ${
                              isCompleted 
                                ? 'border-emerald-100 bg-emerald-50/40 cursor-default opacity-85' 
                                : 'border-slate-200 hover:border-indigo-600 hover:bg-indigo-50/10 cursor-pointer hover:shadow-md'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <span className="font-extrabold text-sm text-slate-900 block">{prof.name}</span>
                              {isCompleted ? (
                                <span className="text-[10px] px-2 py-0.5 bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-full font-bold">Completed</span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-full font-bold">Pending</span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 block truncate">{prof.email}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 2: Fill Questionnaire */}
          {wizardStep === 2 && selectedProf && template && (() => {
            const midIndex = Math.ceil(template.clusters.length / 2);
            const isPaginated = template.clusters.length > 2;
            const page1Clusters = isPaginated ? template.clusters.slice(0, midIndex) : template.clusters;
            const page2Clusters = isPaginated ? template.clusters.slice(midIndex) : [];
            const currentClusters = (!isPaginated || questionnairePage === 1) ? page1Clusters : page2Clusters;

            const getPageFieldNames = (clustersOnPage: any[]) => {
              const fields: string[] = [];
              clustersOnPage.forEach((cluster) => {
                cluster.criteria.forEach((crit: any) => {
                  if (crit.type === 'SCALE_1_TO_5' || crit.type === 'SCALE_0_TO_4') {
                    fields.push(`answers.${crit.id}.score`);
                  } else if (crit.type === 'TEXT_LONG' || crit.type === 'RADIO_EXPECTATION') {
                    fields.push(`answers.${crit.id}.textVal`);
                  } else if (crit.type === 'CHECKBOX_AREAS') {
                    fields.push(`answers.${crit.id}.jsonVal`);
                  }
                });
              });
              return fields;
            };

            const handleNextPage = async () => {
              const fieldsToValidate = getPageFieldNames(page1Clusters);
              // @ts-ignore
              const isValid = await evaluationForm.trigger(fieldsToValidate);
              if (isValid) {
                setQuestionnairePage(2);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              } else {
                toast.error("Please answer all required questions on this page before proceeding.");
                setTimeout(() => {
                  const firstError = document.querySelector('.text-red-500');
                  if (firstError) {
                    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }, 50);
              }
            };

            const handleFormSubmit = async (e: React.FormEvent) => {
              e.preventDefault();
              if (isPaginated && questionnairePage === 1) {
                await handleNextPage();
                return;
              }
              
              const allFields = getPageFieldNames(template.clusters);
              // @ts-ignore
              const isValid = await evaluationForm.trigger(allFields);
              if (isValid) {
                setWizardStep(3);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              } else {
                toast.error("Please ensure all questions are answered properly.");
                setTimeout(() => {
                  const firstError = document.querySelector('.text-red-500');
                  if (firstError) {
                    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }, 50);
              }
            };

            return (
              <motion.div 
                key={`step-2-${selectedProf.id}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 bg-slate-50/40 flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">
                      STEP 2: QUESTIONNAIRE {isPaginated ? `(Page ${questionnairePage} of 2)` : ''}
                    </span>
                    <h3 className="text-lg font-black text-slate-900">Evaluating: {selectedProf.name}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (isPaginated && questionnairePage === 2) {
                        setQuestionnairePage(1);
                      } else {
                        evaluationForm.reset(); // Clear old answers!
                        setSelectedProf(null);
                        setWizardStep(1);
                      }
                    }}
                    className="px-3.5 py-1.5 border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-bold rounded-xl transition"
                  >
                    ← Back
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {isPaginated && (
                    <div className="flex gap-2 p-3.5 bg-indigo-50/30 border border-indigo-100/50 rounded-2xl items-center justify-between">
                      <span className="text-xs font-bold text-indigo-950">Form Progress: Page {questionnairePage} of 2</span>
                      <div className="flex gap-1.5">
                        <div className={`h-2.5 w-10 rounded-full transition-all duration-300 ${questionnairePage === 1 ? 'bg-indigo-600' : 'bg-emerald-500'}`} />
                        <div className={`h-2.5 w-10 rounded-full transition-all duration-300 ${questionnairePage === 2 ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                      </div>
                    </div>
                  )}

                  {/* Introductory Letter */}
                  {(!isPaginated || questionnairePage === 1) && (
                    <div className="bg-indigo-50/35 border border-indigo-100/60 rounded-2xl p-5 sm:p-6 mb-6 space-y-3 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none select-none text-indigo-950 text-8xl font-black">
                        UA
                      </div>
                      <h4 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
                        <span className="text-base">✉️</span> Dear Student,
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium italic">
                        Please accomplish this instrument with all sincerity and honesty. Your objective assessment is counted for the further improvement of instruction. Rest assured that your responses will be held strictly confidential and will not in any manner affect your grade in the subject. The summary of the results of this evaluation will only be made available to the instructor being evaluated in the next semester.
                      </p>
                      <div className="flex justify-between items-center pt-2 border-t border-indigo-100/40 text-[11px] font-bold text-indigo-800">
                        <span>Thank You.</span>
                        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-indigo-950/60">
                          🔒 Strictly Confidential
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-6">
                    {currentClusters.map((cluster: any) => (
                      <div key={cluster.id} className="space-y-4">
                        <h4 className="text-sm font-extrabold text-slate-900 border-l-4 border-indigo-600 pl-3 tracking-wide uppercase">
                          {cluster.title}
                        </h4>
                        {cluster.criteria.map((criterion: any) => (
                          <DynamicQuestionRenderer 
                            key={criterion.id} 
                            question={criterion} 
                            control={evaluationForm.control} 
                          />
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-6 border-t">
                    {isPaginated && questionnairePage === 2 ? (
                      <button 
                        type="button" 
                        onClick={() => setQuestionnairePage(1)}
                        className="px-5 py-2.5 bg-white border border-slate-200 text-slate-655 hover:bg-slate-50 font-bold rounded-xl text-sm transition"
                      >
                        ← Previous Page
                      </button>
                    ) : <div />}

                    {isPaginated && questionnairePage === 1 ? (
                      <button 
                        type="button" 
                        onClick={handleNextPage}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 hover:-translate-y-0.5 active:translate-y-0 transition-all text-sm cursor-pointer"
                      >
                        Next Page →
                      </button>
                    ) : (
                      <button 
                        type="button" 
                        onClick={handleFormSubmit}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 hover:-translate-y-0.5 active:translate-y-0 transition-all text-sm cursor-pointer"
                      >
                        Review Answers →
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })()}

          {/* STEP 3: Review Answers Summary */}
          {wizardStep === 3 && selectedProf && template && (
            <motion.div 
              key="step-3"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 bg-slate-50/40 flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">STEP 3: SUMMARY REVIEW</span>
                  <h3 className="text-lg font-black text-slate-900">Summary: {selectedProf.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-bold rounded-xl transition"
                >
                  ← Edit
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-2 divide-y divide-slate-100">
                  {template.clusters.map((cluster: any) => (
                    <div key={cluster.id} className="space-y-3 pt-4 first:pt-0">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{cluster.title}</h4>
                      {cluster.criteria.map((criterion: any) => {
                        const ans = answers[criterion.id] || {};
                        let responseText = <span className="text-slate-400 italic">No Answer</span>;

                        if (criterion.type === 'SCALE_0_TO_4' || criterion.type === 'SCALE_1_TO_5') {
                          if (typeof ans.score === 'number') {
                            responseText = <span className="text-indigo-600 font-extrabold text-sm">{ans.score} / {criterion.type === 'SCALE_0_TO_4' ? '4' : '5'}</span>;
                          }
                        } else if (criterion.type === 'TEXT_LONG') {
                          if (ans.textVal) {
                            responseText = <span className="text-slate-700 font-semibold italic text-xs">"{ans.textVal}"</span>;
                          }
                        } else if (criterion.type === 'CHECKBOX_AREAS') {
                          if (ans.jsonVal && Array.isArray(ans.jsonVal) && ans.jsonVal.length > 0) {
                            responseText = (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {ans.jsonVal.map((v: string) => (
                                  <span key={v} className="bg-slate-100 text-slate-700 border text-[9px] px-2 py-0.5 rounded-full font-bold">{v}</span>
                                ))}
                              </div>
                            );
                          }
                        } else if (criterion.type === 'RADIO_EXPECTATION') {
                          if (ans.textVal) {
                            responseText = <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] px-2.5 py-0.5 rounded-full font-bold">{ans.textVal}</span>;
                          }
                        }

                        return (
                          <div key={criterion.id} className="flex justify-between items-start gap-4 py-1.5">
                            <span className="text-xs font-bold text-slate-800 flex-grow">{criterion.question}</span>
                            <div className="shrink-0">{responseText}</div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-6 border-t bg-slate-50 p-4 -mx-6 -mb-6">
                  <span className="text-xs font-bold text-slate-500">🔒 Submitted data is 100% anonymous</span>
                  <button 
                    type="button" 
                    onClick={() => setShowConfirmModal(true)}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20 hover:-translate-y-0.5 active:translate-y-0 transition-all text-sm cursor-pointer"
                  >
                    Submit evalUAtion
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirmation Modal */}
        {showConfirmModal && selectedProf && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden flex flex-col p-6 space-y-4">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto">🔒</div>
                <h3 className="font-extrabold text-slate-900 text-base">Submit Anonymous Feedback</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Are you sure you want to submit your evaluation for <strong>{selectedProf.name}</strong>? This action is permanent and completely anonymous. You will not be able to change your feedback.
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button 
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  {isSubmitting ? 'Submitting...' : 'Confirm & Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
