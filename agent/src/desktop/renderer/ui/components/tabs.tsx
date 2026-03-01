import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../lib/cn.js";

export const Tabs = TabsPrimitive.Root;

export const TabsList = ({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.List>) => (
  <TabsPrimitive.List
    className={cn("inline-flex h-9 items-center rounded-md bg-neutral-100 p-1", className)}
    {...props}
  />
);

export const TabsTrigger = ({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) => (
  <TabsPrimitive.Trigger
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-sm font-medium transition data-[state=active]:bg-white data-[state=active]:shadow",
      className,
    )}
    {...props}
  />
);

export const TabsContent = ({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) => (
  <TabsPrimitive.Content className={cn("mt-2", className)} {...props} />
);
