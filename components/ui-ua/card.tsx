import * as React from "react"
import { cn } from "@/lib/utils"

export interface CardProps extends React.ComponentProps<"div"> {
  hoverable?: boolean
}

export function Card({ className, hoverable = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg bg-card text-card-foreground border border-border/80 shadow-sm transition-all duration-200",
        hoverable && "hover:shadow-md hover:border-ua-gold/50 dark:hover:border-ua-gold/50 cursor-pointer",
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 p-6", className)}
      {...props}
    />
  )
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn(
        "font-serif text-lg font-semibold leading-none tracking-tight text-ua-navy dark:text-ua-gold",
        className
      )}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("font-sans text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-6 pt-0 font-sans", className)} {...props} />
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center p-6 pt-0 border-t border-border/40 mt-4 bg-muted/10", className)}
      {...props}
    />
  )
}
