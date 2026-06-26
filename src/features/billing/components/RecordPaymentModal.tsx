import { useEffect, useMemo, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CustomerSearchCombobox } from '@/features/billing/components/CustomerSearchCombobox';
import { InvoicePicker } from '@/features/billing/components/InvoicePicker';
import { getCustomers } from '@/features/customers/services/customer.service';
import {
  addPayment,
  getCollectableInvoices,
  type AddPaymentRequest,
  type CollectableInvoice,
} from '@/features/billing/services/payment.service';
import { toLocalDateInputValue } from '@/lib/utils/format';
import type { Payment, PaymentMethod } from '@/types/database.types';

const paymentMethodOptions: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank', label: 'Bank' },
  { value: 'card', label: 'Card' },
];

function formatCurrency(value: number): string {
  return `₹${Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function todayForInput(): string {
  return toLocalDateInputValue();
}

type RecordPaymentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (payment: Payment) => void;
};

export function RecordPaymentModal({ isOpen, onClose, onSuccess }: RecordPaymentModalProps) {
  const queryClient = useQueryClient();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<CollectableInvoice | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Customer list for the search combobox (active customers only).
  const { data: customersData } = useQuery({
    queryKey: ['customers', { status: 'active' }],
    queryFn: () => getCustomers({ status: 'active' }),
    enabled: isOpen,
  });
  const customers = customersData?.customers ?? [];

  // Outstanding invoices for the selected customer (created/partial only).
  const { data: collectableInvoices = [], isLoading: isLoadingInvoices } = useQuery({
    queryKey: ['invoices', 'collectable', selectedCustomerId],
    queryFn: () => getCollectableInvoices(selectedCustomerId),
    enabled: isOpen && Boolean(selectedCustomerId),
  });

  const due = selectedInvoice?.due_amount ?? 0;

  const schema = useMemo(
    () =>
      z.object({
        amount: z
          .number({ invalid_type_error: 'Required' })
          .positive('Must be greater than 0')
          .max(due, `Amount cannot exceed due of ${formatCurrency(due)}`),
        payment_method: z.enum(['cash', 'upi', 'bank', 'card'] as const),
        payment_date: z.string().min(1, 'Payment date is required'),
        reference_num: z.string().optional(),
        notes: z.string().optional(),
      }),
    [due],
  );

  type PaymentFormData = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: undefined,
      payment_method: 'cash',
      payment_date: todayForInput(),
      reference_num: '',
      notes: '',
    },
  });

  // Reset everything each time the modal is (re)opened.
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setToast(null);
      setSelectedCustomerId('');
      setSelectedInvoice(null);
      reset({
        amount: undefined,
        payment_method: 'cash',
        payment_date: todayForInput(),
        reference_num: '',
        notes: '',
      });
    }
  }, [isOpen, reset]);

  // Clear the selected invoice when the customer changes.
  useEffect(() => {
    setSelectedInvoice(null);
  }, [selectedCustomerId]);

  const mutation = useMutation({
    mutationFn: addPayment,
    onSuccess: (payment) => {
      queryClient.invalidateQueries({ queryKey: ['payments', 'ledger'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', selectedInvoice?.id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices', 'collectable', selectedCustomerId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });

      setToast(`Payment of ${formatCurrency(Number(payment.amount))} recorded`);
      onSuccess?.(payment);
      setTimeout(() => onClose(), 1200);
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to record payment. Please try again.',
      );
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !mutation.isPending) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, mutation.isPending]);

  if (!isOpen) {
    return null;
  }

  const enteredAmount = Number(watch('amount')) || 0;
  const remainingAfter = Math.max(due - enteredAmount, 0);

  const handleInvoiceChange = (invoiceId: string) => {
    setErrorMessage(null);
    const invoice = collectableInvoices.find((inv) => inv.id === invoiceId) ?? null;
    setSelectedInvoice(invoice);
    // Reset the amount field so the user can't accidentally submit a stale
    // value that exceeds the new invoice's due.
    reset({
      amount: undefined,
      payment_method: watch('payment_method'),
      payment_date: watch('payment_date'),
      reference_num: watch('reference_num'),
      notes: watch('notes'),
    });
  };

  const onFormSubmit: SubmitHandler<PaymentFormData> = async (data) => {
    if (!selectedInvoice) {
      setErrorMessage('Please select an invoice to record the payment against.');
      return;
    }
    setErrorMessage(null);
    const request: AddPaymentRequest = {
      invoice_id: selectedInvoice.id,
      amount: data.amount,
      payment_method: data.payment_method,
      payment_date: data.payment_date,
      reference_num: data.reference_num || null,
      notes: data.notes || null,
    };
    await mutation.mutateAsync(request).catch(() => {
      // Surfaced via onError banner.
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => {
        if (!mutation.isPending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Record Payment</h3>
          <button
            type="button"
            onClick={() => !mutation.isPending && onClose()}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-6 py-5">
          {errorMessage && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {/* STEP 1 — Customer */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">
              Step 1 — Select Customer
            </label>
            <CustomerSearchCombobox
              customers={customers}
              value={selectedCustomerId}
              onChange={setSelectedCustomerId}
              placeholder="Search customer by name or phone..."
            />
          </div>

          {/* STEP 2 — Invoice + Payment entry */}
          {selectedCustomerId && (
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Step 2 — Select Invoice
                </label>
                {isLoadingInvoices ? (
                  <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
                    <p className="mt-2 text-sm text-slate-500">Loading outstanding invoices...</p>
                  </div>
                ) : (
                  <InvoicePicker
                    invoices={collectableInvoices}
                    value={selectedInvoice?.id ?? ''}
                    onChange={handleInvoiceChange}
                  />
                )}
              </div>

              {selectedInvoice && (
                <div className="space-y-4">
                  {/* Auto-shown invoice summary — no extra click required */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-slate-900">
                        {selectedInvoice.invoice_number}
                      </p>
                      <span className="text-xs text-slate-500">
                        {selectedInvoice.customer_name}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-slate-500">Invoice Total</p>
                        <p className="font-medium text-slate-900">
                          {formatCurrency(selectedInvoice.total_amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Already Paid</p>
                        <p className="font-medium text-slate-900">
                          {formatCurrency(selectedInvoice.paid_amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Outstanding Due</p>
                        <p className={`font-medium ${due > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                          {formatCurrency(due)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Input
                        label="Amount *"
                        type="number"
                        step="0.01"
                        min="0"
                        max={due}
                        {...register('amount', { valueAsNumber: true })}
                        error={errors.amount?.message}
                        placeholder="0.00"
                      />

                      <div className="space-y-1.5">
                        <label
                          htmlFor="payment_method"
                          className="block text-sm font-medium text-slate-700"
                        >
                          Payment Method *
                        </label>
                        <select
                          id="payment_method"
                          {...register('payment_method')}
                          className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                        >
                          {paymentMethodOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {errors.payment_method && (
                          <p className="text-sm text-red-600">{errors.payment_method.message}</p>
                        )}
                      </div>

                      <Input
                        label="Payment Date *"
                        type="date"
                        {...register('payment_date')}
                        error={errors.payment_date?.message}
                        max={todayForInput()}
                      />

                      <Input
                        label="Reference Number"
                        {...register('reference_num')}
                        error={errors.reference_num?.message}
                        placeholder="UPI ref / txn id"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="notes" className="block text-sm font-medium text-slate-700">
                        Notes
                      </label>
                      <textarea
                        id="notes"
                        rows={2}
                        {...register('notes')}
                        placeholder="Optional notes about this payment..."
                        className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm">
                      <span className="text-slate-500">Remaining Due After Payment</span>
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(remainingAfter)}
                      </span>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        disabled={mutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" isLoading={mutation.isPending}>
                        Record Payment
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {!selectedCustomerId && (
            <p className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
              Search and select a customer to see their outstanding invoices.
            </p>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
