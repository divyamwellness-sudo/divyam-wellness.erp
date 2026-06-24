import { Star } from 'lucide-react';

export function DefaultLocationBadge() {
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
      <Star className="h-3 w-3 fill-amber-500 text-amber-500" aria-hidden="true" />
      Default
    </span>
  );
}
