import { Button } from '@/components/ui/Button';

type QueryErrorAlertProps = {
  message?: string;
  onRetry?: () => void;
};

export function QueryErrorAlert({
  message = 'Failed to load data. Please try again.',
  onRetry,
}: QueryErrorAlertProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
      <p className="text-sm">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
