import type { SVGProps } from "react";

export const GooseIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <circle cx="32" cy="32" r="30" fill="#13BBAF" />
    <path
      d="M18 37c0-8.837 7.163-16 16-16h4c4.418 0 8 3.582 8 8v1h-7.5a6.5 6.5 0 1 0 0 13H31c-7.18 0-13-5.82-13-13Z"
      fill="#fff"
    />
    <circle cx="40" cy="27" r="2" fill="#0F172A" />
    <path d="m46 31 8 3-8 3v-6Z" fill="#FF6B00" />
  </svg>
);
