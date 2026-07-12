"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { signOut } from "next-auth/react"
import { Menu, X, LogOut, LucideIcon } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "./button"

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
      <aside className="hidden md:flex md:w-72 md:h-screen md:sticky md:top-0 bg-ua-navy text-ua-warm-white flex-col justify-between border-r border-border/10 shadow-lg shrink-0">
        <div>
          {/* Logo Branding */}
          <div className="p-6 border-b border-border/10 flex items-center gap-3 bg-ua-navy-black/10">
            <img
              src="/ua-logo.png"
              alt="UA Logo"
              className="w-11 h-11 object-contain rounded-full border border-white/10"
            />
            <div>
              <h3 className="text-[9px] font-semibold text-ua-warm-white/70 tracking-widest uppercase leading-none mb-1">University of the</h3>
              <h2 className="text-base font-bold text-ua-gold tracking-wide uppercase leading-none">{title}</h2>
              <span className="inline-block mt-1 text-[8px] font-semibold text-white/40 tracking-wider uppercase">
                {subtitle}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const active = isTabActive(item.id, item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 px-4 py-3 text-xs font-semibold uppercase tracking-wider rounded-md transition-all duration-150 border-l-2",
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

        {/* Profile Card & Logout */}
        <div className="p-4 border-t border-border/10 bg-ua-navy-black/15 space-y-3">
          <div className="px-3 py-2 bg-ua-navy-black/30 rounded-md border border-white/5">
            <p className="text-[8px] text-white/40 font-bold uppercase tracking-wider">Role</p>
            <p className="text-xs font-bold text-ua-gold tracking-wide uppercase">{role}</p>
          </div>
          <Button
            uaVariant="outline"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full h-10 border-ua-crimson/30 hover:bg-ua-crimson hover:text-white dark:hover:text-ua-navy"
          >
            <LogOut className="size-3.5 mr-2" />
            Sign Out
          </Button>
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

                {/* Drawer Nav links */}
                <nav className="p-4 space-y-1">
                  {navItems.map((item) => {
                    const active = isTabActive(item.id, item.href)
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          "group flex items-center gap-3 px-4 py-3 text-xs font-semibold uppercase tracking-wider rounded-md transition-all duration-150 border-l-2",
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

              {/* Bottom profile and logout in drawer */}
              <div className="p-4 border-t border-border/10 bg-ua-navy-black/15 space-y-3">
                <div className="px-3 py-2 bg-ua-navy-black/30 rounded-md border border-white/5">
                  <p className="text-[8px] text-white/40 font-bold uppercase tracking-wider">Role</p>
                  <p className="text-xs font-bold text-ua-gold tracking-wide uppercase">{role}</p>
                </div>
                <Button
                  uaVariant="outline"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="w-full h-10 border-ua-crimson/30 hover:bg-ua-crimson hover:text-white"
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
      </div>

    </div>
  )
}
