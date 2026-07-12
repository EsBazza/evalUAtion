import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export interface ProgressBarProps {
  value: number
  className?: string
  animate?: boolean
}

export function ProgressBar({ value, className, animate = true }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value))

  return (
    <div className={cn("w-full h-2.5 bg-muted rounded-full overflow-hidden border border-border/20", className)}>
      {animate ? (
        <motion.div
          className="h-full bg-ua-gold rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${clampedValue}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      ) : (
        <div
          className="h-full bg-ua-gold rounded-full transition-all duration-300"
          style={{ width: `${clampedValue}%` }}
        />
      )}
    </div>
  )
}
