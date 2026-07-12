'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { getTemplateDetails, saveEvaluationTemplate, updateTemplateMetadata } from '@/app/actions/templates';
import { getDepartments } from '@/app/actions/admin';
import { EducationLevel, QuestionType } from '@prisma/client';
import Link from 'next/link';
import { ArrowUp, ArrowDown, Trash2, Edit3, Plus, Eye, ChevronLeft } from 'lucide-react';

// UA Primitives
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui-ua/card';
import { Button } from '@/components/ui-ua/button';
import { toast } from '@/components/ui-ua/toast';
import { Modal } from '@/components/ui-ua/modal';
import { SortableGroup, SortableItem, DragHandle } from '@/components/ui-ua/sortable-item';
import { cn } from '@/lib/utils';

interface FormValues {
  title: string;
  instructions?: string | null;
  scaleType?: string;
  level: EducationLevel;
  departmentId?: string | null;
  clusters: {
    id?: string;
    title: string;
    order: number;
    criteria: {
      id?: string;
      question: string;
      type: QuestionType;
      options?: string[];
      order: number;
    }[];
  }[];
}

export function RatingScaleLegend({ level, scaleType }: { level: string; scaleType?: string }) {
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
        { val: 1, label: 'Strongly Disagree' },
        { val: 2, label: 'Disagree' },
        { val: 3, label: 'Neutral' },
        { val: 4, label: 'Agree' },
        { val: 5, label: 'Strongly Agree' },
      ];

  return (
    <Card className="border border-border/85">
      <CardHeader className="border-b border-border/40 bg-muted/10 pb-3 flex flex-row justify-between items-center">
        <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Evaluation Rating Scale</CardTitle>
        <span className="text-[9px] bg-ua-navy/5 border border-ua-navy/10 text-ua-navy dark:bg-ua-gold/15 dark:text-ua-gold dark:border-ua-gold/20 px-2.5 py-0.5 rounded-full font-bold uppercase">
          {isZeroToFour ? '0 - 4 Scale' : '1 - 5 Scale'}
        </span>
      </CardHeader>
      <CardContent className="p-6">
        {/* Visual Axis */}
        <div className="relative pt-2 pb-6">
          <div className="absolute top-[21px] left-4 right-4 h-0.5 bg-border" />
          <div className="flex justify-between items-start relative z-10">
            {steps.map((step) => (
              <div key={step.val} className="flex flex-col items-center text-center space-y-2 max-w-[80px]">
                <div className="w-8 h-8 rounded-full bg-card border-2 border-border flex items-center justify-center text-xs font-bold text-foreground shadow-sm ring-4 ring-muted">
                  {step.val}
                </div>
                <span className="text-[9px] sm:text-[10px] text-muted-foreground font-semibold leading-tight">
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

export default function TemplateEditor({ params }: { params: Promise<{ templateId: string }> }) {
  const resolvedParams = use(params);
  const templateId = resolvedParams.templateId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);

  // Modal States
  const [isClusterModalOpen, setIsClusterModalOpen] = useState(false);
  const [clusterModalTitle, setClusterModalTitle] = useState('');
  
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [targetClusterIndex, setTargetClusterIndex] = useState<number | null>(null);
  const [editQuestionIndex, setEditQuestionIndex] = useState<number | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<QuestionType>('SCALE_0_TO_4');
  const [questionOptions, setQuestionOptions] = useState<string[]>([]);
  const [newOptionText, setNewOptionText] = useState('');

  const { register, handleSubmit, reset, watch, setValue } = useForm<FormValues>({
    defaultValues: {
      title: '',
      instructions: '',
      scaleType: '0_TO_4',
      level: 'COLLEGE',
      departmentId: null,
      clusters: []
    }
  });

  const formValues = watch();
  const autosaveTimer = useRef<NodeJS.Timeout | null>(null);

  const triggerAutosave = async (updatedValues: FormValues) => {
    try {
      const payload = {
        ...updatedValues,
        clusters: updatedValues.clusters.map((c, cIdx) => ({
          ...c,
          order: cIdx + 1,
          criteria: c.criteria.map((q, qIdx) => ({
            ...q,
            order: qIdx + 1,
            options: Array.isArray(q.options) ? q.options.filter(Boolean) : undefined
          }))
        }))
      };
      await saveEvaluationTemplate(templateId, payload);
      toast.success("Template autosaved");
    } catch (err) {
      toast.error("Autosave failed", "Could not sync new order to server.");
    }
  };

  const debounceAutosave = (updatedValues: FormValues) => {
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
    }
    autosaveTimer.current = setTimeout(() => {
      triggerAutosave(updatedValues);
    }, 1000);
  };

  // Load template details
  useEffect(() => {
    async function loadTemplate() {
      setLoading(true);
      try {
        const data = await getTemplateDetails(templateId);
        if (data) {
          const formattedClusters = data.clusters.map((c) => ({
            id: c.id,
            title: c.title,
            order: c.order,
            criteria: c.criteria.map((q) => ({
              id: q.id,
              question: q.question,
              type: q.type as QuestionType,
              options: Array.isArray(q.options) ? (q.options as string[]) : [],
              order: q.order
            }))
          }));

          const deps = await getDepartments();
          setDepartments(deps);

          reset({
            title: data.title,
            instructions: data.instructions || '',
            scaleType: data.scaleType,
            level: data.level as EducationLevel,
            departmentId: data.departmentId || null,
            clusters: formattedClusters
          });
        }
      } catch (err) {
        toast.error("Failed to load template configuration.");
      } finally {
        setLoading(false);
      }
    }
    loadTemplate();
  }, [templateId, reset]);

  const handleSaveMetadata = async () => {
    setMetadataSaving(true);
    try {
      await updateTemplateMetadata(templateId, {
        title: formValues.title,
        level: formValues.level,
        scaleType: formValues.scaleType,
        departmentId: formValues.departmentId
      });
      toast.success("Template metadata updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update template metadata");
    } finally {
      setMetadataSaving(false);
    }
  };

  const onSave = async (values: FormValues) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        clusters: values.clusters.map((c, cIdx) => ({
          ...c,
          order: cIdx + 1,
          criteria: c.criteria.map((q, qIdx) => ({
            ...q,
            order: qIdx + 1,
            options: Array.isArray(q.options) ? q.options.filter(Boolean) : undefined
          }))
        }))
      };

      await saveEvaluationTemplate(templateId, payload);
      toast.success("Template successfully saved!");
      
      const data = await getTemplateDetails(templateId);
      if (data) {
        const formattedClusters = data.clusters.map((c) => ({
          id: c.id,
          title: c.title,
          order: c.order,
          criteria: c.criteria.map((q) => ({
            id: q.id,
            question: q.question,
            type: q.type as QuestionType,
            options: Array.isArray(q.options) ? (q.options as string[]) : [],
            order: q.order
          }))
        }));
        reset({
          title: data.title,
          instructions: data.instructions || '',
          scaleType: data.scaleType,
          level: data.level as EducationLevel,
          departmentId: data.departmentId || null,
          clusters: formattedClusters
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save template configuration.");
    } finally {
      setSaving(false);
    }
  };

  // Reordering handlers
  const handleReorderClusters = (newClusters: any[]) => {
    setValue("clusters", newClusters);
    debounceAutosave({ ...formValues, clusters: newClusters });
  };

  const moveClusterUp = (index: number) => {
    if (index === 0) return;
    const newClusters = [...formValues.clusters];
    const temp = newClusters[index];
    newClusters[index] = newClusters[index - 1];
    newClusters[index - 1] = temp;
    setValue("clusters", newClusters);
    debounceAutosave({ ...formValues, clusters: newClusters });
  };

  const moveClusterDown = (index: number) => {
    if (index === formValues.clusters.length - 1) return;
    const newClusters = [...formValues.clusters];
    const temp = newClusters[index];
    newClusters[index] = newClusters[index + 1];
    newClusters[index + 1] = temp;
    setValue("clusters", newClusters);
    debounceAutosave({ ...formValues, clusters: newClusters });
  };

  // Cluster Modal action
  const handleAddClusterConfirm = () => {
    if (!clusterModalTitle.trim()) {
      toast.error("Section Title is required");
      return;
    }
    const newClusters = [
      ...formValues.clusters,
      { title: clusterModalTitle, order: formValues.clusters.length + 1, criteria: [] }
    ];
    setValue("clusters", newClusters);
    setClusterModalTitle('');
    setIsClusterModalOpen(false);
    toast.success("Section added");
    debounceAutosave({ ...formValues, clusters: newClusters });
  };

  // Question Modal action
  const handleAddQuestionClick = (clusterIdx: number) => {
    setTargetClusterIndex(clusterIdx);
    setEditQuestionIndex(null);
    setQuestionText('');
    setQuestionType('SCALE_0_TO_4');
    setQuestionOptions([]);
    setIsQuestionModalOpen(true);
  };

  const handleEditQuestionClick = (clusterIdx: number, qIdx: number) => {
    const q = formValues.clusters[clusterIdx].criteria[qIdx];
    setTargetClusterIndex(clusterIdx);
    setEditQuestionIndex(qIdx);
    setQuestionText(q.question);
    setQuestionType(q.type);
    setQuestionOptions(q.options || []);
    setIsQuestionModalOpen(true);
  };

  const handleAddOption = () => {
    if (!newOptionText.trim()) return;
    setQuestionOptions([...questionOptions, newOptionText.trim()]);
    setNewOptionText('');
  };

  const handleRemoveOption = (oIdx: number) => {
    setQuestionOptions(questionOptions.filter((_, idx) => idx !== oIdx));
  };

  const handleQuestionConfirm = () => {
    if (!questionText.trim()) {
      toast.error("Question text is required");
      return;
    }
    if (targetClusterIndex === null) return;

    const newClusters = [...formValues.clusters];
    const targetCluster = newClusters[targetClusterIndex];

    const questionPayload = {
      question: questionText.trim(),
      type: questionType,
      options: (questionType === 'RADIO_EXPECTATION' || questionType === 'CHECKBOX_AREAS') ? questionOptions : [],
      order: editQuestionIndex !== null ? targetCluster.criteria[editQuestionIndex].order : targetCluster.criteria.length + 1
    };

    if (editQuestionIndex !== null) {
      targetCluster.criteria[editQuestionIndex] = {
        ...targetCluster.criteria[editQuestionIndex],
        ...questionPayload
      };
      toast.success("Question updated");
    } else {
      targetCluster.criteria.push(questionPayload);
      toast.success("Question added");
    }

    setValue("clusters", newClusters);
    setIsQuestionModalOpen(false);
    debounceAutosave({ ...formValues, clusters: newClusters });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-border/80 bg-transparent">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground tracking-wide uppercase">
            Template Builder
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-semibold">
            Active WYSIWYG Form Compiler • University of the Assumption
          </p>
        </div>
        <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
          <Button 
            uaVariant={previewMode ? "accent" : "outline"}
            onClick={() => setPreviewMode(!previewMode)}
            className="h-10 text-xs"
          >
            <Eye className="size-4 mr-2" />
            {previewMode ? 'Back to Editor' : 'Student Preview'}
          </Button>
          <Link href="/admin/templates">
            <Button uaVariant="outline" className="h-10 text-xs flex items-center justify-center">
              <ChevronLeft className="size-4 mr-2" />
              Back
            </Button>
          </Link>
          {!previewMode && (
            <Button 
              uaVariant="primary"
              onClick={handleSubmit(onSave)}
              disabled={saving}
              className="h-10 text-xs"
            >
              {saving ? 'Saving...' : 'Save Template'}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted-foreground font-semibold animate-pulse bg-card border border-border/80 rounded-lg shadow-sm">
          Configuring WYSIWYG editor workspace...
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* ==================================================== */}
          {/* 1. STUDENT PREVIEW SIMULATOR */}
          {/* ==================================================== */}
          {previewMode ? (
            <div className="space-y-8 bg-card p-6 border border-border rounded-lg shadow-sm">
              <div className="border-b border-border/40 pb-4 flex justify-between items-start gap-4 flex-wrap">
                <div>
                  <h2 className="font-serif text-xl font-bold text-ua-navy dark:text-ua-gold">{formValues.title || 'Untitled Form'}</h2>
                  <span className="inline-block mt-2 px-3 py-1 bg-ua-navy/5 border border-ua-navy/15 text-ua-navy dark:bg-ua-gold/15 dark:text-ua-gold dark:border-ua-gold/20 text-xs font-bold uppercase tracking-wider rounded-full">
                    Level: {formValues.level}
                  </span>
                </div>
                <div className="px-3 py-2 bg-muted/40 border border-border rounded-md font-semibold text-xs text-muted-foreground">
                  Student View Simulator Mode
                </div>
              </div>

              {formValues.instructions && (
                <div className="space-y-4">
                  <div className="p-4 bg-muted/20 border border-border/50 rounded-lg space-y-1">
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Instructions</h4>
                    <p className="text-xs text-foreground leading-relaxed font-medium italic">
                      "{formValues.instructions}"
                    </p>
                  </div>
                  <RatingScaleLegend level={formValues.level} scaleType={formValues.scaleType} />
                </div>
              )}

              {formValues.clusters.length === 0 ? (
                <p className="text-muted-foreground text-center py-12 text-sm italic">This form has no question sections.</p>
              ) : (
                formValues.clusters.map((cluster, cIdx) => (
                  <div key={cluster.id || cIdx} className="space-y-4">
                    <h3 className="text-sm font-bold text-ua-navy dark:text-ua-gold border-l-4 border-ua-gold pl-3 tracking-wide uppercase">
                      {cluster.title || `Cluster ${cIdx + 1}`}
                    </h3>
                    
                    {cluster.criteria.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic pl-3">No criteria in this cluster.</p>
                    ) : (
                      cluster.criteria.map((q, qIdx) => (
                        <Card key={q.id || qIdx}>
                          <CardContent className="p-5 space-y-3">
                            <label className="text-sm font-semibold text-foreground block leading-relaxed">
                              {q.question || 'Unspecified Question?'}
                            </label>

                            {q.type === 'SCALE_1_TO_5' && (
                              <div className="flex gap-2 items-center py-1 flex-wrap">
                                {[1, 2, 3, 4, 5].map(val => (
                                  <label key={val} className="w-10 h-10 rounded-full border border-border flex items-center justify-center font-bold text-muted-foreground text-xs bg-muted/25 cursor-not-allowed select-none">
                                    {val}
                                  </label>
                                ))}
                              </div>
                            )}

                            {q.type === 'SCALE_0_TO_4' && (
                              <div className="flex gap-2 items-center py-1 flex-wrap">
                                {[0, 1, 2, 3, 4].map(val => (
                                  <label key={val} className="w-10 h-10 rounded-full border border-border flex items-center justify-center font-bold text-muted-foreground text-xs bg-muted/25 cursor-not-allowed select-none">
                                    {val}
                                  </label>
                                ))}
                              </div>
                            )}

                            {q.type === 'RADIO_EXPECTATION' && (
                              <div className="space-y-2">
                                {(q.options || []).map((opt, oIdx) => (
                                  <label key={oIdx} className="flex items-center space-x-2 text-xs font-semibold text-muted-foreground cursor-not-allowed">
                                    <input type="radio" disabled className="h-4 w-4 border-border" />
                                    <span>{opt}</span>
                                  </label>
                                ))}
                              </div>
                            )}

                            {q.type === 'CHECKBOX_AREAS' && (
                              <div className="space-y-2">
                                {(q.options || []).map((opt, oIdx) => (
                                  <label key={oIdx} className="flex items-center space-x-2 text-xs font-semibold text-muted-foreground cursor-not-allowed">
                                    <input type="checkbox" disabled className="h-4 w-4 border-border rounded" />
                                    <span>{opt}</span>
                                  </label>
                                ))}
                              </div>
                            )}

                            {q.type === 'TEXT_LONG' && (
                              <textarea placeholder="Student written remarks..." disabled className="w-full min-h-[80px] p-3 text-xs border border-border rounded-lg bg-muted/25 font-semibold cursor-not-allowed" />
                            )}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            
            // ====================================================
            // 2. EDITOR MODE
            // ====================================================
            <div className="space-y-6">
              
              {/* Template settings Card */}
              <Card className="relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-ua-navy dark:bg-ua-gold" />
                <CardHeader className="border-b border-border/40 pb-4 flex flex-row justify-between items-center">
                  <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    Template Settings
                  </CardTitle>
                  <Button
                    type="button"
                    uaVariant="outline"
                    onClick={handleSaveMetadata}
                    disabled={metadataSaving}
                    className="h-9 text-xs"
                  >
                    {metadataSaving ? "Saving..." : "Update Settings"}
                  </Button>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Form Name</label>
                      <input 
                        type="text" 
                        {...register('title')} 
                        className="w-full h-10 p-2.5 text-sm border rounded-lg bg-card text-foreground font-bold focus:ring-2 focus:ring-ua-gold/30 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Education Level</label>
                      <select 
                        {...register('level')} 
                        className="w-full h-10 p-2 border border-border rounded-lg text-sm bg-card text-foreground font-bold focus:ring-2 focus:ring-ua-gold/30 outline-none"
                      >
                        <option value="JHS">JHS</option>
                        <option value="SHS">SHS</option>
                        <option value="COLLEGE">COLLEGE</option>
                        <option value="GRADUATE">GRADUATE</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Rating Scale Type</label>
                      <select 
                        {...register('scaleType')} 
                        className="w-full h-10 p-2 border border-border rounded-lg text-sm bg-card text-foreground font-bold focus:ring-2 focus:ring-ua-gold/30 outline-none"
                      >
                        <option value="0_TO_4">0 to 4 Scale (College / Graduate / SHS)</option>
                        <option value="1_TO_5">1 to 5 Scale (JHS / standard)</option>
                      </select>
                    </div>
                    
                    {(formValues.level === 'COLLEGE' || formValues.level === 'GRADUATE') ? (
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">Department</label>
                        <select 
                          {...register('departmentId')} 
                          className="w-full h-10 p-2 border border-border rounded-lg text-sm bg-card text-foreground font-bold focus:ring-2 focus:ring-ua-gold/30 outline-none"
                        >
                          <option value="">Global Template (No Department)</option>
                          {departments
                            .filter(d => d.level === formValues.level)
                            .map((d) => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                      </div>
                    ) : (
                      <div className="hidden md:block opacity-0 pointer-events-none" />
                    )}
                  </div>

                  <div className="border-t border-border/40 pt-3">
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Global Instructions / Guidelines</label>
                    <textarea 
                      {...register('instructions')} 
                      placeholder="e.g., Please evaluate the instructor objectively..." 
                      rows={3}
                      className="w-full p-3 text-xs border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Drag-and-drop sortable Group of Clusters */}
              <SortableGroup values={formValues.clusters} onReorder={handleReorderClusters}>
                {formValues.clusters.map((cluster, cIdx) => (
                  <SortableItem key={cluster.id || cIdx} value={cluster}>
                    <ClusterCard 
                      cluster={cluster}
                      clusterIndex={cIdx} 
                      register={register} 
                      watch={watch}
                      setValue={setValue}
                      formValues={formValues}
                      moveClusterUp={() => moveClusterUp(cIdx)}
                      moveClusterDown={() => moveClusterDown(cIdx)}
                      onAddQuestionClick={() => handleAddQuestionClick(cIdx)}
                      onEditQuestionClick={(qIdx) => handleEditQuestionClick(cIdx, qIdx)}
                      removeCluster={() => {
                        const newClusters = formValues.clusters.filter((_, idx) => idx !== cIdx);
                        setValue("clusters", newClusters);
                        toast.success("Section removed");
                        debounceAutosave({ ...formValues, clusters: newClusters });
                      }}
                      isFirst={cIdx === 0}
                      isLast={cIdx === formValues.clusters.length - 1}
                    />
                  </SortableItem>
                ))}
              </SortableGroup>

              {/* Add Cluster */}
              <div className="flex justify-center pt-2">
                <Button 
                  type="button" 
                  uaVariant="outline"
                  onClick={() => setIsClusterModalOpen(true)}
                  className="w-full max-w-sm border-dashed"
                >
                  <Plus className="size-4 mr-2" />
                  Add New Section Cluster
                </Button>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ==================================================== */}
      {/* 3. MODALS FOR INTERACTION */}
      {/* ==================================================== */}
      
      {/* Add Cluster Modal */}
      <Modal
        isOpen={isClusterModalOpen}
        onClose={() => setIsClusterModalOpen(false)}
        title="Add Section Cluster"
        footer={
          <>
            <Button uaVariant="ghost" onClick={() => setIsClusterModalOpen(false)}>Cancel</Button>
            <Button uaVariant="primary" onClick={handleAddClusterConfirm}>Add Section</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Section Title</label>
            <input
              type="text"
              value={clusterModalTitle}
              onChange={(e) => setClusterModalTitle(e.target.value)}
              placeholder="e.g. Communication Skills"
              className="w-full h-11 px-3 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-semibold"
              autoFocus
            />
          </div>
        </div>
      </Modal>

      {/* Add/Edit Question Modal */}
      <Modal
        isOpen={isQuestionModalOpen}
        onClose={() => setIsQuestionModalOpen(false)}
        title={editQuestionIndex !== null ? "Edit Question" : "Add Question"}
        footer={
          <>
            <Button uaVariant="ghost" onClick={() => setIsQuestionModalOpen(false)}>Cancel</Button>
            <Button uaVariant="primary" onClick={handleQuestionConfirm}>
              {editQuestionIndex !== null ? "Update" : "Add Question"}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-left">
          {/* Question Text */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Question Text</label>
            <input
              type="text"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="e.g. The professor comes to class on time."
              className="w-full h-11 px-3 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-semibold"
              required
            />
          </div>

          {/* Question Type */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Input Type</label>
            <select
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value as QuestionType)}
              className="w-full h-11 px-3 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-ua-gold/30 outline-none font-bold"
            >
              <option value="SCALE_0_TO_4">SCALE 0 TO 4</option>
              <option value="SCALE_1_TO_5">SCALE 1 TO 5</option>
              <option value="RADIO_EXPECTATION">CHOOSE ONE (Radio)</option>
              <option value="CHECKBOX_AREAS">CHOOSE MULTIPLE (Checkbox)</option>
              <option value="TEXT_LONG">WRITTEN REMARKS (Textarea)</option>
            </select>
          </div>

          {/* MCQ Options Config */}
          {(questionType === 'RADIO_EXPECTATION' || questionType === 'CHECKBOX_AREAS') && (
            <div className="space-y-3 p-4 bg-muted/20 border border-border/50 rounded-lg">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">Multiple Choice Choices</label>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newOptionText}
                  onChange={(e) => setNewOptionText(e.target.value)}
                  placeholder="Enter option choice..."
                  className="flex-grow h-9 px-3 border border-border rounded-md text-xs bg-card text-foreground focus:ring-1 focus:ring-ua-gold outline-none"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddOption(); } }}
                />
                <Button type="button" uaVariant="outline" onClick={handleAddOption} className="h-9 px-3 text-xs">
                  Add Choice
                </Button>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto pt-2">
                {questionOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center">No options defined.</p>
                ) : (
                  questionOptions.map((opt, oIdx) => (
                    <div key={oIdx} className="flex gap-2 items-center bg-card p-2 rounded border border-border text-xs">
                      <span className="text-[10px] text-muted-foreground font-semibold">#{oIdx + 1}</span>
                      <span className="flex-grow font-semibold">{opt}</span>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveOption(oIdx)}
                        className="text-xs text-ua-crimson font-bold px-1 hover:text-ua-crimson/80 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
}

// Nested Cluster Card Component
interface ClusterCardProps {
  cluster: any;
  clusterIndex: number;
  register: any;
  watch: any;
  setValue: any;
  formValues: FormValues;
  moveClusterUp: () => void;
  moveClusterDown: () => void;
  removeCluster: () => void;
  onAddQuestionClick: () => void;
  onEditQuestionClick: (qIdx: number) => void;
  isFirst: boolean;
  isLast: boolean;
}

function ClusterCard({
  cluster,
  clusterIndex,
  register,
  watch,
  setValue,
  formValues,
  moveClusterUp,
  moveClusterDown,
  removeCluster,
  onAddQuestionClick,
  onEditQuestionClick,
  isFirst,
  isLast,
}: ClusterCardProps) {
  const criteria = watch(`clusters.${clusterIndex}.criteria`) || [];
  const clusterTitle = watch(`clusters.${clusterIndex}.title`);

  const handleReorderCriteria = (newCriteria: any[]) => {
    setValue(`clusters.${clusterIndex}.criteria`, newCriteria);
    // Trigger parent autosave
    const newClusters = [...formValues.clusters];
    newClusters[clusterIndex].criteria = newCriteria;
  };

  const moveCriterionUp = (index: number) => {
    if (index === 0) return;
    const newCriteria = [...criteria];
    const temp = newCriteria[index];
    newCriteria[index] = newCriteria[index - 1];
    newCriteria[index - 1] = temp;
    setValue(`clusters.${clusterIndex}.criteria`, newCriteria);
  };

  const moveCriterionDown = (index: number) => {
    if (index === criteria.length - 1) return;
    const newCriteria = [...criteria];
    const temp = newCriteria[index];
    newCriteria[index] = newCriteria[index + 1];
    newCriteria[index + 1] = temp;
    setValue(`clusters.${clusterIndex}.criteria`, newCriteria);
  };

  return (
    <Card className="border border-border/80 bg-card overflow-visible">
      {/* Cluster Header with DragHandle and mobile arrows */}
      <div className="p-4 border-b border-border/40 bg-muted/10 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-grow">
          {/* Drag Handle primitive */}
          <DragHandle />
          
          <div className="w-8 h-8 rounded-md bg-ua-navy/5 border border-ua-navy/10 text-ua-navy dark:bg-ua-gold/10 dark:text-ua-gold dark:border-ua-gold/20 flex items-center justify-center font-bold text-xs">
            {clusterIndex + 1}
          </div>

          <div className="flex-grow max-w-sm">
            <input 
              type="text" 
              {...register(`clusters.${clusterIndex}.title`)} 
              className="w-full p-1 text-sm font-bold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-ua-navy dark:focus:border-ua-gold rounded outline-none"
              placeholder="e.g. Communication Skills"
              required
            />
          </div>
        </div>

        {/* Mobile Up/Down Arrows and remove actions */}
        <div className="flex items-center gap-2">
          {/* Mobile reorder fallbacks */}
          <div className="flex items-center border border-border rounded-md overflow-hidden bg-card">
            <button
              type="button"
              disabled={isFirst}
              onClick={moveClusterUp}
              className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
              title="Move Section Up"
            >
              <ArrowUp className="size-3.5" />
            </button>
            <div className="w-px h-4 bg-border" />
            <button
              type="button"
              disabled={isLast}
              onClick={moveClusterDown}
              className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
              title="Move Section Down"
            >
              <ArrowDown className="size-3.5" />
            </button>
          </div>

          <Button 
            type="button" 
            uaVariant="destructive"
            onClick={removeCluster}
            className="h-8 px-2.5 text-xs font-semibold"
          >
            Remove Section
          </Button>
        </div>
      </div>

      {/* Criteria sortable list */}
      <CardContent className="p-6 space-y-4">
        {criteria.length === 0 ? (
          <div className="text-center text-muted-foreground/60 text-xs py-8 italic">No questions inside this section. Click below to add.</div>
        ) : (
          <SortableGroup values={criteria} onReorder={handleReorderCriteria}>
            {criteria.map((criterion: any, qIdx: number) => (
              <SortableItem key={criterion.id || qIdx} value={criterion}>
                <div className="flex items-center justify-between gap-3 p-3 bg-muted/20 border border-border/50 rounded-lg group">
                  <div className="flex items-center gap-3 flex-grow min-w-0">
                    <DragHandle />
                    <span className="text-[10px] font-bold text-muted-foreground font-mono">Q{qIdx + 1}</span>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-foreground truncate">{criterion.question || "Empty Question"}</p>
                      <span className="text-[9px] bg-ua-navy/5 border border-ua-navy/10 text-ua-navy dark:bg-ua-gold/15 dark:text-ua-gold dark:border-ua-gold/20 font-bold px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider">{criterion.type}</span>
                    </div>
                  </div>

                  {/* Actions (arrows fallback, edit, delete) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex items-center border border-border rounded-md overflow-hidden bg-card">
                      <button
                        type="button"
                        disabled={qIdx === 0}
                        onClick={() => moveCriterionUp(qIdx)}
                        className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp className="size-3" />
                      </button>
                      <div className="w-px h-3.5 bg-border" />
                      <button
                        type="button"
                        disabled={qIdx === criteria.length - 1}
                        onClick={() => moveCriterionDown(qIdx)}
                        className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown className="size-3" />
                      </button>
                    </div>

                    <Button
                      type="button"
                      uaVariant="outline"
                      onClick={() => onEditQuestionClick(qIdx)}
                      className="h-7 w-7 p-0 flex items-center justify-center"
                      title="Edit Question"
                    >
                      <Edit3 className="size-3" />
                    </Button>
                    
                    <Button
                      type="button"
                      uaVariant="destructive"
                      onClick={() => {
                        const newCriteria = criteria.filter((_: any, idx: number) => idx !== qIdx);
                        setValue(`clusters.${clusterIndex}.criteria`, newCriteria);
                        toast.success("Question deleted");
                      }}
                      className="h-7 w-7 p-0 flex items-center justify-center"
                      title="Delete Question"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              </SortableItem>
            ))}
          </SortableGroup>
        )}
      </CardContent>

      {/* Cluster Footer */}
      <CardFooter className="p-4 bg-muted/10 border-t flex justify-end">
        <Button 
          type="button" 
          uaVariant="outline"
          onClick={onAddQuestionClick}
          className="h-9 text-xs"
        >
          <Plus className="size-3.5 mr-1.5" />
          Add Question in "{clusterTitle || 'this Section'}"
        </Button>
      </CardFooter>

    </Card>
  );
}
