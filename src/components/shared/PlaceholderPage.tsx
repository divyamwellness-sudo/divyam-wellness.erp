import { PageHeader } from '@/components/layout/PageHeader';

type PlaceholderPageProps = {
  title: string;
  description: string;
  phase: string;
};

export function PlaceholderPage({ title, description, phase }: PlaceholderPageProps) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <p className="text-sm font-medium text-slate-900">{phase}</p>
        <p className="mt-2 text-sm text-slate-500">This module will be implemented in a future phase.</p>
      </div>
    </div>
  );
}
