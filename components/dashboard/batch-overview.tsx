'use client';

import { BatchOverview as BatchOverviewData, Severity } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface BatchOverviewProps {
  overview: BatchOverviewData;
}

function severityBadgeClass(severity: Severity) {
  switch (severity) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-800';
    case 'WARNING':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-slate-100 text-slate-800';
  }
}

export function BatchOverview({ overview }: BatchOverviewProps) {
  const { batch, latestIndicator, recentRecords, activeAlerts } = overview;

  const bhi = latestIndicator?.bhi;
  const bhiColor =
    bhi == null
      ? 'text-slate-400'
      : bhi >= 85
        ? 'text-green-600'
        : bhi >= 75
          ? 'text-amber-600'
          : 'text-red-600';

  // Build a trend series from recent daily records (oldest -> newest).
  const trendData = [...recentRecords]
    .sort((a, b) => new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime())
    .map((r) => ({
      date: new Date(r.recordDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      temperature: r.temperatureC,
      mortality: r.mortalityCount,
      feed: r.feedIntakeG,
    }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">BHI Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${bhiColor}`}>{bhi?.toFixed(1) ?? '--'}</div>
            <p className="mt-1 text-xs text-slate-600">Brooding Health Index</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Readiness</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">
              {latestIndicator?.readinessScore?.toFixed(1) ?? '--'}
            </div>
            <p className="mt-1 text-xs text-slate-600">Conditioning readiness</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">BSI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">
              {latestIndicator?.bsi != null ? latestIndicator.bsi.toFixed(1) : '--'}
            </div>
            <p className="mt-1 text-xs text-slate-600">Behavioural stress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">WFR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">
              {latestIndicator?.wfr != null ? latestIndicator.wfr.toFixed(2) : '--'}
            </div>
            <p className="mt-1 text-xs text-slate-600">Water:feed ratio</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Population</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{batch.currentPopulation}</div>
            <p className="mt-1 text-xs text-slate-600">of {batch.initialPopulation} placed</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Alerts</CardTitle>
            <CardDescription>Unacknowledged threshold breaches for this batch</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{alert.message}</p>
                  <p className="text-xs text-slate-500">
                    {alert.indicatorType} · {new Date(alert.createdAt).toLocaleString()}
                  </p>
                </div>
                <Badge className={severityBadgeClass(alert.severity)}>{alert.severity}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent record trends */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Trends</CardTitle>
          <CardDescription>Temperature and mortality from recent daily records</CardDescription>
        </CardHeader>
        <CardContent>
          {trendData.length === 0 ? (
            <p className="py-8 text-center text-slate-600">No daily records yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="temperature"
                  name="Temp (°C)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ fill: '#f59e0b' }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="mortality"
                  name="Mortality"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ fill: '#ef4444' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
