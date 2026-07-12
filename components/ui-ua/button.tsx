import * as React from "react"
import { Button as BaseButton } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ComponentProps<typeof BaseButton> {
  uaVariant?: "primary" | "accent" | "destructive" | "outline" | "ghost"
}

export const Button = React.forwardRef<
  React.ElementRef<typeof BaseButton>,
  ButtonProps
>(({ className, uaVariant = "primary", size = "default", ...props }, ref) => {
  let variantClass = "default"
  let customClass = ""

  if (uaVariant === "accent") {
    variantClass = "default"
    customClass = "bg-ua-gold text-ua-navy hover:bg-ua-gold/90 focus-visible:ring-ua-gold"
  } else if (uaVariant === "primary") {
    variantClass = "default"
    customClass = "bg-ua-navy text-ua-warm-white hover:bg-ua-navy/95 dark:bg-ua-warm-white dark:text-ua-navy dark:hover:bg-ua-warm-white/90"
  } else if (uaVariant === "destructive") {
    variantClass = "destructive"
  } else if (uaVariant === "outline") {
    variantClass = "outline"
  } else if (uaVariant === "ghost") {
    variantClass = "ghost"
  }

  // Ensure touch target of 44px (h-11) for default/large buttons, sm/xs are exceptions
  const sizeClass = size === "default" ? "h-11 px-4 py-2 text-sm" : size === "lg" ? "h-12 px-6 text-base" : ""

  return (
    <BaseButton
      ref={ref}
      variant={variantClass as any}
      size={size === "default" && sizeClass ? (undefined as any) : size}
      className={cn(
        "font-sans transition-all active:scale-[0.98] prefers-reduced-motion:active:scale-100",
        sizeClass,
        customClass,
        className
      )}
      {...props}
    />
  )
})
Button.displayName = "Button"
