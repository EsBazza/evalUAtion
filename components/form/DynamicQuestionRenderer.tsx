import React from 'react';
import { Controller } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui-ua/card';
import { ScaleInput } from '@/components/ui-ua/scale-input';
import { cn } from '@/lib/utils';

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
    <Card className="mb-6 overflow-visible shadow-sm border border-border/80 bg-card">
      <CardContent className="p-6 space-y-4">
        {/* Question Heading */}
        <Label className="text-sm font-semibold text-foreground block leading-relaxed tracking-wide font-sans">
          {question.question}
        </Label>

        {/* SCALE_1_TO_5 */}
        {question.type === 'SCALE_1_TO_5' && (
          <Controller
            name={`answers.${question.id}.score`}
            control={control}
            rules={{ validate: (val) => typeof val === 'number' || "This rating is required" }}
            render={({ field, fieldState: { error } }) => (
              <div className="space-y-2">
                <ScaleInput
                  value={field.value}
                  onChange={field.onChange}
                  max={5}
                  error={!!error}
                />
                {error && <p className="text-xs font-bold text-ua-crimson mt-1">{error.message}</p>}
              </div>
            )}
          />
        )}

        {/* SCALE_0_TO_4 */}
        {question.type === 'SCALE_0_TO_4' && (
          <Controller
            name={`answers.${question.id}.score`}
            control={control}
            rules={{ validate: (val) => typeof val === 'number' || "This rating is required" }}
            render={({ field, fieldState: { error } }) => (
              <div className="space-y-2">
                <ScaleInput
                  value={field.value}
                  onChange={field.onChange}
                  max={4}
                  error={!!error}
                />
                {error && <p className="text-xs font-bold text-ua-crimson mt-1">{error.message}</p>}
              </div>
            )}
          />
        )}

        {/* RADIO_EXPECTATION */}
        {question.type === 'RADIO_EXPECTATION' && (
          <Controller
            name={`answers.${question.id}.textVal`}
            control={control}
            rules={{ required: "Selection is required" }}
            render={({ field, fieldState: { error } }) => (
              <div className="space-y-2">
                <RadioGroup 
                  value={field.value || ""} 
                  onValueChange={field.onChange}
                  className="grid grid-cols-1 gap-2.5"
                >
                  {optionsList.map((opt) => {
                    const isChecked = field.value === opt;
                    return (
                      <label 
                        key={opt} 
                        htmlFor={`${question.id}-${opt}`}
                        className={cn(
                          "flex items-center space-x-3 p-3 rounded-lg border text-sm transition-all duration-150 cursor-pointer select-none min-h-[44px]",
                          isChecked 
                            ? "border-ua-navy dark:border-ua-gold bg-muted/20 text-foreground" 
                            : "border-border hover:bg-muted/35 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <RadioGroupItem value={opt} id={`${question.id}-${opt}`} />
                        <span className="font-sans font-medium text-foreground">{opt}</span>
                      </label>
                    );
                  })}
                </RadioGroup>
                {error && <p className="text-xs font-bold text-ua-crimson mt-1">{error.message}</p>}
              </div>
            )}
          />
        )}

        {/* CHECKBOX_AREAS */}
        {question.type === 'CHECKBOX_AREAS' && (
          <Controller
            name={`answers.${question.id}.jsonVal`}
            control={control}
            rules={{ validate: (val) => (Array.isArray(val) && val.length > 0) || "Please select at least one option" }}
            render={({ field, fieldState: { error } }) => {
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
                  <div className="grid grid-cols-1 gap-2.5">
                    {optionsList.map((opt) => {
                      const isChecked = selectedValues.includes(opt);
                      return (
                        <label 
                          key={opt}
                          htmlFor={`${question.id}-${opt}`}
                          className={cn(
                            "flex items-center space-x-3 p-3 rounded-lg border text-sm transition-all duration-150 cursor-pointer select-none min-h-[44px]",
                            isChecked 
                              ? "border-ua-navy dark:border-ua-gold bg-muted/20 text-foreground" 
                              : "border-border hover:bg-muted/35 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Checkbox 
                            id={`${question.id}-${opt}`} 
                            checked={isChecked}
                            onCheckedChange={(checked) => handleCheckboxChange(opt, !!checked)}
                          />
                          <span className="font-sans font-medium text-foreground">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                  {error && <p className="text-xs font-bold text-ua-crimson mt-1">{error.message}</p>}
                </div>
              );
            }}
          />
        )}

        {/* TEXT_LONG */}
        {question.type === 'TEXT_LONG' && (
          <Controller
            name={`answers.${question.id}.textVal`}
            control={control}
            rules={{ 
              required: "This feedback field is required",
              validate: (val) => (typeof val === 'string' && val.trim() !== "") || "This feedback field is required"
            }}
            render={({ field, fieldState: { error } }) => (
              <div className="space-y-2">
                <Textarea 
                  {...field} 
                  value={field.value || ""}
                  placeholder="Enter your detailed feedback here..." 
                  className={cn(
                    "min-h-[120px] w-full rounded-md border p-3 font-sans text-sm outline-none transition-all duration-200 bg-card text-foreground",
                    error 
                      ? "border-ua-crimson focus-visible:ring-ua-crimson/50" 
                      : "border-border focus-visible:border-ua-navy dark:focus-visible:border-ua-gold focus-visible:ring-2 focus-visible:ring-ua-gold/30"
                  )}
                />
                {error && <p className="text-xs font-bold text-ua-crimson mt-1">{error.message}</p>}
              </div>
            )}
          />
        )}
      </CardContent>
    </Card>
  );
}
