import { toast as sonnerToast } from "sonner"

export const toast = {
  success: (message: string, description?: string) => {
    sonnerToast.success(message, {
      description,
      className: "border border-border bg-card text-card-foreground shadow-lg font-sans rounded-lg",
    })
  },
  error: (message: string, description?: string) => {
    sonnerToast.error(message, {
      description,
      className: "border border-ua-crimson/30 bg-card text-ua-crimson shadow-lg font-sans rounded-lg",
    })
  },
  info: (message: string, description?: string) => {
    sonnerToast(message, {
      description,
      className: "border border-border bg-card text-card-foreground shadow-lg font-sans rounded-lg",
    })
  }
}
