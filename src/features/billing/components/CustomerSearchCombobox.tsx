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
import { cn } from '@/lib/utils/format';
import type { Customer } from '@/types/database.types';

const MAX_VISIBLE_RESULTS = 50;

type CustomerSearchComboboxProps = {
  customers: Customer[];
  value: string;
  onChange: (customerId: string) => void;
  error?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
};

function formatSelectedLabel(customer: Customer): string {
  return customer.phone ? `${customer.name} (${customer.phone})` : customer.name;
}

function filterCustomers(customers: Customer[], query: string): Customer[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return customers;
  }

  return customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(normalized) ||
      customer.phone.toLowerCase().includes(normalized),
  );
}

/**
 * Searchable customer combobox. Mirrors the UX of `ProductSearchCombobox`
 * so the customer picker feels native to the rest of the ERP.
 */
export function CustomerSearchCombobox({
  customers,
  value,
  onChange,
  error,
  placeholder = 'Search customer by name or phone...',
  id,
  disabled = false,
}: CustomerSearchComboboxProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === value),
    [customers, value],
  );

  const filteredCustomers = useMemo(
    () => filterCustomers(customers, query),
    [customers, query],
  );

  const visibleCustomers = useMemo(
    () => filteredCustomers.slice(0, MAX_VISIBLE_RESULTS),
    [filteredCustomers],
  );

  const displayValue =
    query.length > 0
      ? query
      : !isOpen && selectedCustomer
        ? formatSelectedLabel(selectedCustomer)
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

  const selectCustomer = useCallback(
    (customer: Customer) => {
      onChange(customer.id);
      closeList();
      inputRef.current?.blur();
    },
    [closeList, onChange],
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
    setHighlightedIndex(0);
  }, [isOpen, query, visibleCustomers]);

  function moveHighlight(direction: 1 | -1) {
    if (visibleCustomers.length === 0) {
      return;
    }
    setHighlightedIndex((prev) => {
      let nextIndex = prev;
      for (let step = 0; step < visibleCustomers.length; step += 1) {
        nextIndex = (nextIndex + direction + visibleCustomers.length) % visibleCustomers.length;
        return nextIndex;
      }
      return prev;
    });
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
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
        if (visibleCustomers[highlightedIndex]) {
          selectCustomer(visibleCustomers[highlightedIndex]);
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

  const showEmptyState = isOpen && filteredCustomers.length === 0;
  const showTruncationHint =
    isOpen && filteredCustomers.length > MAX_VISIBLE_RESULTS && !showEmptyState;

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
          disabled={disabled}
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            isOpen && visibleCustomers[highlightedIndex]
              ? `${listboxId}-option-${visibleCustomers[highlightedIndex].id}`
              : undefined
          }
          value={displayValue}
          placeholder={placeholder}
          onFocus={() => {
            if (disabled) return;
            openList();
            if (selectedCustomer && query.length === 0) {
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
            'flex h-10 w-full rounded-lg border bg-white py-2 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50',
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
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <ul id={listboxId} role="listbox" aria-label="Customers">
            {showEmptyState && (
              <li className="px-3 py-2 text-sm text-slate-500">No customers found</li>
            )}

            {visibleCustomers.map((customer, index) => {
              const isHighlighted = index === highlightedIndex;
              return (
                <li
                  key={customer.id}
                  id={`${listboxId}-option-${customer.id}`}
                  role="option"
                  aria-selected={value === customer.id}
                  className={cn(
                    'cursor-pointer px-3 py-2',
                    isHighlighted && 'bg-brand-50',
                    !isHighlighted && 'hover:bg-slate-50',
                  )}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectCustomer(customer)}
                >
                  <p className="text-sm font-medium text-slate-900">{customer.name}</p>
                  <p className="text-xs text-slate-500">
                    {customer.phone || 'No phone on file'}
                  </p>
                </li>
              );
            })}
          </ul>

          {showTruncationHint && (
            <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
              Showing first {MAX_VISIBLE_RESULTS} of {filteredCustomers.length} matches. Refine
              your search to narrow results.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
