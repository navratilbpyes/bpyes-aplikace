
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateRecordNumber(year: number, sequence: number, type: string) {
  const paddedSequence = sequence.toString().padStart(3, '0');
  return `${year}/${paddedSequence}/${type}`;
}

export function formatCzechDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('cs-CZ');
}
