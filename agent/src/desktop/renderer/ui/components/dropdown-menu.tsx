import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../lib/cn.js";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export const DropdownMenuContent = ({
  className,
  sideOffset = 4,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border border-neutral-200 bg-white p-1 shadow-md",
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
);

export const DropdownMenuItem = ({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>) => (
  <DropdownMenuPrimitive.Item
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-neutral-100",
      className,
    )}
    {...props}
  />
);
