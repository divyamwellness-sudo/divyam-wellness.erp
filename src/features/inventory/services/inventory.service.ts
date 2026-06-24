import { supabase } from '@/lib/supabase/client';
import type {
  CreateStockLocationRequest,
  InventoryLedgerFilters,
  InventoryLedgerRow,
  LocationStockSummary,
  StockBalanceRow,
  StockInRequest,
  StockLocation,
  StockLocationDeletionStatus,
  StockInDetail,
  StockInHistoryRow,
  TransferStockRequest,
  UpdateStockLocationRequest,
} from '@/features/inventory/types';

class InventoryServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: string | null,
    public hint?: string | null,
  ) {
    super(message);
    this.name = 'InventoryServiceError';
  }
}

function formatSupabaseError(error: { code?: string; message?: string; details?: string | null; hint?: string | null }) {
  return {
    code: error.code ?? null,
    message: error.message ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
  };
}

function mapStockLocationConflict(error: { code?: string; message?: string; details?: string | null; hint?: string | null }): InventoryServiceError {
  const formatted = formatSupabaseError(error);
  const detailText = `${formatted.details ?? ''} ${formatted.message ?? ''}`.toLowerCase();

  if (detailText.includes('is_default') || detailText.includes('one_default')) {
    return new InventoryServiceError(
      'Could not create location because a default location already exists. Please try again.',
      formatted.code ?? undefined,
      formatted.details,
      formatted.hint,
    );
  }

  return new InventoryServiceError(
    'A location with this name already exists.',
    formatted.code ?? undefined,
    formatted.details,
    formatted.hint,
  );
}

function mapInventoryError(error: unknown, context: string): never {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: string }).message);
    if (message.includes('INSUFFICIENT_STOCK')) {
      throw new InventoryServiceError(message.replace(/^INSUFFICIENT_STOCK:\s*/, ''), 'INSUFFICIENT_STOCK');
    }
    if (message.includes('LOCATION_HAS_HISTORY')) {
      throw new InventoryServiceError(
        message.replace(/^LOCATION_HAS_HISTORY:\s*/, ''),
        'LOCATION_HAS_HISTORY',
      );
    }
    if (message.includes('ALREADY_REVERSED')) {
      throw new InventoryServiceError(
        message.replace(/^ALREADY_REVERSED:\s*/, ''),
        'ALREADY_REVERSED',
      );
    }
    throw new InventoryServiceError(`Inventory error in ${context}: ${message}`);
  }

  throw new InventoryServiceError(`Unexpected error in ${context}: ${String(error)}`);
}

export const LOCATION_HAS_HISTORY_MESSAGE =
  'This location contains inventory history. Deactivate it instead.';

async function getStockLocationDeletionBlockReason(location: StockLocation): Promise<string | null> {
  if (location.is_default) {
    return 'Cannot delete the default location.';
  }

  const [balancesResult, ledgerResult, invoicesResult] = await Promise.all([
    supabase
      .from('stock_balances')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', location.id),
    supabase
      .from('inventory_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', location.id),
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('stock_location_id', location.id),
  ]);

  if (balancesResult.error) {
    mapInventoryError(balancesResult.error, 'getStockLocationDeletionBlockReason');
  }
  if (ledgerResult.error) {
    mapInventoryError(ledgerResult.error, 'getStockLocationDeletionBlockReason');
  }
  if (invoicesResult.error) {
    mapInventoryError(invoicesResult.error, 'getStockLocationDeletionBlockReason');
  }

  if (
    (balancesResult.count ?? 0) > 0 ||
    (ledgerResult.count ?? 0) > 0 ||
    (invoicesResult.count ?? 0) > 0
  ) {
    return LOCATION_HAS_HISTORY_MESSAGE;
  }

  return null;
}

export async function getStockLocations(activeOnly = true): Promise<StockLocation[]> {
  try {
    let query = supabase.from('stock_locations').select('*').order('sort_order').order('name');

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      mapInventoryError(error, 'getStockLocations');
    }

    return (data ?? []) as StockLocation[];
  } catch (error) {
    if (error instanceof InventoryServiceError) {
      throw error;
    }
    mapInventoryError(error, 'getStockLocations');
  }
}

export async function getDefaultStockLocation(): Promise<StockLocation | null> {
  const locations = await getStockLocations(true);
  return locations.find((location) => location.is_default) ?? locations[0] ?? null;
}

export async function createStockLocation(
  request: CreateStockLocationRequest,
): Promise<StockLocation> {
  try {
    const name = request.name.trim();
    if (!name) {
      throw new InventoryServiceError('Location name is required.');
    }

    const existing = await getStockLocations(false);
    const duplicate = existing.some((location) => location.name === name);
    if (duplicate) {
      throw new InventoryServiceError('A location with this name already exists.');
    }

    const maxSort = existing.reduce((max, location) => Math.max(max, location.sort_order), 0);
    const insertPayload = {
      name,
      is_active: true,
      is_default: false,
      sort_order: maxSort + 1,
    };

    console.debug('[createStockLocation] insert payload:', insertPayload);

    const { data, error } = await supabase
      .from('stock_locations')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      console.error('[createStockLocation] supabase error:', formatSupabaseError(error));
      if (error.code === '23505') {
        throw mapStockLocationConflict(error);
      }
      mapInventoryError(error, 'createStockLocation');
    }

    if (!data) {
      throw new InventoryServiceError('Failed to create location.', 'UNKNOWN');
    }

    return data as StockLocation;
  } catch (error) {
    if (error instanceof InventoryServiceError) {
      throw error;
    }
    mapInventoryError(error, 'createStockLocation');
  }
}

export async function updateStockLocation(
  request: UpdateStockLocationRequest,
): Promise<StockLocation> {
  try {
    const name = request.name.trim();
    if (!name) {
      throw new InventoryServiceError('Location name is required.');
    }

    const { data, error } = await supabase
      .from('stock_locations')
      .update({ name })
      .eq('id', request.id)
      .select('*')
      .single();

    if (error) {
      console.error('[updateStockLocation] supabase error:', formatSupabaseError(error));
      if (error.code === '23505') {
        throw mapStockLocationConflict(error);
      }
      mapInventoryError(error, 'updateStockLocation');
    }

    if (!data) {
      throw new InventoryServiceError('Location not found.', 'NOT_FOUND');
    }

    return data as StockLocation;
  } catch (error) {
    if (error instanceof InventoryServiceError) {
      throw error;
    }
    mapInventoryError(error, 'updateStockLocation');
  }
}

export async function setDefaultStockLocation(locationId: string): Promise<StockLocation> {
  try {
    const { data: rpcData, error: rpcError } = await (
      supabase.rpc as unknown as (
        fn: 'set_default_stock_location',
        args: { p_location_id: string },
      ) => Promise<{ data: string | null; error: { message: string; code?: string } | null }>
    )('set_default_stock_location', { p_location_id: locationId });

    if (rpcError) {
      mapInventoryError(rpcError, 'setDefaultStockLocation');
    }

    if (!rpcData) {
      throw new InventoryServiceError('Failed to set default location.', 'UNKNOWN');
    }

    const { data, error } = await supabase
      .from('stock_locations')
      .select('*')
      .eq('id', locationId)
      .single();

    if (error) {
      mapInventoryError(error, 'setDefaultStockLocation');
    }

    if (!data) {
      throw new InventoryServiceError('Location not found.', 'NOT_FOUND');
    }

    return data as StockLocation;
  } catch (error) {
    if (error instanceof InventoryServiceError) {
      throw error;
    }
    mapInventoryError(error, 'setDefaultStockLocation');
  }
}

export async function getStockLocationDeletionStatus(
  locationId: string,
): Promise<StockLocationDeletionStatus> {
  const existing = await getStockLocations(false);
  const location = existing.find((entry) => entry.id === locationId);

  if (!location) {
    return { canDelete: false, reason: 'Location not found.' };
  }

  const reason = await getStockLocationDeletionBlockReason(location);
  return reason ? { canDelete: false, reason } : { canDelete: true };
}

export async function deleteStockLocation(locationId: string): Promise<void> {
  try {
    const existing = await getStockLocations(false);
    const location = existing.find((entry) => entry.id === locationId);

    if (!location) {
      throw new InventoryServiceError('Location not found.', 'NOT_FOUND');
    }

    const blockReason = await getStockLocationDeletionBlockReason(location);
    if (blockReason) {
      throw new InventoryServiceError(blockReason);
    }

    const { error } = await (
      supabase.rpc as unknown as (
        fn: 'delete_stock_location',
        args: { p_location_id: string },
      ) => Promise<{ data: null; error: { message: string; code?: string } | null }>
    )('delete_stock_location', { p_location_id: locationId });

    if (error) {
      mapInventoryError(error, 'deleteStockLocation');
    }
  } catch (error) {
    if (error instanceof InventoryServiceError) {
      throw error;
    }
    mapInventoryError(error, 'deleteStockLocation');
  }
}

export async function deactivateStockLocation(locationId: string): Promise<StockLocation> {
  try {
    const existing = await getStockLocations(false);
    const location = existing.find((entry) => entry.id === locationId);

    if (!location) {
      throw new InventoryServiceError('Location not found.', 'NOT_FOUND');
    }

    if (location.is_default) {
      throw new InventoryServiceError(
        'Cannot deactivate the default location. Set another location as default first.',
      );
    }

    const { data, error } = await supabase
      .from('stock_locations')
      .update({ is_active: false })
      .eq('id', locationId)
      .select('*')
      .single();

    if (error) {
      mapInventoryError(error, 'deactivateStockLocation');
    }

    if (!data) {
      throw new InventoryServiceError('Location not found.', 'NOT_FOUND');
    }

    return data as StockLocation;
  } catch (error) {
    if (error instanceof InventoryServiceError) {
      throw error;
    }
    mapInventoryError(error, 'deactivateStockLocation');
  }
}

export function summarizeStockByLocation(balances: StockBalanceRow[]): LocationStockSummary[] {
  const summaryMap = new Map<string, LocationStockSummary>();

  for (const row of balances) {
    if (!row.location || row.quantity_on_hand <= 0) {
      continue;
    }

    const unitCost = Number(row.product?.price_50 ?? 0);
    const lineValue = row.quantity_on_hand * unitCost;
    const existing = summaryMap.get(row.location_id);

    if (existing) {
      existing.total_quantity += row.quantity_on_hand;
      existing.total_value += lineValue;
    } else {
      summaryMap.set(row.location_id, {
        location_id: row.location_id,
        location_name: row.location.name,
        total_quantity: row.quantity_on_hand,
        total_value: lineValue,
      });
    }
  }

  return Array.from(summaryMap.values()).sort((a, b) =>
    a.location_name.localeCompare(b.location_name),
  );
}

export async function getStockBalances(locationId?: string): Promise<StockBalanceRow[]> {
  try {
    let query = supabase
      .from('stock_balances')
      .select(
        `
        *,
        product:products(id, name, sku, price_50, is_active),
        location:stock_locations(id, name)
      `,
      )
      .order('updated_at', { ascending: false });

    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    const { data, error } = await query;

    if (error) {
      mapInventoryError(error, 'getStockBalances');
    }

    return (data ?? []) as StockBalanceRow[];
  } catch (error) {
    if (error instanceof InventoryServiceError) {
      throw error;
    }
    mapInventoryError(error, 'getStockBalances');
  }
}

export async function getTotalStockValuation(): Promise<number> {
  try {
    const { data, error } = await (
      supabase.rpc as unknown as (
        fn: 'get_total_stock_valuation',
      ) => Promise<{ data: number | null; error: { message: string } | null }>
    )('get_total_stock_valuation');

    if (error) {
      mapInventoryError(error, 'getTotalStockValuation');
    }

    return Number(data ?? 0);
  } catch (error) {
    if (error instanceof InventoryServiceError) {
      throw error;
    }
    mapInventoryError(error, 'getTotalStockValuation');
  }
}

export async function stockIn(request: StockInRequest): Promise<string> {
  try {
    const { data, error } = await (
      supabase.rpc as unknown as (
        fn: 'stock_in',
        args: {
          p_location_id: string;
          p_lines: Array<{ product_id: string; quantity: number }>;
          p_remarks: string | null;
        },
      ) => Promise<{ data: string | null; error: { message: string } | null }>
    )('stock_in', {
      p_location_id: request.location_id,
      p_lines: request.lines,
      p_remarks: request.remarks ?? null,
    });

    if (error) {
      mapInventoryError(error, 'stockIn');
    }

    if (!data) {
      throw new InventoryServiceError('Stock in failed.', 'UNKNOWN');
    }

    return data;
  } catch (error) {
    if (error instanceof InventoryServiceError) {
      throw error;
    }
    mapInventoryError(error, 'stockIn');
  }
}

export async function transferStock(request: TransferStockRequest): Promise<string> {
  try {
    const { data, error } = await (
      supabase.rpc as unknown as (
        fn: 'transfer_stock',
        args: {
          p_from_location_id: string;
          p_to_location_id: string;
          p_lines: Array<{ product_id: string; quantity: number }>;
          p_remarks: string | null;
        },
      ) => Promise<{ data: string | null; error: { message: string } | null }>
    )('transfer_stock', {
      p_from_location_id: request.from_location_id,
      p_to_location_id: request.to_location_id,
      p_lines: request.lines,
      p_remarks: request.remarks ?? null,
    });

    if (error) {
      mapInventoryError(error, 'transferStock');
    }

    if (!data) {
      throw new InventoryServiceError('Stock transfer failed.', 'UNKNOWN');
    }

    return data;
  } catch (error) {
    if (error instanceof InventoryServiceError) {
      throw error;
    }
    mapInventoryError(error, 'transferStock');
  }
}

export async function getInventoryLedger(
  filters: InventoryLedgerFilters = {},
): Promise<InventoryLedgerRow[]> {
  try {
    let query = supabase
      .from('inventory_ledger')
      .select(
        `
        *,
        product:products(id, name, sku),
        location:stock_locations(id, name)
      `,
      )
      .order('created_at', { ascending: false });

    if (filters.locationId) {
      query = query.eq('location_id', filters.locationId);
    }

    if (filters.movementType && filters.movementType !== 'all') {
      query = query.eq('movement_type', filters.movementType);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      mapInventoryError(error, 'getInventoryLedger');
    }

    return (data ?? []) as InventoryLedgerRow[];
  } catch (error) {
    if (error instanceof InventoryServiceError) {
      throw error;
    }
    mapInventoryError(error, 'getInventoryLedger');
  }
}

type StockInBatchQueryRow = {
  id: string;
  reference_number: string | null;
  location_id: string;
  status: StockInHistoryRow['status'];
  remarks: string | null;
  created_at: string;
  reversed_at: string | null;
  created_by: string | null;
  location: { id: string; name: string } | null;
  lines: Array<{ id: string; product_id: string; quantity: number; product?: { id: string; name: string; sku: string } | null }>;
};

function mapStockInBatchRow(row: StockInBatchQueryRow): StockInHistoryRow {
  const lines = row.lines ?? [];
  return {
    id: row.id,
    reference_number: row.reference_number ?? `SI-${row.id.slice(0, 8)}`,
    location_id: row.location_id,
    status: row.status ?? 'POSTED',
    remarks: row.remarks,
    created_at: row.created_at,
    reversed_at: row.reversed_at,
    created_by: row.created_by,
    location: row.location,
    products_count: lines.length,
    total_quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

function mapStockInDetail(row: StockInBatchQueryRow): StockInDetail {
  const summary = mapStockInBatchRow(row);
  return {
    ...summary,
    lines: (row.lines ?? []).map((line) => ({
      id: line.id,
      product_id: line.product_id,
      quantity: line.quantity,
      product: line.product ?? null,
    })),
  };
}

const stockInBatchSelect = `
  *,
  location:stock_locations(id, name),
  lines:stock_in_lines(
    id,
    product_id,
    quantity,
    product:products(id, name, sku)
  )
`;

export async function getStockInHistory(): Promise<StockInHistoryRow[]> {
  try {
    const { data, error } = await supabase
      .from('stock_in_batches')
      .select(stockInBatchSelect)
      .order('created_at', { ascending: false });

    if (error) {
      mapInventoryError(error, 'getStockInHistory');
    }

    return ((data ?? []) as StockInBatchQueryRow[]).map(mapStockInBatchRow);
  } catch (error) {
    if (error instanceof InventoryServiceError) {
      throw error;
    }
    mapInventoryError(error, 'getStockInHistory');
  }
}

export async function getStockInById(batchId: string): Promise<StockInDetail> {
  try {
    const { data, error } = await supabase
      .from('stock_in_batches')
      .select(stockInBatchSelect)
      .eq('id', batchId)
      .single();

    if (error) {
      mapInventoryError(error, 'getStockInById');
    }

    if (!data) {
      throw new InventoryServiceError('Stock in batch not found.', 'NOT_FOUND');
    }

    return mapStockInDetail(data as StockInBatchQueryRow);
  } catch (error) {
    if (error instanceof InventoryServiceError) {
      throw error;
    }
    mapInventoryError(error, 'getStockInById');
  }
}

export async function reverseStockIn(batchId: string): Promise<void> {
  try {
    const batch = await getStockInById(batchId);

    if (batch.status === 'REVERSED') {
      throw new InventoryServiceError(
        `Stock in ${batch.reference_number} has already been reversed.`,
        'ALREADY_REVERSED',
      );
    }

    const { error } = await (
      supabase.rpc as unknown as (
        fn: 'reverse_stock_in',
        args: { p_batch_id: string },
      ) => Promise<{ data: string | null; error: { message: string } | null }>
    )('reverse_stock_in', { p_batch_id: batchId });

    if (error) {
      mapInventoryError(error, 'reverseStockIn');
    }
  } catch (error) {
    if (error instanceof InventoryServiceError) {
      throw error;
    }
    mapInventoryError(error, 'reverseStockIn');
  }
}

export { InventoryServiceError };
