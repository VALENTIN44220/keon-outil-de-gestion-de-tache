import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-keon-blue focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-keon-900 to-keon-700 text-white shadow-keon hover:from-keon-700 hover:to-keon-900 active:shadow-inner",
        destructive: "bg-gradient-to-r from-keon-terose to-red-500 text-white shadow-keon hover:from-red-500 hover:to-keon-terose",
        outline: "border-2 border-keon-300 bg-white hover:bg-keon-50 hover:border-keon-blue text-keon-900 shadow-keon-sm",
        secondary: "bg-gradient-to-r from-keon-100 to-keon-50 text-keon-900 hover:from-keon-200 hover:to-keon-100 border border-keon-200",
        ghost: "hover:bg-keon-100 text-keon-700 hover:text-keon-900",
        link: "text-keon-blue underline-offset-4 hover:underline",
        accent: "bg-gradient-to-r from-keon-blue to-cyan-500 text-white shadow-keon hover:from-cyan-500 hover:to-keon-blue",
        success: "bg-gradient-to-r from-keon-green to-emerald-500 text-white shadow-keon hover:from-emerald-500 hover:to-keon-green",
        warning: "bg-gradient-to-r from-keon-orange to-amber-500 text-white shadow-keon hover:from-amber-500 hover:to-keon-orange",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-lg px-8",
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
