import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit, Power, Filter } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProductForm, productCategoryOptions } from '@/features/products/components/ProductForm';
import {
  getProducts,
  createProduct,
  updateProduct,
  toggleProductActive,
  searchProducts,
  type ProductFilters,
} from '@/features/products/services/product.service';
import type { Product, ProductInsert, ProductUpdate, ProductCategory } from '@/types';

type ProductFormMode = 'create' | 'edit' | null;

const statusOptions = [
  { value: 'all', label: 'All Products' },
  { value: 'active', label: 'Active Only' },
  { value: 'inactive', label: 'Inactive Only' },
];

const categoryFilterOptions = [
  { value: '', label: 'All Categories' },
  ...productCategoryOptions,
];

const categoryLabels = Object.fromEntries(
  productCategoryOptions.map((option) => [option.value, option.label]),
) as Record<ProductCategory, string>;

function formatPrice(value: number): string {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
        isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
      }`}
    >
      {isActive ? 'Active' : 'Inactive'}
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

function ProductTable({
  products,
  onEdit,
  onToggleActive,
  isToggling,
}: {
  products: Product[];
  onEdit: (product: Product) => void;
  onToggleActive: (product: Product) => void;
  isToggling: boolean;
}) {
  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-slate-500">No products found matching your filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Product</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Category</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">MRP</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">15%</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">25%</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">35%</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">42%</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">50%</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">VP</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <p className="font-medium text-slate-900">{product.name}</p>
                  <p className="text-sm text-slate-500">{product.sku}</p>
                </td>
                <td className="px-6 py-4 text-sm text-slate-700">
                  {categoryLabels[product.category] ?? product.category}
                </td>
                <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">{formatPrice(product.mrp_price)}</td>
                <td className="px-6 py-4 text-right text-sm text-slate-700">{formatPrice(product.price_15)}</td>
                <td className="px-6 py-4 text-right text-sm text-slate-700">{formatPrice(product.price_25)}</td>
                <td className="px-6 py-4 text-right text-sm text-slate-700">{formatPrice(product.price_35)}</td>
                <td className="px-6 py-4 text-right text-sm text-slate-700">{formatPrice(product.price_42)}</td>
                <td className="px-6 py-4 text-right text-sm text-slate-700">{formatPrice(product.price_50)}</td>
                <td className="px-6 py-4 text-right text-sm font-medium text-orange-600">{product.volume_points} VP</td>
                <td className="px-6 py-4">
                  <StatusBadge isActive={product.is_active} />
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(product)}>
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleActive(product)}
                      disabled={isToggling}
                    >
                      <Power className="h-4 w-4" />
                      {product.is_active ? 'Deactivate' : 'Activate'}
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

export function ProductsPage() {
  const [formMode, setFormMode] = useState<ProductFormMode>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<ProductFilters>({
    status: 'active',
    category: '',
  });

  const queryClient = useQueryClient();

  const {
    data: productsData,
    isLoading: isLoadingProducts,
    error: productsError,
  } = useQuery({
    queryKey: ['products', filters],
    queryFn: () => getProducts(filters),
  });

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['products', 'search', searchTerm],
    queryFn: () => searchProducts(searchTerm),
    enabled: searchTerm.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setFormMode(null);
      setSelectedProduct(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProductUpdate }) => updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setFormMode(null);
      setSelectedProduct(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => toggleProductActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const handleCreateProduct = async (data: ProductInsert) => {
    await createMutation.mutateAsync(data);
  };

  const handleUpdateProduct = async (data: ProductUpdate) => {
    if (!selectedProduct) return;
    await updateMutation.mutateAsync({ id: selectedProduct.id, data });
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setFormMode('edit');
  };

  const handleToggleActive = (product: Product) => {
    toggleMutation.mutate({ id: product.id, isActive: !product.is_active });
  };

  const handleCancelForm = () => {
    setFormMode(null);
    setSelectedProduct(null);
  };

  const handleFilterChange = (key: keyof ProductFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const displayedProducts = searchTerm.length >= 2 ? searchResults || [] : productsData?.products || [];
  const isLoading = isLoadingProducts || isSearching;

  if (formMode) {
    return (
      <div>
        <PageHeader
          title={formMode === 'create' ? 'Add Product' : 'Edit Product'}
          description={
            formMode === 'create'
              ? 'Add a new product to your catalog.'
              : 'Update product information and pricing.'
          }
        />
        <ProductForm
          mode={formMode}
          product={selectedProduct || undefined}
          onSubmit={formMode === 'create' ? handleCreateProduct : handleUpdateProduct}
          isLoading={createMutation.isPending || updateMutation.isPending}
          onCancel={handleCancelForm}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage your product catalog and tier-based pricing."
        action={
          <Button onClick={() => setFormMode('create')}>
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        }
      />

      {/* Filters and Search */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by name or SKU..."
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
            label="Category"
            value={filters.category || ''}
            onChange={(value) => handleFilterChange('category', value)}
            options={categoryFilterOptions}
          />

          <div className="flex items-end">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setSearchTerm('');
                setFilters({ status: 'active', category: '' });
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
          {searchTerm.length >= 2
            ? `Found ${displayedProducts.length} products matching "${searchTerm}"`
            : `Showing ${displayedProducts.length} products`}
        </p>
      </div>

      {/* Error State */}
      {productsError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <p>Error loading products. Please try again.</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="mt-4 text-slate-500">Loading products...</p>
        </div>
      )}

      {/* Product Table */}
      {!isLoading && (
        <ProductTable
          products={displayedProducts}
          onEdit={handleEditProduct}
          onToggleActive={handleToggleActive}
          isToggling={toggleMutation.isPending}
        />
      )}
    </div>
  );
}
