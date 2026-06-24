import { NavLink } from 'react-router-dom';
import { Leaf, LogOut, X } from 'lucide-react';
import { APP_NAME } from '@/config/branding';
import { navigation } from '@/config/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/format';

type SidebarProps = {
  mobileOpen?: boolean;
  onNavigate?: () => void;
};

export function Sidebar({ mobileOpen = false, onNavigate }: SidebarProps) {
  const { signOut, profile, businessSettings } = useAuth();

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:relative lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}
    >
          <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-5">
        {businessSettings?.logo_url ? (
          <img
            src={businessSettings.logo_url}
            alt=""
            className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-0.5"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Leaf className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">
            {businessSettings?.business_name ?? ''}
          </p>
          <p className="truncate text-xs text-slate-500">{APP_NAME}</p>
        </div>
        <button
          type="button"
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden"
          aria-label="Close menu"
          onClick={onNavigate}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navigation.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2">
          <p className="truncate text-sm font-medium text-slate-900">
            {profile?.full_name || 'Admin'}
          </p>
          <p className="truncate text-xs text-slate-500">Administrator</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => void signOut()}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
