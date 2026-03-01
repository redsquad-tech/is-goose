import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../lib/cn.js";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;

export const SheetContent = ({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40" />
    <DialogPrimitive.Content
      className={cn(
        "fixed right-0 top-0 z-50 h-full w-[320px] border-l border-neutral-200 bg-white p-4 shadow-lg",
        className,
      )}
      {...props}
    />
  </DialogPrimitive.Portal>
);
