import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../lib/cn.js";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = ({
  className,
  sideOffset = 4,
  ...props
}: ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>) => (
  <TooltipPrimitive.Content
    sideOffset={sideOffset}
    className={cn("z-50 rounded-md bg-neutral-900 px-3 py-1.5 text-xs text-white", className)}
    {...props}
  />
);
