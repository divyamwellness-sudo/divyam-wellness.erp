import type { InventoryMovementType } from '@/features/inventory/types';

const OUTBOUND_MOVEMENT_TYPES: InventoryMovementType[] = [
  'TRANSFER_OUT',
  'INVOICE_SALE',
  'STOCK_IN_REVERSAL',
];

export function getSignedLedgerQuantity(
  movementType: InventoryMovementType,
  quantity: number,
): number {
  return OUTBOUND_MOVEMENT_TYPES.includes(movementType) ? -quantity : quantity;
}

export function formatSignedLedgerQuantity(
  movementType: InventoryMovementType,
  quantity: number,
): string {
  const signed = getSignedLedgerQuantity(movementType, quantity);
  return signed > 0 ? `+${signed}` : `${signed}`;
}
