import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn.js";

export const Sidebar = ({ className, ...props }: HTMLAttributes<HTMLElement>) => (
  <aside
    className={cn(
      "w-64 border-r border-neutral-200 bg-neutral-50 p-3 text-neutral-900",
      className,
    )}
    {...props}
  />
);
