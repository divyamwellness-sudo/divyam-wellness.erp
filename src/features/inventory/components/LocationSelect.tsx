import type { StockLocation } from '@/features/inventory/types';
import { DefaultLocationBadge } from '@/features/inventory/components/DefaultLocationBadge';

type LocationSelectProps = {
  locations: StockLocation[];
  value: string;
  onChange: (locationId: string) => void;
  label?: string;
  error?: string;
  id?: string;
  placeholder?: string;
  includeAllOption?: boolean;
  allOptionLabel?: string;
};

export function LocationSelect({
  locations,
  value,
  onChange,
  label,
  error,
  id,
  placeholder = 'Select location',
  includeAllOption = false,
  allOptionLabel = 'All locations',
}: LocationSelectProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
          error ? 'border-red-500' : 'border-slate-200'
        }`}
      >
        {includeAllOption ? (
          <option value="">{allOptionLabel}</option>
        ) : (
          <option value="">{placeholder}</option>
        )}
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
            {location.is_default ? ' ★ Default' : ''}
          </option>
        ))}
      </select>
      {value && locations.find((location) => location.id === value)?.is_default ? (
        <div className="pt-1">
          <DefaultLocationBadge />
        </div>
      ) : null}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
