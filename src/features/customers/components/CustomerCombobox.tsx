import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils/format';
import type { Customer } from '@/types/database.types';

const MAX_VISIBLE_RESULTS = 50;

type CustomerComboboxProps = {
  customers: Customer[];
  value: string;
  onChange: (customerId: string) => void;
  error?: string;
  label?: string;
  placeholder?: string;
  id?: string;
};

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

export function CustomerCombobox({
  customers,
  value,
  onChange,
  error,
  label,
  placeholder = 'Search customer...',
  id,
}: CustomerComboboxProps) {
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
        ? selectedCustomer.name
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

  const clearSelection = useCallback(() => {
    onChange('');
    setQuery('');
    closeList();
    inputRef.current?.focus();
  }, [closeList, onChange]);

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

    setHighlightedIndex(visibleCustomers.length > 0 ? 0 : -1);
  }, [isOpen, query, visibleCustomers.length]);

  function moveHighlight(direction: 1 | -1) {
    if (visibleCustomers.length === 0) {
      return;
    }

    setHighlightedIndex((current) => {
      if (current < 0) {
        return direction === 1 ? 0 : visibleCustomers.length - 1;
      }

      return (current + direction + visibleCustomers.length) % visibleCustomers.length;
    });
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
        if (highlightedIndex >= 0 && visibleCustomers[highlightedIndex]) {
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
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}

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
            isOpen && highlightedIndex >= 0 && visibleCustomers[highlightedIndex]
              ? `${listboxId}-option-${visibleCustomers[highlightedIndex].id}`
              : undefined
          }
          value={displayValue}
          placeholder={placeholder}
          onFocus={openList}
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
            'flex h-10 w-full rounded-lg border bg-white py-2 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
            value ? 'pr-16' : 'pr-9',
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-200',
          )}
        />

        {value && !isOpen && (
          <button
            type="button"
            aria-label="Clear selected customer"
            onMouseDown={(event) => event.preventDefault()}
            onClick={clearSelection}
            className="absolute right-8 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <ChevronDown
          className={cn(
            'pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </div>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      {isOpen && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
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
                    'cursor-pointer px-3 py-2 text-sm font-medium text-slate-900',
                    isHighlighted && 'bg-brand-50',
                    !isHighlighted && 'hover:bg-slate-50',
                  )}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectCustomer(customer)}
                >
                  {customer.name}
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
