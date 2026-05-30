'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Settings } from 'lucide-react';
import { ScoringWeights } from '@/lib/types';
import apiClient from '@/lib/api-client';

interface WeightsAdjusterProps {
  batchId: string;
  currentWeights: ScoringWeights;
  onWeightsChanged?: (weights: ScoringWeights) => void;
}

export function WeightsAdjuster({ batchId, currentWeights, onWeightsChanged }: WeightsAdjusterProps) {
  const [open, setOpen] = useState(false);
  const [weights, setWeights] = useState<ScoringWeights>(currentWeights);
  const [loading, setLoading] = useState(false);

  const total = weights.bhiWeight + weights.growthWeight + weights.healthWeight + weights.behavioralWeight;
  
  const normalizedWeights = {
    bhiWeight: (weights.bhiWeight / total * 100).toFixed(1),
    growthWeight: (weights.growthWeight / total * 100).toFixed(1),
    healthWeight: (weights.healthWeight / total * 100).toFixed(1),
    behavioralWeight: (weights.behavioralWeight / total * 100).toFixed(1),
  };

  const handleWeightChange = (key: keyof ScoringWeights, value: number) => {
    setWeights(prev => ({
      ...prev,
      [key]: Math.max(0, Math.min(100, value)),
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await apiClient.put(`/batches/${batchId}/scoring-weights`, weights);
      onWeightsChanged?.(weights);
      setOpen(false);
    } catch (error) {
      console.error('Failed to save weights:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setWeights(currentWeights);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings className="h-4 w-4" />
          Adjust Weights
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Scoring Weights</DialogTitle>
          <DialogDescription>
            Adjust the relative importance of each scoring factor (values normalized to 100%)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* BHI Weight */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>BHI Weight</Label>
              <span className="text-sm font-semibold text-slate-900">{normalizedWeights.bhiWeight}%</span>
            </div>
            <div className="flex items-center gap-3">
              <Slider
                value={[weights.bhiWeight]}
                onValueChange={(value) => handleWeightChange('bhiWeight', value[0])}
                min={0}
                max={100}
                step={1}
                className="flex-1"
              />
              <Input
                type="number"
                value={weights.bhiWeight}
                onChange={(e) => handleWeightChange('bhiWeight', parseInt(e.target.value) || 0)}
                className="w-16 text-sm"
              />
            </div>
          </div>

          {/* Growth Weight */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Growth Weight</Label>
              <span className="text-sm font-semibold text-slate-900">{normalizedWeights.growthWeight}%</span>
            </div>
            <div className="flex items-center gap-3">
              <Slider
                value={[weights.growthWeight]}
                onValueChange={(value) => handleWeightChange('growthWeight', value[0])}
                min={0}
                max={100}
                step={1}
                className="flex-1"
              />
              <Input
                type="number"
                value={weights.growthWeight}
                onChange={(e) => handleWeightChange('growthWeight', parseInt(e.target.value) || 0)}
                className="w-16 text-sm"
              />
            </div>
          </div>

          {/* Health Weight */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Health Weight</Label>
              <span className="text-sm font-semibold text-slate-900">{normalizedWeights.healthWeight}%</span>
            </div>
            <div className="flex items-center gap-3">
              <Slider
                value={[weights.healthWeight]}
                onValueChange={(value) => handleWeightChange('healthWeight', value[0])}
                min={0}
                max={100}
                step={1}
                className="flex-1"
              />
              <Input
                type="number"
                value={weights.healthWeight}
                onChange={(e) => handleWeightChange('healthWeight', parseInt(e.target.value) || 0)}
                className="w-16 text-sm"
              />
            </div>
          </div>

          {/* Behavioral Weight */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Behavioral Weight</Label>
              <span className="text-sm font-semibold text-slate-900">{normalizedWeights.behavioralWeight}%</span>
            </div>
            <div className="flex items-center gap-3">
              <Slider
                value={[weights.behavioralWeight]}
                onValueChange={(value) => handleWeightChange('behavioralWeight', value[0])}
                min={0}
                max={100}
                step={1}
                className="flex-1"
              />
              <Input
                type="number"
                value={weights.behavioralWeight}
                onChange={(e) => handleWeightChange('behavioralWeight', parseInt(e.target.value) || 0)}
                className="w-16 text-sm"
              />
            </div>
          </div>

          {/* Summary Card */}
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="pt-4">
              <p className="text-xs text-slate-600 mb-2">Normalized Distribution</p>
              <div className="flex h-2 gap-1 rounded overflow-hidden bg-slate-200">
                <div 
                  className="bg-blue-500" 
                  style={{ width: `${normalizedWeights.bhiWeight}%` }}
                  title={`BHI: ${normalizedWeights.bhiWeight}%`}
                />
                <div 
                  className="bg-green-500" 
                  style={{ width: `${normalizedWeights.growthWeight}%` }}
                  title={`Growth: ${normalizedWeights.growthWeight}%`}
                />
                <div 
                  className="bg-amber-500" 
                  style={{ width: `${normalizedWeights.healthWeight}%` }}
                  title={`Health: ${normalizedWeights.healthWeight}%`}
                />
                <div 
                  className="bg-red-500" 
                  style={{ width: `${normalizedWeights.behavioralWeight}%` }}
                  title={`Behavioral: ${normalizedWeights.behavioralWeight}%`}
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={handleReset} disabled={loading}>
              Reset to Current
            </Button>
            <Button onClick={handleSave} disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Weights'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
