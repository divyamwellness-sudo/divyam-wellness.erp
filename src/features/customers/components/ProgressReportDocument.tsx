import { forwardRef, useMemo } from 'react';
import { ProgressReportPrintChart } from '@/features/customers/components/ProgressReportPrintChart';
import {
  formatBmiChange,
  formatWeightChange,
  progressReportChartColors,
  type ProgressReportDocumentProps,
} from '@/features/customers/utils/progressReportDocument';
import { formatDate } from '@/lib/utils/format';
import '@/features/customers/styles/progress-report-print.css';

export const ProgressReportDocument = forwardRef<HTMLDivElement, ProgressReportDocumentProps>(
  function ProgressReportDocument({ customer, analytics, weightLogs, businessSettings }, ref) {
    const summary = analytics.summary;
    const generatedOn = formatDate(new Date());

    const historyLogs = useMemo(
      () => [...weightLogs].sort((a, b) => b.recorded_date.localeCompare(a.recorded_date)),
      [weightLogs],
    );

    return (
      <div ref={ref} className="progress-report-document">
        <header className="progress-report-document__header">
          <div className="progress-report-document__brand">
            {businessSettings.logo_url ? (
              <img
                src={businessSettings.logo_url}
                alt={`${businessSettings.business_name} logo`}
                className="progress-report-document__logo"
              />
            ) : (
              <div
                className="progress-report-document__logo-placeholder"
                aria-label="Business logo placeholder"
              >
                Logo
              </div>
            )}
            <div>
              <h1 className="progress-report-document__business-name">
                {businessSettings.business_name}
              </h1>
              {businessSettings.address && (
                <p className="progress-report-document__business-meta">{businessSettings.address}</p>
              )}
              {businessSettings.phone && (
                <p className="progress-report-document__business-meta">
                  Phone: {businessSettings.phone}
                </p>
              )}
              {businessSettings.email && (
                <p className="progress-report-document__business-meta">
                  Email: {businessSettings.email}
                </p>
              )}
            </div>
          </div>

          <div className="progress-report-document__title-block">
            <h2 className="progress-report-document__title">PROGRESS REPORT</h2>
            <p className="progress-report-document__meta-row">Generated: {generatedOn}</p>
          </div>
        </header>

        <section className="progress-report-document__section">
          <h3 className="progress-report-document__section-title">Customer Information</h3>
          <div className="progress-report-document__grid">
            <div>
              <span className="progress-report-document__field-label">Name</span>
              <p className="progress-report-document__field-value">{customer.name}</p>
            </div>
            <div>
              <span className="progress-report-document__field-label">Phone</span>
              <p className="progress-report-document__field-value">{customer.phone}</p>
            </div>
            <div>
              <span className="progress-report-document__field-label">Join Date</span>
              <p className="progress-report-document__field-value">
                {formatDate(customer.joining_date)}
              </p>
            </div>
          </div>
        </section>

        <section className="progress-report-document__section">
          <h3 className="progress-report-document__section-title">Progress Summary</h3>
          <div className="progress-report-document__grid progress-report-document__grid--summary">
            <div>
              <span className="progress-report-document__field-label">Starting Weight</span>
              <p className="progress-report-document__field-value">
                {summary.startingWeight != null ? `${summary.startingWeight} kg` : '—'}
              </p>
            </div>
            <div>
              <span className="progress-report-document__field-label">Current Weight</span>
              <p className="progress-report-document__field-value">
                {summary.currentWeight != null ? `${summary.currentWeight} kg` : '—'}
              </p>
            </div>
            <div>
              <span className="progress-report-document__field-label">Weight Change</span>
              <p className="progress-report-document__field-value">
                {formatWeightChange(summary.weightChange)}
              </p>
            </div>
            <div>
              <span className="progress-report-document__field-label">BMI Change</span>
              <p className="progress-report-document__field-value">
                {formatBmiChange(summary.bmiChange)}
              </p>
            </div>
            <div>
              <span className="progress-report-document__field-label">Latest Metabolic Age</span>
              <p className="progress-report-document__field-value">
                {summary.latestMetabolicAge != null ? `${summary.latestMetabolicAge} yrs` : '—'}
              </p>
            </div>
            <div>
              <span className="progress-report-document__field-label">Transformation Period</span>
              <p className="progress-report-document__field-value">
                {summary.transformationPeriod ?? '—'}
              </p>
            </div>
          </div>
        </section>

        <section className="progress-report-document__section">
          <h3 className="progress-report-document__section-title">Progress Charts</h3>
          <div className="progress-report-document__charts">
            {analytics.charts.map((chart) => (
              <ProgressReportPrintChart
                key={chart.key}
                title={chart.title}
                data={chart.points}
                unit={chart.unit || undefined}
                color={progressReportChartColors[chart.key]}
                emptyMessage={`No ${chart.title.replace(' Trend', '').toLowerCase()} data logged yet.`}
              />
            ))}
          </div>
        </section>

        <section className="progress-report-document__section">
          <h3 className="progress-report-document__section-title">Weight Log History</h3>
          <div className="progress-report-document__table-wrap">
            <table className="progress-report-document__table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Weight</th>
                  <th>Body Fat</th>
                  <th>VF</th>
                  <th>BMI</th>
                  <th>Metabolic Age</th>
                  <th>Muscle Mass</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {historyLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDate(log.recorded_date)}</td>
                    <td>{log.weight_kg} kg</td>
                    <td>
                      {log.body_fat_percentage != null ? `${log.body_fat_percentage}%` : '—'}
                    </td>
                    <td>{log.visceral_fat != null ? log.visceral_fat : '—'}</td>
                    <td>{log.bmi != null ? log.bmi : '—'}</td>
                    <td>{log.metabolic_age != null ? `${log.metabolic_age} yrs` : '—'}</td>
                    <td>{log.muscle_mass != null ? `${log.muscle_mass} kg` : '—'}</td>
                    <td>{log.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="progress-report-document__footer">
          {businessSettings.business_name} — Customer Progress Report — {customer.name}
        </footer>
      </div>
    );
  },
);
