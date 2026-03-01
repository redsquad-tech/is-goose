import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../lib/cn.js";

export const ScrollArea = ({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>) => (
  <ScrollAreaPrimitive.Root className={cn("relative overflow-hidden", className)} {...props}>
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollAreaPrimitive.Scrollbar orientation="vertical" className="w-2 p-[1px]">
      <ScrollAreaPrimitive.Thumb className="rounded-full bg-neutral-300" />
    </ScrollAreaPrimitive.Scrollbar>
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
);
