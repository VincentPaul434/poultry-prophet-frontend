'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/app/dashboard-layout';
import { RangingForm } from '@/components/data-entry/ranging-form';
import { useToast } from '@/hooks/use-toast';

interface RangingPageProps {
  params: Promise<{ batchId: string }>;
}

export default function RangingPage({ params }: RangingPageProps) {
  const { batchId } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const handleSuccess = () => {
    toast({
      title: 'Success',
      description: 'Ranging milestone saved successfully',
    });
  };

  return (
    <DashboardLayout allowedRoles={['handler']}>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Record Ranging Data</h1>
          <p className="mt-2 text-slate-600">
            Log a per-bird weight and conformation milestone
          </p>
        </div>

        <RangingForm batchId={batchId} onSuccess={handleSuccess} />
      </div>
    </DashboardLayout>
  );
}
