import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit, UserX, Filter } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/layout/PageHeader';
import { calculateAge } from '@/lib/utils/format';
import { CustomerForm } from '@/features/customers/components/CustomerForm';
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deactivateCustomer,
  searchCustomers,
  type CustomerFilters,
} from '@/features/customers/services/customer.service';
import type { Customer, CustomerInsert, CustomerUpdate, PricingTier, CustomerStatus } from '@/types';

type CustomerFormMode = 'create' | 'edit' | null;

const statusOptions = [
  { value: 'all', label: 'All Customers' },
  { value: 'active', label: 'Active Only' },
  { value: 'inactive', label: 'Inactive Only' },
];

const pricingTierOptions = [
  { value: '', label: 'All Tiers' },
  { value: 'MRP', label: 'MRP' },
  { value: '25', label: 'Tier 25' },
  { value: '35', label: 'Tier 35' },
  { value: '42', label: 'Tier 42' },
  { value: '50', label: 'Tier 50' },
];

function PricingTierBadge({ tier }: { tier: PricingTier }) {
  const colorMap = {
    MRP: 'bg-purple-100 text-purple-700',
    '25': 'bg-blue-100 text-blue-700',
    '35': 'bg-green-100 text-green-700',
    '42': 'bg-orange-100 text-orange-700',
    '50': 'bg-red-100 text-red-700',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${colorMap[tier]}`}>
      {tier === 'MRP' ? 'MRP' : `Tier ${tier}`}
    </span>
  );
}

function StatusBadge({ status }: { status: CustomerStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
        status === 'active'
          ? 'bg-green-100 text-green-700'
          : 'bg-gray-100 text-gray-700'
      }`}
    >
      {status === 'active' ? 'Active' : 'Inactive'}
    </span>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function CustomerTable({
  customers,
  onEdit,
  onDeactivate,
  isDeactivating,
}: {
  customers: Customer[];
  onEdit: (customer: Customer) => void;
  onDeactivate: (id: string) => void;
  isDeactivating: boolean;
}) {
  if (customers.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-slate-500">No customers found matching your filters.</p>
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
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Age
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Tier
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Weight
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {customers.map((customer) => (
              <tr key={customer.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-slate-900">{customer.name}</p>
                    {customer.city && (
                      <p className="text-sm text-slate-500">{customer.city}</p>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm">
                    <p className="text-slate-900">{customer.phone}</p>
                    {customer.email && (
                      <p className="text-slate-500">{customer.email}</p>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm">
                    {calculateAge(customer.date_of_birth) != null ? (
                      <p className="text-slate-900">{calculateAge(customer.date_of_birth)} yrs</p>
                    ) : (
                      <p className="text-slate-400">—</p>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <PricingTierBadge tier={customer.pricing_tier} />
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm">
                    {customer.current_weight ? (
                      <>
                        <p className="text-slate-900">{customer.current_weight} kg</p>
                        {customer.target_weight && (
                          <p className="text-slate-500">Target: {customer.target_weight} kg</p>
                        )}
                      </>
                    ) : (
                      <p className="text-slate-400">No weight logged</p>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={customer.status} />
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(customer)}
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                    {customer.status === 'active' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeactivate(customer.id)}
                        disabled={isDeactivating}
                      >
                        <UserX className="h-4 w-4" />
                        Deactivate
                      </Button>
                    )}
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

export function CustomersPage() {
  const [formMode, setFormMode] = useState<CustomerFormMode>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<CustomerFilters>({
    status: 'active',
    pricingTier: '',
  });

  const queryClient = useQueryClient();

  // Queries
  const {
    data: customersData,
    isLoading: isLoadingCustomers,
    error: customersError,
  } = useQuery({
    queryKey: ['customers', filters],
    queryFn: () => getCustomers(filters),
  });

  const {
    data: searchResults,
    isLoading: isSearching,
  } = useQuery({
    queryKey: ['customers', 'search', searchTerm],
    queryFn: () => searchCustomers(searchTerm),
    enabled: searchTerm.length >= 2,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setFormMode(null);
      setSelectedCustomer(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CustomerUpdate }) =>
      updateCustomer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setFormMode(null);
      setSelectedCustomer(null);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  // Event handlers
  const handleCreateCustomer = async (data: CustomerInsert) => {
    await createMutation.mutateAsync(data);
  };

  const handleUpdateCustomer = async (data: CustomerUpdate) => {
    if (!selectedCustomer) return;
    await updateMutation.mutateAsync({ id: selectedCustomer.id, data });
  };

  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormMode('edit');
  };

  const handleDeactivateCustomer = (id: string) => {
    if (confirm('Are you sure you want to deactivate this customer?')) {
      deactivateMutation.mutate(id);
    }
  };

  const handleCancelForm = () => {
    setFormMode(null);
    setSelectedCustomer(null);
  };

  const handleFilterChange = (key: keyof CustomerFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const displayedCustomers = searchTerm.length >= 2 ? (searchResults || []) : (customersData?.customers || []);
  const isLoading = isLoadingCustomers || isSearching;

  if (formMode) {
    return (
      <div>
        <PageHeader
          title={formMode === 'create' ? 'Add Customer' : 'Edit Customer'}
          description={formMode === 'create' ? 'Add a new customer to your wellness program.' : 'Update customer information.'}
        />
        <CustomerForm
          mode={formMode}
          customer={selectedCustomer || undefined}
          onSubmit={formMode === 'create' ? handleCreateCustomer : handleUpdateCustomer}
          isLoading={createMutation.isPending || updateMutation.isPending}
          onCancel={handleCancelForm}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Manage your wellness program customers and their information."
        action={
          <Button onClick={() => setFormMode('create')}>
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        }
      />

      {/* Filters and Search */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select
            label="Status"
            value={filters.status || 'all'}
            onChange={(value) => handleFilterChange('status', value === 'all' ? '' : value)}
            options={statusOptions}
          />

          <Select
            label="Pricing Tier"
            value={filters.pricingTier || ''}
            onChange={(value) => handleFilterChange('pricingTier', value)}
            options={pricingTierOptions}
          />

          <div className="flex items-end">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setSearchTerm('');
                setFilters({ status: 'active', pricingTier: '' });
              }}
            >
              <Filter className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-600">
          {searchTerm.length >= 2 ? (
            `Found ${displayedCustomers.length} customers matching "${searchTerm}"`
          ) : (
            `Showing ${displayedCustomers.length} customers`
          )}
        </p>
      </div>

      {/* Error State */}
      {customersError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <p>Error loading customers. Please try again.</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="mt-4 text-slate-500">Loading customers...</p>
        </div>
      )}

      {/* Customer Table */}
      {!isLoading && (
        <CustomerTable
          customers={displayedCustomers}
          onEdit={handleEditCustomer}
          onDeactivate={handleDeactivateCustomer}
          isDeactivating={deactivateMutation.isPending}
        />
      )}
    </div>
  );
}