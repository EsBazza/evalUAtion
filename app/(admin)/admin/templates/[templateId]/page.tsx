'use client';

import { use, useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { getTemplateDetails, saveEvaluationTemplate, updateTemplateMetadata } from '@/app/actions/templates';
import { getDepartments } from '@/app/actions/admin';
import { EducationLevel, QuestionType } from '@prisma/client';
import Link from 'next/link';

interface FormValues {
  title: string;
  instructions?: string | null;
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
      options?: string[]; // Array of strings inside JSON
      order: number;
    }[];
  }[];
}

export default function TemplateEditor({ params }: { params: Promise<{ templateId: string }> }) {
  const resolvedParams = use(params);
  const templateId = resolvedParams.templateId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [departments, setDepartments] = useState<any[]>([]);

  const { register, control, handleSubmit, reset, watch, setValue } = useForm<FormValues>({
    defaultValues: {
      title: '',
      instructions: '',
      level: 'COLLEGE',
      departmentId: null,
      clusters: []
    }
  });

  const handleSaveMetadata = async () => {
    setMetadataSaving(true);
    setErrorMessage('');
    setMessage('');
    try {
      await updateTemplateMetadata(templateId, {
        title: formValues.title,
        level: formValues.level,
        departmentId: formValues.departmentId
      });
      setMessage("Template metadata updated successfully!");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update template metadata");
    } finally {
      setMetadataSaving(false);
    }
  };

  const { fields: clusterFields, append: appendCluster, remove: removeCluster } = useFieldArray({
    control,
    name: 'clusters'
  });

  // Load template details into form
  useEffect(() => {
    async function loadTemplate() {
      setLoading(true);
      try {
        const data = await getTemplateDetails(templateId);
        if (data) {
          // Format option fields from Json to string[] if needed
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
            level: data.level as EducationLevel,
            departmentId: data.departmentId || null,
            clusters: formattedClusters
          });
        }
      } catch (err) {
        setErrorMessage("Failed to load template configuration.");
      } finally {
        setLoading(false);
      }
    }
    loadTemplate();
  }, [templateId, reset]);

  const onSave = async (values: FormValues) => {
    setSaving(true);
    setErrorMessage('');
    setMessage('');
    try {
      // Re-assign order parameters based on index
      const payload = {
        ...values,
        clusters: values.clusters.map((c, cIdx) => ({
          ...c,
          order: cIdx + 1,
          criteria: c.criteria.map((q, qIdx) => ({
            ...q,
            order: qIdx + 1,
            // Strip empty options
            options: Array.isArray(q.options) ? q.options.filter(Boolean) : undefined
          }))
        }))
      };

      await saveEvaluationTemplate(templateId, payload);
      setMessage("Template successfully saved and synced with database!");
      
      // Reload template to populate newly created IDs
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
          level: data.level as EducationLevel,
          departmentId: data.departmentId || null,
          clusters: formattedClusters
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save template configuration.");
    } finally {
      setSaving(false);
    }
  };

  const formValues = watch();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-200 bg-transparent">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
            Template Builder
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-semibold">
            WYSIWYG forms compiler for University of the Assumption
          </p>
        </div>
        <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
          <button 
            onClick={() => {
              setPreviewMode(!previewMode);
              setMessage('');
              setErrorMessage('');
            }}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all border cursor-pointer ${
              previewMode 
                ? 'bg-ua-gold border-ua-gold text-slate-900 shadow-md font-extrabold' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-55 hover:bg-slate-50'
            }`}
          >
            {previewMode ? 'Back to Editor' : 'Student Preview'}
          </button>
          <Link 
            href="/admin/templates"
            className="px-4 py-2.5 text-xs font-bold bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 uppercase tracking-wider transition-all"
          >
            Cancel
          </Link>
          {!previewMode && (
            <button 
              onClick={handleSubmit(onSave)}
              disabled={saving}
              className="px-5 py-2.5 bg-ua-blue hover:bg-ua-blue-dark text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-ua-blue/10 disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving Config...' : 'Save Template'}
            </button>
          )}
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

      {loading ? (
        <div className="py-20 text-center text-slate-400 font-semibold animate-pulse bg-white border border-slate-200/80 rounded-2xl shadow-sm">
          Configuring WYSIWYG editor workspace...
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* ==================================================== */}
          {/* 1. STUDENT PREVIEW MODE */}
          {/* ==================================================== */}
          {previewMode ? (
            <div className="space-y-8 bg-white p-6 border border-slate-200 rounded-2xl shadow-sm">
              <div className="border-b pb-4 flex justify-between items-start gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-black text-slate-900">{formValues.title || 'Untitled Form'}</h2>
                  <span className="inline-block mt-2 px-3 py-1 bg-ua-blue/5 border border-ua-blue/10 text-ua-blue text-xs font-bold uppercase tracking-wider rounded-full">
                    Level: {formValues.level}
                  </span>
                </div>
                <div className="px-3 py-2 bg-slate-50 border rounded-xl font-semibold text-xs text-slate-500">
                  Student View Simulator Mode
                </div>
              </div>

              {formValues.instructions && (
                <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-1">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Instructions</h4>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium italic">
                    "{formValues.instructions}"
                  </p>
                </div>
              )}

              {formValues.clusters.length === 0 ? (
                <p className="text-slate-400 text-center py-12 text-sm italic">This form has no question sections.</p>
              ) : (
                formValues.clusters.map((cluster, cIdx) => (
                  <div key={cluster.id || cIdx} className="space-y-6">
                    <h3 className="text-sm font-extrabold text-slate-900 border-l-4 border-ua-blue pl-3 tracking-wide uppercase">
                      {cluster.title || `Cluster ${cIdx + 1}`}
                    </h3>
                    
                    {cluster.criteria.length === 0 ? (
                      <p className="text-xs text-slate-400 italic pl-3">No criteria in this cluster.</p>
                    ) : (
                      cluster.criteria.map((q, qIdx) => (
                        <div key={q.id || qIdx} className="p-5 border border-slate-200/60 bg-slate-50/50 rounded-xl space-y-3 bg-white">
                          <label className="text-sm font-bold text-slate-800 block leading-relaxed">
                            {q.question || 'Unspecified Question?'}
                          </label>

                          {q.type === 'SCALE_1_TO_5' && (
                            <div className="flex gap-3 items-center py-1 flex-wrap">
                              {[1, 2, 3, 4, 5].map(val => (
                                <label key={val} className="w-10 h-10 rounded-full border-2 border-slate-200 flex items-center justify-center font-bold text-slate-550 text-slate-500 text-xs bg-white cursor-not-allowed select-none">
                                  {val}
                                </label>
                              ))}
                            </div>
                          )}

                          {q.type === 'SCALE_0_TO_4' && (
                            <div className="flex gap-3 items-center py-1 flex-wrap">
                              {[0, 1, 2, 3, 4].map(val => (
                                <label key={val} className="w-10 h-10 rounded-full border-2 border-slate-200 flex items-center justify-center font-bold text-slate-550 text-slate-500 text-xs bg-white cursor-not-allowed select-none">
                                  {val}
                                </label>
                              ))}
                            </div>
                          )}

                          {q.type === 'RADIO_EXPECTATION' && (
                            <div className="space-y-2">
                              {(q.options || []).map((opt, oIdx) => (
                                <label key={oIdx} className="flex items-center space-x-2 text-xs font-semibold text-slate-655 cursor-not-allowed">
                                  <input type="radio" disabled className="h-4 w-4 border-gray-300" />
                                  <span>{opt}</span>
                                </label>
                              ))}
                            </div>
                          )}

                          {q.type === 'CHECKBOX_AREAS' && (
                            <div className="space-y-2">
                              {(q.options || []).map((opt, oIdx) => (
                                <label key={oIdx} className="flex items-center space-x-2 text-xs font-semibold text-slate-655 cursor-not-allowed">
                                  <input type="checkbox" disabled className="h-4 w-4 border-gray-300 rounded" />
                                  <span>{opt}</span>
                                </label>
                              ))}
                            </div>
                          )}

                          {q.type === 'TEXT_LONG' && (
                            <textarea placeholder="Student written remarks..." disabled className="w-full min-h-[80px] p-3 text-xs border border-slate-200 rounded-xl bg-white/70 font-semibold" />
                          )}
                        </div>
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
            <form onSubmit={handleSubmit(onSave)} className="space-y-8">
              
              {/* Template Settings / Form Header Editor */}
              <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Template Metadata Settings</h2>
                  <button
                    type="button"
                    onClick={handleSaveMetadata}
                    disabled={metadataSaving}
                    className="px-4 py-2 bg-ua-blue/5 border border-ua-blue/10 hover:bg-ua-blue/10 text-ua-blue text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    {metadataSaving ? "Saving Settings..." : "Update Settings"}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Form Name</label>
                    <input 
                      type="text" 
                      {...register('title')} 
                      className="w-full p-2.5 text-sm border rounded-xl bg-white font-bold text-slate-800 focus:ring-2 focus:ring-ua-blue/20 focus:border-ua-blue"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Education Level</label>
                    <select 
                      {...register('level')} 
                      className="w-full p-2.5 text-sm border rounded-xl bg-white font-bold text-slate-700 focus:ring-2 focus:ring-ua-blue/20 focus:border-ua-blue"
                    >
                      <option value="JHS">JHS</option>
                      <option value="SHS">SHS</option>
                      <option value="COLLEGE">COLLEGE</option>
                      <option value="GRADUATE">GRADUATE</option>
                    </select>
                  </div>
                  
                  {(formValues.level === 'COLLEGE' || formValues.level === 'GRADUATE') && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Department</label>
                      <select 
                        {...register('departmentId')} 
                        className="w-full p-2.5 text-sm border rounded-xl bg-white font-bold text-slate-750 focus:ring-2 focus:ring-ua-blue/20 focus:border-ua-blue"
                      >
                        <option value="">Global Template (No Department)</option>
                        {departments
                          .filter(d => d.level === formValues.level)
                          .map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Global Instructions / Guidelines</label>
                  <textarea 
                    {...register('instructions')} 
                    placeholder="e.g., Please evaluate the instructor objectively based on your experience this semester. Use the rating scale provided in each section." 
                    rows={3}
                    className="w-full p-2.5 text-xs border border-slate-200 rounded-xl bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-ua-blue/20 focus:border-ua-blue outline-none"
                  />
                </div>
              </div>

              {/* Clusters Loop */}
              {clusterFields.map((cluster, cIdx) => (
                <ClusterCard 
                  key={cluster.id} 
                  clusterIndex={cIdx} 
                  control={control} 
                  register={register} 
                  removeCluster={() => removeCluster(cIdx)} 
                  watch={watch}
                  setValue={setValue}
                />
              ))}

              {/* Add Cluster */}
              <div className="flex justify-center">
                <button 
                  type="button" 
                  onClick={() => appendCluster({ title: 'New Question Cluster', order: clusterFields.length + 1, criteria: [] })}
                  className="px-6 py-3 border-2 border-dashed border-ua-blue/30 hover:border-ua-blue text-ua-blue hover:text-ua-blue-dark text-xs font-bold rounded-2xl bg-white hover:bg-slate-50 transition-all flex items-center gap-2 cursor-pointer uppercase tracking-wider"
                >
                  + Add New Cluster Card (Form Section)
                </button>
              </div>

            </form>
          )}

        </div>
      )}

    </div>
  );
}

// Sub-component to handle Nested Criteria list inside each Cluster
interface ClusterCardProps {
  clusterIndex: number;
  control: any;
  register: any;
  removeCluster: () => void;
  watch: any;
  setValue: any;
}

function ClusterCard({ clusterIndex, control, register, removeCluster, watch, setValue }: ClusterCardProps) {
  const { fields: criteriaFields, append: appendCriterion, remove: removeCriterion } = useFieldArray({
    control,
    name: `clusters.${clusterIndex}.criteria`
  });

  const clusterTitle = watch(`clusters.${clusterIndex}.title`);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      
      {/* Cluster Header */}
      <div className="p-6 border-b border-slate-100 bg-slate-50/40 flex justify-between items-center gap-4">
        <div className="flex-grow">
          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Section Title</label>
          <input 
            type="text" 
            {...register(`clusters.${clusterIndex}.title`)} 
            className="w-full p-2 text-md font-bold text-slate-800 bg-transparent hover:bg-slate-100 border border-transparent hover:border-slate-200 rounded-lg transition-all focus:bg-slate-50"
            placeholder="e.g. Communication Skills"
            required
          />
        </div>
        <button 
          type="button" 
          onClick={removeCluster}
          className="text-[10px] text-ua-red hover:text-ua-red-dark font-extrabold uppercase tracking-wider border border-ua-red/10 rounded-xl px-3 py-1.5 hover:bg-ua-red/5 transition cursor-pointer"
        >
          Remove Section
        </button>
      </div>

      {/* Criteria (Questions) Block */}
      <div className="p-6 space-y-6 divide-y divide-slate-100">
        {criteriaFields.length === 0 ? (
          <div className="text-center text-slate-400 text-xs py-6 font-semibold italic">No questions added inside this section yet.</div>
        ) : (
          criteriaFields.map((criterion, qIdx) => {
            const pathPrefix = `clusters.${clusterIndex}.criteria.${qIdx}` as const;
            const currentType = watch(`${pathPrefix}.type`);
            const options = watch(`${pathPrefix}.options`) || [];

            const handleAddOption = () => {
              setValue(`${pathPrefix}.options`, [...options, `Choice ${options.length + 1}`]);
            };

            const handleRemoveOption = (oIdx: number) => {
              setValue(`${pathPrefix}.options`, options.filter((_: any, idx: number) => idx !== oIdx));
            };

            return (
              <div key={criterion.id} className="pt-6 first:pt-0 space-y-4">
                
                {/* Question Input Line */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-grow">
                    <label className="block text-[9px] font-bold text-slate-450 text-slate-400 uppercase tracking-wider mb-1">Question Text</label>
                    <input 
                      type="text" 
                      {...register(`${pathPrefix}.question`)}
                      className="w-full p-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50/50 font-semibold focus:bg-white focus:ring-2 focus:ring-ua-blue/20 focus:border-ua-blue"
                      placeholder="e.g. The professor comes to class on time."
                      required
                    />
                  </div>
                  <div className="w-full sm:w-56">
                    <label className="block text-[9px] font-bold text-slate-450 text-slate-400 uppercase tracking-wider mb-1">Question Input Type</label>
                    <select 
                      {...register(`${pathPrefix}.type`)}
                      className="w-full p-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50/50 font-bold text-ua-blue focus:bg-white focus:ring-2 focus:ring-ua-blue/20"
                    >
                      <option value="SCALE_1_TO_5">SCALE 1 TO 5</option>
                      <option value="SCALE_0_TO_4">SCALE 0 TO 4</option>
                      <option value="RADIO_EXPECTATION">RADIO CHOOSE ONE</option>
                      <option value="CHECKBOX_AREAS">CHECKBOX MULTI</option>
                      <option value="TEXT_LONG">TEXT FEEDBACK</option>
                    </select>
                  </div>
                </div>

                {/* Option / Preview Render depending on selection */}
                {(currentType === 'RADIO_EXPECTATION' || currentType === 'CHECKBOX_AREAS') ? (
                  <div className="p-4 bg-slate-50 rounded-xl space-y-3 border border-slate-200/50">
                    <div className="flex justify-between items-center">
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Multiple Choice Options</label>
                      <button 
                        type="button" 
                        onClick={handleAddOption}
                        className="text-[9px] font-extrabold uppercase tracking-wider text-ua-blue hover:text-ua-blue-dark cursor-pointer"
                      >
                        + Add Choice Option
                      </button>
                    </div>
                    {options.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No options defined. Click Add Option.</p>
                    ) : (
                      <div className="space-y-2">
                        {options.map((opt: string, oIdx: number) => (
                          <div key={oIdx} className="flex gap-2 items-center">
                            <span className="text-[9px] text-slate-400 font-mono">#{oIdx+1}</span>
                            <input 
                              type="text"
                              {...register(`${pathPrefix}.options.${oIdx}`)}
                              className="flex-grow p-1.5 text-xs border rounded-lg bg-white font-semibold focus:ring-1 focus:ring-ua-blue"
                              required
                            />
                            <button 
                              type="button"
                              onClick={() => handleRemoveOption(oIdx)}
                              className="text-xs text-ua-red hover:text-ua-red-dark font-bold px-1"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  // SCALE or TEXT View Placeholder
                  <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-500 font-semibold italic border border-slate-250 border-slate-200/40">
                    {currentType === 'SCALE_1_TO_5' && "Rating Scale Input: 1 to 5 values will be rendered dynamically."}
                    {currentType === 'SCALE_0_TO_4' && "Semantic Scale Input: 0 to 4 values will be rendered dynamically."}
                    {currentType === 'TEXT_LONG' && "Open remarks field: Large text input will be rendered dynamically."}
                  </div>
                )}

                {/* Remove Question */}
                <div className="flex justify-end pt-1">
                  <button 
                    type="button" 
                    onClick={() => removeCriterion(qIdx)}
                    className="text-[9px] text-ua-red hover:text-ua-red-dark font-extrabold uppercase tracking-wider cursor-pointer"
                  >
                    Delete Question Block
                  </button>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* Cluster Footer (Add Question Actions) */}
      <div className="p-4 bg-slate-50/60 border-t flex justify-end">
        <button 
          type="button" 
          onClick={() => appendCriterion({ question: '', type: 'SCALE_0_TO_4', order: criteriaFields.length + 1, options: [] })}
          className="px-4 py-2 border border-ua-blue/20 hover:border-ua-blue text-ua-blue font-bold text-xs rounded-xl bg-white hover:bg-slate-50 transition cursor-pointer"
        >
          + Add Question inside "{clusterTitle || 'this Section'}"
        </button>
      </div>

    </div>
  );
}
