import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { ProgressBar } from "./progress-bar"
import { Button } from "./button"
import { pageTransition } from "@/lib/motion"

export interface Cluster {
  id: string
  title: string
  [key: string]: any
}

export interface ClusterStepperProps {
  clusters: Cluster[]
  currentIndex: number
  onNext: () => void
  onBack: () => void
  children: React.ReactNode
  disableNext?: boolean
  isSubmitting?: boolean
}

export function ClusterStepper({
  clusters,
  currentIndex,
  onNext,
  onBack,
  children,
  disableNext = false,
  isSubmitting = false,
}: ClusterStepperProps) {
  const total = clusters.length
  const progress = total > 0 ? ((currentIndex + 1) / total) * 100 : 0
  const currentCluster = clusters[currentIndex]

  return (
    <div className="flex flex-col min-h-screen pb-[80px]">
      {/* Sticky Top Progress Header */}
      <header className="sticky top-0 bg-background/90 backdrop-blur-sm z-30 border-b border-border/60 py-4 px-4 shadow-sm">
        <div className="max-w-xl mx-auto space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-ua-navy dark:text-ua-gold uppercase tracking-wider">
              {currentCluster?.title || `Cluster ${currentIndex + 1}`}
            </span>
            <span className="text-muted-foreground font-medium">
              Step {currentIndex + 1} of {total}
            </span>
          </div>
          <ProgressBar value={progress} />
        </div>
      </header>

      {/* Main Animated content area */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            className="w-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Sticky Bottom Nav */}
      <footer className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/80 p-4 z-30 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
          <Button
            uaVariant="outline"
            onClick={onBack}
            disabled={isSubmitting}
            className="flex-1 h-11"
          >
            <ChevronLeft className="size-4 mr-2" />
            Back
          </Button>

          <Button
            uaVariant={currentIndex === total - 1 ? "accent" : "primary"}
            onClick={onNext}
            disabled={disableNext || isSubmitting}
            className="flex-1 h-11"
          >
            {currentIndex === total - 1 ? (
              isSubmitting ? "Submitting..." : "Submit Evaluation"
            ) : (
              <>
                Next
                <ChevronRight className="size-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </footer>
    </div>
  )
}
