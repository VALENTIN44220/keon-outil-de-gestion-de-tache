import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: [
          "bg-primary/10 text-primary border border-primary/20",
          "hover:bg-primary/15",
        ].join(" "),
        secondary: [
          "bg-secondary text-secondary-foreground border border-border",
          "hover:bg-muted",
        ].join(" "),
        destructive: [
          "bg-destructive/10 text-destructive border border-destructive/20",
          "hover:bg-destructive/15",
        ].join(" "),
        outline: [
          "border-2 border-border text-muted-foreground bg-white",
          "hover:border-primary/30 hover:text-primary",
        ].join(" "),
        success: [
          "bg-success/10 text-success border border-success/20",
          "hover:bg-success/15",
        ].join(" "),
        warning: [
          "bg-warning/10 text-warning border border-warning/20",
          "hover:bg-warning/15",
        ].join(" "),
        info: [
          "bg-info/10 text-info border border-info/20",
          "hover:bg-info/15",
        ].join(" "),
        accent: [
          "bg-accent/10 text-accent border border-accent/20",
          "hover:bg-accent/15",
        ].join(" "),
        // Filled variants for more emphasis
        "default-filled": [
          "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground",
          "shadow-sm hover:shadow-md",
        ].join(" "),
        "success-filled": [
          "bg-gradient-to-r from-success to-success/90 text-success-foreground",
          "shadow-sm hover:shadow-md",
        ].join(" "),
        "warning-filled": [
          "bg-gradient-to-r from-warning to-warning/90 text-warning-foreground",
          "shadow-sm hover:shadow-md",
        ].join(" "),
        "destructive-filled": [
          "bg-gradient-to-r from-destructive to-destructive/90 text-destructive-foreground",
          "shadow-sm hover:shadow-md",
        ].join(" "),
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
