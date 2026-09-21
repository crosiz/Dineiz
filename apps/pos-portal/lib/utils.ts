import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPKR(amount: number): string {
  return `PKR ${Math.round(amount).toLocaleString("en-US")}`;
}

export function formatPKRCompact(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 10000000) return `PKR ${(amount / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `PKR ${(amount / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `PKR ${Math.round(amount / 1000)}K`;
  return `PKR ${Math.round(amount)}`;
}
