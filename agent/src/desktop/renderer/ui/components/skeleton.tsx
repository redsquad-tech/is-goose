import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn.js";

export const Skeleton = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("animate-pulse rounded-md bg-neutral-200", className)} {...props} />
);
