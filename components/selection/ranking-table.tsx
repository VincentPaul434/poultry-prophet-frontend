'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { SelectionRow } from '@/lib/types';

interface RankingTableProps {
  rows: SelectionRow[];
  cutLineCrs: number;
  onDecide: (row: SelectionRow, advance: boolean) => void;
  pendingBirdId?: number | null;
}

type SortKey = 'crs' | 'bandNumber' | 'growthScore' | 'healthHistoryScore' | 'behaviouralScore';

function decisionBadge(row: SelectionRow) {
  if (!row.decision) return { label: 'Pending', cls: 'bg-slate-100 text-slate-800' };
  const advanced = row.decision.outcome === 'ADVANCE' || row.decision.outcome === 'ADVANCED';
  return advanced
    ? { label: row.decision.overridden ? 'Advance (override)' : 'Advance', cls: 'bg-green-100 text-green-800' }
    : { label: row.decision.overridden ? 'Reject (override)' : 'Reject', cls: 'bg-red-100 text-red-800' };
}

export function RankingTable({ rows, cutLineCrs, onDecide, pendingBirdId }: RankingTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('crs');
  const [sortDesc, setSortDesc] = useState(true);
  const [search, setSearch] = useState('');

  const sortedAndFiltered = useMemo(() => {
    let result = [...rows];
    result.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const comparison =
        typeof aVal === 'number' && typeof bVal === 'number'
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
      return sortDesc ? -comparison : comparison;
    });
    if (search) {
      result = result.filter((r) => r.bandNumber.toLowerCase().includes(search.toLowerCase()));
    }
    return result;
  }, [rows, sortKey, sortDesc, search]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDesc ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />;
  };

  const scoreColor = (score: number) =>
    score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-slate-600';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bird Rankings</CardTitle>
        <CardDescription>
          Conditioning Readiness Score (CRS) — higher is better. Suggested advancement cut-line at CRS{' '}
          {cutLineCrs.toFixed(1)}.
        </CardDescription>
        <div className="mt-4">
          <Input
            placeholder="Search band number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="md:w-64"
          />
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-3 text-left font-semibold text-slate-700">Rank</th>
                <th
                  className="cursor-pointer px-3 py-3 text-left font-semibold text-slate-700 hover:bg-slate-100"
                  onClick={() => toggleSort('bandNumber')}
                >
                  <span className="flex items-center gap-1">Band {sortIcon('bandNumber')}</span>
                </th>
                <th
                  className="cursor-pointer px-3 py-3 text-right font-semibold text-slate-700 hover:bg-slate-100"
                  onClick={() => toggleSort('crs')}
                >
                  <span className="flex items-center justify-end gap-1">CRS {sortIcon('crs')}</span>
                </th>
                <th className="px-3 py-3 text-right font-semibold text-slate-700">BHI</th>
                <th
                  className="cursor-pointer px-3 py-3 text-right font-semibold text-slate-700 hover:bg-slate-100"
                  onClick={() => toggleSort('growthScore')}
                >
                  <span className="flex items-center justify-end gap-1">Growth {sortIcon('growthScore')}</span>
                </th>
                <th
                  className="cursor-pointer px-3 py-3 text-right font-semibold text-slate-700 hover:bg-slate-100"
                  onClick={() => toggleSort('healthHistoryScore')}
                >
                  <span className="flex items-center justify-end gap-1">Health {sortIcon('healthHistoryScore')}</span>
                </th>
                <th
                  className="cursor-pointer px-3 py-3 text-right font-semibold text-slate-700 hover:bg-slate-100"
                  onClick={() => toggleSort('behaviouralScore')}
                >
                  <span className="flex items-center justify-end gap-1">Behaviour {sortIcon('behaviouralScore')}</span>
                </th>
                <th className="px-3 py-3 text-center font-semibold text-slate-700">Recommended</th>
                <th className="px-3 py-3 text-center font-semibold text-slate-700">Decision</th>
                <th className="px-3 py-3 text-center font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedAndFiltered.map((row) => {
                const badge = decisionBadge(row);
                const advanced =
                  row.decision &&
                  (row.decision.outcome === 'ADVANCE' || row.decision.outcome === 'ADVANCED');
                const busy = pendingBirdId === row.birdId;
                const belowCut = row.crs < cutLineCrs;
                return (
                  <tr
                    key={row.birdId}
                    className={belowCut ? 'border-b border-slate-100 bg-red-50/40' : 'border-b border-slate-100'}
                  >
                    <td className="px-3 py-3 font-semibold text-slate-900">#{row.rank}</td>
                    <td className="px-3 py-3 text-slate-900">{row.bandNumber}</td>
                    <td className={`px-3 py-3 text-right font-semibold ${scoreColor(row.crs)}`}>
                      {row.crs.toFixed(1)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-600">{row.broodingHealthIndex.toFixed(1)}</td>
                    <td className="px-3 py-3 text-right text-slate-600">{row.growthScore.toFixed(1)}</td>
                    <td className="px-3 py-3 text-right text-slate-600">{row.healthHistoryScore.toFixed(1)}</td>
                    <td className="px-3 py-3 text-right text-slate-600">{row.behaviouralScore.toFixed(1)}</td>
                    <td className="px-3 py-3 text-center">
                      <Badge
                        className={
                          row.recommendedAdvance
                            ? 'bg-green-50 text-green-700'
                            : 'bg-slate-50 text-slate-600'
                        }
                      >
                        {row.recommendedAdvance ? 'Advance' : 'Reject'}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Badge className={badge.cls}>{badge.label}</Badge>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        <Button
                          size="sm"
                          variant={advanced ? 'default' : 'outline'}
                          className="h-7 w-16 text-xs"
                          disabled={busy}
                          onClick={() => onDecide(row, true)}
                        >
                          Advance
                        </Button>
                        <Button
                          size="sm"
                          variant={row.decision && !advanced ? 'default' : 'outline'}
                          className="h-7 w-16 text-xs"
                          disabled={busy}
                          onClick={() => onDecide(row, false)}
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {sortedAndFiltered.length === 0 && (
            <div className="py-8 text-center text-slate-600">No ranked birds for this batch yet</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
