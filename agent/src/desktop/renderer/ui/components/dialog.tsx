import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../lib/cn.js";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = ({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
    <DialogPrimitive.Content
      className={cn(
        "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-6 shadow-lg",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
        <X className="h-4 w-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
);

export const DialogHeader = ({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) => (
  <div className={cn("flex flex-col space-y-1.5", className)} {...props} />
);

export const DialogTitle = ({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) => (
  <DialogPrimitive.Title className={cn("text-lg font-semibold", className)} {...props} />
);
