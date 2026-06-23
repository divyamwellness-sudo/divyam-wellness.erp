import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Product, ProductInsert, ProductUpdate, ProductCategory } from '@/types';

export const productCategoryOptions: Array<{ value: ProductCategory; label: string }> = [
  { value: 'shakes', label: 'Shakes' },
  { value: 'protein', label: 'Protein' },
  { value: 'tea_energy', label: 'Tea & Energy' },
  { value: 'supplements', label: 'Supplements' },
  { value: 'vitamins', label: 'Vitamins' },
  { value: 'skincare', label: 'Skincare' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'other', label: 'Other' },
];

const priceField = z.number({ invalid_type_error: 'Required' }).min(0, 'Must be 0 or more');

const productFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').trim(),
  sku: z.string().min(1, 'SKU is required').trim(),
  category: z.enum([
    'shakes',
    'protein',
    'tea_energy',
    'supplements',
    'vitamins',
    'skincare',
    'accessories',
    'other',
  ] as const),
  mrp_price: z.number({ invalid_type_error: 'Required' }).positive('MRP must be greater than 0'),
  price_15: priceField,
  price_25: priceField,
  price_35: priceField,
  price_42: priceField,
  price_50: priceField,
  volume_points: priceField,
  is_active: z.boolean(),
});

type ProductFormData = z.infer<typeof productFormSchema>;

type ProductFormProps = {
  mode: 'create' | 'edit';
  product?: Product;
  onSubmit: (data: ProductInsert | ProductUpdate) => Promise<void>;
  isLoading?: boolean;
  onCancel: () => void;
};

function Select({
  label,
  name,
  options,
  register,
  error,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  register: any;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={name}
        {...register(name)}
        className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function ProductForm({ mode, product, onSubmit, isLoading = false, onCancel }: ProductFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name || '',
      sku: product?.sku || '',
      category: product?.category || 'other',
      mrp_price: product?.mrp_price ?? undefined,
      price_15: product?.price_15 ?? 0,
      price_25: product?.price_25 ?? 0,
      price_35: product?.price_35 ?? 0,
      price_42: product?.price_42 ?? 0,
      price_50: product?.price_50 ?? 0,
      volume_points: product?.volume_points ?? 0,
      is_active: product?.is_active ?? true,
    },
  });

  const onFormSubmit: SubmitHandler<ProductFormData> = async (data) => {
    await onSubmit(data);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <Input
            label="Name *"
            {...register('name')}
            error={errors.name?.message}
            placeholder="Formula 1 Nutritional Shake"
          />

          <Input
            label="SKU *"
            {...register('sku')}
            error={errors.sku?.message}
            placeholder="F1-VAN-550"
          />

          <Select
            label="Category *"
            name="category"
            options={productCategoryOptions}
            register={register}
            error={errors.category?.message}
          />

          <Input
            label="MRP Price (₹) *"
            type="number"
            step="0.01"
            {...register('mrp_price', { valueAsNumber: true })}
            error={errors.mrp_price?.message}
            placeholder="2950.00"
          />
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-slate-700">Tier Prices (₹)</h4>
          <p className="mb-3 text-xs text-slate-500">
            Price is keyed by tier value. Tier 25 and Tier 35 are shared between PC and Coach customers.
          </p>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <Input
              label="15%"
              type="number"
              step="0.01"
              {...register('price_15', { valueAsNumber: true })}
              error={errors.price_15?.message}
              placeholder="0.00"
            />
            <Input
              label="25%"
              type="number"
              step="0.01"
              {...register('price_25', { valueAsNumber: true })}
              error={errors.price_25?.message}
              placeholder="0.00"
            />
            <Input
              label="35%"
              type="number"
              step="0.01"
              {...register('price_35', { valueAsNumber: true })}
              error={errors.price_35?.message}
              placeholder="0.00"
            />
            <Input
              label="42%"
              type="number"
              step="0.01"
              {...register('price_42', { valueAsNumber: true })}
              error={errors.price_42?.message}
              placeholder="0.00"
            />
            <Input
              label="50%"
              type="number"
              step="0.01"
              {...register('price_50', { valueAsNumber: true })}
              error={errors.price_50?.message}
              placeholder="0.00"
            />
          </div>
        </div>

        <Input
          label="Volume Points (VP) *"
          type="number"
          step="0.01"
          {...register('volume_points', { valueAsNumber: true })}
          error={errors.volume_points?.message}
          placeholder="45.00"
        />

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            {...register('is_active')}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm font-medium text-slate-700">Active (available for billing)</span>
        </label>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {mode === 'create' ? 'Create Product' : 'Update Product'}
          </Button>
        </div>
      </form>
    </div>
  );
}
