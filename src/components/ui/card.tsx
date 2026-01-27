import * as React from "react";

import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'accent' | 'elevated' }>(
  ({ className, variant = 'default', ...props }, ref) => (
  <div 
    ref={ref} 
    className={cn(
      "rounded-2xl bg-white text-card-foreground transition-all duration-200",
      "border border-border",
      // Default variant
      variant === 'default' && [
        "shadow-premium",
        "hover:shadow-premium-md hover:border-primary/20",
      ],
      // Accent variant with left border
      variant === 'accent' && [
        "shadow-premium relative overflow-hidden",
        "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-gradient-to-b before:from-primary before:to-accent before:rounded-l-2xl",
        "hover:shadow-premium-md",
      ],
      // Elevated variant
      variant === 'elevated' && [
        "shadow-premium-lg",
        "hover:shadow-premium-xl hover:-translate-y-0.5",
      ],
      className
    )} 
    {...props} 
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight text-foreground", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
