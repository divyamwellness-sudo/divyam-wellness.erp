type ReportDateFilterProps = {
  dateFrom: string;
  dateTo: string;
  onChange: (field: 'dateFrom' | 'dateTo', value: string) => void;
  onReset: () => void;
};

function todayForInput(): string {
  return new Date().toISOString().split('T')[0];
}

function startOfMonthForInput(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
}

export function getDefaultReportDateRange(): { dateFrom: string; dateTo: string } {
  return {
    dateFrom: startOfMonthForInput(),
    dateTo: todayForInput(),
  };
}

export function ReportDateFilter({ dateFrom, dateTo, onChange, onReset }: ReportDateFilterProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-1">
          <label htmlFor="report-date-from" className="block text-sm font-medium text-slate-700">
            From
          </label>
          <input
            id="report-date-from"
            type="date"
            value={dateFrom}
            max={dateTo}
            onChange={(e) => onChange('dateFrom', e.target.value)}
            className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="report-date-to" className="block text-sm font-medium text-slate-700">
            To
          </label>
          <input
            id="report-date-to"
            type="date"
            value={dateTo}
            min={dateFrom}
            max={todayForInput()}
            onChange={(e) => onChange('dateTo', e.target.value)}
            className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <div className="flex items-end md:col-span-2">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Reset to This Month
          </button>
        </div>
      </div>
    </div>
  );
}
