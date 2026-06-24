import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartPoint } from '@/features/customers/utils/progressAnalytics';

type ProgressReportPrintChartProps = {
  title: string;
  data: ChartPoint[];
  unit?: string;
  color?: string;
  emptyMessage?: string;
};

const CHART_WIDTH = 320;
const CHART_HEIGHT = 140;

export function ProgressReportPrintChart({
  title,
  data,
  unit,
  color = '#2563eb',
  emptyMessage = 'No data logged yet.',
}: ProgressReportPrintChartProps) {
  return (
    <div className="progress-report-document__chart">
      <h4 className="progress-report-document__chart-title">{title}</h4>
      {data.length === 0 ? (
        <div className="progress-report-document__chart-empty">{emptyMessage}</div>
      ) : (
        <LineChart width={CHART_WIDTH} height={CHART_HEIGHT} data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
          />
          <YAxis
            tick={{ fontSize: 9, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            width={36}
            tickFormatter={(value) => {
              const formatted = Number(value).toLocaleString('en-IN', { maximumFractionDigits: 1 });
              return unit ? `${formatted}${unit === '%' ? '%' : ''}` : formatted;
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={{ r: 2, fill: color }}
            isAnimationActive={false}
          />
        </LineChart>
      )}
    </div>
  );
}
