import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return format(date, "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es });
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
}
