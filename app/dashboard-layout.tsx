'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { Header } from '@/components/shared/header';
import { Navigation } from '@/components/shared/navigation';

interface DashboardLayoutProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function DashboardLayout({ children, allowedRoles }: DashboardLayoutProps) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Header />
        <Navigation />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}
