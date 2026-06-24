import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ProductSearchCombobox } from '@/features/billing/components/ProductSearchCombobox';
import { LocationSelect } from '@/features/inventory/components/LocationSelect';
import { transferStock } from '@/features/inventory/services/inventory.service';
import type { StockLocation, TransferStockLine } from '@/features/inventory/types';
import type { Product } from '@/types/database.types';

type TransferLineDraft = TransferStockLine & { key: string };

type StockTransferFormProps = {
  locations: StockLocation[];
  products: Product[];
};

function createLine(): TransferLineDraft {
  return {
    key: crypto.randomUUID(),
    product_id: '',
    quantity: 1,
  };
}

export function StockTransferForm({ locations, products }: StockTransferFormProps) {
  const queryClient = useQueryClient();
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [lines, setLines] = useState<TransferLineDraft[]>([createLine()]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: transferStock,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      setLines([createLine()]);
      setRemarks('');
      setErrorMessage(null);
      setSuccessMessage('Stock transferred successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to transfer stock.');
    },
  });

  const selectedProductIds = lines.map((line) => line.product_id).filter(Boolean);

  const updateLine = (key: string, patch: Partial<TransferLineDraft>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!fromLocationId || !toLocationId) {
      setErrorMessage('Select both from and to locations.');
      return;
    }

    if (fromLocationId === toLocationId) {
      setErrorMessage('From and to locations must be different.');
      return;
    }

    const validLines = lines.filter((line) => line.product_id && line.quantity > 0);

    if (validLines.length === 0) {
      setErrorMessage('Add at least one product with quantity.');
      return;
    }

    const seen = new Set<string>();
    for (const line of validLines) {
      if (seen.has(line.product_id)) {
        setErrorMessage('Each product can only appear once per transfer.');
        return;
      }
      seen.add(line.product_id);
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        setErrorMessage('Each quantity must be a whole number greater than zero.');
        return;
      }
    }

    mutation.mutate({
      from_location_id: fromLocationId,
      to_location_id: toLocationId,
      lines: validLines.map(({ product_id, quantity }) => ({ product_id, quantity })),
      remarks: remarks.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Stock Transfer</h3>

      <div className="grid gap-4 md:grid-cols-2">
        <LocationSelect
          label="From Location *"
          locations={locations}
          value={fromLocationId}
          onChange={setFromLocationId}
        />
        <LocationSelect
          label="To Location *"
          locations={locations}
          value={toLocationId}
          onChange={setToLocationId}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700">Products</h4>
          <Button type="button" variant="secondary" size="sm" onClick={() => setLines((current) => [...current, createLine()])}>
            <Plus className="h-4 w-4" />
            Add Line
          </Button>
        </div>

        {lines.map((line) => (
          <div
            key={line.key}
            className="grid items-start gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-12"
          >
            <div className="md:col-span-7">
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Product *</label>
              <ProductSearchCombobox
                products={products}
                value={line.product_id}
                onChange={(productId) => updateLine(line.key, { product_id: productId })}
                disabledProductIds={selectedProductIds.filter((id) => id !== line.product_id)}
                placeholder="Search product by name or SKU..."
              />
            </div>
            <div className="md:col-span-3">
              <Input
                label="Qty *"
                type="number"
                min={1}
                step={1}
                value={line.quantity}
                onChange={(event) => updateLine(line.key, { quantity: Number(event.target.value) })}
              />
            </div>
            <div className="flex items-end justify-end md:col-span-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))}
                disabled={lines.length <= 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Input
        label="Remarks"
        value={remarks}
        onChange={(event) => setRemarks(event.target.value)}
        placeholder="Optional transfer notes"
      />

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {successMessage}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" isLoading={mutation.isPending}>
          Transfer Stock
        </Button>
      </div>
    </form>
  );
}
