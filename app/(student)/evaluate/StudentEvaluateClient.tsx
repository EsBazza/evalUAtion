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
import { Footer } from '@/components/layout/Footer';
import { generateClientKeyPair, exportPublicKey, deriveSessionKey, encryptPayloadClient } from '@/lib/crypto/ecdh-client';


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
  studentName?: string;
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
        className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-white hover:bg-slate-50 text-left flex justify-between items-center font-bold disabled:opacity-50 disabled:cursor-not-allowed select-none transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-ua-blue/20"
      >
        <span className="truncate">{selectedOption ? selectedOption.name : placeholder}</span>
        <span className="text-slate-400 text-xs shrink-0 ml-2">▼</span>
      </button>

      {isOpen && !disabled && (
        <>
          <div className="fixed inset-0 z-35" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-lg p-2.5 z-40 space-y-2 animate-fade-in">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to search..."
              className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-ua-blue/20 focus:border-ua-blue transition-all font-semibold outline-none text-slate-800"
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
                      className="w-full text-left p-2.5 hover:bg-ua-blue/5 font-bold text-slate-700 hover:text-ua-blue transition rounded-lg"
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

export default function StudentEvaluateClient({ studentEmail, studentName }: StudentEvaluateClientProps) {
  let displayName = "Student";
  if (studentName) {
    const rawFirst = studentName.split(' ')[0];
    if (rawFirst) {
      displayName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase();
    }
  } else if (studentEmail) {
    const emailPrefix = studentEmail.split('@')[0];
    const firstName = emailPrefix.split('.')[0];
    if (firstName) {
      displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    }
  }

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
    shouldUnregister: false,
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
            setValue('departmentId', deps[0].id);
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
      // 1. Fetch server crypto session
      const cryptoSessionRes = await fetch('/api/crypto/session');
      if (!cryptoSessionRes.ok) {
        throw new Error('Failed to establish security session with server.');
      }
      const { sessionId, publicKey: serverPublicKeyBase64 } = await cryptoSessionRes.json();

      // 2. Perform client-side ECDH key exchange & encryption
      const clientKeyPair = await generateClientKeyPair();
      const clientPublicKey = await exportPublicKey(clientKeyPair.publicKey);
      const sessionKey = await deriveSessionKey(clientKeyPair.privateKey, serverPublicKeyBase64);

      const encrypted = await encryptPayloadClient(
        { answers: formattedAnswers },
        sessionKey
      );

      // 3. Submit encrypted evaluation details
      await submitProfessorEvaluation({
        studentEmail,
        sectionId: selectedSectionId,
        professorId: selectedProf.id,
        departmentId: selectedDepartmentId || departments[0]?.id || "",
        templateId: template.id,
        answers: formattedAnswers,
        encryptedPayload: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        clientPublicKey,
        sessionId,
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

  // Computed values
  const totalProfsCount = professors.length;
  const completedProfsCount = completedProfs.length;
  const progressPercent = totalProfsCount > 0 ? Math.round((completedProfsCount / totalProfsCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {/* Premium Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full bg-[#002366] text-white shadow-md select-none">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="/ua-logo.png" alt="UA Logo" className="w-12 h-12 object-contain rounded-full border border-white/10" />
            <div>
              <h1 className="text-[10px] font-bold tracking-widest text-slate-200 leading-none mb-1">UNIVERSITY OF THE</h1>
              <h2 className="text-lg font-black tracking-wide text-ua-gold uppercase leading-tight">Assumption</h2>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="px-5 py-2 border border-white/30 hover:bg-white/10 text-white text-xs font-bold rounded-full transition cursor-pointer select-none"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Split-Screen Sidebar Container */}
      <div className="flex-grow flex flex-col md:flex-row w-full max-w-7xl mx-auto bg-white min-h-[calc(100vh-80px-240px)] border-x border-slate-200/50">
        
        {/* Left Sidebar */}
        <aside className="w-full md:w-72 shrink-0 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200/60 p-6 flex flex-col space-y-8 select-none">
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">Welcome,<br />{displayName}!</h2>
            <p className="text-xs text-slate-400 font-semibold leading-relaxed">Your anonymous feedback contributes directly to academic quality improvement</p>
          </div>

          {/* Vertical Stepper */}
          <nav className="flex flex-col -mx-6">
            {[
              { step: 1, label: 'Parameters' },
              { step: 2, label: 'Evaluate' },
              { step: 3, label: 'Review' }
            ].map((item) => {
              const isActive = wizardStep === item.step;
              const isPassed = wizardStep > item.step;
              return (
                <div 
                  key={item.step} 
                  className={`flex items-center gap-3 px-6 py-4 transition-all font-bold text-xs ${
                    isActive 
                      ? 'bg-slate-200/60 text-[#002366]' 
                      : 'text-slate-400'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] transition-all shrink-0 ${
                    isActive 
                      ? 'bg-[#002366] text-white ring-2 ring-[#FFBD00]' 
                      : isPassed 
                      ? 'bg-emerald-500 text-white' 
                      : 'border-2 border-slate-200 bg-white text-slate-400'
                  }`}>
                    {isPassed ? '✓' : item.step}
                  </span>
                  <span className="uppercase tracking-widest leading-none mt-0.5">{item.label}</span>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Right Main Content */}
        <section className="flex-grow p-6 sm:p-8 md:p-10 space-y-6">
          <h2 className="text-xl font-black uppercase tracking-wider text-[#002366]">
            {wizardStep === 1 && 'Course Parameter'}
            {wizardStep === 2 && 'Evaluate Instructor'}
            {wizardStep === 3 && 'Review Evaluation'}
          </h2>

          <AnimatePresence mode="wait">
            {/* STEP 1: Select parameters and choose professor */}
            {wizardStep === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Parameters Panel */}
                <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-6">
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
                                className={`p-4 border rounded-2xl text-left transition-all duration-200 cursor-pointer select-none ${
                                  isActive
                                    ? 'border-ua-blue bg-ua-blue/5 ring-2 ring-ua-blue/10'
                                    : 'border-slate-200 bg-white hover:bg-slate-50'
                                }`}
                              >
                                <span className={`font-extrabold text-sm block ${isActive ? 'text-ua-blue' : 'text-slate-900'}`}>{option.title}</span>
                                <span className="text-[10px] text-slate-500 mt-1 font-semibold block">{option.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    />
                    {errors.level && <p className="text-red-600 text-xs mt-1.5 font-bold">{errors.level.message}</p>}
                  </div>

                  {/* Department and Section selectors */}
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
                          {errors.departmentId && <p className="text-red-600 text-xs mt-1.5 font-bold">{errors.departmentId.message}</p>}
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
                        {errors.sectionId && <p className="text-red-600 text-xs mt-1.5 font-bold">{errors.sectionId.message}</p>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Professor Selection Cards */}
                {selectedSectionId && (
                  <div className="space-y-6">
                    <div className="bg-white p-6 border border-slate-200/80 rounded-2xl shadow-sm space-y-4">
                      <div className="border-b pb-3">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">Your Instructors</h3>
                        <p className="text-[10px] text-slate-400 font-medium">The list of instructors assigned to your section.</p>
                      </div>

                      {professors.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50 border rounded-xl font-semibold text-slate-400">No instructors assigned to this section.</div>
                      ) : !template ? (
                        <div className="p-8 text-center bg-amber-50 border border-amber-200 rounded-xl text-amber-800 font-semibold">
                          <p>No active evaluation form template registered for this level.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {professors.map((prof) => {
                            const isCompleted = completedProfs.includes(prof.id);
                            return (
                              <div
                                key={prof.id}
                                className={`p-5 border rounded-2xl text-left transition-all duration-200 ${isCompleted
                                    ? 'border-emerald-100 bg-emerald-50/20 opacity-80'
                                    : 'border-slate-200 bg-slate-50/30'
                                  }`}
                              >
                                <div className="flex justify-between items-start gap-4">
                                  <div>
                                    <span className="font-extrabold text-sm text-slate-900 block">{prof.name}</span>
                                    <span className="text-[10px] text-slate-400 mt-1 block font-semibold">{prof.email}</span>
                                  </div>
                                  {isCompleted ? (
                                    <span className="text-[9px] px-2.5 py-1 bg-emerald-50 border border-emerald-150 text-emerald-700 rounded-full font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                                      Done
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedProf(prof);
                                        evaluationForm.reset();
                                        setWizardStep(2);
                                        setQuestionnairePage(1);
                                      }}
                                      className="text-[9px] px-2.5 py-1 bg-ua-blue hover:bg-ua-blue-dark text-white rounded-full font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
                                    >
                                      Evaluate
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {professors.length > 0 && template && (
                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            // Find first pending instructor
                            const nextPendingProf = professors.find(p => !completedProfs.includes(p.id));
                            if (nextPendingProf) {
                              setSelectedProf(nextPendingProf);
                              evaluationForm.reset();
                              setWizardStep(2);
                              setQuestionnairePage(1);
                            } else {
                              toast.error("All instructors in this section have already been evaluated!");
                            }
                          }}
                          className="px-6 py-3 bg-[#002366] hover:bg-[#00184d] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                        >
                          Start Evaluation →
                        </button>
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
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  <div className="p-6 border-b border-slate-100 bg-slate-50/40 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">
                        STEP 2: QUESTIONNAIRE {isPaginated ? `(Page ${questionnairePage} of 2)` : ''}
                      </span>
                      <h3 className="text-lg font-black text-slate-900 leading-tight">Evaluating: {selectedProf.name}</h3>
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
                      className="px-3.5 py-1.5 border border-slate-200 text-slate-500 hover:text-slate-805 hover:bg-slate-50 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      ← Back
                    </button>
                  </div>

                  <div className="p-6 space-y-6">
                    {isPaginated && (
                      <div className="flex gap-2 p-3.5 bg-ua-blue/5 border border-ua-blue/10 rounded-2xl items-center justify-between">
                        <span className="text-xs font-bold text-ua-blue-dark">Form Progress: Page {questionnairePage} of 2</span>
                        <div className="flex gap-1.5">
                          <div className={`h-2 w-10 rounded-full transition-all duration-300 ${questionnairePage === 1 ? 'bg-ua-blue' : 'bg-emerald-500'}`} />
                          <div className={`h-2 w-10 rounded-full transition-all duration-300 ${questionnairePage === 2 ? 'bg-ua-blue' : 'bg-slate-200'}`} />
                        </div>
                      </div>
                    )}

                    {/* Introductory Letter (no emojis) */}
                    {(!isPaginated || questionnairePage === 1) && (
                      <div className="bg-ua-blue/5 border border-ua-blue/10 rounded-2xl p-5 sm:p-6 mb-6 space-y-3 relative overflow-hidden text-left">
                        <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none select-none text-ua-blue text-8xl font-black">
                          UA
                        </div>
                        <h4 className="text-sm font-bold text-ua-blue flex items-center gap-2">
                          Dear Student,
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-655 leading-relaxed font-medium italic text-slate-600">
                          Please accomplish this instrument with all sincerity and honesty. Your objective assessment is counted for the further improvement of instruction. Rest assured that your responses will be held strictly confidential and will not in any manner affect your grade in the subject. The summary of the results of this evaluation will only be made available to the instructor being evaluated in the next semester.
                        </p>
                        <div className="flex justify-between items-center pt-2 border-t border-ua-blue/10 text-[10px] font-bold text-ua-blue-dark">
                          <span>Thank You.</span>
                          <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-ua-blue-dark/50">
                            Anonymous & Confidential
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Template Instructions */}
                    {template.instructions && (!isPaginated || questionnairePage === 1) && (
                      <div className="space-y-4 mb-6 text-left">
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-2">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Evaluation Instructions</h4>
                          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-semibold">
                            {template.instructions}
                          </p>
                        </div>
                        <RatingScaleLegend level={template.level} scaleType={template.scaleType} />
                      </div>
                    )}

                    <div className="space-y-6">
                      {currentClusters.map((cluster: any) => (
                        <div key={cluster.id} className="space-y-4 text-left">
                          <h4 className="text-xs font-extrabold text-slate-900 border-l-4 border-ua-blue pl-3 tracking-wide uppercase">
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
                          className="px-5 py-2.5 bg-white border border-slate-200 text-slate-655 hover:bg-slate-50 font-bold rounded-xl text-sm transition cursor-pointer"
                        >
                          ← Previous Page
                        </button>
                      ) : <div />}

                      {isPaginated && questionnairePage === 1 ? (
                        <button
                          type="button"
                          onClick={handleNextPage}
                          className="px-6 py-3 bg-ua-blue hover:bg-ua-blue-dark text-white font-bold rounded-xl shadow-lg shadow-ua-blue/10 hover:shadow-ua-blue/20 hover:-translate-y-0.5 active:translate-y-0 transition-all text-sm cursor-pointer"
                        >
                          Next Page →
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleFormSubmit}
                          className="px-6 py-3 bg-ua-blue hover:bg-ua-blue-dark text-white font-bold rounded-xl shadow-lg shadow-ua-blue/10 hover:shadow-ua-blue/20 hover:-translate-y-0.5 active:translate-y-0 transition-all text-sm cursor-pointer"
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 bg-slate-50/40 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">STEP 3: SUMMARY REVIEW</span>
                    <h3 className="text-lg font-black text-slate-900 leading-tight">Review: {selectedProf.name}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="px-3.5 py-1.5 border border-slate-200 text-slate-500 hover:text-slate-805 hover:bg-slate-50 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    ← Edit Form
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-2 divide-y divide-slate-100 text-left">
                    {template.clusters.map((cluster: any) => (
                      <div key={cluster.id} className="space-y-3 pt-4 first:pt-0">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{cluster.title}</h4>
                        {cluster.criteria.map((criterion: any) => {
                          const ans = answers[criterion.id] || {};
                          let responseText = <span className="text-slate-400 italic">No Answer</span>;

                          if (criterion.type === 'SCALE_0_TO_4' || criterion.type === 'SCALE_1_TO_5') {
                            if (typeof ans.score === 'number') {
                              responseText = <span className="text-ua-blue font-extrabold text-sm">{ans.score} / {criterion.type === 'SCALE_0_TO_4' ? '4' : '5'}</span>;
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
                                    <span key={v} className="bg-slate-100 text-slate-750 border text-[9px] px-2 py-0.5 rounded-full font-bold">{v}</span>
                                  ))}
                                </div>
                              );
                            }
                          } else if (criterion.type === 'RADIO_EXPECTATION') {
                            if (ans.textVal) {
                              responseText = <span className="bg-ua-blue/5 border border-ua-blue/10 text-ua-blue text-[10px] px-2.5 py-0.5 rounded-full font-bold">{ans.textVal}</span>;
                            }
                          }

                          return (
                            <div key={criterion.id} className="flex justify-between items-start gap-4 py-2 border-b border-slate-50 last:border-b-0">
                              <span className="text-xs font-semibold text-slate-800 leading-relaxed flex-grow">{criterion.question}</span>
                              <div className="shrink-0">{responseText}</div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center pt-6 border-t bg-slate-50 p-5 -mx-6 -mb-6">
                    <span className="text-xs font-bold text-slate-500">Submitted evaluations are anonymized and locked</span>
                    <button
                      type="button"
                      onClick={() => setShowConfirmModal(true)}
                      className="px-6 py-3 bg-[#002366] hover:bg-[#00184d] text-white font-extrabold rounded-xl shadow-lg transition-all text-xs uppercase tracking-wider cursor-pointer"
                    >
                      Submit Evaluation
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedProf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden flex flex-col p-6 space-y-4">
            <div className="text-center space-y-2">
              <h3 className="font-extrabold text-slate-900 text-base">Submit Anonymous Feedback</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                Are you sure you want to submit your evaluation for <strong>{selectedProf.name}</strong>? This action is permanent and completely anonymous.
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
                className="px-5 py-2.5 bg-[#002366] hover:bg-[#00184d] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer uppercase tracking-wider"
              >
                {isSubmitting ? 'Submitting...' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer className="mt-auto" />
    </div>
  );
}

function RatingScaleLegend({ level, scaleType }: { level: string; scaleType?: string }) {
  const isZeroToFour = scaleType ? scaleType === '0_TO_4' : (level === 'COLLEGE' || level === 'GRADUATE');
  const steps = isZeroToFour
    ? [
      { val: 0, label: 'Not at all true' },
      { val: 1, label: 'Rarely true' },
      { val: 2, label: 'Moderately true' },
      { val: 3, label: 'Mostly true' },
      { val: 4, label: 'Highly true' },
    ]
    : [
      { val: 1, label: 'Poor / Strongly Disagree' },
      { val: 2, label: 'Fair / Disagree' },
      { val: 3, label: 'Satisfactory / Neutral' },
      { val: 4, label: 'Very Satisfactory / Agree' },
      { val: 5, label: 'Outstanding / Strongly Agree' },
    ];

  return (
    <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-6 space-y-4 shadow-sm text-left">
      <div className="flex justify-between items-center pb-2 border-b border-slate-200/50 bg-transparent">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Evaluation Rating Scale</h4>
        <span className="text-[9px] bg-ua-blue/5 border border-ua-blue/10 text-ua-blue px-2.5 py-0.5 rounded-full font-bold uppercase">
          {isZeroToFour ? '0 - 4 Scale' : '1 - 5 Scale'}
        </span>
      </div>

      {/* Visual Timeline/Axis */}
      <div className="relative pt-2 pb-6">
        <div className="absolute top-[21px] left-4 right-4 h-0.5 bg-slate-200" />
        <div className="flex justify-between items-start relative z-10">
          {steps.map((step) => (
            <div key={step.val} className="flex flex-col items-center text-center space-y-2.5 max-w-[80px]">
              <div className="w-8 h-8 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center text-xs font-black text-slate-800 shadow-sm ring-4 ring-slate-50">
                {step.val}
              </div>
              <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold leading-tight">
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
