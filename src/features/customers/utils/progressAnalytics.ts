import type { Customer, WeightLog } from '@/types/database.types';

export type ChartPoint = {
  date: string;
  label: string;
  value: number;
};

export type MetricChartData = {
  key: string;
  title: string;
  unit: string;
  points: ChartPoint[];
};

export type ProgressSummary = {
  startingWeight: number | null;
  currentWeight: number | null;
  weightChange: number | null;
  bmiChange: number | null;
  latestMetabolicAge: number | null;
  firstBmi: number | null;
  latestBmi: number | null;
};

export type ProgressAnalytics = {
  summary: ProgressSummary;
  charts: MetricChartData[];
};

function formatChartLabel(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
}

function buildSeries(
  logs: WeightLog[],
  key: keyof Pick<
    WeightLog,
    'weight_kg' | 'bmi' | 'body_fat_percentage' | 'visceral_fat' | 'muscle_mass'
  >,
): ChartPoint[] {
  return logs
    .filter((log) => log[key] != null)
    .map((log) => ({
      date: log.recorded_date,
      label: formatChartLabel(log.recorded_date),
      value: Number(log[key]),
    }));
}

function firstLogWithField(
  logs: WeightLog[],
  key: keyof Pick<WeightLog, 'bmi' | 'weight_kg' | 'metabolic_age'>,
): WeightLog | undefined {
  return logs.find((log) => log[key] != null);
}

function lastLogWithField(
  logs: WeightLog[],
  key: keyof Pick<WeightLog, 'bmi' | 'weight_kg' | 'metabolic_age'>,
): WeightLog | undefined {
  for (let index = logs.length - 1; index >= 0; index -= 1) {
    if (logs[index][key] != null) {
      return logs[index];
    }
  }
  return undefined;
}

export function buildProgressAnalytics(logs: WeightLog[], customer: Customer): ProgressAnalytics {
  const firstWeightLog = logs[0];
  const latestWeightLog = logs.length > 0 ? logs[logs.length - 1] : undefined;

  const startingWeight =
    firstWeightLog?.weight_kg ?? customer.starting_weight ?? null;
  const currentWeight =
    latestWeightLog?.weight_kg ?? customer.current_weight ?? null;

  const weightChange =
    startingWeight != null && currentWeight != null
      ? Number(currentWeight) - Number(startingWeight)
      : null;

  const firstBmiLog = firstLogWithField(logs, 'bmi');
  const latestBmiLog = lastLogWithField(logs, 'bmi');
  const firstBmi = firstBmiLog?.bmi ?? null;
  const latestBmi = latestBmiLog?.bmi ?? null;
  const bmiChange =
    firstBmi != null && latestBmi != null ? Number(latestBmi) - Number(firstBmi) : null;

  const latestMetabolicLog = lastLogWithField(logs, 'metabolic_age');
  const latestMetabolicAge = latestMetabolicLog?.metabolic_age ?? null;

  const charts: MetricChartData[] = [
    {
      key: 'weight_kg',
      title: 'Weight Trend',
      unit: 'kg',
      points: buildSeries(logs, 'weight_kg'),
    },
    {
      key: 'bmi',
      title: 'BMI Trend',
      unit: '',
      points: buildSeries(logs, 'bmi'),
    },
    {
      key: 'body_fat_percentage',
      title: 'Body Fat Trend',
      unit: '%',
      points: buildSeries(logs, 'body_fat_percentage'),
    },
    {
      key: 'visceral_fat',
      title: 'Visceral Fat Trend',
      unit: '',
      points: buildSeries(logs, 'visceral_fat'),
    },
    {
      key: 'muscle_mass',
      title: 'Muscle Mass Trend',
      unit: 'kg',
      points: buildSeries(logs, 'muscle_mass'),
    },
  ];

  return {
    summary: {
      startingWeight: startingWeight != null ? Number(startingWeight) : null,
      currentWeight: currentWeight != null ? Number(currentWeight) : null,
      weightChange,
      bmiChange,
      latestMetabolicAge: latestMetabolicAge != null ? Number(latestMetabolicAge) : null,
      firstBmi: firstBmi != null ? Number(firstBmi) : null,
      latestBmi: latestBmi != null ? Number(latestBmi) : null,
    },
    charts,
  };
}
