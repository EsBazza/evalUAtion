import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export interface ScaleInputProps {
  value?: number | null
  onChange: (value: number) => void
  disabled?: boolean
  error?: boolean
  max?: 4 | 5
}

const SCALE_4_OPTIONS = [
  { value: 0, label: "Poor / Strongly Disagree" },
  { value: 1, label: "Unsatisfactory / Disagree" },
  { value: 2, label: "Satisfactory / Neutral" },
  { value: 3, label: "Very Satisfactory / Agree" },
  { value: 4, label: "Outstanding / Strongly Agree" },
]

const SCALE_5_OPTIONS = [
  { value: 1, label: "Poor / Strongly Disagree" },
  { value: 2, label: "Unsatisfactory / Disagree" },
  { value: 3, label: "Satisfactory / Neutral" },
  { value: 4, label: "Very Satisfactory / Agree" },
  { value: 5, label: "Outstanding / Strongly Agree" },
]

export function ScaleInput({
  value,
  onChange,
  disabled = false,
  error = false,
  max = 4,
}: ScaleInputProps) {
  const options = max === 5 ? SCALE_5_OPTIONS : SCALE_4_OPTIONS
  const selectedOption = options.find((opt) => opt.value === value)

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Option Buttons Row */}
      <div className="flex items-center justify-between gap-2">
        {options.map((option) => {
          const isSelected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                "relative flex-1 aspect-square min-h-[48px] min-w-[48px] max-w-[64px] rounded-md border text-base font-semibold transition-all outline-none select-none flex items-center justify-center cursor-pointer",
                "focus-visible:ring-2 focus-visible:ring-ua-gold focus-visible:ring-offset-2",
                isSelected
                  ? "bg-ua-navy text-ua-warm-white border-ua-navy shadow-md dark:bg-ua-warm-white dark:text-ua-navy dark:border-ua-warm-white"
                  : "bg-card text-foreground border-border hover:bg-muted/50",
                error && !isSelected && "border-ua-crimson/50 focus-visible:ring-ua-crimson",
                disabled && "opacity-40 pointer-events-none"
              )}
            >
              {/* Scale Number */}
              <span className="relative z-10">{option.value}</span>

              {/* Selection ring highlighting */}
              {isSelected && (
                <motion.div
                  layoutId={`scale-active-indicator-${max}`}
                  className="absolute inset-0 rounded-[inherit] border-2 border-ua-gold pointer-events-none"
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  style={{ originX: 0.5, originY: 0.5 }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Helper label describing current selection */}
      <div className="min-h-[20px] text-center">
        {selectedOption ? (
          <span className="text-xs font-semibold text-ua-navy dark:text-ua-gold uppercase tracking-wider">
            {selectedOption.label}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground italic">
            Select a score from {max === 5 ? "1 to 5" : "0 to 4"}
          </span>
        )}
      </div>
    </div>
  )
}
