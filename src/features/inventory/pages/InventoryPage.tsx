import { useMemo, useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import { IndianRupee } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';

import { QueryErrorAlert } from '@/components/shared/QueryErrorAlert';

import { ExportDropdown } from '@/components/shared/ExportDropdown';

import { useAuth } from '@/features/auth/hooks/useAuth';

import { exportToExcel, exportToPdfReport } from '@/lib/export';

import type { ExportColumn, ExportRow } from '@/lib/export';

import { Input } from '@/components/ui/Input';

import { LocationManagement } from '@/features/inventory/components/LocationManagement';

import { LocationSelect } from '@/features/inventory/components/LocationSelect';

import { MovementTypeBadge } from '@/features/inventory/components/MovementTypeBadge';

import { StockInForm } from '@/features/inventory/components/StockInForm';

import { StockInHistoryPanel } from '@/features/inventory/components/StockInHistoryPanel';

import { StockTransferForm } from '@/features/inventory/components/StockTransferForm';

import { formatSignedLedgerQuantity } from '@/features/inventory/utils/ledgerQuantity';

import {

  getInventoryLedger,

  getStockBalances,

  getStockLocations,

  getTotalStockValuation,

  summarizeStockByLocation,

} from '@/features/inventory/services/inventory.service';

import type {
  InventoryMovementType,
  StockBalanceRow,
  StockLocation,
} from '@/features/inventory/types';

import { getProducts } from '@/features/products/services/product.service';

import { formatDate } from '@/lib/utils/format';



type InventoryTab = 'overview' | 'locations' | 'stock-in' | 'stock-in-history' | 'transfer' | 'ledger';



const tabs: Array<{ id: InventoryTab; label: string }> = [

  { id: 'overview', label: 'Overview' },

  { id: 'locations', label: 'Locations' },

  { id: 'stock-in', label: 'Stock In' },

  { id: 'stock-in-history', label: 'Stock In History' },

  { id: 'transfer', label: 'Transfer' },

  { id: 'ledger', label: 'Ledger' },

];



const movementFilterOptions: Array<{ value: InventoryMovementType | 'all'; label: string }> = [

  { value: 'all', label: 'All Types' },

  { value: 'STOCK_IN', label: 'Stock In' },

  { value: 'STOCK_IN_REVERSAL', label: 'Stock In Reversal' },

  { value: 'TRANSFER_IN', label: 'Transfer In' },

  { value: 'TRANSFER_OUT', label: 'Transfer Out' },

  { value: 'INVOICE_SALE', label: 'Invoice Sale' },

  { value: 'INVOICE_CANCEL', label: 'Invoice Cancel' },

];



function formatCurrency(value: number): string {

  return `₹${Number(value).toLocaleString('en-IN', {

    minimumFractionDigits: 2,

    maximumFractionDigits: 2,

  })}`;

}



// ---------------------------------------------------------------------------

// Overview V2 — one row per product, locations stacked vertically in one cell.

// Aggregation is presentation logic on top of the existing stock_balances

// query; no business logic or stock calculations are changed.

// ---------------------------------------------------------------------------

type LocationQty = {

  location_id: string;

  location_name: string;

  quantity: number;

  is_default: boolean;

};



type ProductOverviewRow = {

  product_id: string;

  product_name: string;

  sku: string;

  cost_price: number;

  total_qty: number;

  total_value: number;

  locations: LocationQty[];

};



function aggregateBalancesByProduct(

  balances: StockBalanceRow[],

  activeLocations: StockLocation[],

  locationFilter: string,

): ProductOverviewRow[] {

  // Which locations to render inside each product cell.

  // - All Locations filter: every active location (default included, so the

  //   Rule-1 highlight on the default location's 0 qty is always visible).

  // - Single location filter: only the selected location (no duplicate rows).

  const displayLocations = locationFilter

    ? activeLocations.filter((loc) => loc.id === locationFilter)

    : activeLocations;



  const byProduct = new Map<string, StockBalanceRow[]>();

  for (const row of balances) {

    if (!row.product) continue;

    const arr = byProduct.get(row.product_id) ?? [];

    arr.push(row);

    byProduct.set(row.product_id, arr);

  }



  const rows: ProductOverviewRow[] = [];

  for (const [productId, productRows] of byProduct) {

    const product = productRows[0].product!;

    const costPrice = Number(product.price_50 ?? 0);



    const qtyByLocation = new Map<string, number>();

    for (const row of productRows) {

      qtyByLocation.set(row.location_id, row.quantity_on_hand);

    }



    const locations: LocationQty[] = displayLocations.map((loc) => ({

      location_id: loc.id,

      location_name: loc.name,

      quantity: qtyByLocation.get(loc.id) ?? 0,

      is_default: loc.is_default,

    }));



    const totalQty = locations.reduce((sum, l) => sum + l.quantity, 0);



    rows.push({

      product_id: productId,

      product_name: product.name,

      sku: product.sku,

      cost_price: costPrice,

      total_qty: totalQty,

      total_value: totalQty * costPrice,

      locations,

    });

  }



  rows.sort((a, b) => a.product_name.localeCompare(b.product_name));

  return rows;

}



function filterProductsBySearch(rows: ProductOverviewRow[], search: string): ProductOverviewRow[] {

  const normalized = search.trim().toLowerCase();

  if (!normalized) return rows;

  return rows.filter(

    (row) =>

      row.product_name.toLowerCase().includes(normalized) ||

      row.sku.toLowerCase().includes(normalized),

  );

}



export function InventoryPage() {

  const { businessSettings, profile } = useAuth();

  const [activeTab, setActiveTab] = useState<InventoryTab>('overview');

  const [locationFilter, setLocationFilter] = useState('');

  const [productSearch, setProductSearch] = useState('');

  const [ledgerLocationFilter, setLedgerLocationFilter] = useState('');

  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<InventoryMovementType | 'all'>('all');



  const {

    data: activeLocations = [],

    isLoading: isLoadingActiveLocations,

    error: activeLocationsError,

    refetch: refetchActiveLocations,

  } = useQuery({

    queryKey: ['inventory', 'locations', { activeOnly: true }],

    queryFn: () => getStockLocations(true),

  });



  const {

    data: allLocations = [],

    isLoading: isLoadingAllLocations,

    error: allLocationsError,

    refetch: refetchAllLocations,

  } = useQuery({

    queryKey: ['inventory', 'locations', { activeOnly: false }],

    queryFn: () => getStockLocations(false),

    enabled: activeTab === 'locations',

  });



  const defaultLocation =

    activeLocations.find((location) => location.is_default) ?? activeLocations[0];



  const {

    data: productsData,

    isLoading: isLoadingProducts,

    error: productsError,

  } = useQuery({

    queryKey: ['products', { status: 'active' }],

    queryFn: () => getProducts({ status: 'active' }),

  });



  const products = productsData?.products ?? [];



  const {

    data: balances = [],

    isLoading: isLoadingBalances,

    error: balancesError,

    refetch: refetchBalances,

  } = useQuery({

    queryKey: ['inventory', 'balances', { locationId: locationFilter || undefined }],

    queryFn: () => getStockBalances(locationFilter || undefined),

    enabled: activeTab === 'overview' && !isLoadingActiveLocations,

  });



  const {

    data: valuation = 0,

    isLoading: isLoadingValuation,

    error: valuationError,

    refetch: refetchValuation,

  } = useQuery({

    queryKey: ['inventory', 'valuation'],

    queryFn: getTotalStockValuation,

    enabled: activeTab === 'overview',

  });



  const {

    data: ledger = [],

    isLoading: isLoadingLedger,

    error: ledgerError,

    refetch: refetchLedger,

  } = useQuery({

    queryKey: [

      'inventory',

      'ledger',

      { locationId: ledgerLocationFilter || undefined, movementType: ledgerTypeFilter },

    ],

    queryFn: () =>

      getInventoryLedger({

        locationId: ledgerLocationFilter || undefined,

        movementType: ledgerTypeFilter,

        limit: 200,

      }),

    enabled: activeTab === 'ledger',

  });



  // Overview V2: collapse per-location balance rows into one row per product.

  const productRows = useMemo(

    () => aggregateBalancesByProduct(balances, activeLocations, locationFilter),

    [balances, activeLocations, locationFilter],

  );



  const filteredProductRows = useMemo(

    () => filterProductsBySearch(productRows, productSearch),

    [productRows, productSearch],

  );



  // --- Export wiring (Overview report — respects current search + location filter) ---

  const inventoryExportColumns: ExportColumn[] = [

    { key: 'sku', header: 'SKU', type: 'text' },

    { key: 'product', header: 'Product', type: 'text' },

    { key: 'locations', header: 'Locations', type: 'text', width: 60 },

    { key: 'totalQty', header: 'Total Qty', type: 'number' },

    { key: 'costPrice', header: 'Cost Price', type: 'currency' },

    { key: 'totalValue', header: 'Total Value', type: 'currency' },

  ];



  const buildInventoryExportRows = (): ExportRow[] =>

    filteredProductRows.map((row) => ({

      sku: row.sku,

      product: row.product_name,

      locations: row.locations

        .map((l) => `${l.location_name}: ${l.quantity}`)

        .join('\n'),

      totalQty: row.total_qty,

      costPrice: row.cost_price,

      totalValue: row.total_value,

    }));



  const inventoryExportBase = {

    title: 'Inventory Report',

    worksheetName: 'Inventory',

    filename: `inventory-${new Date().toISOString().slice(0, 10)}`,

    columns: inventoryExportColumns,

    businessSettings,

    generatedBy: profile?.full_name,

    orientation: 'landscape' as const,

  };



  const handleExportInventoryExcel = () =>

    exportToExcel({ ...inventoryExportBase, rows: buildInventoryExportRows() });

  const handleExportInventoryPdf = () =>

    exportToPdfReport({ ...inventoryExportBase, rows: buildInventoryExportRows() });



  const locationSummaries = useMemo(() => summarizeStockByLocation(balances), [balances]);



  const overviewError =

    activeLocationsError ?? productsError ?? balancesError ?? valuationError;

  const locationsTabError = allLocationsError;



  return (

    <div>

      <PageHeader

        title="Inventory"

        description="Track stock by location, record movements, and monitor valuation."

        action={

          <ExportDropdown

            onExportExcel={handleExportInventoryExcel}

            onExportPdf={handleExportInventoryPdf}

            disabled={activeTab !== 'overview' || filteredProductRows.length === 0}

          />

        }

      />



      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200">

        {tabs.map((tab) => (

          <button

            key={tab.id}

            type="button"

            onClick={() => setActiveTab(tab.id)}

            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${

              activeTab === tab.id

                ? 'border-brand-600 text-brand-600'

                : 'border-transparent text-slate-500 hover:text-slate-700'

            }`}

          >

            {tab.label}

          </button>

        ))}

      </div>



      {overviewError && activeTab === 'overview' && (

        <QueryErrorAlert

          message="Failed to load inventory overview."

          onRetry={() => {

            void refetchActiveLocations();

            void refetchBalances();

            void refetchValuation();

          }}

        />

      )}



      {activeTab === 'overview' && (

        <div className="space-y-6">

          <h3 className="text-lg font-semibold text-slate-900">Inventory Overview</h3>



          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="mb-4 grid gap-4 md:grid-cols-3">

              <LocationSelect

                label="Location"

                locations={activeLocations}

                value={locationFilter}

                onChange={setLocationFilter}

                includeAllOption

              />

              <div className="md:col-span-2">

                <Input

                  label="Search Product"

                  value={productSearch}

                  onChange={(event) => setProductSearch(event.target.value)}

                  placeholder="Search by product name or SKU..."

                />

              </div>

            </div>



            {isLoadingBalances || isLoadingActiveLocations ? (

              <div className="py-12 text-center text-slate-500">Loading stock balances...</div>

            ) : filteredProductRows.length === 0 ? (

              <div className="py-12 text-center text-slate-500">No stock matches your filters.</div>

            ) : (

              <div className="overflow-x-auto">

                <table className="w-full divide-y divide-slate-200">

                  <thead className="bg-slate-50">

                    <tr>

                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">

                        SKU

                      </th>

                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">

                        Product

                      </th>

                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">

                        Locations

                      </th>

                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">

                        Cost Price

                      </th>

                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">

                        Total Qty

                      </th>

                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">

                        Total Value

                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-200 bg-white">

                    {filteredProductRows.map((row) => {

                      // Rule 2: total qty across all (displayed) locations is 0

                      // → light red background on the entire row, still readable.

                      const totalIsZero = row.total_qty === 0;

                      // Rule 1: default location qty is 0 AND total > 0

                      // → highlight ONLY that quantity cell (solid red, white text).

                      const defaultZeroCell = row.locations.find(

                        (loc) => loc.is_default && loc.quantity === 0 && row.total_qty > 0,

                      );

                      return (

                        <tr

                          key={row.product_id}

                          className={

                            totalIsZero

                              ? 'bg-red-50 hover:bg-red-100'

                              : 'hover:bg-slate-50'

                          }

                        >

                          <td className="px-4 py-3 text-sm text-slate-500">{row.sku || '—'}</td>

                          <td className="px-4 py-3 text-sm font-medium text-slate-900">

                            {row.product_name}

                          </td>

                          <td className="px-4 py-3 text-sm text-slate-700">

                            <div className="flex flex-col gap-1.5">

                              {row.locations.map((loc) => {

                                const highlightCell =

                                  defaultZeroCell?.location_id === loc.location_id;

                                return (

                                  <div key={loc.location_id} className="flex flex-col">

                                    <span className="text-slate-600">{loc.location_name}</span>

                                    <span

                                      className={

                                        highlightCell

                                          ? 'inline-block w-fit rounded bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white'

                                          : 'text-slate-900'

                                      }

                                    >

                                      {loc.quantity.toLocaleString('en-IN')}

                                    </span>

                                  </div>

                                );

                              })}

                            </div>

                          </td>

                          <td className="px-4 py-3 text-right text-sm text-slate-700">

                            {formatCurrency(row.cost_price)}

                          </td>

                          <td className="px-4 py-3 text-right text-sm text-slate-900">

                            {row.total_qty.toLocaleString('en-IN')}

                          </td>

                          <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">

                            {formatCurrency(row.total_value)}

                          </td>

                        </tr>

                      );

                    })}

                  </tbody>

                </table>

              </div>

            )}

          </div>



          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

            <h4 className="mb-4 text-sm font-semibold text-slate-700">Location Summary</h4>

            {isLoadingBalances ? (

              <div className="py-6 text-center text-sm text-slate-500">Loading location summary...</div>

            ) : locationSummaries.length === 0 ? (

              <div className="py-6 text-center text-sm text-slate-500">No stock recorded yet.</div>

            ) : (

              <div className="overflow-x-auto">

                <table className="w-full divide-y divide-slate-200">

                  <thead className="bg-slate-50">

                    <tr>

                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">

                        Location

                      </th>

                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">

                        Total Qty

                      </th>

                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">

                        Total Value

                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-200 bg-white">

                    {locationSummaries.map((summary) => (

                      <tr key={summary.location_id} className="hover:bg-slate-50">

                        <td className="px-4 py-3 text-sm font-medium text-slate-900">

                          {summary.location_name}

                        </td>

                        <td className="px-4 py-3 text-right text-sm text-slate-900">

                          {summary.total_quantity.toLocaleString('en-IN')}

                        </td>

                        <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">

                          {formatCurrency(summary.total_value)}

                        </td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            )}

          </div>



          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm font-medium text-slate-500">Total Stock Valuation</p>

                <p className="mt-1 text-2xl font-semibold text-slate-900">

                  {isLoadingValuation ? '…' : formatCurrency(valuation)}

                </p>

                <p className="mt-1 text-xs text-slate-500">Calculated at Cost Price (50%)</p>

              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50">

                <IndianRupee className="h-5 w-5 text-teal-600" />

              </div>

            </div>

          </div>

        </div>

      )}



      {activeTab === 'locations' && (

        <>

          {locationsTabError && (

            <QueryErrorAlert

              message="Failed to load locations."

              onRetry={() => void refetchAllLocations()}

            />

          )}

          {!locationsTabError && !isLoadingAllLocations && (

            <LocationManagement locations={allLocations} />

          )}

          {!locationsTabError && isLoadingAllLocations && (

            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">

              Loading locations...

            </div>

          )}

        </>

      )}



      {activeTab === 'stock-in' && (
        <>

          {(activeLocationsError || productsError) && (

            <QueryErrorAlert

              message="Failed to load stock in form data."

              onRetry={() => void refetchActiveLocations()}

            />

          )}

          {!activeLocationsError && !productsError && !isLoadingActiveLocations && !isLoadingProducts && (

            <StockInForm

              locations={activeLocations}

              products={products}

              defaultLocationId={defaultLocation?.id}

            />

          )}

        </>

      )}



      {activeTab === 'stock-in-history' && <StockInHistoryPanel />}



      {activeTab === 'transfer' && (

        <>

          {(activeLocationsError || productsError) && (

            <QueryErrorAlert

              message="Failed to load transfer form data."

              onRetry={() => void refetchActiveLocations()}

            />

          )}

          {!activeLocationsError && !productsError && !isLoadingActiveLocations && !isLoadingProducts && (

            <StockTransferForm locations={activeLocations} products={products} />

          )}

        </>

      )}



      {activeTab === 'ledger' && (

        <div className="space-y-4">

          {ledgerError && (

            <QueryErrorAlert message="Failed to load inventory ledger." onRetry={() => void refetchLedger()} />

          )}



          <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">

            <LocationSelect

              label="Location"

              locations={activeLocations}

              value={ledgerLocationFilter}

              onChange={setLedgerLocationFilter}

              includeAllOption

            />

            <div className="space-y-1.5">

              <label className="block text-sm font-medium text-slate-700">Movement Type</label>

              <select

                value={ledgerTypeFilter}

                onChange={(event) =>

                  setLedgerTypeFilter(event.target.value as InventoryMovementType | 'all')

                }

                className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"

              >

                {movementFilterOptions.map((option) => (

                  <option key={option.value} value={option.value}>

                    {option.label}

                  </option>

                ))}

              </select>

            </div>

          </div>



          {isLoadingLedger ? (

            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">

              Loading ledger...

            </div>

          ) : ledger.length === 0 ? (

            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">

              No inventory movements found.

            </div>

          ) : (

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

              <div className="overflow-x-auto">

                <table className="w-full divide-y divide-slate-200">

                  <thead className="bg-slate-50">

                    <tr>

                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">

                        Date

                      </th>

                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">

                        Type

                      </th>

                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">

                        Location

                      </th>

                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">

                        Product

                      </th>

                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">

                        Qty

                      </th>

                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">

                        Remarks

                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-200 bg-white">

                    {ledger.map((entry) => (

                      <tr key={entry.id} className="hover:bg-slate-50">

                        <td className="px-4 py-3 text-sm text-slate-700">

                          {formatDate(entry.created_at)}

                        </td>

                        <td className="px-4 py-3">

                          <MovementTypeBadge type={entry.movement_type} />

                        </td>

                        <td className="px-4 py-3 text-sm text-slate-700">{entry.location?.name ?? '—'}</td>

                        <td className="px-4 py-3 text-sm text-slate-900">{entry.product?.name ?? '—'}</td>

                        <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">

                          {formatSignedLedgerQuantity(entry.movement_type, entry.quantity)}

                        </td>

                        <td className="px-4 py-3 text-sm text-slate-500">{entry.remarks ?? '—'}</td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            </div>

          )}

        </div>

      )}

    </div>

  );

}


