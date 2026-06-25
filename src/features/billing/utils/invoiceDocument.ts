import type { InvoiceWithDetails } from '@/features/billing/services/invoice.service';
import type { BusinessSettings, Payment, PaymentMethod } from '@/types/database.types';

export type InvoiceDocumentProps = {
  invoice: InvoiceWithDetails;
  businessSettings: BusinessSettings;
};

export const paymentMethodLabels: Record<PaymentMethod | 'other', string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank: 'Bank',
  card: 'Card',
  other: 'Other',
};

export const invoiceStatusLabels = {
  created: 'Created',
  partial: 'Partial',
  paid: 'Paid',
  cancelled: 'Cancelled',
} as const;

export function sortInvoicePayments(payments: Payment[]): Payment[] {
  return [...payments].sort(
    (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime(),
  );
}

/** Posted payments only — used for print/PDF where reversed entries are excluded. */
export function getActiveInvoicePayments(payments: Payment[]): Payment[] {
  return payments.filter((payment) => payment.status !== 'REVERSED');
}

export function sortActiveInvoicePayments(payments: Payment[]): Payment[] {
  return sortInvoicePayments(getActiveInvoicePayments(payments));
}

export function sumActivePaymentAmount(payments: Payment[]): number {
  return getActiveInvoicePayments(payments).reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );
}

export function formatPricingTier(tier: string): string {
  return tier === 'MRP' ? 'MRP' : `${tier}%`;
}

export function formatCustomerType(type: string): string {
  return type === 'coach' ? 'Coach' : 'PC';
}

export function getInvoicePdfFilename(invoiceNumber: string): string {
  const safeName = invoiceNumber.replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '');
  return `${safeName || 'invoice'}.pdf`;
}
