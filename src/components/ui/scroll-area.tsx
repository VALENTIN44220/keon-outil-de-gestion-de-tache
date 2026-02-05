import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/lib/utils";

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root ref={ref} className={cn("relative overflow-hidden", className)} {...props}>
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">{children}</ScrollAreaPrimitive.Viewport>
    <ScrollBar forceMount />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      // Radix can set data-state="hidden" and effectively hide the scrollbar.
      // We want it visible in premium dialogs even before interaction.
      "touch-none select-none flex data-[state=hidden]:flex data-[state=visible]:flex transition-opacity data-[state=hidden]:opacity-100 data-[state=visible]:opacity-100",
      // Make the track visible (users on overlay-scrollbar OSes often think there is no scroll).
      // Keep it theme-driven via semantic tokens.
      "bg-muted/40 backdrop-blur-sm rounded-full",
      orientation === "vertical" && "h-full w-3.5 border-l border-border/50 p-[2px]",
      orientation === "horizontal" && "h-3.5 flex-col border-t border-border/50 p-[2px]",
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 min-h-[32px] rounded-full bg-muted-foreground/45 hover:bg-muted-foreground/70" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
