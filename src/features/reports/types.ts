import type { CustomerType, InvoiceStatus, PaymentMethod } from '@/types/database.types';

export type ReportDateRange = {
  dateFrom: string;
  dateTo: string;
};

export type SalesReportRow = {
  date: string;
  invoiceNumber: string;
  customer: string;
  totalAmount: number;
  status: InvoiceStatus;
  invoiceId: string;
};

export type SalesReportSummary = {
  count: number;
  totalAmount: number;
};

export type DueReportRow = {
  customer: string;
  customerPhone: string;
  invoiceNumber: string;
  dueAmount: number;
  invoiceDate: string;
  daysOutstanding: number;
  invoiceId: string;
};

export type DueReportSummary = {
  count: number;
  totalDue: number;
};

export type PaymentReportRow = {
  paymentId: string;
  date: string;
  invoiceNumber: string;
  paymentMethod: PaymentMethod | 'other';
  amount: number;
  reference: string;
  invoiceId: string;
};

export type PaymentReportSummary = {
  count: number;
  totalAmount: number;
};

export type CustomerReportRow = {
  customerId: string;
  customerName: string;
  customerType: CustomerType;
  currentWeight: number | null;
  totalInvoices: number;
  totalSpend: number;
  totalVp: number;
};

export type CustomerReportSummary = {
  count: number;
  totalInvoices: number;
  totalSpend: number;
  totalVp: number;
};

export type ReportType = 'sales' | 'due' | 'payments' | 'customers';
