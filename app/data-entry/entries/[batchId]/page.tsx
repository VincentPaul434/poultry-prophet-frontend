'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/app/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BroodingRecord, RangingRecord } from '@/lib/types';
import apiClient from '@/lib/api-client';
import { Loader2, Trash2, Edit2 } from 'lucide-react';
import Link from 'next/link';

interface EntriesPageProps {
  params: Promise<{ batchId: string }>;
}

export default function EntriesPage({ params: paramsPromise }: EntriesPageProps) {
  const [params, setParams] = useState<{ batchId: string } | null>(null);
  const [broodingRecords, setBroodingRecords] = useState<BroodingRecord[]>([]);
  const [rangingRecords, setRangingRecords] = useState<RangingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    paramsPromise.then(setParams);
  }, [paramsPromise]);

  useEffect(() => {
    if (!params) return;

    const fetchRecords = async () => {
      try {
        const [broodingRes, rangingRes] = await Promise.all([
          apiClient.get(`/batches/${params.batchId}/brooding-records`),
          apiClient.get(`/batches/${params.batchId}/ranging-records`),
        ]);
        setBroodingRecords(broodingRes.data);
        setRangingRecords(rangingRes.data);
      } catch (error) {
        console.error('Failed to fetch records:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [params]);

  if (loading) {
    return (
      <DashboardLayout allowedRoles={['handler']}>
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </DashboardLayout>
    );
  }

  if (!params) return null;

  return (
    <DashboardLayout allowedRoles={['handler']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Entry History</h1>
          <p className="mt-2 text-slate-600">
            View, edit, and manage your recorded data entries
          </p>
        </div>

        <Tabs defaultValue="brooding" className="w-full">
          <TabsList>
            <TabsTrigger value="brooding">
              Brooding ({broodingRecords.length})
            </TabsTrigger>
            <TabsTrigger value="ranging">
              Ranging ({rangingRecords.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="brooding" className="space-y-4">
            {broodingRecords.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-slate-600">
                    No brooding records yet
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {broodingRecords.map((record) => (
                  <Card key={record.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {new Date(record.recordDate).toLocaleDateString()}
                          </CardTitle>
                          <CardDescription>
                            Temp: {record.temperature}°F | Humidity: {record.humidity}% | Mortality: {record.mortalityCount}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm text-slate-600">Ventilation</p>
                        <p className="font-semibold">{record.ventilation}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Mortality Cause</p>
                        <p className="font-semibold">{record.mortalityCause}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Feed Intake</p>
                        <p className="font-semibold">{record.feedIntake} lbs</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Water Intake</p>
                        <p className="font-semibold">{record.waterIntake} gal</p>
                      </div>
                      {record.healthObservations.length > 0 && (
                        <div className="md:col-span-2">
                          <p className="text-sm text-slate-600 mb-2">Health Observations</p>
                          <div className="flex flex-wrap gap-2">
                            {record.healthObservations.map((obs) => (
                              <span key={obs} className="inline-block bg-amber-100 px-3 py-1 rounded-full text-sm">
                                {obs}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ranging" className="space-y-4">
            {rangingRecords.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-slate-600">
                    No ranging records yet
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {rangingRecords.map((record) => (
                  <Card key={record.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {new Date(record.recordDate).toLocaleDateString()}
                          </CardTitle>
                          <CardDescription>
                            Temp: {record.outdoorTemp}°F | Forage: {record.forageConsumption} lbs | Water: {record.waterIntake} gal
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm text-slate-600">Precipitation</p>
                        <p className="font-semibold">{record.precipitation ? 'Yes' : 'No'}</p>
                      </div>
                      {record.predatorsObserved.length > 0 && (
                        <div>
                          <p className="text-sm text-slate-600">Predators Observed</p>
                          <p className="font-semibold">{record.predatorsObserved.join(', ')}</p>
                        </div>
                      )}
                      {record.healthIssues.length > 0 && (
                        <div className="md:col-span-2">
                          <p className="text-sm text-slate-600 mb-2">Health Issues</p>
                          <div className="flex flex-wrap gap-2">
                            {record.healthIssues.map((issue) => (
                              <span key={issue} className="inline-block bg-amber-100 px-3 py-1 rounded-full text-sm">
                                {issue}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Link href="/data-entry">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    </DashboardLayout>
  );
}
