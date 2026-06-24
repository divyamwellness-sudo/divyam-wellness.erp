import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit, Plus, Power, Star, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DefaultLocationBadge } from '@/features/inventory/components/DefaultLocationBadge';
import { DeleteLocationModal } from '@/features/inventory/components/DeleteLocationModal';
import {
  createStockLocation,
  deactivateStockLocation,
  getStockLocationDeletionStatus,
  setDefaultStockLocation,
  updateStockLocation,
} from '@/features/inventory/services/inventory.service';
import type { StockLocation } from '@/features/inventory/types';

type LocationManagementProps = {
  locations: StockLocation[];
};

type LocationFormMode = 'create' | 'edit' | null;

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
        isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

export function LocationManagement({ locations }: LocationManagementProps) {
  const queryClient = useQueryClient();
  const [formMode, setFormMode] = useState<LocationFormMode>(null);
  const [editingLocation, setEditingLocation] = useState<StockLocation | null>(null);
  const [locationToDelete, setLocationToDelete] = useState<StockLocation | null>(null);
  const [name, setName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [checkingDeleteId, setCheckingDeleteId] = useState<string | null>(null);

  const invalidateLocations = async () => {
    await queryClient.invalidateQueries({ queryKey: ['inventory'] });
  };

  const createMutation = useMutation({
    mutationFn: createStockLocation,
    onSuccess: async () => {
      await invalidateLocations();
      setFormMode(null);
      setName('');
      setErrorMessage(null);
      setSuccessMessage('Location created successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create location.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateStockLocation,
    onSuccess: async () => {
      await invalidateLocations();
      setFormMode(null);
      setEditingLocation(null);
      setName('');
      setErrorMessage(null);
      setSuccessMessage('Location updated successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update location.');
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: setDefaultStockLocation,
    onSuccess: async () => {
      await invalidateLocations();
      setSettingDefaultId(null);
      setErrorMessage(null);
      setSuccessMessage('Default location updated.');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (error) => {
      setSettingDefaultId(null);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to set default location.');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateStockLocation,
    onSuccess: async () => {
      await invalidateLocations();
      setDeactivatingId(null);
      setErrorMessage(null);
      setSuccessMessage('Location deactivated successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (error) => {
      setDeactivatingId(null);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to deactivate location.');
    },
  });

  useEffect(() => {
    if (formMode === 'edit' && editingLocation) {
      setName(editingLocation.name);
    }
    if (formMode === 'create') {
      setName('');
    }
  }, [formMode, editingLocation]);

  const openCreate = () => {
    setErrorMessage(null);
    setEditingLocation(null);
    setName('');
    setFormMode('create');
  };

  const openEdit = (location: StockLocation) => {
    setErrorMessage(null);
    setEditingLocation(location);
    setFormMode('edit');
  };

  const closeForm = () => {
    if (createMutation.isPending || updateMutation.isPending) {
      return;
    }
    setFormMode(null);
    setEditingLocation(null);
    setName('');
    setErrorMessage(null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Location name is required.');
      return;
    }

    if (formMode === 'create') {
      createMutation.mutate({ name: trimmedName });
      return;
    }

    if (formMode === 'edit' && editingLocation) {
      updateMutation.mutate({ id: editingLocation.id, name: trimmedName });
    }
  };

  const handleSetDefault = (location: StockLocation) => {
    setErrorMessage(null);
    setSettingDefaultId(location.id);
    setDefaultMutation.mutate(location.id);
  };

  const handleDeactivate = (location: StockLocation) => {
    setErrorMessage(null);
    setDeactivatingId(location.id);
    deactivateMutation.mutate(location.id);
  };

  const handleDeleteClick = async (location: StockLocation) => {
    setErrorMessage(null);
    setCheckingDeleteId(location.id);

    try {
      const status = await getStockLocationDeletionStatus(location.id);
      if (!status.canDelete) {
        setErrorMessage(status.reason ?? 'This location cannot be deleted.');
        return;
      }
      setLocationToDelete(location);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to verify delete eligibility.');
    } finally {
      setCheckingDeleteId(null);
    }
  };

  const sortedLocations = [...locations].sort((a, b) => {
    if (a.is_default !== b.is_default) {
      return a.is_default ? -1 : 1;
    }
    if (a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Locations</h3>
          <p className="mt-1 text-sm text-slate-500">
            Create and manage stock locations. One active location is the default for new invoices.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Location
        </Button>
      </div>

      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {successMessage}
        </div>
      )}

      {errorMessage && !formMode && !locationToDelete && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {sortedLocations.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          No locations yet. Add your first location, then set it as default.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Name
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
                {sortedLocations.map((location) => (
                  <tr
                    key={location.id}
                    className={
                      location.is_default && location.is_active
                        ? 'bg-amber-50/40 hover:bg-amber-50/60'
                        : 'hover:bg-slate-50'
                    }
                  >
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      <span className="inline-flex flex-wrap items-center gap-1">
                        {location.name}
                        {location.is_default && location.is_active ? <DefaultLocationBadge /> : null}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge isActive={location.is_active} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        {location.is_active && !location.is_default ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefault(location)}
                            isLoading={settingDefaultId === location.id && setDefaultMutation.isPending}
                          >
                            <Star className="h-4 w-4" />
                            Set as Default
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(location)}
                          disabled={!location.is_active}
                        >
                          <Edit className="h-4 w-4" />
                          Edit
                        </Button>
                        {location.is_active ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeactivate(location)}
                            disabled={location.is_default}
                            title={
                              location.is_default
                                ? 'Set another location as default before deactivating this one.'
                                : undefined
                            }
                            isLoading={deactivatingId === location.id && deactivateMutation.isPending}
                          >
                            <Power className="h-4 w-4" />
                            Deactivate
                          </Button>
                        ) : null}
                        {!location.is_default ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDeleteClick(location)}
                            isLoading={checkingDeleteId === location.id}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {formMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeForm}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {formMode === 'create' ? 'Add Location' : 'Edit Location'}
              </h3>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5">
              <Input
                label="Location Name *"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Rajkot Center"
                autoFocus
              />

              {errorMessage && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={closeForm}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={createMutation.isPending || updateMutation.isPending}
                >
                  {formMode === 'create' ? 'Create Location' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {locationToDelete && (
        <DeleteLocationModal
          locationId={locationToDelete.id}
          locationName={locationToDelete.name}
          isOpen={Boolean(locationToDelete)}
          onClose={() => setLocationToDelete(null)}
          onSuccess={() => {
            setLocationToDelete(null);
            setErrorMessage(null);
            setSuccessMessage('Location deleted successfully.');
            setTimeout(() => setSuccessMessage(null), 3000);
          }}
        />
      )}
    </div>
  );
}
