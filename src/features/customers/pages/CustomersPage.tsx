import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit, UserX, Filter, Eye } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/layout/PageHeader';
import { QueryErrorAlert } from '@/components/shared/QueryErrorAlert';
import { ExportDropdown } from '@/components/shared/ExportDropdown';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { exportToExcel, exportToPdfReport } from '@/lib/export';
import type { ExportColumn, ExportRow } from '@/lib/export';
import { calculateAge, formatDate } from '@/lib/utils/format';
import { CustomerForm } from '@/features/customers/components/CustomerForm';
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deactivateCustomer,
  searchCustomers,
  type CustomerFilters,
} from '@/features/customers/services/customer.service';
import type { Customer, CustomerInsert, CustomerUpdate, CustomerType, PricingTier, CustomerStatus } from '@/types';

type CustomerFormMode = 'create' | 'edit' | null;

const statusOptions = [
  { value: 'all', label: 'All Customers' },
  { value: 'active', label: 'Active Only' },
  { value: 'inactive', label: 'Inactive Only' },
];

const customerTypeOptions = [
  { value: '', label: 'All Types' },
  { value: 'pc', label: 'PC' },
  { value: 'coach', label: 'Coach' },
];

const pricingTierOptions = [
  { value: '', label: 'All Tiers' },
  { value: 'MRP', label: 'MRP' },
  { value: '15', label: '15%' },
  { value: '25', label: '25%' },
  { value: '35', label: '35%' },
  { value: '42', label: '42%' },
  { value: '50', label: '50%' },
];

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
  const colorMap: Record<PricingTier, string> = {
    MRP: 'bg-purple-100 text-purple-700',
    '15': 'bg-sky-100 text-sky-700',
    '25': 'bg-blue-100 text-blue-700',
    '35': 'bg-green-100 text-green-700',
    '42': 'bg-orange-100 text-orange-700',
    '50': 'bg-red-100 text-red-700',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${colorMap[tier]}`}>
      {tier === 'MRP' ? 'MRP' : `${tier}%`}
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
  onView,
  onEdit,
  onDeactivate,
  isDeactivating,
}: {
  customers: Customer[];
  onView: (customer: Customer) => void;
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
                Type
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
                  <CustomerTypeBadge type={customer.customer_type} />
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
                      onClick={() => onView(customer)}
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
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
  const navigate = useNavigate();
  const { businessSettings, profile } = useAuth();
  const [formMode, setFormMode] = useState<CustomerFormMode>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<CustomerFilters>({
    status: 'active',
  });

  const queryClient = useQueryClient();

  // Queries
  const {
    data: customersData,
    isLoading: isLoadingCustomers,
    error: customersError,
    refetch: refetchCustomers,
  } = useQuery({
    queryKey: ['customers', filters],
    queryFn: () => getCustomers(filters),
  });

  const {
    data: searchResults,
    isLoading: isSearching,
    error: searchError,
    refetch: refetchSearch,
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
  const handleCreateCustomer = async (data: CustomerInsert | CustomerUpdate) => {
    await createMutation.mutateAsync(data as CustomerInsert);
  };

  const handleUpdateCustomer = async (data: CustomerInsert | CustomerUpdate) => {
    if (!selectedCustomer) return;
    await updateMutation.mutateAsync({ id: selectedCustomer.id, data: data as CustomerUpdate });
  };

  const handleViewCustomer = (customer: Customer) => {
    navigate(`/customers/${customer.id}`);
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
  const isSearchActive = searchTerm.length >= 2;
  const listError = isSearchActive ? searchError : customersError;
  const refetchList = isSearchActive ? refetchSearch : refetchCustomers;

  // --- Export wiring (respects current search + filters) ---
  const customerExportColumns: ExportColumn[] = [
    { key: 'name', header: 'Name', type: 'text' },
    { key: 'phone', header: 'Phone', type: 'text' },
    { key: 'customerType', header: 'Customer Type', type: 'text' },
    { key: 'pricingTier', header: 'Pricing Tier', type: 'text' },
    { key: 'joinDate', header: 'Join Date', type: 'date' },
    { key: 'currentWeight', header: 'Current Weight (kg)', type: 'number' },
  ];

  const buildCustomerExportRows = (): ExportRow[] =>
    displayedCustomers.map((c) => ({
      name: c.name,
      phone: c.phone,
      customerType: c.customer_type === 'coach' ? 'Coach' : 'PC',
      pricingTier: c.pricing_tier === 'MRP' ? 'MRP' : `${c.pricing_tier}%`,
      joinDate: formatDate(c.joining_date),
      currentWeight: c.current_weight ?? '',
    }));

  const customerExportBase = {
    title: 'Customers Report',
    worksheetName: 'Customers',
    filename: `customers-${new Date().toISOString().slice(0, 10)}`,
    columns: customerExportColumns,
    businessSettings,
    generatedBy: profile?.full_name,
  };

  const handleExportCustomersExcel = () =>
    exportToExcel({
      ...customerExportBase,
      rows: buildCustomerExportRows(),
    });

  const handleExportCustomersPdf = () =>
    exportToPdfReport({
      ...customerExportBase,
      rows: buildCustomerExportRows(),
    });

  const getMutationErrorMessage = () => {
    if (createMutation.error instanceof Error) return createMutation.error.message;
    if (updateMutation.error instanceof Error) return updateMutation.error.message;
    if (deactivateMutation.error instanceof Error) return deactivateMutation.error.message;
    return 'Something went wrong. Please try again.';
  };

  if (formMode) {
    return (
      <div>
        <PageHeader
          title={formMode === 'create' ? 'Add Customer' : 'Edit Customer'}
          description={formMode === 'create' ? 'Add a new customer to your wellness program.' : 'Update customer information.'}
        />
        {(createMutation.error || updateMutation.error) && (
          <QueryErrorAlert message={getMutationErrorMessage()} />
        )}
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
          <div className="flex flex-wrap gap-2">
            <ExportDropdown
              onExportExcel={handleExportCustomersExcel}
              onExportPdf={handleExportCustomersPdf}
              disabled={displayedCustomers.length === 0}
            />
            <Button onClick={() => setFormMode('create')}>
              <Plus className="h-4 w-4" />
              Add Customer
            </Button>
          </div>
        }
      />

      {deactivateMutation.error && (
        <QueryErrorAlert message={getMutationErrorMessage()} />
      )}

      {/* Filters and Search */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-5">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Select
            label="Status"
            value={filters.status || 'all'}
            onChange={(value) => handleFilterChange('status', value === 'all' ? '' : value)}
            options={statusOptions}
          />

          <Select
            label="Customer Type"
            value={filters.customerType || ''}
            onChange={(value) => handleFilterChange('customerType', value)}
            options={customerTypeOptions}
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
                setFilters({ status: 'active' });
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
      {listError && (
        <QueryErrorAlert
          message={
            isSearchActive
              ? 'Error searching customers. Please try again.'
              : 'Error loading customers. Please try again.'
          }
          onRetry={() => void refetchList()}
        />
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
          onView={handleViewCustomer}
          onEdit={handleEditCustomer}
          onDeactivate={handleDeactivateCustomer}
          isDeactivating={deactivateMutation.isPending}
        />
      )}
    </div>
  );
}