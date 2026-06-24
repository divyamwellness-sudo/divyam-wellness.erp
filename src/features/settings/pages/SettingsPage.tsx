import { useEffect, useRef, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  getBusinessSettings,
  updateBusinessSettings,
  type UpdateBusinessSettingsRequest,
} from '@/features/settings/services/settings.service';

const currencyOptions = [{ value: 'INR', label: 'INR (₹)' }] as const;

const settingsFormSchema = z.object({
  business_name: z.string().min(2, 'Business name must be at least 2 characters').trim(),
  invoice_prefix: z
    .string()
    .min(1, 'Invoice prefix is required')
    .max(10, 'Invoice prefix must be at most 10 characters')
    .regex(/^[A-Z0-9-]+$/, 'Use uppercase letters, numbers, or hyphens only')
    .transform((value) => value.toUpperCase()),
  currency: z.enum(['INR']),
  phone: z
    .string()
    .optional()
    .refine((val) => !val || (val.length >= 10 && /^\d+$/.test(val)), {
      message: 'Phone must be at least 10 digits and contain only digits',
    }),
  whatsapp_number: z
    .string()
    .optional()
    .refine((val) => !val || (val.length >= 10 && /^\d+$/.test(val)), {
      message: 'WhatsApp number must be at least 10 digits and contain only digits',
    }),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  address: z.string().optional(),
  gstin: z.string().optional(),
});

type SettingsFormData = z.infer<typeof settingsFormSchema>;

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { refreshProfile } = useAuth();

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    data: settings,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['businessSettings'],
    queryFn: getBusinessSettings,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      business_name: '',
      invoice_prefix: 'DW',
      currency: 'INR',
      phone: '',
      whatsapp_number: '',
      email: '',
      address: '',
      gstin: '',
    },
  });

  useEffect(() => {
    if (settings) {
      reset({
        business_name: settings.business_name,
        invoice_prefix: settings.invoice_prefix,
        currency: settings.currency as 'INR',
        phone: settings.phone ?? '',
        whatsapp_number: settings.whatsapp_number ?? '',
        email: settings.email ?? '',
        address: settings.address ?? '',
        gstin: settings.gstin ?? '',
      });
    }
  }, [settings, reset]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  const saveMutation = useMutation({
    mutationFn: (payload: UpdateBusinessSettingsRequest) =>
      updateBusinessSettings(settings!.id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['businessSettings'] });
      await refreshProfile();
      setToast('Settings saved successfully.');
      toastTimer.current = setTimeout(() => setToast(null), 3000);
    },
  });

  const onSubmit: SubmitHandler<SettingsFormData> = async (data) => {
    const payload: UpdateBusinessSettingsRequest = {
      business_name: data.business_name,
      invoice_prefix: data.invoice_prefix,
      currency: data.currency,
      phone: data.phone || null,
      whatsapp_number: data.whatsapp_number || null,
      email: data.email || null,
      address: data.address || null,
      gstin: data.gstin || null,
    };

    await saveMutation.mutateAsync(payload).catch(() => {
      // Error surfaced via mutation state if needed.
    });
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        <p className="mt-4 text-slate-500">Loading settings...</p>
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div>
        <PageHeader title="Settings" description="Manage your business and system preferences." />
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700">Failed to load settings. Please try again.</p>
          <Button variant="secondary" className="mt-4" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Settings" description="Manage your business and system preferences." />

      {saveMutation.error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {saveMutation.error instanceof Error
            ? saveMutation.error.message
            : 'Failed to save settings. Please try again.'}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Business Settings */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Business Settings</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Business Name *"
              {...register('business_name')}
              error={errors.business_name?.message}
              placeholder="Divyam Wellness"
            />

            <div className="space-y-1.5">
              <Input
                label="Invoice Prefix *"
                {...register('invoice_prefix')}
                error={errors.invoice_prefix?.message}
                placeholder="DW"
                className="uppercase"
              />
              <p className="text-xs text-amber-700">
                Changing the invoice prefix affects only future invoices. Existing invoices will remain
                unchanged.
              </p>
            </div>

            <Input
              label="Next Invoice Number"
              type="text"
              value={String(settings.next_invoice_number)}
              readOnly
              disabled
              placeholder="Auto-managed"
            />

            <div className="space-y-1.5">
              <label htmlFor="currency" className="block text-sm font-medium text-slate-700">
                Default Currency *
              </label>
              <select
                id="currency"
                {...register('currency')}
                className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                {currencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.currency && <p className="text-sm text-red-600">{errors.currency.message}</p>}
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Next invoice number is auto-incremented when new invoices are created.
          </p>
        </section>

        {/* Business Information */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Business Information</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Phone"
              type="tel"
              {...register('phone')}
              error={errors.phone?.message}
              placeholder="9876543210"
            />

            <Input
              label="WhatsApp Number"
              type="tel"
              {...register('whatsapp_number')}
              error={errors.whatsapp_number?.message}
              placeholder="9876543210"
            />

            <Input
              label="Email"
              type="email"
              {...register('email')}
              error={errors.email?.message}
              placeholder="business@example.com"
            />

            <Input
              label="GSTIN"
              {...register('gstin')}
              error={errors.gstin?.message}
              placeholder="22AAAAA0000A1Z5"
            />
          </div>

          <div className="mt-4 space-y-1.5">
            <label htmlFor="address" className="block text-sm font-medium text-slate-700">
              Address
            </label>
            <textarea
              id="address"
              rows={3}
              {...register('address')}
              placeholder="Business address..."
              className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
            />
            {errors.address && <p className="text-sm text-red-600">{errors.address.message}</p>}
          </div>
        </section>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-6 py-4">
          <p className="text-sm text-slate-500">
            Last updated: {formatDateTime(settings.updated_at)}
          </p>
          <Button type="submit" isLoading={saveMutation.isPending}>
            Save Settings
          </Button>
        </div>
      </form>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
