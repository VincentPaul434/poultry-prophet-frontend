'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/app/dashboard-layout';
import { BroodingForm } from '@/components/data-entry/brooding-form';
import { useToast } from '@/hooks/use-toast';

interface BroodingPageProps {
  params: Promise<{ batchId: string }>;
}

export default function BroodingPage({ params }: BroodingPageProps) {
  const { batchId } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const handleSuccess = () => {
    toast({
      title: 'Success',
      description: 'Daily record saved successfully',
    });
    router.push('/data-entry');
  };

  return (
    <DashboardLayout allowedRoles={['handler']}>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Record Daily Data</h1>
          <p className="mt-2 text-slate-600">
            Enter environmental conditions, mortality and intake
          </p>
        </div>

        <BroodingForm batchId={batchId} onSuccess={handleSuccess} />
      </div>
    </DashboardLayout>
  );
}
