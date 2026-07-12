"use client"

import * as React from "react"
import { Button } from "@/components/ui-ua/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui-ua/card"
import { ProgressBar } from "@/components/ui-ua/progress-bar"
import { Modal } from "@/components/ui-ua/modal"
import { toast } from "@/components/ui-ua/toast"

export default function UIPreviewPage() {
  const [progress, setProgress] = React.useState(33)
  const [isModalOpen, setIsModalOpen] = React.useState(false)

  // Block production access
  React.useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      window.location.href = "/"
    }
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground p-8 max-w-4xl mx-auto space-y-12">
      {/* Brand Header */}
      <header className="border-b border-border/60 pb-6">
        <span className="text-[10px] tracking-wider uppercase font-semibold text-ua-gold bg-ua-navy px-2 py-1 rounded">
          Scientia · Virtus · Communitas
        </span>
        <h1 className="font-serif text-3xl font-bold mt-3 text-ua-navy dark:text-ua-gold">
          evalUAte Primitives Preview
        </h1>
        <p className="text-muted-foreground mt-1">
          Visual QA sheet for the University of the Assumption branded UI kit.
        </p>
      </header>

      {/* Typography Section */}
      <section className="space-y-4">
        <h2 className="font-serif text-xl font-semibold border-l-4 border-ua-gold pl-3">
          1. Typography
        </h2>
        <div className="space-y-2 p-6 border border-border bg-card rounded-lg">
          <h1 className="font-serif text-4xl font-bold">Serif Display Title (4xl)</h1>
          <h2 className="font-serif text-2xl font-semibold">Serif Subsection (2xl)</h2>
          <p className="font-sans text-sm text-foreground">
            Standard sans-serif body text (Inter/Geist) for labels, descriptions, and lists.
          </p>
          <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground block mt-2">
            SMALL CAPS EYEBROW LABEL
          </span>
        </div>
      </section>

      {/* Buttons Section */}
      <section className="space-y-4">
        <h2 className="font-serif text-xl font-semibold border-l-4 border-ua-gold pl-3">
          2. Buttons
        </h2>
        <div className="p-6 border border-border bg-card rounded-lg flex flex-wrap gap-4 items-center">
          <Button uaVariant="primary">Primary Navy</Button>
          <Button uaVariant="accent">Accent Gold CTA</Button>
          <Button uaVariant="destructive">Destructive Crimson</Button>
          <Button uaVariant="outline">Outline</Button>
          <Button uaVariant="ghost">Ghost Button</Button>
          <Button uaVariant="primary" size="lg">Large Touch Target (48px)</Button>
        </div>
      </section>

      {/* Cards Section */}
      <section className="space-y-4">
        <h2 className="font-serif text-xl font-semibold border-l-4 border-ua-gold pl-3">
          3. Cards
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Standard Card</CardTitle>
              <CardDescription>Description for secondary information.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Card contents with standard sizing, borders, and rounded corners.
              </p>
            </CardContent>
            <CardFooter>
              <span className="text-xs text-muted-foreground">Footer information</span>
            </CardFooter>
          </Card>

          <Card hoverable>
            <CardHeader>
              <CardTitle>Hoverable & Interactive Card</CardTitle>
              <CardDescription>Hover over this to test the micro-interaction.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Transitions outline border color and scale-shadows.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Progress Bar Section */}
      <section className="space-y-4">
        <h2 className="font-serif text-xl font-semibold border-l-4 border-ua-gold pl-3">
          4. Progress Bar
        </h2>
        <div className="p-6 border border-border bg-card rounded-lg space-y-4">
          <div className="flex justify-between text-sm">
            <span>Dynamic Progress</span>
            <span className="font-bold">{progress}%</span>
          </div>
          <ProgressBar value={progress} />
          <div className="flex gap-2">
            <Button size="sm" uaVariant="outline" onClick={() => setProgress(Math.max(0, progress - 10))}>
              Decrease
            </Button>
            <Button size="sm" uaVariant="outline" onClick={() => setProgress(Math.min(100, progress + 10))}>
              Increase
            </Button>
          </div>
        </div>
      </section>

      {/* Modal and Toast Section */}
      <section className="space-y-4">
        <h2 className="font-serif text-xl font-semibold border-l-4 border-ua-gold pl-3">
          5. Modal & Toasts
        </h2>
        <div className="p-6 border border-border bg-card rounded-lg flex flex-wrap gap-4">
          <Button uaVariant="outline" onClick={() => setIsModalOpen(true)}>
            Open Dialog Modal
          </Button>

          <Button uaVariant="outline" onClick={() => toast.success("Evaluation Saved", "Draft saved locally.")}>
            Trigger Success Toast
          </Button>

          <Button uaVariant="outline" onClick={() => toast.error("Submission Error", "Please answer all mandatory criteria.")}>
            Trigger Error Toast
          </Button>
        </div>
      </section>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Confirm Submission"
        description="Once submitted, evaluations cannot be modified."
        footer={
          <>
            <Button uaVariant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button uaVariant="primary" onClick={() => {
              setIsModalOpen(false)
              toast.success("Action Confirmed")
            }}>Confirm</Button>
          </>
        }
      >
        <p className="text-sm">
          Are you sure you want to proceed with this evaluation? This action will securely sign and store the answers anonymously.
        </p>
      </Modal>
    </div>
  )
}
