import { useMemo, useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import { IndianRupee } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';

import { QueryErrorAlert } from '@/components/shared/QueryErrorAlert';

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

import type { InventoryMovementType } from '@/features/inventory/types';

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



function filterBalancesBySearch<T extends { product: { name: string; sku: string } | null }>(

  rows: T[],

  search: string,

): T[] {

  const normalized = search.trim().toLowerCase();

  if (!normalized) {

    return rows;

  }



  return rows.filter((row) => {

    const name = row.product?.name.toLowerCase() ?? '';

    const sku = row.product?.sku.toLowerCase() ?? '';

    return name.includes(normalized) || sku.includes(normalized);

  });

}



export function InventoryPage() {

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



  const filteredBalances = useMemo(

    () => filterBalancesBySearch(balances, productSearch),

    [balances, productSearch],

  );



  const locationSummaries = useMemo(() => summarizeStockByLocation(balances), [balances]);



  const overviewError =

    activeLocationsError ?? productsError ?? balancesError ?? valuationError;

  const locationsTabError = allLocationsError;



  return (

    <div>

      <PageHeader

        title="Inventory"

        description="Track stock by location, record movements, and monitor valuation."

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

            ) : filteredBalances.length === 0 ? (

              <div className="py-12 text-center text-slate-500">No stock matches your filters.</div>

            ) : (

              <div className="overflow-x-auto">

                <table className="w-full divide-y divide-slate-200">

                  <thead className="bg-slate-50">

                    <tr>

                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">

                        Location

                      </th>

                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">

                        Product

                      </th>

                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">

                        SKU

                      </th>

                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">

                        Qty

                      </th>

                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">

                        Unit Cost

                      </th>

                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">

                        Value

                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-200 bg-white">

                    {filteredBalances.map((row) => {

                      const unitCost = Number(row.product?.price_50 ?? 0);

                      const lineValue = row.quantity_on_hand * unitCost;

                      return (

                        <tr key={row.id} className="hover:bg-slate-50">

                          <td className="px-4 py-3 text-sm text-slate-700">{row.location?.name ?? '—'}</td>

                          <td className="px-4 py-3 text-sm font-medium text-slate-900">

                            {row.product?.name ?? '—'}

                          </td>

                          <td className="px-4 py-3 text-sm text-slate-500">{row.product?.sku ?? '—'}</td>

                          <td className="px-4 py-3 text-right text-sm text-slate-900">

                            {row.quantity_on_hand}

                          </td>

                          <td className="px-4 py-3 text-right text-sm text-slate-700">

                            {formatCurrency(unitCost)}

                          </td>

                          <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">

                            {formatCurrency(lineValue)}

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


