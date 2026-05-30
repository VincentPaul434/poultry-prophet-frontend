'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/app/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Batch } from '@/lib/types';
import { batchApi } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

function daysSince(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

export default function DashboardPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    batchApi
      .list()
      .then(setBatches)
      .catch((error) => console.error('Failed to fetch batches:', error))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout allowedRoles={['manager', 'admin']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-2 text-slate-600">
            Monitor batch performance and health indicators
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : batches.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-slate-600">No batches to display</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {batches.map((batch) => (
              <Card key={batch.id}>
                <CardHeader>
                  <CardTitle>{batch.name}</CardTitle>
                  <CardDescription>{batch.bloodline || 'Unspecified bloodline'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-slate-600">Population:</span>
                      <p className="font-semibold">{batch.currentPopulation}</p>
                    </div>
                    <div>
                      <span className="text-slate-600">Stage:</span>
                      <p className="font-semibold capitalize">{batch.stageName}</p>
                    </div>
                    <div>
                      <span className="text-slate-600">Age:</span>
                      <p className="font-semibold">{daysSince(batch.startDate)} days</p>
                    </div>
                    <div>
                      <span className="text-slate-600">Status:</span>
                      <p className="font-semibold capitalize">{batch.status.toLowerCase()}</p>
                    </div>
                  </div>

                  <Link href={`/dashboard/${batch.id}`}>
                    <Button className="w-full" variant="outline">
                      View Batch Analytics
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
