'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { BarChart3, Database, ListChecks } from 'lucide-react';

export function Navigation() {
  const { user } = useAuth();
  const pathname = usePathname();

  const handlerNavItems = [
    { label: 'Data Entry', href: '/data-entry', icon: Database },
  ];

  const managerNavItems = [
    { label: 'Dashboard', href: '/dashboard', icon: BarChart3 },
    { label: 'Selection', href: '/selection', icon: ListChecks },
  ];

  const navItems = user?.role === 'handler' ? handlerNavItems : managerNavItems;

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="flex gap-1 px-4 sm:px-6">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 border-b-2 px-3 py-4 text-sm font-medium transition-colors',
                isActive
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
