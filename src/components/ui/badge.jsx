import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "../../lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-smooth focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent linear-accent-bg text-white shadow-sm hover:linear-accent-hover",
        secondary:
          "border-transparent linear-surface-elevated linear-text-secondary hover:linear-surface-hover",
        destructive:
          "border-transparent bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30",
        outline: "linear-text border-linear-border-subtle",
        success: "border-transparent bg-green-500/20 text-green-400 border-green-500/30",
        warning: "border-transparent bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }