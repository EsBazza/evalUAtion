import { toast as sonnerToast } from "sonner"

export const toast = {
  success: (message: string, description?: string, options?: any) => {
    sonnerToast.success(message, {
      description,
      className: "border border-border bg-card text-card-foreground shadow-lg font-sans rounded-lg",
      ...options,
    })
  },
  error: (message: string, description?: string, options?: any) => {
    sonnerToast.error(message, {
      description,
      className: "border border-ua-crimson/30 bg-card text-ua-crimson shadow-lg font-sans rounded-lg",
      ...options,
    })
  },
  info: (message: string, description?: string, options?: any) => {
    sonnerToast(message, {
      description,
      className: "border border-border bg-card text-card-foreground shadow-lg font-sans rounded-lg",
      ...options,
    })
  },
  loading: (message: string, description?: string) => {
    return sonnerToast.loading(message, {
      description,
      className: "border border-border bg-card text-card-foreground shadow-lg font-sans rounded-lg",
    })
  },
  dismiss: (id?: string | number) => {
    sonnerToast.dismiss(id)
  }
}
