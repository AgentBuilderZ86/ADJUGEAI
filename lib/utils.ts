import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const fmtMad = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
export const mad = (n: number) => `${fmtMad.format(n)} MAD`;
export const pct = (n: number, d = 1) => `${(n * 100).toFixed(d).replace(".", ",")} %`;
