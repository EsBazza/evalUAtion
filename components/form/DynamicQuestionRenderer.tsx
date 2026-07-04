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
    <div className="p-5 border rounded-lg bg-gray-50/50 shadow-sm mb-5 space-y-3">
      <Label className="text-base font-medium text-gray-900 block leading-relaxed">
        {question.question}
      </Label>

      {question.type === 'SCALE_1_TO_5' && (
        <Controller
          name={`answers.${question.id}.score`}
          control={control}
          rules={{ required: "This rating is required" }}
          render={({ field, fieldState: { error } }) => (
            <div>
              <div className="flex gap-4 items-center">
                {[1, 2, 3, 4, 5].map((val) => (
                  <label key={val} className="flex flex-col items-center gap-1 cursor-pointer">
                    <input 
                      type="radio" 
                      name={field.name}
                      value={val}
                      checked={field.value === val}
                      onChange={() => field.onChange(val)}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm font-semibold">{val}</span>
                  </label>
                ))}
              </div>
              {error && <p className="text-xs text-red-500 mt-1">{error.message}</p>}
            </div>
          )}
        />
      )}

      {question.type === 'SCALE_0_TO_4' && (
        <Controller
          name={`answers.${question.id}.score`}
          control={control}
          rules={{ required: "This rating is required" }}
          render={({ field, fieldState: { error } }) => (
            <div>
              <div className="flex gap-4 items-center">
                {[0, 1, 2, 3, 4].map((val) => (
                  <label key={val} className="flex flex-col items-center gap-1 cursor-pointer">
                    <input 
                      type="radio" 
                      name={field.name}
                      value={val}
                      checked={field.value === val}
                      onChange={() => field.onChange(val)}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm font-semibold">{val}</span>
                  </label>
                ))}
              </div>
              {error && <p className="text-xs text-red-500 mt-1">{error.message}</p>}
            </div>
          )}
        />
      )}

      {question.type === 'RADIO_EXPECTATION' && (
        <Controller
          name={`answers.${question.id}.jsonVal`}
          control={control}
          rules={{ required: "Selection is required" }}
          render={({ field, fieldState: { error } }) => (
            <div>
              <RadioGroup 
                value={field.value || ""} 
                onValueChange={field.onChange}
                className="space-y-2"
              >
                {optionsList.map((opt) => (
                  <div key={opt} className="flex items-center space-x-2">
                    <RadioGroupItem value={opt} id={`${question.id}-${opt}`} />
                    <Label htmlFor={`${question.id}-${opt}`} className="text-sm font-normal text-gray-700 cursor-pointer">
                      {opt}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              {error && <p className="text-xs text-red-500 mt-1">{error.message}</p>}
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
              <div className="space-y-2">
                {optionsList.map((opt) => (
                  <div key={opt} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`${question.id}-${opt}`} 
                      checked={selectedValues.includes(opt)}
                      onCheckedChange={(checked) => handleCheckboxChange(opt, !!checked)}
                    />
                    <Label htmlFor={`${question.id}-${opt}`} className="text-sm font-normal text-gray-700 cursor-pointer">
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
          rules={{ required: "Comments are required" }}
          render={({ field, fieldState: { error } }) => (
            <div>
              <Textarea 
                {...field} 
                value={field.value || ""}
                placeholder="Enter your detailed feedback here..." 
                className="min-h-[100px] w-full"
              />
              {error && <p className="text-xs text-red-500 mt-1">{error.message}</p>}
            </div>
          )}
        />
      )}
    </div>
  );
}
