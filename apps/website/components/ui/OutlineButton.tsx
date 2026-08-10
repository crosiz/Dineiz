"use client";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md" | "lg";
  href?: string;
}

const SecondaryButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size = "md", children, href, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center gap-2 font-semibold rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
    const sizes = {
      sm: "px-3.5 py-2 text-sm",
      md: "px-5 py-2.5 text-sm",
      lg: "px-6 py-3 text-base",
    };
    const cls = cn(
      base,
      sizes[size],
      "border-gray-300 text-gray-700 bg-white hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50",
      className
    );

    if (href) {
      return (
        <a href={href} className={cls}>
          {children}
        </a>
      );
    }

    return (
      <button ref={ref} className={cls} {...props}>
        {children}
      </button>
    );
  }
);
SecondaryButton.displayName = "SecondaryButton";

export default SecondaryButton;
export { SecondaryButton };
