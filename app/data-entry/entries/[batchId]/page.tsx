'use client';

import { use, useState, useEffect } from 'react';
import { DashboardLayout } from '@/app/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DailyRecord, RangingRecord } from '@/lib/types';
import { recordApi, birdApi, rangingApi } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

interface EntriesPageProps {
  params: Promise<{ batchId: string }>;
}

interface RangingEntry extends RangingRecord {
  bandNumber: string;
}

export default function EntriesPage({ params }: EntriesPageProps) {
  const { batchId } = use(params);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [rangingEntries, setRangingEntries] = useState<RangingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const [records, birds] = await Promise.all([
          recordApi.recent(batchId, 60),
          birdApi.list(batchId),
        ]);
        setDailyRecords(records);

        // Ranging milestones are stored per bird; gather and flatten them.
        const perBird = await Promise.all(
          birds.map((bird) =>
            rangingApi
              .list(batchId, bird.id)
              .then((rows) => rows.map((r) => ({ ...r, bandNumber: bird.bandNumber })))
              .catch(() => [] as RangingEntry[])
          )
        );
        setRangingEntries(
          perBird
            .flat()
            .sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime())
        );
      } catch (error) {
        console.error('Failed to fetch records:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [batchId]);

  if (loading) {
    return (
      <DashboardLayout allowedRoles={['handler']}>
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout allowedRoles={['handler']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Entry History</h1>
          <p className="mt-2 text-slate-600">View your recorded data entries</p>
        </div>

        <Tabs defaultValue="daily" className="w-full">
          <TabsList>
            <TabsTrigger value="daily">Daily ({dailyRecords.length})</TabsTrigger>
            <TabsTrigger value="ranging">Ranging ({rangingEntries.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="space-y-4">
            {dailyRecords.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-slate-600">No daily records yet</p>
                </CardContent>
              </Card>
            ) : (
              dailyRecords.map((record) => (
                <Card key={record.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {new Date(record.recordDate).toLocaleDateString()}
                        </CardTitle>
                        <CardDescription>
                          Temp: {record.temperatureC}°C · Mortality: {record.mortalityCount}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">{record.syncStatus}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm text-slate-600">Feed Intake</p>
                      <p className="font-semibold">{record.feedIntakeG} g</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Water Intake</p>
                      <p className="font-semibold">{record.waterIntakeMl} mL</p>
                    </div>
                    {record.behaviorNotes && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-slate-600">Behaviour Notes</p>
                        <p className="font-medium">{record.behaviorNotes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="ranging" className="space-y-4">
            {rangingEntries.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-slate-600">No ranging milestones yet</p>
                </CardContent>
              </Card>
            ) : (
              rangingEntries.map((record) => (
                <Card key={record.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">Band {record.bandNumber}</CardTitle>
                        <CardDescription>
                          {new Date(record.recordDate).toLocaleDateString()} · {record.weightG} g
                        </CardDescription>
                      </div>
                      <Badge>{record.qualityRating.replace(/_PLUS/g, '+')}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm text-slate-600">Health Event</p>
                      <p className="font-semibold">{record.healthEvent ?? 'NONE'}</p>
                    </div>
                    {record.temperamentNotes && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-slate-600">Temperament Notes</p>
                        <p className="font-medium">{record.temperamentNotes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>

        <Link href="/data-entry">
          <Button variant="outline">Back to Data Entry</Button>
        </Link>
      </div>
    </DashboardLayout>
  );
}
