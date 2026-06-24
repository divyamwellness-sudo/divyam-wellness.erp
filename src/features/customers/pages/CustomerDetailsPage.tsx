import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowLeft,
  Calendar,
  CalendarClock,
  Download,
  Printer,
  Scale,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/layout/PageHeader';
import { QueryErrorAlert } from '@/components/shared/QueryErrorAlert';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ProgressLineChart } from '@/features/customers/components/ProgressLineChart';
import { ProgressReportDocument } from '@/features/customers/components/ProgressReportDocument';
import { getCustomerById } from '@/features/customers/services/customer.service';
import { buildProgressAnalytics } from '@/features/customers/utils/progressAnalytics';
import {
  formatBmiChange,
  formatWeightChange,
  getProgressReportPdfFilename,
} from '@/features/customers/utils/progressReportDocument';
import { downloadProgressReportPdf } from '@/features/customers/utils/progressReportPdf';
import { useProgressReportPrint } from '@/features/customers/utils/progressReportPrint';
import { getBusinessSettings } from '@/features/settings/services/settings.service';
import { getWeightLogs } from '@/features/weight-tracking/services/weight-log.service';
import { calculateAge } from '@/lib/utils/format';
import type { CustomerType, PricingTier } from '@/types/database.types';

const chartColors: Record<string, string> = {
  weight_kg: '#2563eb',
  bmi: '#7c3aed',
  body_fat_percentage: '#ea580c',
  visceral_fat: '#dc2626',
  muscle_mass: '#059669',
};

function CustomerTypeBadge({ type }: { type: CustomerType }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
        type === 'coach' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'
      }`}
    >
      {type === 'coach' ? 'Coach' : 'PC'}
    </span>
  );
}

function PricingTierBadge({ tier }: { tier: PricingTier }) {
  return (
    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
      {tier === 'MRP' ? 'MRP' : `${tier}%`}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  accent,
  valueClassName = 'text-slate-900',
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className={`mt-1 text-2xl font-semibold ${valueClassName}`}>{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}>{icon}</div>
      </div>
    </div>
  );
}

export function CustomerDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { businessSettings: authBusinessSettings } = useAuth();
  const documentRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [documentActionError, setDocumentActionError] = useState<string | null>(null);

  const {
    data: customer,
    isLoading: isLoadingCustomer,
    error: customerError,
    refetch: refetchCustomer,
  } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomerById(id!),
    enabled: !!id,
  });

  const {
    data: weightLogs,
    isLoading: isLoadingLogs,
    error: weightLogsError,
    refetch: refetchWeightLogs,
  } = useQuery({
    queryKey: ['weightLogs', id],
    queryFn: () => getWeightLogs(id!),
    enabled: !!id,
  });

  const { data: fetchedBusinessSettings } = useQuery({
    queryKey: ['businessSettings'],
    queryFn: getBusinessSettings,
    enabled: !authBusinessSettings,
  });

  const businessSettings = authBusinessSettings ?? fetchedBusinessSettings ?? null;

  const analytics = useMemo(() => {
    if (!customer || weightLogsError || !weightLogs) return null;
    return buildProgressAnalytics(weightLogs, customer);
  }, [customer, weightLogs, weightLogsError]);

  const logs = weightLogs ?? [];
  const canExportReport = Boolean(
    customer && analytics && logs.length > 0 && businessSettings,
  );

  const handlePrint = useProgressReportPrint(
    documentRef,
    customer ? `${customer.name} Progress Report` : 'Progress Report',
  );

  const handlePrintClick = () => {
    if (!canExportReport) {
      setDocumentActionError('Configure business settings before printing.');
      return;
    }

    setDocumentActionError(null);
    handlePrint();
  };

  const handleDownloadPdf = async () => {
    if (!documentRef.current || !customer) {
      setDocumentActionError('Progress report is not ready.');
      return;
    }

    setDocumentActionError(null);
    setIsGeneratingPdf(true);

    try {
      await downloadProgressReportPdf(
        documentRef.current,
        getProgressReportPdfFilename(customer.name),
      );
    } catch {
      setDocumentActionError('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (isLoadingCustomer) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        <p className="mt-4 text-slate-500">Loading customer progress...</p>
      </div>
    );
  }

  if (customerError || !customer) {
    return (
      <div>
        <PageHeader title="Customer Not Found" description="The requested customer could not be loaded." />
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700">
            {customerError instanceof Error ? customerError.message : 'Customer not found.'}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {customerError && (
              <Button variant="secondary" onClick={() => void refetchCustomer()}>
                Retry
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate('/customers')}>
              <ArrowLeft className="h-4 w-4" />
              Back to Customers
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const summary = analytics?.summary;
  const age = calculateAge(customer.date_of_birth);

  const weightChange = summary?.weightChange ?? null;
  const isWeightLoss = weightChange != null && weightChange < 0;
  const isWeightGain = weightChange != null && weightChange > 0;

  const bmiChange = summary?.bmiChange ?? null;
  const isBmiImprovement = bmiChange != null && bmiChange < 0;

  const weightChangeLabel = formatWeightChange(weightChange);
  const bmiChangeLabel = formatBmiChange(bmiChange);

  return (
    <div>
      <PageHeader
        title={customer.name}
        description="Customer profile and wellness progress analytics."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate('/customers')}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            {logs.length > 0 && (
              <>
                <Button
                  variant="secondary"
                  onClick={handlePrintClick}
                  disabled={!canExportReport}
                >
                  <Printer className="h-4 w-4" />
                  Print Progress Report
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void handleDownloadPdf()}
                  disabled={!canExportReport || isGeneratingPdf}
                >
                  <Download className="h-4 w-4" />
                  {isGeneratingPdf ? 'Generating PDF…' : 'Download PDF'}
                </Button>
              </>
            )}
            <Button variant="secondary" onClick={() => navigate('/weight-tracking')}>
              <Scale className="h-4 w-4" />
              Log Weight
            </Button>
          </div>
        }
      />

      {/* Customer info */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">{customer.phone}</p>
            {customer.email && <p className="text-sm text-slate-500">{customer.email}</p>}
            {customer.city && <p className="mt-1 text-sm text-slate-500">{customer.city}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <CustomerTypeBadge type={customer.customer_type} />
            <PricingTierBadge tier={customer.pricing_tier} />
          </div>
        </div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-slate-500">Goal: </span>
            <span className="font-medium text-slate-900">
              {customer.goal?.replace(/_/g, ' ') ?? '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Target Weight: </span>
            <span className="font-medium text-slate-900">
              {customer.target_weight != null ? `${customer.target_weight} kg` : '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Age: </span>
            <span className="font-medium text-slate-900">{age != null ? `${age} yrs` : '—'}</span>
          </div>
          <div>
            <span className="text-slate-500">Weight Logs: </span>
            <span className="font-medium text-slate-900">{logs.length}</span>
          </div>
        </div>
      </div>

      {documentActionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {documentActionError}
        </div>
      )}

      {weightLogsError && (
        <QueryErrorAlert
          message="Failed to load weight logs. Progress charts are unavailable."
          onRetry={() => void refetchWeightLogs()}
        />
      )}

      {isLoadingLogs && !weightLogsError ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="mt-4 text-slate-500">Loading weight logs...</p>
        </div>
      ) : !weightLogsError && logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Scale className="mx-auto h-12 w-12 text-slate-400" />
          <p className="mt-4 text-slate-600">No weight logs yet for this customer.</p>
          <p className="mt-1 text-sm text-slate-500">
            Add the first entry in Weight Tracking to see progress charts.
          </p>
          <Button className="mt-4" onClick={() => navigate('/weight-tracking')}>
            Go to Weight Tracking
          </Button>
        </div>
      ) : !weightLogsError && logs.length > 0 ? (
        <>
          {/* Summary cards */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <SummaryCard
              label="Starting Weight"
              value={summary?.startingWeight != null ? `${summary.startingWeight} kg` : '—'}
              icon={<Scale className="h-5 w-5 text-brand-600" />}
              accent="bg-brand-50"
            />
            <SummaryCard
              label="Current Weight"
              value={summary?.currentWeight != null ? `${summary.currentWeight} kg` : '—'}
              icon={<Activity className="h-5 w-5 text-blue-600" />}
              accent="bg-blue-50"
            />
            <SummaryCard
              label="Weight Change"
              value={weightChangeLabel}
              icon={
                isWeightLoss ? (
                  <TrendingDown className="h-5 w-5 text-green-600" />
                ) : isWeightGain ? (
                  <TrendingUp className="h-5 w-5 text-orange-600" />
                ) : (
                  <Scale className="h-5 w-5 text-slate-400" />
                )
              }
              accent={isWeightLoss ? 'bg-green-50' : isWeightGain ? 'bg-orange-50' : 'bg-slate-50'}
              valueClassName={
                isWeightLoss ? 'text-green-600' : isWeightGain ? 'text-orange-600' : 'text-slate-900'
              }
            />
            <SummaryCard
              label="BMI Change"
              value={bmiChangeLabel}
              icon={<TrendingDown className="h-5 w-5 text-purple-600" />}
              accent="bg-purple-50"
              valueClassName={isBmiImprovement ? 'text-green-600' : bmiChange != null && bmiChange > 0 ? 'text-orange-600' : 'text-slate-900'}
            />
            <SummaryCard
              label="Latest Metabolic Age"
              value={
                summary?.latestMetabolicAge != null ? `${summary.latestMetabolicAge} yrs` : '—'
              }
              icon={<CalendarClock className="h-5 w-5 text-orange-600" />}
              accent="bg-orange-50"
            />
            <SummaryCard
              label="Transformation Period"
              value={summary?.transformationPeriod ?? '—'}
              icon={<Calendar className="h-5 w-5 text-teal-600" />}
              accent="bg-teal-50"
            />
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            {analytics?.charts.map((chart) => (
              <ProgressLineChart
                key={chart.key}
                title={chart.title}
                data={chart.points}
                unit={chart.unit || undefined}
                color={chartColors[chart.key]}
                emptyMessage={`No ${chart.title.replace(' Trend', '').toLowerCase()} data logged yet.`}
              />
            ))}
          </div>
        </>
      ) : null}

      {canExportReport && analytics && businessSettings && (
        <div className="fixed left-[-9999px] top-0 -z-50 overflow-hidden" aria-hidden="true">
          <ProgressReportDocument
            ref={documentRef}
            customer={customer}
            analytics={analytics}
            weightLogs={logs}
            businessSettings={businessSettings}
          />
        </div>
      )}
    </div>
  );
}
