import type { ProgressAnalytics } from '@/features/customers/utils/progressAnalytics';
import type { BusinessSettings, Customer, WeightLog } from '@/types/database.types';

export type ProgressReportDocumentProps = {
  customer: Customer;
  analytics: ProgressAnalytics;
  weightLogs: WeightLog[];
  businessSettings: BusinessSettings;
};

export function formatWeightChange(weightChange: number | null): string {
  if (weightChange == null) return '—';
  return `${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg`;
}

export function formatBmiChange(bmiChange: number | null): string {
  if (bmiChange == null) return '—';
  return `${bmiChange > 0 ? '+' : ''}${bmiChange.toFixed(1)}`;
}

export function getProgressReportPdfFilename(customerName: string): string {
  const safeName =
    customerName
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-]+/g, '')
      .replace(/^-+|-+$/g, '') || 'Customer';

  return `${safeName}-Progress-Report.pdf`;
}

export const progressReportChartColors: Record<string, string> = {
  weight_kg: '#2563eb',
  bmi: '#7c3aed',
  body_fat_percentage: '#ea580c',
  visceral_fat: '#dc2626',
  muscle_mass: '#059669',
};
