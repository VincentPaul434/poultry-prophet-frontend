'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronUp, ChevronDown } from 'lucide-react';

export interface BirdRanking {
  id: string;
  bandId: string;
  crs: number;
  growthScore: number;
  healthScore: number;
  behavioralScore: number;
  weightTrend: number;
  decision: 'advance' | 'hold' | 'reject' | null;
  overrideReason?: string;
}

interface RankingTableProps {
  batchId: string;
  birds: BirdRanking[];
  onDecisionChange?: (birdId: string, decision: 'advance' | 'hold' | 'reject') => void;
  cutLinePosition?: number;
}

type SortKey = 'crs' | 'bandId' | 'growthScore' | 'healthScore' | 'behavioralScore';

export function RankingTable({ birds, onDecisionChange, cutLinePosition = Math.floor(birds.length * 0.5) }: RankingTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('crs');
  const [sortDesc, setSortDesc] = useState(true);
  const [filterDecision, setFilterDecision] = useState<'all' | 'advance' | 'hold' | 'reject'>('all');
  const [searchBandId, setSearchBandId] = useState('');

  const sortedAndFiltered = useMemo(() => {
    let result = [...birds];

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const comparison = typeof aVal === 'number' && typeof bVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal));
      return sortDesc ? -comparison : comparison;
    });

    // Filter by decision
    if (filterDecision !== 'all') {
      result = result.filter(b => b.decision === filterDecision);
    }

    // Filter by band ID
    if (searchBandId) {
      result = result.filter(b => b.bandId.toLowerCase().includes(searchBandId.toLowerCase()));
    }

    return result;
  }, [birds, sortKey, sortDesc, filterDecision, searchBandId]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDesc ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />;
  };

  const getDecisionColor = (decision: 'advance' | 'hold' | 'reject' | null) => {
    switch (decision) {
      case 'advance':
        return 'bg-green-100 text-green-800';
      case 'hold':
        return 'bg-amber-100 text-amber-800';
      case 'reject':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 100) return 'text-green-600';
    if (score >= 90) return 'text-amber-600';
    return 'text-slate-600';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bird Rankings</CardTitle>
        <CardDescription>Comprehensive Ranking Score (CRS) - Higher is better for breeding selection</CardDescription>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
          <Input
            placeholder="Search band ID..."
            value={searchBandId}
            onChange={(e) => setSearchBandId(e.target.value)}
            className="md:w-48"
          />
          <div className="flex gap-2">
            {(['all', 'advance', 'hold', 'reject'] as const).map((decision) => (
              <Button
                key={decision}
                variant={filterDecision === decision ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterDecision(decision)}
                className="capitalize"
              >
                {decision}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Rank</th>
                <th 
                  className="px-4 py-3 text-left font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 flex items-center gap-1"
                  onClick={() => toggleSort('bandId')}
                >
                  Band ID {getSortIcon('bandId')}
                </th>
                <th 
                  className="px-4 py-3 text-right font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 flex items-center justify-end gap-1"
                  onClick={() => toggleSort('crs')}
                >
                  CRS {getSortIcon('crs')}
                </th>
                <th 
                  className="px-4 py-3 text-right font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 flex items-center justify-end gap-1"
                  onClick={() => toggleSort('growthScore')}
                >
                  Growth {getSortIcon('growthScore')}
                </th>
                <th 
                  className="px-4 py-3 text-right font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 flex items-center justify-end gap-1"
                  onClick={() => toggleSort('healthScore')}
                >
                  Health {getSortIcon('healthScore')}
                </th>
                <th 
                  className="px-4 py-3 text-right font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 flex items-center justify-end gap-1"
                  onClick={() => toggleSort('behavioralScore')}
                >
                  Behavior {getSortIcon('behavioralScore')}
                </th>
                <th className="px-4 py-3 text-center font-semibold text-slate-700">Decision</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedAndFiltered.map((bird, idx) => (
                <tr key={bird.id} className={idx === cutLinePosition ? 'border-t-4 border-red-400 bg-red-50' : 'border-b border-slate-100'}>
                  <td className="px-4 py-3 font-semibold text-slate-900">#{idx + 1}</td>
                  <td className="px-4 py-3 text-slate-900">{bird.bandId}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${getScoreColor(bird.crs)}`}>
                    {bird.crs.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{bird.growthScore.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{bird.healthScore.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{bird.behavioralScore.toFixed(1)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={getDecisionColor(bird.decision)}>
                      {bird.decision || 'Pending'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-1">
                      <Button
                        size="sm"
                        variant={bird.decision === 'advance' ? 'default' : 'outline'}
                        className="h-7 w-16 text-xs"
                        onClick={() => onDecisionChange?.(bird.id, 'advance')}
                      >
                        Adv
                      </Button>
                      <Button
                        size="sm"
                        variant={bird.decision === 'hold' ? 'default' : 'outline'}
                        className="h-7 w-12 text-xs"
                        onClick={() => onDecisionChange?.(bird.id, 'hold')}
                      >
                        Hld
                      </Button>
                      <Button
                        size="sm"
                        variant={bird.decision === 'reject' ? 'default' : 'outline'}
                        className="h-7 w-16 text-xs"
                        onClick={() => onDecisionChange?.(bird.id, 'reject')}
                      >
                        Rej
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {sortedAndFiltered.length === 0 && (
            <div className="py-8 text-center text-slate-600">
              No birds match your filters
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
          <div className="text-sm text-slate-600">
            Showing {sortedAndFiltered.length} of {birds.length} birds
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-green-100" />
              <span>Advance: {birds.filter(b => b.decision === 'advance').length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-amber-100" />
              <span>Hold: {birds.filter(b => b.decision === 'hold').length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-red-100" />
              <span>Reject: {birds.filter(b => b.decision === 'reject').length}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
