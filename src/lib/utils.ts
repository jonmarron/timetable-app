import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function possessiveTitle(name: string): string {
  return name.endsWith("s") ? `${name}' Weekly Planner` : `${name}'s Weekly Planner`;
}
