"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { signOut } from "next-auth/react"
import { Menu, X, LogOut, ChevronLeft, ChevronRight, LucideIcon } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import { Footer } from "@/components/layout/Footer"

export interface NavItem {
  id: string
  label: string
  href: string
  icon: LucideIcon
}

export interface AppShellProps {
  navItems: NavItem[]
  role: string
  title?: string
  subtitle?: string
  children: React.ReactNode
}

export function AppShell({
  navItems,
  role,
  title = "Assumption",
  subtitle = "Admin Console",
  children,
}: AppShellProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = React.useState(false)
  const [isCollapsed, setIsCollapsed] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    const collapsed = localStorage.getItem("ua_sidebar_collapsed") === "true"
    setIsCollapsed(collapsed)
  }, [])

  // Helper to determine if a menu item is active
  const isTabActive = (id: string, href: string) => {
    if (id === "rankings") {
      return pathname === "/admin" && (!searchParams.get("tab") || searchParams.get("tab") === "rankings")
    }
    if (id === "logs") {
      return pathname === "/admin" && searchParams.get("tab") === "logs"
    }
    if (id === "settings") {
      return pathname === "/admin" && searchParams.get("tab") === "settings"
    }
    return pathname.startsWith(href)
  }

  // Filter items into Workflow vs Utility
  const workflowIds = ["departments", "templates", "rankings"]
  const utilityIds = ["logs", "settings"]

  const workflowItems = navItems
    .filter(item => workflowIds.includes(item.id))
    .sort((a, b) => workflowIds.indexOf(a.id) - workflowIds.indexOf(b.id))

  const utilityItems = navItems
    .filter(item => utilityIds.includes(item.id))

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground font-sans">
      
      {/* Mobile Sticky Navbar Header */}
      <header className="md:hidden sticky top-0 z-40 w-full flex items-center justify-between bg-ua-navy text-ua-warm-white px-5 py-3 shadow-md">
        <div className="flex items-center gap-3">
          <img
            src="/ua-logo.png"
            alt="UA Logo"
            className="w-10 h-10 object-contain rounded-full border border-white/20 bg-white"
          />
          <div>
            <h1 className="text-[10px] font-semibold tracking-wider text-ua-warm-white/80 leading-none">UNIVERSITY OF THE</h1>
            <h2 className="text-sm font-bold tracking-wide text-ua-gold uppercase leading-tight">{title}</h2>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-md hover:bg-white/10 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ua-gold"
          aria-label="Toggle navigation menu"
        >
          {isOpen ? <X className="size-5 text-ua-gold" /> : <Menu className="size-5 text-ua-warm-white" />}
        </button>
      </header>

      {/* Left Sidebar (Desktop Fixed) */}
      <aside 
        className={cn(
          "hidden md:flex bg-ua-navy text-ua-warm-white flex-col justify-between border-r border-border/10 shadow-lg shrink-0 h-screen sticky top-0 transition-all duration-300 ease-in-out motion-reduce:transition-none",
          mounted && isCollapsed ? "w-20" : "w-72"
        )}
      >
        <div>
          {/* Logo Branding */}
          <div 
            className={cn(
              "p-6 border-b border-border/10 flex items-center bg-ua-navy-black/10 transition-all duration-300 ease-in-out motion-reduce:transition-none",
              mounted && isCollapsed ? "justify-center px-4" : "justify-between px-6 gap-3"
            )}
          >
            {mounted && isCollapsed ? (
              <button
                onClick={() => {
                  setIsCollapsed(false)
                  localStorage.setItem("ua_sidebar_collapsed", "false")
                }}
                className="relative group focus:outline-none flex items-center justify-center cursor-pointer"
                title="Expand Sidebar"
              >
                <img
                  src="/ua-logo.png"
                  alt="UA Logo"
                  className="w-11 h-11 object-contain rounded-full border border-white/10 shrink-0 transition-transform group-hover:scale-105 duration-200"
                />
                <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-150">
                  <ChevronRight className="size-4 text-ua-gold" />
                </div>
              </button>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <img
                    src="/ua-logo.png"
                    alt="UA Logo"
                    className="w-11 h-11 object-contain rounded-full border border-white/10 shrink-0"
                  />
                  <div className="animate-fade-in">
                    <h3 className="text-[9px] font-semibold text-ua-warm-white/70 tracking-widest uppercase leading-none mb-1">University of the</h3>
                    <h2 className="text-base font-bold text-ua-gold tracking-wide uppercase leading-none">{title}</h2>
                    <span className="inline-block mt-1 text-[8px] font-semibold text-white/40 tracking-wider uppercase">
                      {subtitle}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsCollapsed(true)
                    localStorage.setItem("ua_sidebar_collapsed", "true")
                  }}
                  className="p-1.5 rounded-md hover:bg-white/10 text-ua-warm-white/60 hover:text-ua-warm-white transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ua-gold shrink-0"
                  title="Collapse Sidebar"
                >
                  <ChevronLeft className="size-4" />
                </button>
              </>
            )}
          </div>

          {/* Navigation Links */}
          <div className="p-4 space-y-6">
            {/* Workflow Steps Section */}
            <div className="space-y-2">
              {!(mounted && isCollapsed) && (
                <span className="px-4 text-[9px] font-bold text-ua-warm-white/40 uppercase tracking-widest block">
                  Evaluation Steps
                </span>
              )}
              <nav className="space-y-1">
                {workflowItems.map((item, index) => {
                  const active = isTabActive(item.id, item.href)
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-3 px-4 h-12 text-xs font-semibold uppercase tracking-wider rounded-md transition-all duration-150 border-l-4 relative",
                        active
                          ? "bg-ua-navy-black/40 border-ua-gold text-ua-warm-white font-bold"
                          : "border-transparent text-ua-warm-white/60 hover:bg-ua-navy-black/20 hover:text-ua-warm-white",
                        mounted && isCollapsed ? "justify-center px-0" : "px-4"
                      )}
                      title={mounted && isCollapsed ? `${index + 1}. ${item.label}` : undefined}
                    >
                      <div className="relative shrink-0">
                        <Icon
                          className={cn(
                            "size-4 transition-colors duration-150",
                            active ? "text-ua-gold" : "text-ua-warm-white/45 group-hover:text-ua-gold"
                          )}
                        />
                        <span 
                          className={cn(
                            "absolute text-[8px] bg-ua-gold text-slate-900 rounded-full w-3.5 h-3.5 flex items-center justify-center font-black shadow-sm transition-all duration-300",
                            mounted && isCollapsed ? "-top-2 -right-2" : "-top-1 -left-2"
                          )}
                        >
                          {index + 1}
                        </span>
                      </div>
                      {!(mounted && isCollapsed) && <span className="truncate ml-1">{item.label}</span>}
                    </Link>
                  )
                })}
              </nav>
            </div>

            {/* Utilities Section */}
            <div className="space-y-2">
              {!(mounted && isCollapsed) && (
                <span className="px-4 text-[9px] font-bold text-ua-warm-white/40 uppercase tracking-widest block">
                  Administration
                </span>
              )}
              <nav className="space-y-1">
                {utilityItems.map((item) => {
                  const active = isTabActive(item.id, item.href)
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-3 px-4 h-12 text-xs font-semibold uppercase tracking-wider rounded-md transition-all duration-150 border-l-4",
                        active
                          ? "bg-ua-navy-black/40 border-ua-gold text-ua-warm-white font-bold"
                          : "border-transparent text-ua-warm-white/60 hover:bg-ua-navy-black/20 hover:text-ua-warm-white",
                        mounted && isCollapsed ? "justify-center px-0" : "px-4"
                      )}
                      title={mounted && isCollapsed ? item.label : undefined}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0 transition-colors duration-150",
                          active ? "text-ua-gold" : "text-ua-warm-white/45 group-hover:text-ua-gold"
                        )}
                      />
                      {!(mounted && isCollapsed) && <span className="truncate">{item.label}</span>}
                    </Link>
                  )
                })}
              </nav>
            </div>
          </div>
        </div>

        {/* Bottom Panel (Profile/Logout) */}
        <div>

          {/* Profile Card & Logout */}
          <div className="p-4 border-t border-border/10 bg-ua-navy-black/15 space-y-3">
            {!(mounted && isCollapsed) ? (
              <>
                <div className="px-3 py-2 bg-ua-navy-black/30 rounded-md border border-white/5">
                  <p className="text-[8px] text-white/40 font-bold uppercase tracking-wider">Role</p>
                  <p className="text-xs font-bold text-ua-gold tracking-wide uppercase">{role}</p>
                </div>
                <Button
                  uaVariant="destructive"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="w-full h-10 font-bold text-xs uppercase tracking-wider"
                >
                  <LogOut className="size-3.5 mr-2" />
                  Sign Out
                </Button>
              </>
            ) : (
              <Button
                uaVariant="destructive"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full h-10 p-0 flex items-center justify-center"
                title="Sign Out"
              >
                <LogOut className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Slide-in Navigation Drawer (Mobile view) */}
      <AnimatePresence>
        {isOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-ua-navy-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />

            {/* Sidebar drawer content */}
            <motion.aside
              className="relative w-72 max-w-[80vw] bg-ua-navy text-ua-warm-white flex flex-col justify-between shadow-2xl h-full border-r border-border/10"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
            >
              <div>
                {/* Header inside drawer */}
                <div className="p-5 border-b border-border/10 flex items-center justify-between bg-ua-navy-black/10">
                  <div className="flex items-center gap-2.5">
                    <img
                      src="/ua-logo.png"
                      alt="UA Logo"
                      className="w-10 h-10 object-contain rounded-full"
                    />
                    <div>
                      <h2 className="text-sm font-bold text-ua-gold tracking-wide uppercase leading-none">{title}</h2>
                      <span className="text-[8px] font-semibold text-white/40 uppercase block mt-1">{subtitle}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ua-gold"
                    aria-label="Close menu"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                {/* Drawer Nav links with Steps Grouping */}
                <div className="p-4 space-y-6">
                  {/* Workflow steps */}
                  <div className="space-y-2">
                    <span className="px-4 text-[9px] font-bold text-ua-warm-white/40 uppercase tracking-widest block">
                      Evaluation Steps
                    </span>
                    <nav className="space-y-1">
                      {workflowItems.map((item, index) => {
                        const active = isTabActive(item.id, item.href)
                        const Icon = item.icon
                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className={cn(
                              "group flex items-center gap-3 px-4 h-12 text-xs font-semibold uppercase tracking-wider rounded-md transition-all duration-150 border-l-4 relative",
                              active
                                ? "bg-ua-navy-black/40 border-ua-gold text-ua-warm-white font-bold"
                                : "border-transparent text-ua-warm-white/60 hover:bg-ua-navy-black/20 hover:text-ua-warm-white"
                            )}
                          >
                            <div className="relative shrink-0">
                              <Icon
                                className={cn(
                                  "size-4 transition-colors duration-150",
                                  active ? "text-ua-gold" : "text-ua-warm-white/45 group-hover:text-ua-gold"
                                )}
                              />
                              <span className="absolute -top-1 -left-2 text-[8px] bg-ua-gold text-slate-900 rounded-full w-3.5 h-3.5 flex items-center justify-center font-black shadow-sm">
                                {index + 1}
                              </span>
                            </div>
                            <span className="truncate ml-1">{item.label}</span>
                          </Link>
                        )
                      })}
                    </nav>
                  </div>

                  {/* Utilities */}
                  <div className="space-y-2">
                    <span className="px-4 text-[9px] font-bold text-ua-warm-white/40 uppercase tracking-widest block">
                      Administration
                    </span>
                    <nav className="space-y-1">
                      {utilityItems.map((item) => {
                        const active = isTabActive(item.id, item.href)
                        const Icon = item.icon
                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className={cn(
                              "group flex items-center gap-3 px-4 h-12 text-xs font-semibold uppercase tracking-wider rounded-md transition-all duration-150 border-l-4",
                              active
                                ? "bg-ua-navy-black/40 border-ua-gold text-ua-warm-white font-bold"
                                : "border-transparent text-ua-warm-white/60 hover:bg-ua-navy-black/20 hover:text-ua-warm-white"
                            )}
                          >
                            <Icon
                              className={cn(
                                "size-4 shrink-0 transition-colors duration-150",
                                active ? "text-ua-gold" : "text-ua-warm-white/45 group-hover:text-ua-gold"
                              )}
                            />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        )
                      })}
                    </nav>
                  </div>
                </div>
              </div>

              {/* Bottom profile and logout in drawer */}
              <div className="p-4 border-t border-border/10 bg-ua-navy-black/15 space-y-3">
                <div className="px-3 py-2 bg-ua-navy-black/30 rounded-md border border-white/5">
                  <p className="text-[8px] text-white/40 font-bold uppercase tracking-wider">Role</p>
                  <p className="text-xs font-bold text-ua-gold tracking-wide uppercase">{role}</p>
                </div>
                <Button
                  uaVariant="destructive"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="w-full h-10 font-bold text-xs uppercase tracking-wider"
                >
                  <LogOut className="size-3.5 mr-2" />
                  Sign Out
                </Button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main Viewport Workspace */}
      <div className="flex-1 flex flex-col min-w-0 md:h-screen md:overflow-y-auto bg-background">
        <main className="flex-grow p-4 sm:p-6 md:p-8">
          {children}
        </main>
        <Footer />
      </div>

    </div>
  )
}
