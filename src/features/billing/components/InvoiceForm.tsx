import { useForm, useFieldArray, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Scale, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getCustomers } from '@/features/customers/services/customer.service';
import { getProducts } from '@/features/products/services/product.service';
import { getInvoices, type CreateInvoiceRequest } from '@/features/billing/services/invoice.service';
import { toLocalDateInputValue } from '@/lib/utils/format';
import {
  resolveProductPrice,
  type CustomerType,
  type PricingTier,
} from '@/types/database.types';

const invoiceItemSchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  quantity: z
    .number({ invalid_type_error: 'Required' })
    .int('Whole number')
    .positive('Must be greater than 0'),
});

const invoiceFormSchema = z
  .object({
    customer_id: z.string().min(1, 'Customer is required'),
    invoice_date: z.string().min(1, 'Invoice date is required'),
    due_date: z.string().optional(),
    tax_amount: z.number({ invalid_type_error: 'Required' }).min(0, 'Must be 0 or more'),
    notes: z.string().optional(),
    items: z.array(invoiceItemSchema).min(1, 'Add at least one item'),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    data.items.forEach((item, index) => {
      if (!item.product_id) return;
      if (seen.has(item.product_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', index, 'product_id'],
          message: 'This product is already added',
        });
      } else {
        seen.add(item.product_id);
      }
    });
  });

type InvoiceFormData = z.infer<typeof invoiceFormSchema>;

type InvoiceFormProps = {
  onSubmit: (request: CreateInvoiceRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
};

function formatCurrency(value: number): string {
  return `₹${Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatVP(value: number): string {
  return `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })} VP`;
}

function todayForInput(): string {
  return toLocalDateInputValue();
}

function CustomerTypeBadge({ type }: { type: CustomerType }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
        type === 'coach' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'
      }`}
    >
      {type === 'coach' ? 'Coach' : 'PC'}
    </span>
  );
}

function PricingTierBadge({ tier }: { tier: PricingTier }) {
  return (
    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
      {tier === 'MRP' ? 'MRP' : `${tier}%`}
    </span>
  );
}

export function InvoiceForm({ onSubmit, onCancel, isLoading = false }: InvoiceFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setError,
    formState: { errors },
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      customer_id: '',
      invoice_date: todayForInput(),
      due_date: '',
      tax_amount: 0,
      notes: '',
      items: [{ product_id: '', quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const { data: customersData } = useQuery({
    queryKey: ['customers', { status: 'active' }],
    queryFn: () => getCustomers({ status: 'active' }),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products', { status: 'active' }],
    queryFn: () => getProducts({ status: 'active' }),
  });

  const customers = customersData?.customers || [];
  const products = productsData?.products || [];
  const productMap = new Map(products.map((product) => [product.id, product]));

  const selectedCustomerId = watch('customer_id');
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
  const tier = selectedCustomer?.pricing_tier;

  const { data: customerInvoicesData } = useQuery({
    queryKey: ['invoices', { customerId: selectedCustomerId }],
    queryFn: () => getInvoices({ customerId: selectedCustomerId }),
    enabled: !!selectedCustomerId,
  });

  const existingDue = (customerInvoicesData?.invoices || [])
    .filter((invoice) => invoice.status !== 'cancelled')
    .reduce((sum, invoice) => sum + Number(invoice.due_amount), 0);

  const watchedItems = watch('items') || [];
  const taxAmount = Number(watch('tax_amount')) || 0;

  // Derived per-row figures and summary (display only; the server recomputes).
  const rows = watchedItems.map((item) => {
    const product = item?.product_id ? productMap.get(item.product_id) : undefined;
    const quantity = Number(item?.quantity) || 0;
    const unitPrice = product && tier ? resolveProductPrice(product, tier) : 0;
    const unitVp = product ? Number(product.volume_points) : 0;
    return {
      unitPrice,
      lineTotal: unitPrice * quantity,
      lineVp: unitVp * quantity,
    };
  });

  const subtotal = rows.reduce((sum, row) => sum + row.lineTotal, 0);
  const totalVp = rows.reduce((sum, row) => sum + row.lineVp, 0);
  const totalItems = watchedItems.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);
  const grandTotal = subtotal + taxAmount;

  const selectedProductIds = watchedItems.map((item) => item?.product_id).filter(Boolean) as string[];

  const onFormSubmit: SubmitHandler<InvoiceFormData> = async (data) => {
    // Defensive guard: reject any product that is missing or inactive.
    for (let index = 0; index < data.items.length; index += 1) {
      const product = productMap.get(data.items[index].product_id);
      if (!product || !product.is_active) {
        setError(`items.${index}.product_id`, {
          type: 'manual',
          message: 'Product is not available',
        });
        return;
      }
    }

    const request: CreateInvoiceRequest = {
      customer_id: data.customer_id,
      items: data.items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
      tax_amount: data.tax_amount,
      invoice_date: data.invoice_date,
      due_date: data.due_date || undefined,
      notes: data.notes || null,
    };

    await onSubmit(request);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
        {/* Customer Selection */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Customer</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="customer_id" className="block text-sm font-medium text-slate-700">
                Customer *
              </label>
              <select
                id="customer_id"
                {...register('customer_id')}
                className={`flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
                  errors.customer_id ? 'border-red-500' : 'border-slate-200'
                }`}
              >
                <option value="">Select a customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} ({customer.phone})
                  </option>
                ))}
              </select>
              {errors.customer_id && <p className="text-sm text-red-600">{errors.customer_id.message}</p>}
            </div>

            {selectedCustomer && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-900">{selectedCustomer.name}</p>
                  <div className="flex gap-2">
                    <CustomerTypeBadge type={selectedCustomer.customer_type} />
                    <PricingTierBadge tier={selectedCustomer.pricing_tier} />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Scale className="h-4 w-4 text-slate-400" />
                    <span>
                      Current Weight:{' '}
                      <span className="font-medium text-slate-900">
                        {selectedCustomer.current_weight != null
                          ? `${selectedCustomer.current_weight} kg`
                          : '—'}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <AlertCircle
                      className={`h-4 w-4 ${existingDue > 0 ? 'text-red-500' : 'text-slate-400'}`}
                    />
                    <span>
                      Existing Due:{' '}
                      <span className={`font-medium ${existingDue > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        {formatCurrency(existingDue)}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Invoice Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Items</h3>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => append({ product_id: '', quantity: 1 })}
              disabled={!selectedCustomer}
            >
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          </div>

          {!selectedCustomer ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Select a customer to start adding items.
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => {
                const row = rows[index];
                const itemError = errors.items?.[index];
                return (
                  <div
                    key={field.id}
                    className="grid items-start gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-12"
                  >
                    {/* Product */}
                    <div className="space-y-1.5 md:col-span-5">
                      <label className="block text-xs font-medium text-slate-500">Product</label>
                      <select
                        {...register(`items.${index}.product_id`)}
                        className={`flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
                          itemError?.product_id ? 'border-red-500' : 'border-slate-200'
                        }`}
                      >
                        <option value="">Select a product</option>
                        {products.map((product) => {
                          const takenElsewhere =
                            selectedProductIds.includes(product.id) &&
                            watchedItems[index]?.product_id !== product.id;
                          return (
                            <option key={product.id} value={product.id} disabled={takenElsewhere}>
                              {product.name} ({product.sku})
                            </option>
                          );
                        })}
                      </select>
                      {itemError?.product_id && (
                        <p className="text-xs text-red-600">{itemError.product_id.message}</p>
                      )}
                    </div>

                    {/* Quantity */}
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="block text-xs font-medium text-slate-500">Qty</label>
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                        error={itemError?.quantity?.message}
                      />
                    </div>

                    {/* Unit price */}
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="block text-xs font-medium text-slate-500">Unit Price</label>
                      <p className="flex h-10 items-center text-sm text-slate-700">
                        {formatCurrency(row?.unitPrice ?? 0)}
                      </p>
                    </div>

                    {/* Line total + VP */}
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="block text-xs font-medium text-slate-500">Line Total</label>
                      <div className="flex h-10 flex-col justify-center">
                        <p className="text-sm font-medium text-slate-900">
                          {formatCurrency(row?.lineTotal ?? 0)}
                        </p>
                        <p className="text-xs text-orange-600">{formatVP(row?.lineVp ?? 0)}</p>
                      </div>
                    </div>

                    {/* Remove */}
                    <div className="flex h-full items-center justify-end md:col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                        disabled={fields.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {errors.items && typeof errors.items.message === 'string' && (
                <p className="text-sm text-red-600">{errors.items.message}</p>
              )}
            </div>
          )}
        </div>

        {/* Invoice meta */}
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Invoice Date *"
            type="date"
            {...register('invoice_date')}
            error={errors.invoice_date?.message}
          />
          <Input
            label="Due Date"
            type="date"
            {...register('due_date')}
            error={errors.due_date?.message}
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
            placeholder="Optional notes for this invoice..."
            className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
          />
        </div>

        {/* Summary */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Total Items</span>
              <span className="font-medium text-slate-900">{totalItems}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium text-slate-900">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Total VP</span>
              <span className="font-medium text-orange-600">{formatVP(totalVp)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">Tax</span>
              <div className="w-32">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('tax_amount', { valueAsNumber: true })}
                  error={errors.tax_amount?.message}
                  className="text-right"
                />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3">
              <span className="text-base font-semibold text-slate-900">Grand Total</span>
              <span className="text-base font-semibold text-slate-900">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Create Invoice
          </Button>
        </div>
      </form>
    </div>
  );
}
