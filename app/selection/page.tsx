'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/app/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Batch } from '@/lib/types';
import apiClient from '@/lib/api-client';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function SelectionPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const response = await apiClient.get('/batches');
        // Filter for batches in selection status
        setBatches(response.data.filter((b: Batch) => b.status === 'selection'));
      } catch (error) {
        console.error('Failed to fetch batches:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBatches();
  }, []);

  return (
    <DashboardLayout allowedRoles={['manager', 'admin']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Month-5 Selection</h1>
          <p className="mt-2 text-slate-600">
            Make breeding selection decisions based on comprehensive scoring
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : batches.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-slate-600">
                No batches in selection phase yet
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {batches.map((batch) => (
              <Card key={batch.id}>
                <CardHeader>
                  <CardTitle>{batch.name}</CardTitle>
                  <CardDescription>{batch.strain}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-slate-600">Total Birds:</span>
                      <p className="font-semibold">{batch.totalBirds}</p>
                    </div>
                    <div>
                      <span className="text-slate-600">Age:</span>
                      <p className="font-semibold">
                        {Math.floor((Date.now() - new Date(batch.hatchDate).getTime()) / (1000 * 60 * 60 * 24))} days
                      </p>
                    </div>
                  </div>

                  <Link href={`/selection/${batch.id}`}>
                    <Button className="w-full" variant="outline">
                      Start Selection
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
