'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getDepartments, getSections, getProfessorsBySection, getEvaluationTemplate, submitProfessorEvaluation } from '@/app/actions/student';
import { DynamicQuestionRenderer } from '@/components/form/DynamicQuestionRenderer';
import { toast } from '@/components/ui-ua/toast';
import { Button } from '@/components/ui-ua/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui-ua/card';
import { ClusterStepper } from '@/components/ui-ua/cluster-stepper';
import { Modal } from '@/components/ui-ua/modal';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut } from 'next-auth/react';
import { Footer } from '@/components/layout/Footer';
import { generateClientKeyPair, exportPublicKey, deriveSessionKey, encryptPayloadClient } from '@/lib/crypto/ecdh-client';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

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
        className="w-full h-11 px-3 border border-border rounded-lg text-sm bg-card hover:bg-muted/40 text-left flex justify-between items-center font-medium disabled:opacity-50 disabled:cursor-not-allowed select-none transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-ua-gold/30 cursor-pointer"
      >
        <span className="truncate">{selectedOption ? selectedOption.name : placeholder}</span>
        <span className="text-muted-foreground text-[10px] shrink-0 ml-2">▼</span>
      </button>
      
      {isOpen && !disabled && (
        <>
          <div className="fixed inset-0 z-35" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-1.5 w-full bg-card border border-border rounded-lg shadow-lg p-2.5 z-40 space-y-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to search..."
              className="w-full h-9 p-2.5 text-xs border border-border rounded-md focus:ring-2 focus:ring-ua-gold/30 focus:border-ua-navy dark:focus:border-ua-gold transition-all font-medium outline-none bg-card text-foreground"
              autoFocus
            />
            <ul className="max-h-40 overflow-y-auto divide-y divide-border text-xs">
              {filtered.length === 0 ? (
                <li className="p-3 text-muted-foreground text-center font-medium">{emptyMessage}</li>
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
                      className="w-full text-left p-2.5 hover:bg-muted font-medium text-foreground transition rounded-md cursor-pointer"
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
  const [currentClusterIndex, setCurrentClusterIndex] = useState(0); // Tracks current cluster screen
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
      evaluationForm.reset();

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
      evaluationForm.reset();
      getSections(selectedDepartmentId).then(setSections);
    }
  }, [selectedDepartmentId, setValue]);

  useEffect(() => {
    if (selectedSectionId) {
      getProfessorsBySection(selectedSectionId).then(setProfessors);
      evaluationForm.reset();
      
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

  const isClusterAnswered = (cluster: any) => {
    if (!cluster) return true;
    return cluster.criteria.every((crit: any) => {
      if (!crit.isMandatory) return true;
      const ans = answers[crit.id];
      if (!ans) return false;
      if (crit.type === 'SCALE_1_TO_5' || crit.type === 'SCALE_0_TO_4') {
        return typeof ans.score === 'number';
      }
      if (crit.type === 'TEXT_LONG' || crit.type === 'RADIO_EXPECTATION') {
        return typeof ans.textVal === 'string' && ans.textVal.trim() !== "";
      }
      if (crit.type === 'CHECKBOX_AREAS') {
        return Array.isArray(ans.jsonVal) && ans.jsonVal.length > 0;
      }
      return false;
    });
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
      const cryptoSessionRes = await fetch('/api/crypto/session');
      if (!cryptoSessionRes.ok) {
        throw new Error('Failed to establish security session with server.');
      }
      const { sessionId, publicKey: serverPublicKeyBase64 } = await cryptoSessionRes.json();

      const clientKeyPair = await generateClientKeyPair();
      const clientPublicKey = await exportPublicKey(clientKeyPair.publicKey);
      const sessionKey = await deriveSessionKey(clientKeyPair.privateKey, serverPublicKeyBase64);

      const encrypted = await encryptPayloadClient(
        { answers: formattedAnswers },
        sessionKey
      );

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
      
      evaluationForm.reset();
      setSelectedProf(null);
      setWizardStep(1);
      setCurrentClusterIndex(0);
      setShowConfirmModal(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit evaluation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const allCompleted = professors.length > 0 && professors.every(p => completedProfs.includes(p.id));

  // RENDER COMPLETION SCREEN (Post-Submit signature flame motif)
  if (allCompleted) {
    return (
      <div className="min-h-screen bg-background flex flex-col font-sans">
        <header className="w-full bg-ua-navy text-ua-warm-white border-b border-border/20 py-4 px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <img src="/ua-logo.png" alt="UA Logo" className="w-10 h-10 object-contain rounded-full" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-ua-gold">University of the Assumption</h2>
            </div>
          </div>
          <Button
            uaVariant="destructive"
            onClick={() => signOut({ callbackUrl: '/' })}
            className="h-9 px-4 text-xs"
          >
            Sign Out
          </Button>
        </header>

        <main className="flex-grow flex flex-col items-center justify-center max-w-md mx-auto px-4 py-16 text-center space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-ua-gold/10 rounded-full blur-xl scale-125" />
            <div className="w-20 h-20 bg-ua-navy border border-ua-gold rounded-full flex items-center justify-center shadow-lg relative z-10">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="size-10 text-ua-gold"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18a3.75 3.75 0 0 0 .495-7.467 5.99 5.99 0 0 0-1.925 3.546 5.974 5.974 0 0 1-2.133-1A3.75 3.75 0 0 0 12 18Z"
                />
              </svg>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] tracking-wider uppercase font-semibold text-ua-gold bg-ua-navy px-3 py-1 rounded">
              Scientia · Virtus · Communitas
            </span>
            <h1 className="font-serif text-2xl font-bold text-ua-navy dark:text-ua-gold pt-2">
              Evaluations Completed
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Thank you, <span className="font-semibold text-foreground">{displayName}</span>. Your evaluations for this section have been securely and anonymously submitted. Your feedback helps UA maintain its commitment to educational excellence.
            </p>
          </div>

          <div className="w-full pt-4 flex flex-col gap-2">
            <Button
              uaVariant="primary"
              onClick={() => {
                setValue('sectionId', '');
                setValue('departmentId', '');
                setTemplate(null);
                setProfessors([]);
                setCompletedProfs([]);
              }}
              className="w-full"
            >
              Evaluate Another Section
            </Button>
            <Button
              uaVariant="destructive"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="w-full h-9 text-xs"
            >
              Sign Out
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full bg-ua-navy text-ua-warm-white border-b border-border/20 shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="/ua-logo.png" alt="UA Logo" className="w-10 h-10 object-contain rounded-full" />
            <div>
              <h1 className="text-[10px] font-semibold tracking-wider text-ua-gold leading-none mb-1">UNIVERSITY OF THE</h1>
              <h2 className="text-base font-bold tracking-wide uppercase leading-tight">Assumption</h2>
            </div>
          </div>
          <Button
            uaVariant="destructive"
            onClick={() => signOut({ callbackUrl: '/' })}
            className="h-9 px-4 text-xs"
          >
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className={cn(
        "flex-grow max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-8",
        wizardStep === 2 && "max-w-xl p-0" // Narrower container for stepper
      )}>
        
        {/* Welcome & Profile State Card - hide when in stepper mode to prevent distraction */}
        {wizardStep !== 2 && (
          <Card className="border border-border/80">
            <CardContent className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">Welcome, {displayName}!</h2>
                <p className="text-xs text-muted-foreground font-medium">Your anonymous feedback contributes directly to academic quality improvement.</p>
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <div className="px-3 py-1.5 rounded-lg bg-muted/40 border border-border text-[10px] font-medium text-muted-foreground truncate max-w-xs shadow-inner">
                  User: <span className="font-semibold text-foreground">{studentEmail}</span>
                </div>
                {selectedLevel && (
                  <span className="px-3 py-1.5 rounded-lg bg-ua-gold/10 border border-ua-gold/30 text-[10px] font-bold text-ua-gold-dark dark:text-ua-gold uppercase tracking-wider">
                    {selectedLevel}
                  </span>
                )}
                {selectedSectionId && sections.find(s => s.id === selectedSectionId) && (
                  <span className="px-3 py-1.5 rounded-lg bg-ua-navy text-ua-warm-white border border-ua-navy text-[10px] font-bold uppercase tracking-wider shadow-sm">
                    Sec: {sections.find(s => s.id === selectedSectionId)?.name}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Wizard Steps indicator - hide when in stepper mode to prevent distraction */}
        {wizardStep !== 2 && (
          <div className="flex items-center justify-between max-w-md mx-auto bg-card p-3 rounded-lg border border-border/80 shadow-sm">
            {[
              { step: 1, label: 'Parameters' },
              { step: 2, label: 'Evaluate' },
              { step: 3, label: 'Review' }
            ].map((item) => (
              <div key={item.step} className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                  wizardStep === item.step 
                    ? 'bg-ua-navy text-ua-warm-white shadow-md shadow-ua-navy/20 ring-2 ring-ua-gold' 
                    : wizardStep > item.step 
                    ? 'bg-emerald-500 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {wizardStep > item.step ? '✓' : item.step}
                </span>
                <span className={`text-[10px] font-bold tracking-wide uppercase ${
                  wizardStep === item.step ? 'text-ua-navy dark:text-ua-gold' : 'text-muted-foreground'
                }`}>{item.label}</span>
              </div>
            ))}
          </div>
        )}

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
              <Card className="border border-border/80 bg-card">
                <CardHeader className="border-b border-border/40 pb-4">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-ua-navy dark:text-ua-gold">
                    Course Parameters
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* Level Select Cards */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Education Level</label>
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
                                className={cn(
                                  "p-4 border rounded-lg text-left transition-all duration-200 cursor-pointer min-h-[44px]",
                                  isActive 
                                    ? 'border-ua-navy bg-ua-navy/5 dark:border-ua-gold dark:bg-ua-gold/5 ring-2 ring-ua-gold/30' 
                                    : 'border-border bg-card hover:bg-muted/40'
                                )}
                              >
                                <span className={cn("font-bold text-sm block", isActive ? 'text-ua-navy dark:text-ua-gold' : 'text-foreground')}>{option.title}</span>
                                <span className="text-[10px] text-muted-foreground mt-1 font-medium block">{option.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    />
                    {errors.level && <p className="text-ua-crimson text-xs mt-1.5 font-bold">{errors.level.message}</p>}
                  </div>

                  {/* Department and Section dropdowns */}
                  {selectedLevel && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                      {selectedLevel !== 'JHS' && selectedLevel !== 'SHS' && (
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Department</label>
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
                          {errors.departmentId && <p className="text-ua-crimson text-xs mt-1.5 font-bold">{errors.departmentId.message}</p>}
                        </div>
                      )}

                      <div className={(selectedLevel === 'JHS' || selectedLevel === 'SHS') ? 'md:col-span-2 space-y-1.5' : 'space-y-1.5'}>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assigned Section</label>
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
                        {errors.sectionId && <p className="text-ua-crimson text-xs mt-1.5 font-bold">{errors.sectionId.message}</p>}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Professor Selection Cards */}
              {selectedSectionId && (
                <div className="space-y-6">
                  <Card className="border border-border/80 bg-card">
                    <CardHeader className="border-b border-border/40 pb-4">
                      <CardTitle className="text-sm font-bold uppercase tracking-wider text-ua-navy dark:text-ua-gold">
                        Your Instructors
                      </CardTitle>
                      <CardDescription>
                        The list of instructors assigned to your section.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                      {professors.length === 0 ? (
                        <div className="p-8 text-center bg-muted/20 border border-dashed rounded-lg font-medium text-muted-foreground">No instructors assigned to this section.</div>
                      ) : !template ? (
                        <div className="p-8 text-center bg-ua-gold/5 border border-ua-gold/25 rounded-lg text-ua-gold-dark dark:text-ua-gold font-medium">
                          <p>No active evaluation form template registered for this level.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {professors.map((prof) => {
                            const isCompleted = completedProfs.includes(prof.id);
                            return (
                              <div
                                key={prof.id}
                                className={cn(
                                  "p-5 border rounded-lg text-left transition-all duration-200",
                                  isCompleted 
                                    ? 'border-emerald-100 bg-emerald-50/10 dark:border-emerald-950 dark:bg-emerald-950/10 opacity-80' 
                                    : 'border-border bg-card'
                                )}
                              >
                                <div className="flex justify-between items-start gap-4">
                                  <div>
                                    <span className="font-bold text-sm text-foreground block">{prof.name}</span>
                                    <span className="text-[10px] text-muted-foreground mt-1 block font-medium">{prof.email}</span>
                                  </div>
                                  {isCompleted ? (
                                    <span className="text-[9px] px-2.5 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
                                      ✓ Done
                                    </span>
                                  ) : (
                                    <span className="text-[9px] px-2.5 py-1 bg-ua-navy/5 border border-ua-navy/10 text-ua-navy dark:bg-ua-gold/10 dark:border-ua-gold/20 dark:text-ua-gold rounded-full font-bold uppercase tracking-wider shrink-0">
                                      Pending
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {professors.length > 0 && template && (
                    <div className="flex justify-end pt-2">
                      <Button
                        type="button"
                        uaVariant="primary"
                        onClick={() => {
                          const nextPendingProf = professors.find(p => !completedProfs.includes(p.id));
                          if (nextPendingProf) {
                            setSelectedProf(nextPendingProf);
                            evaluationForm.reset();
                            setWizardStep(2);
                            setCurrentClusterIndex(0);
                          } else {
                            toast.error("All instructors in this section have already been evaluated!");
                          }
                        }}
                        className="flex items-center gap-1.5"
                      >
                        Start Evaluation
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 2: Fill Questionnaire (Now paginated ONE CLUSTER per screen via Stepper) */}
          {wizardStep === 2 && selectedProf && template && (
            <motion.div 
              key={`step-2-${selectedProf.id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ClusterStepper
                clusters={template.clusters}
                currentIndex={currentClusterIndex}
                isSubmitting={isSubmitting}
                disableNext={!isClusterAnswered(template.clusters[currentClusterIndex])}
                onBack={() => {
                  if (currentClusterIndex > 0) {
                    setCurrentClusterIndex(prev => prev - 1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  } else {
                    evaluationForm.reset();
                    setSelectedProf(null);
                    setWizardStep(1);
                  }
                }}
                onNext={async () => {
                  const currentCluster = template.clusters[currentClusterIndex];
                  const fieldsToValidate = currentCluster.criteria.map((crit: any) => {
                    if (crit.type === 'SCALE_1_TO_5' || crit.type === 'SCALE_0_TO_4') {
                      return `answers.${crit.id}.score`;
                    }
                    if (crit.type === 'TEXT_LONG' || crit.type === 'RADIO_EXPECTATION') {
                      return `answers.${crit.id}.textVal`;
                    }
                    return `answers.${crit.id}.jsonVal`;
                  });
                  // @ts-ignore
                  const isValid = await evaluationForm.trigger(fieldsToValidate);
                  if (isValid) {
                    if (currentClusterIndex < template.clusters.length - 1) {
                      setCurrentClusterIndex(prev => prev + 1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    } else {
                      setWizardStep(3);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  } else {
                    toast.error("Please answer all required questions on this screen.");
                  }
                }}
              >
                {/* Introductory Letter on first screen */}
                {currentClusterIndex === 0 && (
                  <Card className="border border-border/80 bg-card mb-6">
                    <CardContent className="p-6 space-y-3 relative overflow-hidden">
                      <h4 className="text-sm font-bold text-ua-navy dark:text-ua-gold">
                        Dear Student,
                      </h4>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed italic">
                        Please accomplish this instrument with all sincerity and honesty. Your objective assessment is counted for the further improvement of instruction. Rest assured that your responses will be held strictly confidential and will not in any manner affect your grade in the subject. The summary of the results of this evaluation will only be made available to the instructor being evaluated in the next semester.
                      </p>
                      <div className="flex justify-between items-center pt-2 border-t border-border/40 text-[10px] font-semibold text-muted-foreground">
                        <span>Thank You.</span>
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50">
                          Anonymous & Confidential
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Template Instructions & Legend on first screen */}
                {currentClusterIndex === 0 && (
                  <div className="space-y-4 mb-6">
                    {template.instructions && (
                      <Card className="border border-border/80 bg-card">
                        <CardContent className="p-6 space-y-2">
                          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Evaluation Instructions</h4>
                          <p className="text-xs sm:text-sm text-foreground leading-relaxed">
                            {template.instructions}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                    <RatingScaleLegend level={template.level} scaleType={template.scaleType} />
                  </div>
                )}

                {/* Active Cluster questions */}
                <div className="space-y-6">
                  <div className="border-b border-border/50 pb-2 mb-4">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">Evaluating: {selectedProf.name}</span>
                    <h3 className="font-serif text-xl font-bold text-ua-navy dark:text-ua-gold uppercase tracking-wide">
                      {template.clusters[currentClusterIndex].title}
                    </h3>
                  </div>
                  
                  <div className="space-y-6">
                    {template.clusters[currentClusterIndex].criteria.map((criterion: any) => (
                      <DynamicQuestionRenderer 
                        key={criterion.id} 
                        question={criterion} 
                        control={evaluationForm.control} 
                      />
                    ))}
                  </div>
                </div>
              </ClusterStepper>
            </motion.div>
          )}

          {/* STEP 3: Review Answers Summary */}
          {wizardStep === 3 && selectedProf && template && (
            <motion.div 
              key="step-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <Card className="border border-border/80 bg-card">
                <CardHeader className="border-b border-border/40 pb-4 flex flex-row justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-0.5">STEP 3: SUMMARY REVIEW</span>
                    <CardTitle className="text-lg font-bold">Reviewing: {selectedProf.name}</CardTitle>
                  </div>
                  <Button
                    uaVariant="outline"
                    onClick={() => {
                      setWizardStep(2);
                      setCurrentClusterIndex(template.clusters.length - 1);
                    }}
                    className="h-9 text-xs"
                  >
                    ← Edit Answers
                  </Button>
                </CardHeader>

                <CardContent className="p-6">
                  <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-2 divide-y divide-border/60">
                    {template.clusters.map((cluster: any) => (
                      <div key={cluster.id} className="space-y-3 pt-4 first:pt-0">
                        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{cluster.title}</h4>
                        {cluster.criteria.map((criterion: any) => {
                          const ans = answers[criterion.id] || {};
                          let responseText = <span className="text-muted-foreground/60 italic text-xs">No Answer</span>;

                          if (criterion.type === 'SCALE_0_TO_4' || criterion.type === 'SCALE_1_TO_5') {
                            if (typeof ans.score === 'number') {
                              responseText = <span className="text-ua-navy dark:text-ua-gold font-bold text-sm">{ans.score} / {criterion.type === 'SCALE_0_TO_4' ? '4' : '5'}</span>;
                            }
                          } else if (criterion.type === 'TEXT_LONG') {
                            if (ans.textVal) {
                              responseText = <span className="text-foreground font-medium italic text-xs">"{ans.textVal}"</span>;
                            }
                          } else if (criterion.type === 'CHECKBOX_AREAS') {
                            if (ans.jsonVal && Array.isArray(ans.jsonVal) && ans.jsonVal.length > 0) {
                              responseText = (
                                <div className="flex flex-wrap gap-1 mt-1 justify-end">
                                  {ans.jsonVal.map((v: string) => (
                                    <span key={v} className="bg-muted text-foreground border border-border text-[9px] px-2 py-0.5 rounded-full font-bold">{v}</span>
                                  ))}
                                </div>
                              );
                            }
                          } else if (criterion.type === 'RADIO_EXPECTATION') {
                            if (ans.textVal) {
                              responseText = <span className="bg-ua-navy/5 border border-ua-navy/10 text-ua-navy dark:bg-ua-gold/10 dark:border-ua-gold/20 dark:text-ua-gold text-[10px] px-2.5 py-0.5 rounded-full font-bold">{ans.textVal}</span>;
                            }
                          }

                          return (
                            <div key={criterion.id} className="flex justify-between items-start gap-4 py-2 border-b border-border/20 last:border-b-0">
                              <span className="text-xs font-semibold text-foreground leading-relaxed flex-grow">{criterion.question}</span>
                              <div className="shrink-0">{responseText}</div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center p-6 border-t border-border/40 bg-muted/20">
                  <span className="text-xs text-muted-foreground font-medium">Submitted evaluations are permanently anonymous and locked.</span>
                  <Button 
                    type="button" 
                    uaVariant="accent"
                    onClick={() => setShowConfirmModal(true)}
                  >
                    Submit Evaluation
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirmation Modal */}
        <Modal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          title="Submit Anonymous Feedback"
          description="Permanent and completely anonymous."
          footer={
            <>
              <Button 
                uaVariant="ghost" 
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                uaVariant="accent"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Confirm & Submit'}
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted-foreground leading-relaxed">
            Are you sure you want to submit your evaluation for <strong>{selectedProf?.name}</strong>? This action is permanent and completely anonymous. Your responses cannot be altered post-submission.
          </p>
        </Modal>
      </main>
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
    <Card className="border border-border/85 bg-card">
      <CardHeader className="flex flex-row justify-between items-center pb-2 border-b border-border/40">
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Rating Scale Legend</h4>
        <span className="text-[9px] bg-ua-navy/5 border border-ua-navy/10 text-ua-navy px-2.5 py-0.5 rounded-full font-bold uppercase dark:bg-ua-gold/10 dark:text-ua-gold dark:border-ua-gold/20">
          {isZeroToFour ? '0 - 4 Scale' : '1 - 5 Scale'}
        </span>
      </CardHeader>
      <CardContent className="p-6">
        <div className="relative pt-2 pb-6">
          <div className="absolute top-[21px] left-4 right-4 h-0.5 bg-border" />
          <div className="flex justify-between items-start relative z-10">
            {steps.map((step) => (
              <div key={step.val} className="flex flex-col items-center text-center space-y-2.5 max-w-[80px]">
                <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-xs font-bold text-foreground shadow-sm">
                  {step.val}
                </div>
                <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium leading-tight">
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
