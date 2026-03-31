import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes without conflicts. Use instead of template literals in all Art components. */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
