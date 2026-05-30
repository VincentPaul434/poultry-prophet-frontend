'use client';

import { use, useState, useEffect } from 'react';
import { DashboardLayout } from '@/app/dashboard-layout';
import { BatchOverview } from '@/components/dashboard/batch-overview';
import { Card, CardContent } from '@/components/ui/card';
import { BatchOverview as BatchOverviewData } from '@/lib/types';
import { batchApi } from '@/lib/api';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface BatchDetailPageProps {
  params: Promise<{ batchId: string }>;
}

export default function BatchDetailPage({ params }: BatchDetailPageProps) {
  const { batchId } = use(params);
  const [data, setData] = useState<BatchOverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    batchApi
      .overview(batchId)
      .then(setData)
      .catch((error) => console.error('Failed to fetch batch overview:', error))
      .finally(() => setLoading(false));
  }, [batchId]);

  if (loading) {
    return (
      <DashboardLayout allowedRoles={['manager', 'admin']}>
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout allowedRoles={['manager', 'admin']}>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-slate-600">Batch not found</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const { batch } = data;
  const daysOld = Math.floor(
    (Date.now() - new Date(batch.startDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <DashboardLayout allowedRoles={['manager', 'admin']}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{batch.name}</h1>
            <p className="mt-1 text-slate-600 capitalize">
              {batch.bloodline || 'Unspecified'} · {daysOld} days old · Stage: {batch.stageName}
            </p>
          </div>
        </div>

        <BatchOverview overview={data} />
      </div>
    </DashboardLayout>
  );
}
