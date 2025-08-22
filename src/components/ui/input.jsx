import * as React from "react"
import { cn } from "../../lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-lg border px-3 py-1 text-sm shadow-sm transition-smooth file:border-0 file:bg-transparent file:text-sm file:font-medium file:linear-text placeholder:linear-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 linear-surface border-linear-border-subtle hover:linear-surface-elevated focus-visible:linear-surface-elevated focus-visible:border-linear-accent",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = "Input"

export { Input }