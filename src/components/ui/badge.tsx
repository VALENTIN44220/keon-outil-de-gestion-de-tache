import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm",
        secondary: "border-slate-200 bg-slate-100 text-slate-700",
        destructive: "border-transparent bg-gradient-to-r from-red-500 to-red-600 text-white shadow-sm",
        outline: "border-slate-300 text-slate-600 bg-white",
        success: "border-transparent bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-sm",
        warning: "border-transparent bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm",
        info: "border-transparent bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
