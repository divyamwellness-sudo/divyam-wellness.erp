import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { deleteStockLocation } from '@/features/inventory/services/inventory.service';

type DeleteLocationModalProps = {
  locationId: string;
  locationName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export function DeleteLocationModal({
  locationId,
  locationName,
  isOpen,
  onClose,
  onSuccess,
}: DeleteLocationModalProps) {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => deleteStockLocation(locationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete location.');
    },
  });

  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      return;
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !mutation.isPending) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, mutation.isPending, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => {
        if (!mutation.isPending) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-location-title"
        className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 id="delete-location-title" className="text-lg font-semibold text-slate-900">
            Delete Location
          </h3>
          <button
            type="button"
            onClick={() => !mutation.isPending && onClose()}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-slate-600">
            Delete location &apos;{locationName}&apos;? This action cannot be undone.
          </p>

          {errorMessage && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            isLoading={mutation.isPending}
            onClick={() => {
              setErrorMessage(null);
              mutation.mutate();
            }}
          >
            Delete Location
          </Button>
        </div>
      </div>
    </div>
  );
}
