'use client';

import { Batch, BatchIndicator, BirdIndicator } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface BatchOverviewProps {
  batch: Batch;
  indicator?: BatchIndicator;
  birdIndicators?: BirdIndicator[];
}

// Mock trend data
const mockTrendData = [
  { date: 'Day 1', bhi: 75, mortality: 2, temp: 95 },
  { date: 'Day 5', bhi: 78, mortality: 1, temp: 94 },
  { date: 'Day 10', bhi: 82, mortality: 0.5, temp: 93 },
  { date: 'Day 15', bhi: 85, mortality: 0.2, temp: 92 },
  { date: 'Day 20', bhi: 88, mortality: 0.1, temp: 90 },
];

const mockBirdScoreDistribution = [
  { score: '80-89', count: 15 },
  { score: '90-99', count: 45 },
  { score: '100-109', count: 65 },
  { score: '110-119', count: 55 },
  { score: '120+', count: 20 },
];

const mockIndicatorData = [
  { category: 'Growth', value: 85 },
  { category: 'Health', value: 88 },
  { category: 'Behavior', value: 82 },
  { category: 'Environment', value: 90 },
  { category: 'Feed Intake', value: 87 },
];

export function BatchOverview({ batch, indicator }: BatchOverviewProps) {
  const bhiColor = indicator?.bhi || 0 >= 85 ? 'text-green-600' : indicator?.bhi || 0 >= 75 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">BHI Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${bhiColor}`}>
              {indicator?.bhi?.toFixed(1) || '--'}
            </div>
            <p className="mt-1 text-xs text-slate-600">
              {indicator?.bhi && indicator.bhi >= 85 ? 'Excellent' : indicator?.bhi && indicator.bhi >= 75 ? 'Good' : 'Fair'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Mortality Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">
              {indicator?.mortalityRate?.toFixed(2) || '--'}%
            </div>
            <p className="mt-1 text-xs text-slate-600">Daily average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Avg Temperature</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">
              {indicator?.avgTemp?.toFixed(1) || '--'}°F
            </div>
            <p className="mt-1 text-xs text-slate-600">Current trend</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Feed Intake</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">
              {indicator?.avgFeedIntake?.toFixed(1) || '--'} lbs
            </div>
            <p className="mt-1 text-xs text-slate-600">Per bird daily</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Birds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">
              {batch.totalBirds}
            </div>
            <p className="mt-1 text-xs text-slate-600">In batch</p>
          </CardContent>
        </Card>
      </div>

      {/* BHI Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>BHI Trend</CardTitle>
          <CardDescription>Batch Health Index progression over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mockTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="bhi" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b' }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Indicator Radar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Indicators</CardTitle>
          <CardDescription>Multi-dimensional health assessment</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={mockIndicatorData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="category" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar name="Score" dataKey="value" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Bird Score Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Bird Score Distribution</CardTitle>
          <CardDescription>CRS scores across the flock</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mockBirdScoreDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="score" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
