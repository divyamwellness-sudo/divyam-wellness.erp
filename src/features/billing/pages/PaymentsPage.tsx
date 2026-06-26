import { CreditCard } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

export function PaymentsPage() {
  return (
    <div>
      <PageHeader
        title="Payments"
        description="A consolidated view of payments recorded against all invoices."
      />
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <CreditCard className="mx-auto h-12 w-12 text-slate-400" />
        <p className="mt-4 text-sm font-medium text-slate-900">Payments summary coming soon</p>
        <p className="mt-2 text-sm text-slate-500">
          Per-invoice payment recording is available on each invoice page. A cross-invoice payments
          ledger will be added in a future phase.
        </p>
      </div>
    </div>
  );
}
