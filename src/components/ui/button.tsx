import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: [
          "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground",
          "shadow-primary-glow",
          "hover:from-primary/90 hover:to-primary hover:shadow-lg hover:-translate-y-0.5",
          "active:translate-y-0 active:shadow-md",
        ].join(" "),
        destructive: [
          "bg-gradient-to-r from-destructive to-destructive/90 text-destructive-foreground",
          "shadow-sm",
          "hover:from-destructive/90 hover:to-destructive hover:shadow-md",
        ].join(" "),
        outline: [
          "border-2 border-primary/30 bg-white text-primary",
          "shadow-sm",
          "hover:bg-primary/5 hover:border-primary hover:shadow-md",
        ].join(" "),
        secondary: [
          "bg-secondary text-secondary-foreground border border-border",
          "hover:bg-muted hover:border-muted-foreground/20",
        ].join(" "),
        ghost: [
          "text-muted-foreground",
          "hover:bg-muted hover:text-foreground",
        ].join(" "),
        link: [
          "text-primary underline-offset-4",
          "hover:underline",
        ].join(" "),
        accent: [
          "bg-gradient-to-r from-accent to-accent/90 text-accent-foreground",
          "shadow-sm",
          "hover:from-accent/90 hover:to-accent hover:shadow-md hover:-translate-y-0.5",
        ].join(" "),
        success: [
          "bg-gradient-to-r from-success to-success/90 text-success-foreground",
          "shadow-sm",
          "hover:from-success/90 hover:to-success hover:shadow-md",
        ].join(" "),
        warning: [
          "bg-gradient-to-r from-warning to-warning/90 text-warning-foreground",
          "shadow-sm",
          "hover:from-warning/90 hover:to-warning hover:shadow-md",
        ].join(" "),
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-lg px-4 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
