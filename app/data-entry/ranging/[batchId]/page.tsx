'use client';

import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/app/dashboard-layout';
import { RangingForm } from '@/components/data-entry/ranging-form';
import { useToast } from '@/hooks/use-toast';

interface RangingPageProps {
  params: Promise<{ batchId: string }>;
}

export default async function RangingPage({ params }: RangingPageProps) {
  const { batchId } = await params;
  const router = useRouter();
  const { toast } = useToast();

  const handleSuccess = () => {
    toast({
      title: 'Success',
      description: 'Ranging data saved successfully',
    });
    router.push('/data-entry');
  };

  return (
    <DashboardLayout allowedRoles={['handler']}>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Record Ranging Data</h1>
          <p className="mt-2 text-slate-600">
            Enter outdoor conditions and health observations
          </p>
        </div>

        <RangingForm batchId={batchId} onSuccess={handleSuccess} />
      </div>
    </DashboardLayout>
  );
}
