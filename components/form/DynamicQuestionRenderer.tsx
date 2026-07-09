import React from 'react';
import { Controller } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

interface DynamicQuestionRendererProps {
  question: {
    id: string;
    question: string;
    type: 'SCALE_1_TO_5' | 'SCALE_0_TO_4' | 'RADIO_EXPECTATION' | 'CHECKBOX_AREAS' | 'TEXT_LONG';
    options?: any; // String array
  };
  control: any;
}

export function DynamicQuestionRenderer({ question, control }: DynamicQuestionRendererProps) {
  const optionsList = Array.isArray(question.options) ? (question.options as string[]) : [];

  return (
    <div className="p-6 border border-slate-200/80 rounded-2xl bg-white shadow-sm mb-6 space-y-4 hover:shadow-md/50 transition-all duration-200">
      <Label className="text-sm font-bold text-slate-800 block leading-relaxed uppercase tracking-wider">
        {question.question}
      </Label>

      {question.type === 'SCALE_1_TO_5' && (
        <Controller
          name={`answers.${question.id}.score`}
          control={control}
          rules={{ validate: (val) => typeof val === 'number' || "This rating is required" }}
          render={({ field, fieldState: { error } }) => (
            <div>
              <div className="flex gap-3 sm:gap-4 items-center flex-wrap py-2">
                {[1, 2, 3, 4, 5].map((val) => {
                  const isSelected = field.value === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => field.onChange(val)}
                      className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-black text-sm transition-all duration-200 select-none cursor-pointer ${
                        isSelected
                          ? 'bg-ua-blue border-ua-blue text-white shadow-lg shadow-ua-blue/20 scale-105 ring-2 ring-ua-gold'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-350 hover:bg-slate-50'
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
              {error && <p className="text-xs font-bold text-ua-red mt-2">{error.message}</p>}
            </div>
          )}
        />
      )}

      {question.type === 'SCALE_0_TO_4' && (
        <Controller
          name={`answers.${question.id}.score`}
          control={control}
          rules={{ validate: (val) => typeof val === 'number' || "This rating is required" }}
          render={({ field, fieldState: { error } }) => (
            <div>
              <div className="flex gap-3 sm:gap-4 items-center flex-wrap py-2">
                {[0, 1, 2, 3, 4].map((val) => {
                  const isSelected = field.value === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => field.onChange(val)}
                      className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-black text-sm transition-all duration-200 select-none cursor-pointer ${
                        isSelected
                          ? 'bg-ua-blue border-ua-blue text-white shadow-lg shadow-ua-blue/20 scale-105 ring-2 ring-ua-gold'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-350 hover:bg-slate-50'
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
              {error && <p className="text-xs font-bold text-ua-red mt-2">{error.message}</p>}
            </div>
          )}
        />
      )}

      {question.type === 'RADIO_EXPECTATION' && (
        <Controller
          name={`answers.${question.id}.textVal`}
          control={control}
          rules={{ required: "Selection is required" }}
          render={({ field, fieldState: { error } }) => (
            <div>
              <RadioGroup 
                value={field.value || ""} 
                onValueChange={field.onChange}
                className="space-y-2.5"
              >
                {optionsList.map((opt) => (
                  <div key={opt} className="flex items-center space-x-2.5">
                    <RadioGroupItem value={opt} id={`${question.id}-${opt}`} />
                    <Label htmlFor={`${question.id}-${opt}`} className="text-sm font-semibold text-slate-700 cursor-pointer">
                      {opt}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              {error && <p className="text-xs font-bold text-ua-red mt-2">{error.message}</p>}
            </div>
          )}
        />
      )}

      {question.type === 'CHECKBOX_AREAS' && (
        <Controller
          name={`answers.${question.id}.jsonVal`}
          control={control}
          render={({ field }) => {
            const selectedValues: string[] = Array.isArray(field.value) ? field.value : [];
            const handleCheckboxChange = (opt: string, checked: boolean) => {
              if (checked) {
                field.onChange([...selectedValues, opt]);
              } else {
                field.onChange(selectedValues.filter(val => val !== opt));
              }
            };
            return (
              <div className="space-y-2.5">
                {optionsList.map((opt) => (
                  <div key={opt} className="flex items-center space-x-2.5">
                    <Checkbox 
                      id={`${question.id}-${opt}`} 
                      checked={selectedValues.includes(opt)}
                      onCheckedChange={(checked) => handleCheckboxChange(opt, !!checked)}
                    />
                    <Label htmlFor={`${question.id}-${opt}`} className="text-sm font-semibold text-slate-700 cursor-pointer">
                      {opt}
                    </Label>
                  </div>
                ))}
              </div>
            );
          }}
        />
      )}

      {question.type === 'TEXT_LONG' && (
        <Controller
          name={`answers.${question.id}.textVal`}
          control={control}
          render={({ field }) => (
            <div>
              <Textarea 
                {...field} 
                value={field.value || ""}
                placeholder="Enter your detailed feedback here (optional)..." 
                className="min-h-[120px] w-full border border-slate-200 rounded-xl focus-visible:ring-ua-blue font-semibold text-sm text-slate-800 placeholder:text-slate-400 p-3 bg-slate-50 focus:bg-white transition-all duration-200"
              />
            </div>
          )}
        />
      )}
    </div>
  );
}
