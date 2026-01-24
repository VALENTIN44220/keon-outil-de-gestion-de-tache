import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-keon-blue focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-keon-900 text-white shadow-keon hover:bg-keon-700 active:bg-keon-900",
        destructive: "bg-keon-terose text-white shadow-keon hover:bg-keon-terose/90",
        outline: "border border-keon-300 bg-white hover:bg-keon-50 hover:border-keon-500 text-keon-900 shadow-keon-sm",
        secondary: "bg-keon-100 text-keon-900 hover:bg-keon-300",
        ghost: "hover:bg-keon-100 text-keon-700 hover:text-keon-900",
        link: "text-keon-blue underline-offset-4 hover:underline",
        accent: "bg-keon-blue text-white shadow-keon hover:bg-keon-blue/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-sm px-3",
        lg: "h-11 rounded-sm px-8",
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
