import { useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { calculateAge, toDateInputValue, toLocalDateInputValue } from '@/lib/utils/format';
import { TIERS_BY_CUSTOMER_TYPE } from '@/types';
import type { Customer, CustomerInsert, CustomerUpdate, Gender, CustomerGoal, CustomerType, PricingTier } from '@/types';

const customerFormSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters').trim(),
    phone: z.string().min(10, 'Phone number must be at least 10 digits').regex(/^\d+$/, 'Phone number must contain only digits'),
    whatsapp_number: z.string().optional().refine((val) => !val || (val.length >= 10 && /^\d+$/.test(val)), {
      message: 'WhatsApp number must be at least 10 digits and contain only digits',
    }),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    gender: z.enum(['male', 'female', 'other'] as const).optional(),
    date_of_birth: z.string().optional(),
    city: z.string().optional(),
    joining_date: z.string().min(1, 'Joining date is required'),
    // Height / Starting Weight / Target Weight are OPTIONAL. They use
    // `valueAsNumber: true` in register(), which yields NaN for an empty
    // input — preprocess converts NaN/empty back to undefined so the
    // `.optional()` actually applies and the min/max range checks only run
    // when a real value was entered.
    height_cm: z.preprocess(
      (val) => (val == null || val === '' || Number.isNaN(val) ? undefined : val),
      z.number().min(50, 'Height must be at least 50 cm').max(250, 'Height must be at most 250 cm').optional(),
    ),
    starting_weight: z.preprocess(
      (val) => (val == null || val === '' || Number.isNaN(val) ? undefined : val),
      z.number().min(20, 'Weight must be at least 20 kg').max(300, 'Weight must be at most 300 kg').optional(),
    ),
    target_weight: z.preprocess(
      (val) => (val == null || val === '' || Number.isNaN(val) ? undefined : val),
      z.number().min(20, 'Weight must be at least 20 kg').max(300, 'Weight must be at most 300 kg').optional(),
    ),
    goal: z.enum(['weight_loss', 'weight_gain', 'maintenance', 'muscle_gain', 'general_wellness'] as const).optional(),
    customer_type: z.enum(['pc', 'coach'] as const),
    pricing_tier: z.enum(['MRP', '15', '25', '35', '42', '50'] as const),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const validTiers = TIERS_BY_CUSTOMER_TYPE[data.customer_type];
    if (!validTiers.includes(data.pricing_tier)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pricing_tier'],
        message: `Tier ${data.pricing_tier} is not valid for a ${data.customer_type === 'pc' ? 'PC' : 'Coach'} customer`,
      });
    }
  });

type CustomerFormData = z.infer<typeof customerFormSchema>;

type CustomerFormProps = {
  mode: 'create' | 'edit';
  customer?: Customer;
  onSubmit: (data: CustomerInsert | CustomerUpdate) => Promise<void>;
  isLoading?: boolean;
  onCancel: () => void;
};

const genderOptions: Array<{ value: Gender; label: string }> = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const goalOptions: Array<{ value: CustomerGoal; label: string }> = [
  { value: 'weight_loss', label: 'Weight Loss' },
  { value: 'weight_gain', label: 'Weight Gain' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'muscle_gain', label: 'Muscle Gain' },
  { value: 'general_wellness', label: 'General Wellness' },
];

const customerTypeOptions: Array<{ value: CustomerType; label: string }> = [
  { value: 'pc', label: 'PC (Preferred Customer)' },
  { value: 'coach', label: 'Coach (Distributor)' },
];

function tierLabel(tier: PricingTier): string {
  return tier === 'MRP' ? 'MRP' : `${tier}%`;
}

function Select({
  label,
  name,
  options,
  register,
  error,
  placeholder = 'Select an option',
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  register: any;
  error?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={name}
        {...register(name)}
        className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
      >
        <option value="">{placeholder}</option>
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

function Textarea({
  label,
  name,
  register,
  error,
  placeholder,
}: {
  label: string;
  name: string;
  register: any;
  error?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea
        id={name}
        rows={3}
        {...register(name)}
        placeholder={placeholder}
        className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 resize-none"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function CustomerForm({ mode, customer, onSubmit, isLoading = false, onCancel }: CustomerFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: customer?.name || '',
      phone: customer?.phone || '',
      whatsapp_number: customer?.whatsapp_number || '',
      email: customer?.email || '',
      gender: customer?.gender || undefined,
      date_of_birth: customer?.date_of_birth || '',
      city: customer?.city || '',
      joining_date: toDateInputValue(customer?.joining_date),
      height_cm: customer?.height_cm || undefined,
      starting_weight: customer?.starting_weight || undefined,
      target_weight: customer?.target_weight || undefined,
      goal: customer?.goal || undefined,
      customer_type: customer?.customer_type || 'pc',
      pricing_tier: customer?.pricing_tier || 'MRP',
      notes: customer?.notes || '',
    },
  });

  const dateOfBirth = watch('date_of_birth');
  const age = calculateAge(dateOfBirth);

  const customerType = watch('customer_type');
  const pricingTier = watch('pricing_tier');
  const tierOptions = TIERS_BY_CUSTOMER_TYPE[customerType].map((tier) => ({
    value: tier,
    label: tierLabel(tier),
  }));

  // When the membership type changes, reset the tier if it is no longer valid.
  useEffect(() => {
    if (!TIERS_BY_CUSTOMER_TYPE[customerType].includes(pricingTier)) {
      setValue('pricing_tier', 'MRP', { shouldValidate: true });
    }
  }, [customerType, pricingTier, setValue]);

  const onFormSubmit: SubmitHandler<CustomerFormData> = async (data) => {
    const processedData = {
      ...data,
      email: data.email || null,
      whatsapp_number: data.whatsapp_number || null,
      city: data.city || null,
      gender: data.gender || null,
      date_of_birth: data.date_of_birth || null,
      height_cm: data.height_cm || null,
      starting_weight: data.starting_weight || null,
      target_weight: data.target_weight || null,
      goal: data.goal || null,
      notes: data.notes || null,
    };

    await onSubmit(processedData);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <Input
            label="Name *"
            {...register('name')}
            error={errors.name?.message}
            placeholder="Enter customer name"
          />

          <Input
            label="Phone *"
            type="tel"
            {...register('phone')}
            error={errors.phone?.message}
            placeholder="1234567890"
          />

          <Input
            label="WhatsApp Number"
            type="tel"
            {...register('whatsapp_number')}
            error={errors.whatsapp_number?.message}
            placeholder="1234567890"
          />

          <Input
            label="Email"
            type="email"
            {...register('email')}
            error={errors.email?.message}
            placeholder="customer@example.com"
          />

          <Select
            label="Gender"
            name="gender"
            options={genderOptions}
            register={register}
            error={errors.gender?.message}
            placeholder="Select gender"
          />

          <Input
            label="Date of Birth"
            type="date"
            {...register('date_of_birth')}
            error={errors.date_of_birth?.message}
            max={toLocalDateInputValue()}
          />

          <Input
            label="Age"
            type="text"
            value={age != null ? `${age} years` : ''}
            placeholder="Auto-calculated from date of birth"
            readOnly
            disabled
          />

          <Input
            label="City"
            {...register('city')}
            error={errors.city?.message}
            placeholder="Enter city"
          />

          <Input
            label="Joining Date *"
            type="date"
            {...register('joining_date')}
            error={errors.joining_date?.message}
          />

          <Select
            label="Customer Type *"
            name="customer_type"
            options={customerTypeOptions}
            register={register}
            error={errors.customer_type?.message}
          />

          <Select
            label="Pricing Tier *"
            name="pricing_tier"
            options={tierOptions}
            register={register}
            error={errors.pricing_tier?.message}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Input
            label="Height (cm)"
            type="number"
            step="0.1"
            {...register('height_cm', { valueAsNumber: true })}
            error={errors.height_cm?.message}
            placeholder="170.5"
          />

          <Input
            label="Starting Weight (kg)"
            type="number"
            step="0.1"
            {...register('starting_weight', { valueAsNumber: true })}
            error={errors.starting_weight?.message}
            placeholder="75.5"
          />

          <Input
            label="Target Weight (kg)"
            type="number"
            step="0.1"
            {...register('target_weight', { valueAsNumber: true })}
            error={errors.target_weight?.message}
            placeholder="70.0"
          />
        </div>

        <Select
          label="Goal"
          name="goal"
          options={goalOptions}
          register={register}
          error={errors.goal?.message}
          placeholder="Select wellness goal"
        />

        <Textarea
          label="Notes"
          name="notes"
          register={register}
          error={errors.notes?.message}
          placeholder="Enter any additional notes about the customer..."
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {mode === 'create' ? 'Create Customer' : 'Update Customer'}
          </Button>
        </div>
      </form>
    </div>
  );
}