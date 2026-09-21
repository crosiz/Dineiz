import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-[13px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
          variant === "primary" && "bg-primary text-white hover:opacity-90",
          variant === "secondary" && "border border-primary-border bg-primary-tint text-primary hover:bg-[#FFEFE7]",
          variant === "outline" && "border border-border bg-bg text-text-1 hover:bg-hover",
          variant === "ghost" && "text-text-2 hover:bg-hover",
          variant === "danger" && "bg-danger text-white hover:opacity-90",
          size === "md" && "h-10 px-4",
          size === "sm" && "h-8 px-3 text-xs",
          size === "lg" && "h-11 px-5 text-sm",
          size === "icon" && "h-10 w-10",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
