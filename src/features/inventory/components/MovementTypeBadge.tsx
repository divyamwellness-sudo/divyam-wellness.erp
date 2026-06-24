import type { InventoryMovementType } from '@/features/inventory/types';

const movementStyles: Record<InventoryMovementType, string> = {
  STOCK_IN: 'bg-green-100 text-green-700',
  STOCK_IN_REVERSAL: 'bg-orange-100 text-orange-700',
  TRANSFER_IN: 'bg-blue-100 text-blue-700',
  TRANSFER_OUT: 'bg-amber-100 text-amber-700',
  INVOICE_SALE: 'bg-red-100 text-red-700',
  INVOICE_CANCEL: 'bg-purple-100 text-purple-700',
};

const movementLabels: Record<InventoryMovementType, string> = {
  STOCK_IN: 'Stock In',
  STOCK_IN_REVERSAL: 'Stock In Reversal',
  TRANSFER_IN: 'Transfer In',
  TRANSFER_OUT: 'Transfer Out',
  INVOICE_SALE: 'Invoice Sale',
  INVOICE_CANCEL: 'Invoice Cancel',
};

export function MovementTypeBadge({ type }: { type: InventoryMovementType }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${movementStyles[type]}`}
    >
      {movementLabels[type]}
    </span>
  );
}

export function formatMovementType(type: InventoryMovementType): string {
  return movementLabels[type];
}
