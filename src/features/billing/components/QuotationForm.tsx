import { useEffect } from 'react';
import {
  useForm,
  useFieldArray,
  Controller,
  type SubmitHandler,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Scale } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getCustomers } from '@/features/customers/services/customer.service';
import { getProducts } from '@/features/products/services/product.service';
import { getStockLocations } from '@/features/inventory/services/inventory.service';
import { ProductSearchCombobox } from '@/features/billing/components/ProductSearchCombobox';
import { LocationSelect } from '@/features/inventory/components/LocationSelect';
import { toLocalDateInputValue } from '@/lib/utils/format';
import {
  resolveProductPrice,
  type CustomerType,
  type PricingTier,
} from '@/types/database.types';
import type {
  CreateQuotationRequest,
  QuotationWithDetails,
} from '@/features/billing/services/quotation.service';

const quotationItemSchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  quantity: z
    .number({ invalid_type_error: 'Required' })
    .int('Whole number')
    .positive('Must be greater than 0'),
});

const quotationFormSchema = z
  .object({
    customer_id: z.string().min(1, 'Customer is required'),
    stock_location_id: z.string().min(1, 'Stock location is required'),
    quotation_date: z.string().min(1, 'Quotation date is required'),
    valid_until: z.string().min(1, 'Valid until is required'),
    tax_amount: z.number({ invalid_type_error: 'Required' }).min(0, 'Must be 0 or more'),
    notes: z.string().optional(),
    terms: z.string().optional(),
    items: z.array(quotationItemSchema).min(1, 'Add at least one item'),
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

    if (data.valid_until && data.quotation_date && data.valid_until < data.quotation_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['valid_until'],
        message: 'Valid until must be on or after the quotation date',
      });
    }
  });

type QuotationFormData = z.infer<typeof quotationFormSchema>;

export type QuotationFormSubmitPayload = CreateQuotationRequest;

type QuotationFormProps = {
  onSubmit: (request: QuotationFormSubmitPayload) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
  initialQuotation?: QuotationWithDetails | null;
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

function defaultValidUntil(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return toLocalDateInputValue(date);
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

function buildInitialValues(initialQuotation?: QuotationWithDetails | null): QuotationFormData {
  if (!initialQuotation) {
    return {
      customer_id: '',
      stock_location_id: '',
      quotation_date: todayForInput(),
      valid_until: defaultValidUntil(),
      tax_amount: 0,
      notes: '',
      terms: '',
      items: [{ product_id: '', quantity: 1 }],
    };
  }

  return {
    customer_id: initialQuotation.customer_id,
    stock_location_id: initialQuotation.stock_location_id,
    quotation_date: initialQuotation.quotation_date,
    valid_until: initialQuotation.valid_until,
    tax_amount: Number(initialQuotation.tax_amount),
    notes: initialQuotation.notes ?? '',
    terms: initialQuotation.terms ?? '',
    items:
      initialQuotation.items.length > 0
        ? initialQuotation.items.map((item) => ({
            product_id: item.product_id ?? '',
            quantity: item.quantity,
          }))
        : [{ product_id: '', quantity: 1 }],
  };
}

export function QuotationForm({
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel = 'Create Quotation',
  initialQuotation = null,
}: QuotationFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<QuotationFormData>({
    resolver: zodResolver(quotationFormSchema),
    defaultValues: buildInitialValues(initialQuotation),
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

  const { data: stockLocations = [] } = useQuery({
    queryKey: ['inventory', 'locations'],
    queryFn: () => getStockLocations(true),
  });

  const defaultStockLocation =
    stockLocations.find((location) => location.is_default) ?? stockLocations[0];

  const stockLocationId = watch('stock_location_id');

  useEffect(() => {
    if (defaultStockLocation && !stockLocationId) {
      setValue('stock_location_id', defaultStockLocation.id, { shouldValidate: true });
    }
  }, [defaultStockLocation, setValue, stockLocationId]);

  const customers = customersData?.customers || [];
  const products = productsData?.products || [];
  const productMap = new Map(products.map((product) => [product.id, product]));

  const selectedCustomerId = watch('customer_id');
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
  const tier = selectedCustomer?.pricing_tier;

  const watchedItems = watch('items') || [];
  const taxAmount = Number(watch('tax_amount')) || 0;

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

  const selectedProductIds = watchedItems
    .map((item) => item?.product_id)
    .filter(Boolean) as string[];

  const onFormSubmit: SubmitHandler<QuotationFormData> = async (data) => {
    for (let index = 0; index < data.items.length; index += 1) {
      const product = productMap.get(data.items[index].product_id);
      if (!product) {
        setError(`items.${index}.product_id`, {
          type: 'manual',
          message: 'Product is not available',
        });
        return;
      }
    }

    const request: QuotationFormSubmitPayload = {
      customer_id: data.customer_id,
      stock_location_id: data.stock_location_id,
      items: data.items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
      tax_amount: data.tax_amount,
      quotation_date: data.quotation_date,
      valid_until: data.valid_until,
      notes: data.notes || null,
      terms: data.terms || null,
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
                    {customer.name}
                  </option>
                ))}
              </select>
              {errors.customer_id && (
                <p className="text-sm text-red-600">{errors.customer_id.message}</p>
              )}
            </div>

            <LocationSelect
              label="Stock Location *"
              locations={stockLocations}
              value={stockLocationId}
              onChange={(value) => setValue('stock_location_id', value, { shouldValidate: true })}
              error={errors.stock_location_id?.message}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {selectedCustomer ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 md:col-span-2">
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
                    <span className="text-slate-400">Phone:</span>
                    <span className="font-medium text-slate-900">
                      {selectedCustomer.phone || '—'}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Quotation Items */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Items</h3>

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
                    <div className="space-y-1.5 md:col-span-5">
                      <label className="block text-xs font-medium text-slate-500">Product</label>
                      <Controller
                        name={`items.${index}.product_id`}
                        control={control}
                        render={({ field }) => (
                          <ProductSearchCombobox
                            id={`items.${index}.product_id`}
                            products={products}
                            value={field.value}
                            onChange={field.onChange}
                            disabledProductIds={selectedProductIds.filter(
                              (productId) => productId !== field.value,
                            )}
                            error={itemError?.product_id?.message}
                          />
                        )}
                      />
                    </div>

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

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="block text-xs font-medium text-slate-500">Unit Price</label>
                      <p className="flex h-10 items-center text-sm text-slate-700">
                        {formatCurrency(row?.unitPrice ?? 0)}
                      </p>
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="block text-xs font-medium text-slate-500">Line Total</label>
                      <div className="flex h-10 flex-col justify-center">
                        <p className="text-sm font-medium text-slate-900">
                          {formatCurrency(row?.lineTotal ?? 0)}
                        </p>
                        <p className="text-xs text-orange-600">{formatVP(row?.lineVp ?? 0)}</p>
                      </div>
                    </div>

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

              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => append({ product_id: '', quantity: 1 })}
              >
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </div>
          )}
        </div>

        {/* Quotation meta */}
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Quotation Date *"
            type="date"
            {...register('quotation_date')}
            error={errors.quotation_date?.message}
          />
          <Input
            label="Valid Until *"
            type="date"
            {...register('valid_until')}
            error={errors.valid_until?.message}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="terms" className="block text-sm font-medium text-slate-700">
            Terms &amp; Conditions
          </label>
          <textarea
            id="terms"
            rows={2}
            {...register('terms')}
            placeholder="Optional terms for this quotation..."
            className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
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
            placeholder="Optional notes for this quotation..."
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
              <span className="text-base font-semibold text-slate-900">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
