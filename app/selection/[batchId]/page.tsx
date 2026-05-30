'use client';

import { use, useState, useEffect } from 'react';
import { DashboardLayout } from '@/app/dashboard-layout';
import { RankingTable } from '@/components/selection/ranking-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SelectionRow, SelectionView } from '@/lib/types';
import { selectionApi } from '@/lib/api';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

interface SelectionDetailPageProps {
  params: Promise<{ batchId: string }>;
}

interface OverrideState {
  row: SelectionRow;
  advance: boolean;
  reason: string;
}

function isAdvanced(row: SelectionRow) {
  return row.decision?.outcome === 'ADVANCE' || row.decision?.outcome === 'ADVANCED';
}

export default function SelectionDetailPage({ params }: SelectionDetailPageProps) {
  const { batchId } = use(params);
  const { toast } = useToast();
  const [view, setView] = useState<SelectionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingBirdId, setPendingBirdId] = useState<number | null>(null);
  const [override, setOverride] = useState<OverrideState | null>(null);

  useEffect(() => {
    selectionApi
      .view(batchId)
      .then(setView)
      .catch((error) => {
        console.error('Failed to fetch selection view:', error);
        toast({ title: 'Error', description: 'Failed to load ranking data', variant: 'destructive' });
      })
      .finally(() => setLoading(false));
  }, [batchId, toast]);

  const applyUpdatedRow = (updated: SelectionRow) => {
    setView((prev) =>
      prev ? { ...prev, rows: prev.rows.map((r) => (r.birdId === updated.birdId ? updated : r)) } : prev
    );
  };

  const saveDecision = async (birdId: number, advance: boolean, reason?: string) => {
    setPendingBirdId(birdId);
    try {
      const updated = await selectionApi.decide(batchId, birdId, { advance, reason });
      applyUpdatedRow(updated);
      toast({ title: 'Decision saved', description: `Bird ${updated.bandNumber} recorded.` });
    } catch (error) {
      console.error('Failed to save decision:', error);
      toast({ title: 'Error', description: 'Failed to save decision', variant: 'destructive' });
    } finally {
      setPendingBirdId(null);
    }
  };

  const handleDecide = (row: SelectionRow, advance: boolean) => {
    // The backend requires a reason whenever the manager overrides the recommendation.
    if (advance !== row.recommendedAdvance) {
      setOverride({ row, advance, reason: '' });
      return;
    }
    saveDecision(row.birdId, advance);
  };

  const confirmOverride = async () => {
    if (!override) return;
    if (!override.reason.trim()) return;
    await saveDecision(override.row.birdId, override.advance, override.reason.trim());
    setOverride(null);
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

  if (!view) {
    return (
      <DashboardLayout allowedRoles={['manager', 'admin']}>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-slate-600">Selection data not available</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const advanceCount = view.rows.filter(isAdvanced).length;
  const decidedCount = view.rows.filter((r) => r.decision != null).length;
  const pendingCount = view.rows.length - decidedCount;

  return (
    <DashboardLayout allowedRoles={['manager', 'admin']}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/selection">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Month-5 Selection</h1>
            <p className="mt-1 text-slate-600">{view.rows.length} birds ranked by readiness</p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Advancing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{advanceCount}</div>
              <p className="mt-1 text-xs text-slate-600">Confirmed for breeding</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Decided</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{decidedCount}</div>
              <p className="mt-1 text-xs text-slate-600">of {view.rows.length} birds</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{pendingCount}</div>
              <p className="mt-1 text-xs text-slate-600">Awaiting decision</p>
            </CardContent>
          </Card>
        </div>

        <RankingTable
          rows={view.rows}
          cutLineCrs={view.cutLineCrs}
          onDecide={handleDecide}
          pendingBirdId={pendingBirdId}
        />
      </div>

      {/* Override reason dialog */}
      <Dialog open={override != null} onOpenChange={(open) => !open && setOverride(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override recommendation</DialogTitle>
            <DialogDescription>
              {override && (
                <>
                  Bird {override.row.bandNumber} is recommended to{' '}
                  <strong>{override.row.recommendedAdvance ? 'advance' : 'reject'}</strong>. You are choosing
                  to <strong>{override.advance ? 'advance' : 'reject'}</strong> it. A reason is required.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="override-reason">Reason</Label>
            <Textarea
              id="override-reason"
              value={override?.reason ?? ''}
              onChange={(e) => setOverride((prev) => (prev ? { ...prev, reason: e.target.value } : prev))}
              placeholder="Explain why you are overriding the system recommendation"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverride(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmOverride}
              disabled={!override?.reason.trim() || pendingBirdId != null}
            >
              {pendingBirdId != null ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
