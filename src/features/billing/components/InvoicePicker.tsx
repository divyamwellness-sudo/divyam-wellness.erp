import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils/format';
import { formatDate } from '@/lib/utils/format';
import type { CollectableInvoice } from '@/features/billing/services/payment.service';

type InvoicePickerProps = {
  invoices: CollectableInvoice[];
  value: string;
  onChange: (invoiceId: string) => void;
  error?: string;
  id?: string;
};

function formatCurrency(value: number): string {
  return `₹${Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function filterInvoices(invoices: CollectableInvoice[], query: string): CollectableInvoice[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return invoices;

  const numericQuery = Number(normalized.replace(/[^0-9.]/g, ''));

  return invoices.filter((invoice) => {
    if (invoice.invoice_number.toLowerCase().includes(normalized)) return true;
    if (invoice.customer_name.toLowerCase().includes(normalized)) return true;
    if (numericQuery > 0) {
      if (Math.abs(invoice.total_amount - numericQuery) < 0.001) return true;
      if (Math.abs(invoice.due_amount - numericQuery) < 0.001) return true;
    }
    return false;
  });
}

/**
 * Searchable invoice picker for the Record Payment flow.
 *
 * Each invoice is rendered as a card:
 *   INV-00015  •  Rajesh Patel
 *   Invoice Total ₹6,600.00          [ ₹2,200.00 Due ]
 *   25-Jun-2026
 *
 * Only `created` / `partial` invoices are passed in (paid/cancelled are
 * filtered out by the service), so the picker never offers an invoice that
 * cannot accept a payment.
 */
export function InvoicePicker({
  invoices,
  value,
  onChange,
  error,
  id,
}: InvoicePickerProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => filterInvoices(invoices, query), [invoices, query]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          id={id}
          type="text"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by invoice number, customer, total or due amount..."
          className="flex h-10 w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            {invoices.length === 0
              ? 'No outstanding invoices for this customer.'
              : 'No invoices match your search.'}
          </div>
        ) : (
          <ul role="listbox" aria-label="Outstanding invoices" className="divide-y divide-slate-100">
            {filtered.map((invoice) => {
              const isSelected = invoice.id === value;
              return (
                <li key={invoice.id} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => onChange(invoice.id)}
                    className={cn(
                      'flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors',
                      isSelected ? 'bg-brand-50' : 'hover:bg-slate-50',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {invoice.invoice_number}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {invoice.customer_name}
                        </p>
                      </div>
                      <span
                        className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white"
                        title="Outstanding due"
                      >
                        {formatCurrency(invoice.due_amount)} Due
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Invoice Total: {formatCurrency(invoice.total_amount)}</span>
                      <span>{formatDate(invoice.invoice_date)}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
