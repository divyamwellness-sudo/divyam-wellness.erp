import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(typeof date === 'string' ? new Date(date) : date);
}

/**
 * Calculate age in whole years from a date of birth.
 * Recomputed at call time, so it always reflects the current date
 * and "increments" automatically every year. Returns null for missing/invalid input.
 */
export function calculateAge(dateOfBirth?: string | null): number | null {
  if (!dateOfBirth) return null;

  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();

  const monthDiff = today.getMonth() - dob.getMonth();
  const dayDiff = today.getDate() - dob.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

/** Local calendar date as YYYY-MM-DD for date inputs (not UTC). */
export function toLocalDateInputValue(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** First day of the local calendar month as YYYY-MM-DD. */
export function startOfLocalMonthInputValue(date: Date = new Date()): string {
  return toLocalDateInputValue(new Date(date.getFullYear(), date.getMonth(), 1));
}

/** Map stored date/datetime to YYYY-MM-DD for `<input type="date" />` in local calendar. */
export function toDateInputValue(dateString?: string | null): string {
  if (!dateString) return toLocalDateInputValue();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return toLocalDateInputValue();
  return toLocalDateInputValue(parsed);
}
