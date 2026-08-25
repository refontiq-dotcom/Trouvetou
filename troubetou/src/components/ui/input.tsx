import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-xl border bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground",
          "transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring",
          error ? "border-destructive" : "border-border",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
