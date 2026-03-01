import * as SwitchPrimitive from "@radix-ui/react-switch";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../lib/cn.js";

export const Switch = ({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>) => (
  <SwitchPrimitive.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-neutral-300 transition-colors data-[state=checked]:bg-neutral-900",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block h-4 w-4 translate-x-0.5 rounded-full bg-white transition-transform data-[state=checked]:translate-x-4" />
  </SwitchPrimitive.Root>
);
