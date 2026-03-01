import type { InputHTMLAttributes } from "react";
import { cn } from "../lib/cn.js";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = ({ className, ...props }: InputProps) => (
  <input
    className={cn(
      "flex h-9 w-full rounded-md border border-neutral-300 bg-white px-3 py-1 text-sm outline-none ring-offset-white placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-neutral-500",
      className,
    )}
    {...props}
  />
);
