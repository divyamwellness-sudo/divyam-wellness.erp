import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { productCategoryOptions } from '@/features/products/components/ProductForm';
import { cn } from '@/lib/utils/format';
import type { Product, ProductCategory } from '@/types/database.types';

const categoryLabels = Object.fromEntries(
  productCategoryOptions.map((option) => [option.value, option.label]),
) as Record<ProductCategory, string>;

const MAX_VISIBLE_RESULTS = 50;

type ProductSearchComboboxProps = {
  products: Product[];
  value: string;
  onChange: (productId: string) => void;
  disabledProductIds?: string[];
  error?: string;
  placeholder?: string;
  id?: string;
};

function formatSelectedLabel(product: Product): string {
  return `${product.name} (${product.sku})`;
}

function filterProducts(products: Product[], query: string): Product[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return products;
  }

  return products.filter(
    (product) =>
      product.name.toLowerCase().includes(normalized) ||
      product.sku.toLowerCase().includes(normalized),
  );
}

export function ProductSearchCombobox({
  products,
  value,
  onChange,
  disabledProductIds = [],
  error,
  placeholder = 'Search product by name or SKU...',
  id,
}: ProductSearchComboboxProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === value),
    [products, value],
  );

  const filteredProducts = useMemo(() => filterProducts(products, query), [products, query]);

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, MAX_VISIBLE_RESULTS),
    [filteredProducts],
  );

  const displayValue =
    query.length > 0
      ? query
      : !isOpen && selectedProduct
        ? formatSelectedLabel(selectedProduct)
        : '';

  const closeList = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setHighlightedIndex(0);
  }, []);

  const openList = useCallback(() => {
    setIsOpen(true);
    setHighlightedIndex(0);
  }, []);

  const selectProduct = useCallback(
    (product: Product) => {
      if (disabledProductIds.includes(product.id)) {
        return;
      }

      onChange(product.id);
      closeList();
      inputRef.current?.blur();
    },
    [closeList, disabledProductIds, onChange],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeList();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [closeList, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const firstSelectableIndex = visibleProducts.findIndex(
      (product) => !disabledProductIds.includes(product.id),
    );
    setHighlightedIndex(firstSelectableIndex >= 0 ? firstSelectableIndex : 0);
  }, [disabledProductIds, isOpen, query, visibleProducts]);

  function moveHighlight(direction: 1 | -1) {
    if (visibleProducts.length === 0) {
      return;
    }

    let nextIndex = highlightedIndex;

    for (let step = 0; step < visibleProducts.length; step += 1) {
      nextIndex = (nextIndex + direction + visibleProducts.length) % visibleProducts.length;
      if (!disabledProductIds.includes(visibleProducts[nextIndex].id)) {
        setHighlightedIndex(nextIndex);
        break;
      }
    }
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      openList();
      return;
    }

    if (!isOpen) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveHighlight(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveHighlight(-1);
        break;
      case 'Enter':
        event.preventDefault();
        if (
          visibleProducts[highlightedIndex] &&
          !disabledProductIds.includes(visibleProducts[highlightedIndex].id)
        ) {
          selectProduct(visibleProducts[highlightedIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        closeList();
        inputRef.current?.blur();
        break;
      default:
        break;
    }
  }

  const showEmptyState = isOpen && filteredProducts.length === 0;
  const showTruncationHint =
    isOpen && filteredProducts.length > MAX_VISIBLE_RESULTS && !showEmptyState;

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            isOpen && visibleProducts[highlightedIndex]
              ? `${listboxId}-option-${visibleProducts[highlightedIndex].id}`
              : undefined
          }
          value={displayValue}
          placeholder={placeholder}
          onFocus={() => {
            openList();
            if (selectedProduct && query.length === 0) {
              setQuery('');
            }
          }}
          onChange={(event) => {
            const nextQuery = event.target.value;
            if (value) {
              onChange('');
            }
            setQuery(nextQuery);
            if (!isOpen) {
              openList();
            }
          }}
          onKeyDown={handleInputKeyDown}
          className={cn(
            'flex h-10 w-full rounded-lg border bg-white py-2 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-200',
          )}
        />
        <ChevronDown
          className={cn(
            'pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {isOpen && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <ul id={listboxId} role="listbox" aria-label="Products">
            {showEmptyState && (
              <li className="px-3 py-2 text-sm text-slate-500">No products found</li>
            )}

            {visibleProducts.map((product, index) => {
              const isDisabled = disabledProductIds.includes(product.id);
              const isHighlighted = index === highlightedIndex;

              return (
                <li
                  key={product.id}
                  id={`${listboxId}-option-${product.id}`}
                  role="option"
                  aria-selected={value === product.id}
                  aria-disabled={isDisabled}
                  className={cn(
                    'cursor-pointer px-3 py-2',
                    isHighlighted && !isDisabled && 'bg-brand-50',
                    isDisabled && 'cursor-not-allowed opacity-50',
                    !isDisabled && !isHighlighted && 'hover:bg-slate-50',
                  )}
                  onMouseEnter={() => {
                    if (!isDisabled) {
                      setHighlightedIndex(index);
                    }
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={() => selectProduct(product)}
                >
                  <p className="text-sm font-medium text-slate-900">
                    {product.name} ({product.sku})
                  </p>
                  <p className="text-xs text-slate-500">
                    {categoryLabels[product.category] ?? product.category}
                  </p>
                  {isDisabled && (
                    <p className="text-xs text-slate-400">Already added to this invoice</p>
                  )}
                </li>
              );
            })}
          </ul>

          {showTruncationHint && (
            <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
              Showing first {MAX_VISIBLE_RESULTS} of {filteredProducts.length} matches. Refine your
              search to narrow results.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
