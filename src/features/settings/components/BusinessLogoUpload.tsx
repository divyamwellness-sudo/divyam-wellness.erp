import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImageIcon, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { uploadBusinessLogo } from '@/features/settings/services/settings.service';

type BusinessLogoUploadProps = {
  settingsId: string;
  logoUrl: string | null;
};

export function BusinessLogoUpload({ settingsId, logoUrl }: BusinessLogoUploadProps) {
  const queryClient = useQueryClient();
  const { refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadBusinessLogo(settingsId, file),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['businessSettings'] }),
        refreshProfile(),
      ]);
      setErrorMessage(null);
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to upload logo.');
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setErrorMessage(null);
    uploadMutation.mutate(file);
  };

  return (
    <div className="md:col-span-2 space-y-3">
      <div>
        <p className="text-sm font-medium text-slate-700">Business Logo</p>
        <p className="mt-1 text-xs text-slate-500">
          PNG, JPG, JPEG, or WEBP. Max 5 MB. Shown on invoices and in the sidebar.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Business logo"
            className="h-[72px] w-[72px] rounded-lg border border-slate-200 bg-white object-contain p-1"
          />
        ) : (
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400">
            <ImageIcon className="h-8 w-8" aria-hidden="true" />
          </div>
        )}

        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            isLoading={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Upload Logo
          </Button>
        </div>
      </div>

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
    </div>
  );
}
