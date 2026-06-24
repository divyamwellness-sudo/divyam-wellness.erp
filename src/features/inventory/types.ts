export type InventoryMovementType =
  | 'STOCK_IN'
  | 'STOCK_IN_REVERSAL'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'INVOICE_SALE'
  | 'INVOICE_CANCEL';

export type StockInStatus = 'POSTED' | 'REVERSED';

export type StockLocation = {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type StockBalanceRow = {
  id: string;
  location_id: string;
  product_id: string;
  quantity_on_hand: number;
  updated_at: string;
  product: {
    id: string;
    name: string;
    sku: string;
    price_50: number;
    is_active: boolean;
  } | null;
  location: {
    id: string;
    name: string;
  } | null;
};

export type InventoryLedgerRow = {
  id: string;
  movement_type: InventoryMovementType;
  location_id: string;
  product_id: string;
  quantity: number;
  transfer_id: string | null;
  stock_in_id: string | null;
  invoice_id: string | null;
  invoice_item_id: string | null;
  remarks: string | null;
  created_at: string;
  product: {
    id: string;
    name: string;
    sku: string;
  } | null;
  location: {
    id: string;
    name: string;
  } | null;
};

export type TransferStockLine = {
  product_id: string;
  quantity: number;
};

export type StockInLine = {
  product_id: string;
  quantity: number;
};

export type StockInRequest = {
  location_id: string;
  lines: StockInLine[];
  remarks?: string | null;
};

export type CreateStockLocationRequest = {
  name: string;
};

export type UpdateStockLocationRequest = {
  id: string;
  name: string;
};

export type LocationStockSummary = {
  location_id: string;
  location_name: string;
  total_quantity: number;
  total_value: number;
};

export type TransferStockRequest = {
  from_location_id: string;
  to_location_id: string;
  lines: TransferStockLine[];
  remarks?: string | null;
};

export type StockLocationDeletionStatus = {
  canDelete: boolean;
  reason?: string;
};

export type InventoryLedgerFilters = {
  locationId?: string;
  movementType?: InventoryMovementType | 'all';
  limit?: number;
};

export type StockInLineRow = {
  id: string;
  product_id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    sku: string;
  } | null;
};

export type StockInHistoryRow = {
  id: string;
  reference_number: string;
  location_id: string;
  status: StockInStatus;
  remarks: string | null;
  created_at: string;
  reversed_at: string | null;
  created_by: string | null;
  location: {
    id: string;
    name: string;
  } | null;
  products_count: number;
  total_quantity: number;
};

export type StockInDetail = StockInHistoryRow & {
  lines: StockInLineRow[];
};
