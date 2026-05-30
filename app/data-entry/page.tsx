'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/app/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { batchApi } from '@/lib/api';
import { Batch } from '@/lib/types';
import { Plus, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function DataEntryPage() {
  const { user } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    batchApi
      .list()
      // The backend lists every batch in the farm; a handler only records data
      // for batches they are assigned to.
      .then((all) => setBatches(all.filter((b) => b.handlerUserIds.includes(user.id))))
      .catch((error) => console.error('Failed to fetch batches:', error))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <DashboardLayout allowedRoles={['handler']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Data Entry</h1>
          <p className="mt-2 text-slate-600">
            Record daily observations for your assigned batches
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : batches.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-slate-600">No batches assigned to you yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {batches.map((batch) => {
              const stage = batch.stageName.toLowerCase();
              const isBrooding = stage === 'brooding';
              return (
                <Card key={batch.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle>{batch.name}</CardTitle>
                    <CardDescription>{batch.bloodline || 'Unspecified bloodline'}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-slate-600">Population:</span>
                        <p className="font-semibold">{batch.currentPopulation}</p>
                      </div>
                      <div>
                        <span className="text-slate-600">Stage:</span>
                        <p className="font-semibold capitalize">{batch.stageName}</p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      {isBrooding ? (
                        <Link href={`/data-entry/brooding/${batch.id}`}>
                          <Button variant="outline" className="w-full" size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Record Daily Data
                          </Button>
                        </Link>
                      ) : (
                        <Link href={`/data-entry/ranging/${batch.id}`}>
                          <Button variant="outline" className="w-full" size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Record Ranging Data
                          </Button>
                        </Link>
                      )}
                      <Link href={`/data-entry/entries/${batch.id}`}>
                        <Button variant="ghost" className="w-full" size="sm">
                          View Entries
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
