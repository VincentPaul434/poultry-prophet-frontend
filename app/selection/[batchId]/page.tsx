'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/app/dashboard-layout';
import { RankingTable, BirdRanking } from '@/components/selection/ranking-table';
import { WeightsAdjuster } from '@/components/selection/weights-adjuster';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Batch, ScoringWeights, RankingData } from '@/lib/types';
import apiClient from '@/lib/api-client';
import { Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

interface SelectionDetailPageProps {
  params: Promise<{ batchId: string }>;
}

// Mock default weights
const DEFAULT_WEIGHTS: ScoringWeights = {
  bhiWeight: 25,
  growthWeight: 30,
  healthWeight: 25,
  behavioralWeight: 20,
};

export default function SelectionDetailPage({ params: paramsPromise }: SelectionDetailPageProps) {
  const { toast } = useToast();
  const [params, setParams] = useState<{ batchId: string } | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [birds, setBirds] = useState<BirdRanking[]>([]);
  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_WEIGHTS);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    paramsPromise.then(setParams);
  }, [paramsPromise]);

  useEffect(() => {
    if (!params) return;

    const fetchData = async () => {
      try {
        const [batchRes, rankingRes, weightsRes] = await Promise.all([
          apiClient.get(`/batches/${params.batchId}`),
          apiClient.get(`/batches/${params.batchId}/ranking`),
          apiClient.get(`/batches/${params.batchId}/scoring-weights`).catch(() => ({ data: DEFAULT_WEIGHTS })),
        ]);
        setBatch(batchRes.data);
        setBirds(rankingRes.data.birds || []);
        setWeights(weightsRes.data);
      } catch (error) {
        console.error('Failed to fetch selection data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load ranking data',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params, toast]);

  const handleDecisionChange = async (birdId: string, decision: 'advance' | 'hold' | 'reject') => {
    if (!params) return;

    setBirds(prev =>
      prev.map(b =>
        b.id === birdId ? { ...b, decision } : b
      )
    );

    try {
      await apiClient.post(`/batches/${params.batchId}/selection-decisions`, {
        birdId,
        decision,
      });
    } catch (error) {
      console.error('Failed to save decision:', error);
      toast({
        title: 'Error',
        description: 'Failed to save decision',
        variant: 'destructive',
      });
    }
  };

  const handleWeightsChanged = (newWeights: ScoringWeights) => {
    setWeights(newWeights);
    toast({
      title: 'Weights Updated',
      description: 'Rankings will be recomputed with new weights',
    });
  };

  const handleFinalize = async () => {
    if (!params) return;

    setSubmitting(true);
    try {
      await apiClient.post(`/batches/${params.batchId}/selection/finalize`, {
        decisions: birds.map(b => ({
          birdId: b.id,
          decision: b.decision,
          overrideReason: b.overrideReason,
        })),
      });
      toast({
        title: 'Selection Finalized',
        description: 'Breeding decisions have been saved',
      });
    } catch (error) {
      console.error('Failed to finalize selection:', error);
      toast({
        title: 'Error',
        description: 'Failed to finalize selection',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

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

  const advanceCount = birds.filter(b => b.decision === 'advance').length;
  const holdCount = birds.filter(b => b.decision === 'hold').length;
  const rejectCount = birds.filter(b => b.decision === 'reject').length;
  const pendingCount = birds.filter(b => !b.decision).length;

  return (
    <DashboardLayout allowedRoles={['manager', 'admin']}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/selection">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Month-5 Selection</h1>
              <p className="mt-1 text-slate-600">{batch.name} · {birds.length} birds to evaluate</p>
            </div>
          </div>
          <WeightsAdjuster batchId={batch.id} currentWeights={weights} onWeightsChanged={handleWeightsChanged} />
        </div>

        {/* Decision Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Advance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{advanceCount}</div>
              <p className="mt-1 text-xs text-slate-600">For breeding</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Hold</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{holdCount}</div>
              <p className="mt-1 text-xs text-slate-600">For evaluation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Reject</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{rejectCount}</div>
              <p className="mt-1 text-xs text-slate-600">Culled</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-600">{pendingCount}</div>
              <p className="mt-1 text-xs text-slate-600">No decision</p>
            </CardContent>
          </Card>
        </div>

        {/* Ranking Table */}
        <RankingTable
          batchId={batch.id}
          birds={birds}
          onDecisionChange={handleDecisionChange}
          cutLinePosition={Math.floor(advanceCount + holdCount / 2)}
        />

        {/* Finalize Button */}
        <div className="flex justify-end">
          <Button
            size="lg"
            onClick={handleFinalize}
            disabled={submitting || pendingCount > 0}
            className="gap-2"
          >
            <CheckCircle2 className="h-5 w-5" />
            {submitting ? 'Finalizing...' : `Finalize Selection (${pendingCount} pending)`}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
