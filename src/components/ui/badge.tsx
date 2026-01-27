import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-gradient-to-r from-keon-blue to-cyan-500 text-white shadow-sm hover:shadow-md",
        secondary: "border-keon-200 bg-gradient-to-r from-keon-100 to-keon-50 text-keon-700 hover:border-keon-300",
        destructive: "border-transparent bg-gradient-to-r from-keon-terose to-red-500 text-white shadow-sm hover:shadow-md",
        outline: "border-keon-300 text-keon-700 bg-white hover:border-keon-blue hover:text-keon-blue",
        success: "border-transparent bg-gradient-to-r from-keon-green to-emerald-500 text-white shadow-sm hover:shadow-md",
        warning: "border-transparent bg-gradient-to-r from-keon-orange to-amber-500 text-white shadow-sm hover:shadow-md",
        info: "border-transparent bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-sm hover:shadow-md",
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
