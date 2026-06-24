import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit, Trash2, Scale, TrendingUp, TrendingDown, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/layout/PageHeader';
import { QueryErrorAlert } from '@/components/shared/QueryErrorAlert';
import { CustomerCombobox } from '@/features/customers/components/CustomerCombobox';
import { calculateAge, toDateInputValue, toLocalDateInputValue } from '@/lib/utils/format';
import {
  getWeightLogs,
  addWeightLog,
  updateWeightLog,
  deleteWeightLog,
  getLatestWeight,
} from '@/features/weight-tracking/services/weight-log.service';
import { getCustomers } from '@/features/customers/services/customer.service';
import type { WeightLog, WeightLogInsert, WeightLogUpdate, Customer } from '@/types';

const weightLogFormSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  weight_kg: z.number().min(20, 'Weight must be at least 20 kg').max(300, 'Weight must be at most 300 kg'),
  body_fat_percentage: z.preprocess(
    (val) => val === '' || val === null || val === undefined || (typeof val === 'number' && isNaN(val)) ? undefined : val,
    z.number().min(0, 'Body fat must be at least 0%').max(100, 'Body fat must be at most 100%').optional()
  ),
  bmi: z.preprocess(
    (val) => val === '' || val === null || val === undefined || (typeof val === 'number' && isNaN(val)) ? undefined : val,
    z.number().min(0, 'BMI must be at least 0').max(100, 'BMI must be at most 100').optional()
  ),
  visceral_fat: z.preprocess(
    (val) => val === '' || val === null || val === undefined || (typeof val === 'number' && isNaN(val)) ? undefined : val,
    z.number().min(0, 'Visceral fat must be at least 0').max(60, 'Visceral fat must be at most 60').optional()
  ),
  muscle_mass: z.preprocess(
    (val) => val === '' || val === null || val === undefined || (typeof val === 'number' && isNaN(val)) ? undefined : val,
    z.number().min(0, 'Muscle mass must be at least 0 kg').max(200, 'Muscle mass must be at most 200 kg').optional()
  ),
  bmr: z.preprocess(
    (val) => val === '' || val === null || val === undefined || (typeof val === 'number' && isNaN(val)) ? undefined : val,
    z.number().min(0, 'BMR must be at least 0').max(10000, 'BMR must be at most 10000').optional()
  ),
  metabolic_age: z.preprocess(
    (val) => val === '' || val === null || val === undefined || (typeof val === 'number' && isNaN(val)) ? undefined : val,
    z.number().int('Metabolic age must be a whole number').min(0, 'Metabolic age must be at least 0').max(120, 'Metabolic age must be at most 120').optional()
  ),
  tsf: z.preprocess(
    (val) => val === '' || val === null || val === undefined || (typeof val === 'number' && isNaN(val)) ? undefined : val,
    z.number().min(0, 'TSF must be at least 0 mm').max(100, 'TSF must be at most 100 mm').optional()
  ),
  recorded_date: z.string().min(1, 'Date is required'),
  notes: z.string().optional(),
});

type WeightLogFormData = z.infer<typeof weightLogFormSchema>;

type WeightLogFormMode = 'add' | 'edit' | null;

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function Textarea({
  label,
  register,
  error,
  placeholder,
  name,
}: {
  label: string;
  register: any;
  error?: string;
  placeholder?: string;
  name: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea
        id={name}
        rows={2}
        {...register(name)}
        placeholder={placeholder}
        className={`flex w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none ${
          error ? 'border-red-500' : 'border-slate-200'
        }`}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function WeightLogForm({
  mode,
  weightLog,
  onSubmit,
  onCancel,
  isLoading,
  customers,
}: {
  mode: 'add' | 'edit';
  weightLog?: WeightLog;
  onSubmit: (data: WeightLogInsert | WeightLogUpdate) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  customers: Customer[];
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<WeightLogFormData>({
    resolver: zodResolver(weightLogFormSchema),
    defaultValues: {
      customer_id: weightLog?.customer_id || '',
      weight_kg: weightLog?.weight_kg || undefined,
      body_fat_percentage: weightLog?.body_fat_percentage || undefined,
      bmi: weightLog?.bmi || undefined,
      visceral_fat: weightLog?.visceral_fat || undefined,
      muscle_mass: weightLog?.muscle_mass || undefined,
      bmr: weightLog?.bmr || undefined,
      metabolic_age: weightLog?.metabolic_age || undefined,
      tsf: weightLog?.tsf || undefined,
      recorded_date: toDateInputValue(weightLog?.recorded_date),
      notes: weightLog?.notes || '',
    },
  });

  const selectedCustomerId = watch('customer_id');

  const onFormSubmit: SubmitHandler<WeightLogFormData> = async (data) => {
    const processedData = {
      ...data,
      body_fat_percentage: data.body_fat_percentage ?? null,
      bmi: data.bmi ?? null,
      visceral_fat: data.visceral_fat ?? null,
      muscle_mass: data.muscle_mass ?? null,
      bmr: data.bmr ?? null,
      metabolic_age: data.metabolic_age ?? null,
      tsf: data.tsf ?? null,
      notes: data.notes || null,
    };

    await onSubmit(processedData);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-slate-900">
        {mode === 'add' ? 'Add Weight Log' : 'Edit Weight Log'}
      </h3>
      
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <CustomerCombobox
            label="Customer *"
            customers={customers}
            value={selectedCustomerId}
            onChange={(customerId) =>
              setValue('customer_id', customerId, { shouldValidate: true })
            }
            error={errors.customer_id?.message}
            placeholder="Search customer..."
          />

          <Input
            label="Date *"
            type="date"
            {...register('recorded_date')}
            error={errors.recorded_date?.message}
            max={toLocalDateInputValue()}
          />

          <Input
            label="Weight (kg) *"
            type="number"
            step="0.1"
            {...register('weight_kg', { valueAsNumber: true })}
            error={errors.weight_kg?.message}
            placeholder="75.5"
          />

          <Input
            label="Body Fat (%)"
            type="number"
            step="0.1"
            {...register('body_fat_percentage', { valueAsNumber: true })}
            error={errors.body_fat_percentage?.message}
            placeholder="18.5"
          />
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-slate-700">Body Composition</h4>
          <div className="grid gap-4 md:grid-cols-3">
            <Input
              label="VF (Visceral Fat)"
              type="number"
              step="0.1"
              {...register('visceral_fat', { valueAsNumber: true })}
              error={errors.visceral_fat?.message}
              placeholder="8"
            />

            <Input
              label="BMR (kcal/day)"
              type="number"
              step="1"
              {...register('bmr', { valueAsNumber: true })}
              error={errors.bmr?.message}
              placeholder="1500"
            />

            <Input
              label="BMI"
              type="number"
              step="0.1"
              {...register('bmi', { valueAsNumber: true })}
              error={errors.bmi?.message}
              placeholder="24.5"
            />

            <Input
              label="Age (Metabolic Age)"
              type="number"
              step="1"
              {...register('metabolic_age', { valueAsNumber: true })}
              error={errors.metabolic_age?.message}
              placeholder="30"
            />

            <Input
              label="TSF (mm)"
              type="number"
              step="0.1"
              {...register('tsf', { valueAsNumber: true })}
              error={errors.tsf?.message}
              placeholder="12.5"
            />

            <Input
              label="MM (Muscle Mass, kg)"
              type="number"
              step="0.1"
              {...register('muscle_mass', { valueAsNumber: true })}
              error={errors.muscle_mass?.message}
              placeholder="32.5"
            />
          </div>
        </div>

        <Textarea
          label="Notes"
          name="notes"
          register={register}
          error={errors.notes?.message}
          placeholder="Optional notes about this weight log..."
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {mode === 'add' ? 'Add Weight Log' : 'Update Weight Log'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function WeightStatsCard({
  customerId,
  dateOfBirth,
}: {
  customerId: string;
  dateOfBirth?: string | null;
}) {
  const { data: weightLogs } = useQuery({
    queryKey: ['weightLogs', customerId],
    queryFn: () => getWeightLogs(customerId),
    enabled: !!customerId,
  });

  const { data: latestWeight } = useQuery({
    queryKey: ['latestWeight', customerId],
    queryFn: () => getLatestWeight(customerId),
    enabled: !!customerId,
  });

  if (!customerId || !weightLogs || weightLogs.length === 0) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
          <Scale className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 text-sm text-slate-500">No weight logs yet</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
          <TrendingUp className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 text-sm text-slate-500">No progress data</p>
        </div>
      </div>
    );
  }

  const firstLog = weightLogs[0];
  const latestLog = latestWeight ?? weightLogs[weightLogs.length - 1];

  const firstWeight = firstLog?.weight_kg;
  const currentWeight = latestLog?.weight_kg;
  const weightChange = currentWeight && firstWeight ? currentWeight - firstWeight : null;
  const isWeightLoss = weightChange !== null && weightChange < 0;
  const isWeightGain = weightChange !== null && weightChange > 0;

  const realAge = calculateAge(dateOfBirth);
  const metabolicAge = latestLog?.metabolic_age ?? null;
  const ageGap =
    realAge != null && metabolicAge != null ? metabolicAge - realAge : null;
  const ageGapLabel =
    ageGap == null
      ? null
      : ageGap > 0
        ? `+${ageGap} Years Older`
        : ageGap < 0
          ? `${ageGap} Years Younger`
          : 'On Par';

  const composition = [
    { key: 'visceral_fat', label: 'VF (Visceral Fat)', unit: '', latest: latestLog?.visceral_fat, first: firstLog?.visceral_fat, lowerIsBetter: true },
    { key: 'bmr', label: 'BMR', unit: ' kcal', latest: latestLog?.bmr, first: firstLog?.bmr, lowerIsBetter: false },
    { key: 'bmi', label: 'BMI', unit: '', latest: latestLog?.bmi, first: firstLog?.bmi, lowerIsBetter: true },
    { key: 'metabolic_age', label: 'Age (Metabolic Age)', unit: ' yrs', latest: latestLog?.metabolic_age, first: firstLog?.metabolic_age, lowerIsBetter: true },
    { key: 'tsf', label: 'TSF', unit: ' mm', latest: latestLog?.tsf, first: firstLog?.tsf, lowerIsBetter: true },
    { key: 'muscle_mass', label: 'MM (Muscle Mass)', unit: ' kg', latest: latestLog?.muscle_mass, first: firstLog?.muscle_mass, lowerIsBetter: false },
  ] as const;

  const compositionWithData = composition.filter((metric) => metric.latest != null);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Latest Weight</p>
              <p className="text-2xl font-semibold text-slate-900">
                {currentWeight ? `${currentWeight} kg` : '—'}
              </p>
            </div>
            <Scale className="h-8 w-8 text-brand-600" />
          </div>
          {latestLog?.body_fat_percentage != null && (
            <p className="mt-2 text-sm text-slate-500">
              Body Fat: {latestLog.body_fat_percentage}%
            </p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Weight Change</p>
              <p className={`text-2xl font-semibold ${
                isWeightLoss ? 'text-green-600' : isWeightGain ? 'text-orange-600' : 'text-slate-900'
              }`}>
                {weightChange !== null ? `${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg` : '—'}
              </p>
            </div>
            {isWeightLoss ? (
              <TrendingDown className="h-8 w-8 text-green-600" />
            ) : isWeightGain ? (
              <TrendingUp className="h-8 w-8 text-orange-600" />
            ) : (
              <TrendingUp className="h-8 w-8 text-slate-400" />
            )}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Since {firstWeight ? formatDate(firstLog.recorded_date) : 'start'}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Age Gap</p>
            <p
              className={`text-2xl font-semibold ${
                ageGap == null
                  ? 'text-slate-900'
                  : ageGap > 0
                    ? 'text-orange-600'
                    : ageGap < 0
                      ? 'text-green-600'
                      : 'text-slate-900'
              }`}
            >
              {ageGapLabel ?? '—'}
            </p>
          </div>
          <CalendarClock
            className={`h-8 w-8 ${
              ageGap == null
                ? 'text-slate-400'
                : ageGap > 0
                  ? 'text-orange-600'
                  : ageGap < 0
                    ? 'text-green-600'
                    : 'text-slate-400'
            }`}
          />
        </div>
        <div className="mt-3 flex gap-6 text-sm text-slate-500">
          <span>
            Real Age:{' '}
            <span className="font-medium text-slate-900">
              {realAge != null ? `${realAge} yrs` : '—'}
            </span>
          </span>
          <span>
            Metabolic Age:{' '}
            <span className="font-medium text-slate-900">
              {metabolicAge != null ? `${metabolicAge} yrs` : '—'}
            </span>
          </span>
        </div>
      </div>

      {compositionWithData.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {compositionWithData.map((metric) => {
            const change =
              metric.latest != null && metric.first != null
                ? Number(metric.latest) - Number(metric.first)
                : null;
            const isImprovement =
              change !== null && change !== 0
                ? metric.lowerIsBetter
                  ? change < 0
                  : change > 0
                : null;

            return (
              <div key={metric.key} className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-medium text-slate-500">{metric.label}</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {metric.latest}
                  {metric.unit}
                </p>
                {change !== null && change !== 0 && (
                  <p
                    className={`mt-1 text-xs font-medium ${
                      isImprovement ? 'text-green-600' : 'text-orange-600'
                    }`}
                  >
                    {change > 0 ? '+' : ''}
                    {change.toFixed(1)}
                    {metric.unit} since start
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WeightLogTable({
  weightLogs,
  onEdit,
  onDelete,
  isDeleting,
}: {
  weightLogs: WeightLog[];
  onEdit: (weightLog: WeightLog) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  if (weightLogs.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <Scale className="mx-auto h-12 w-12 text-slate-400" />
        <p className="mt-4 text-slate-500">No weight logs found for this customer.</p>
        <p className="text-sm text-slate-400">Add the first weight entry to get started.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Weight
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Body Fat
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                VF
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                BMR
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                BMI
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Age
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                TSF
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                MM
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Notes
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {weightLogs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-sm font-medium text-slate-900">
                  {formatDate(log.recorded_date)}
                </td>
                <td className="px-6 py-4 text-sm text-slate-900">
                  {log.weight_kg} kg
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {log.body_fat_percentage != null ? `${log.body_fat_percentage}%` : '—'}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {log.visceral_fat != null ? log.visceral_fat : '—'}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {log.bmr != null ? `${log.bmr} kcal` : '—'}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {log.bmi != null ? log.bmi : '—'}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {log.metabolic_age != null ? `${log.metabolic_age} yrs` : '—'}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {log.tsf != null ? `${log.tsf} mm` : '—'}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {log.muscle_mass != null ? `${log.muscle_mass} kg` : '—'}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {log.notes || '—'}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(log)}
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(log.id)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function WeightTrackingPage() {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [formMode, setFormMode] = useState<WeightLogFormMode>(null);
  const [selectedWeightLog, setSelectedWeightLog] = useState<WeightLog | null>(null);

  const queryClient = useQueryClient();

  // Queries
  const { data: customersData, isLoading: isLoadingCustomers, error: customersError, refetch: refetchCustomers } = useQuery({
    queryKey: ['customers', { status: 'active' }],
    queryFn: () => getCustomers({ status: 'active' }),
  });

  const {
    data: weightLogs,
    isLoading: isLoadingLogs,
    error: weightLogsError,
    refetch: refetchWeightLogs,
  } = useQuery({
    queryKey: ['weightLogs', selectedCustomerId],
    queryFn: () => getWeightLogs(selectedCustomerId),
    enabled: !!selectedCustomerId,
  });

  // Mutations
  const addMutation = useMutation({
    mutationFn: addWeightLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weightLogs'] });
      queryClient.invalidateQueries({ queryKey: ['latestWeight'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setFormMode(null);
      setSelectedWeightLog(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: WeightLogUpdate }) =>
      updateWeightLog(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weightLogs'] });
      queryClient.invalidateQueries({ queryKey: ['latestWeight'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setFormMode(null);
      setSelectedWeightLog(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWeightLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weightLogs'] });
      queryClient.invalidateQueries({ queryKey: ['latestWeight'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  // Event handlers
  const handleAddWeightLog = async (data: WeightLogInsert | WeightLogUpdate) => {
    await addMutation.mutateAsync(data as WeightLogInsert);
  };

  const handleUpdateWeightLog = async (data: WeightLogInsert | WeightLogUpdate) => {
    if (!selectedWeightLog) return;
    await updateMutation.mutateAsync({ id: selectedWeightLog.id, data: data as WeightLogUpdate });
  };

  const handleEditWeightLog = (weightLog: WeightLog) => {
    setSelectedWeightLog(weightLog);
    setFormMode('edit');
  };

  const handleDeleteWeightLog = (id: string) => {
    if (confirm('Are you sure you want to delete this weight log? This action cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCancelForm = () => {
    setFormMode(null);
    setSelectedWeightLog(null);
  };

  const customers = customersData?.customers || [];
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const getMutationErrorMessage = () => {
    if (addMutation.error instanceof Error) return addMutation.error.message;
    if (updateMutation.error instanceof Error) return updateMutation.error.message;
    if (deleteMutation.error instanceof Error) return deleteMutation.error.message;
    return 'Something went wrong. Please try again.';
  };

  return (
    <div>
      <PageHeader
        title="Weight Tracking"
        description="Monitor customer weight progress and body composition over time."
      />

      {(addMutation.error || updateMutation.error || deleteMutation.error) && (
        <QueryErrorAlert message={getMutationErrorMessage()} />
      )}

      {customersError && (
        <QueryErrorAlert
          message="Failed to load customers. Please try again."
          onRetry={() => void refetchCustomers()}
        />
      )}

      {isLoadingCustomers && !customersError ? (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="mt-4 text-slate-500">Loading customers...</p>
        </div>
      ) : (
        <div className="mb-6">
          <CustomerCombobox
            label="Select Customer"
            customers={customers}
            value={selectedCustomerId}
            onChange={setSelectedCustomerId}
            placeholder="Search customer..."
          />
        </div>
      )}

      {selectedCustomerId && selectedCustomer && (
        <>
          {/* Customer Info & Stats */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{selectedCustomer.name}</h2>
                <p className="text-sm text-slate-500">
                  Goal: {selectedCustomer.goal?.replace('_', ' ') || 'Not set'} • 
                  Target: {selectedCustomer.target_weight ? `${selectedCustomer.target_weight} kg` : 'Not set'}
                </p>
              </div>
              <Button onClick={() => setFormMode('add')}>
                <Plus className="h-4 w-4" />
                Add Weight Log
              </Button>
            </div>
            
            <WeightStatsCard
              customerId={selectedCustomerId}
              dateOfBirth={selectedCustomer.date_of_birth}
            />
          </div>

          {/* Weight Log Form */}
          {formMode && (
            <div className="mb-6">
              <WeightLogForm
                mode={formMode}
                weightLog={selectedWeightLog || undefined}
                onSubmit={formMode === 'add' ? handleAddWeightLog : handleUpdateWeightLog}
                onCancel={handleCancelForm}
                isLoading={addMutation.isPending || updateMutation.isPending}
                customers={customers}
              />
            </div>
          )}

          {weightLogsError && (
            <QueryErrorAlert
              message="Failed to load weight logs. Please try again."
              onRetry={() => void refetchWeightLogs()}
            />
          )}

          {/* Weight Log Table */}
          {isLoadingLogs && !weightLogsError ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
              <p className="mt-4 text-slate-500">Loading weight logs...</p>
            </div>
          ) : !weightLogsError ? (
            <WeightLogTable
              weightLogs={weightLogs || []}
              onEdit={handleEditWeightLog}
              onDelete={handleDeleteWeightLog}
              isDeleting={deleteMutation.isPending}
            />
          ) : null}
        </>
      )}

      {!selectedCustomerId && !isLoadingCustomers && !customersError && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Scale className="mx-auto h-12 w-12 text-slate-400" />
          <p className="mt-4 text-slate-500">Select a customer to start tracking their weight progress.</p>
        </div>
      )}
    </div>
  );
}