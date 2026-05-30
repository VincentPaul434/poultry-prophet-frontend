'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/app/dashboard-layout';
import { BatchOverview } from '@/components/dashboard/batch-overview';
import { Card, CardContent } from '@/components/ui/card';
import { Batch, BatchIndicator } from '@/lib/types';
import apiClient from '@/lib/api-client';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface BatchDetailPageProps {
  params: Promise<{ batchId: string }>;
}

export default function BatchDetailPage({ params: paramsPromise }: BatchDetailPageProps) {
  const [params, setParams] = useState<{ batchId: string } | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [indicator, setIndicator] = useState<BatchIndicator | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    paramsPromise.then(setParams);
  }, [paramsPromise]);

  useEffect(() => {
    if (!params) return;

    const fetchData = async () => {
      try {
        const [batchRes, indicatorRes] = await Promise.all([
          apiClient.get(`/batches/${params.batchId}`),
          apiClient.get(`/batches/${params.batchId}/indicators`),
        ]);
        setBatch(batchRes.data);
        setIndicator(indicatorRes.data);
      } catch (error) {
        console.error('Failed to fetch batch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params]);

  if (loading) {
    return (
      <DashboardLayout allowedRoles={['manager', 'admin']}>
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </DashboardLayout>
    );
  }

  if (!batch || !params) {
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

  const daysOld = Math.floor((Date.now() - new Date(batch.hatchDate).getTime()) / (1000 * 60 * 60 * 24));

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
            <p className="mt-1 text-slate-600">{batch.strain} · {daysOld} days old · Status: {batch.status}</p>
          </div>
        </div>

        <BatchOverview batch={batch} indicator={indicator || undefined} />
      </div>
    </DashboardLayout>
  );
}
