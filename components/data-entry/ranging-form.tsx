'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { birdApi, rangingApi } from '@/lib/api';
import { Bird, HealthEventSeverity, QualityRating } from '@/lib/types';
import { AlertCircle, Loader2, Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Mirrors backend CreateRangingRecordRequest (per-bird ranging milestone).
const rangingSchema = z.object({
  recordDate: z.string().optional(),
  weightG: z.coerce.number().min(0),
  healthEvent: z
    .enum(['NONE', 'ROUTINE', 'MINOR', 'MODERATE', 'MAJOR'])
    .optional(),
  temperamentNotes: z.string().optional(),
  qualityRating: z.enum(['C', 'B', 'B_PLUS', 'A', 'A_PLUS', 'A_PLUS_PLUS']),
});

type RangingFormData = z.infer<typeof rangingSchema>;

interface RangingFormProps {
  batchId: string;
  onSuccess?: () => void;
}

const QUALITY_OPTIONS: { value: QualityRating; label: string }[] = [
  { value: 'C', label: 'C' },
  { value: 'B', label: 'B' },
  { value: 'B_PLUS', label: 'B+' },
  { value: 'A', label: 'A' },
  { value: 'A_PLUS', label: 'A+' },
  { value: 'A_PLUS_PLUS', label: 'A++' },
];

const HEALTH_OPTIONS: { value: HealthEventSeverity; label: string }[] = [
  { value: 'NONE', label: 'None' },
  { value: 'ROUTINE', label: 'Routine' },
  { value: 'MINOR', label: 'Minor' },
  { value: 'MODERATE', label: 'Moderate' },
  { value: 'MAJOR', label: 'Major' },
];

const selectClass =
  'flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-base placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50';

export function RangingForm({ batchId, onSuccess }: RangingFormProps) {
  const [birds, setBirds] = useState<Bird[]>([]);
  const [selectedBirdId, setSelectedBirdId] = useState<string>('');
  const [newBandNumber, setNewBandNumber] = useState('');
  const [banding, setBanding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RangingFormData>({
    resolver: zodResolver(rangingSchema),
    defaultValues: {
      recordDate: new Date().toISOString().slice(0, 10),
      qualityRating: 'B',
      healthEvent: 'NONE',
    },
  });

  useEffect(() => {
    birdApi
      .list(batchId)
      .then((list) => {
        setBirds(list);
        if (list.length > 0) setSelectedBirdId(String(list[0].id));
      })
      .catch((err) => console.error('Failed to fetch birds:', err));
  }, [batchId]);

  const handleBandBird = async () => {
    if (!newBandNumber.trim()) return;
    setBanding(true);
    setError(null);
    try {
      const bird = await birdApi.band(batchId, { bandNumber: newBandNumber.trim() });
      setBirds((prev) => [...prev, bird]);
      setSelectedBirdId(String(bird.id));
      setNewBandNumber('');
    } catch (err) {
      setError('Failed to band bird');
      console.error(err);
    } finally {
      setBanding(false);
    }
  };

  const onSubmit = async (data: RangingFormData) => {
    if (!selectedBirdId) {
      setError('Select or band a bird first');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await rangingApi.create(batchId, selectedBirdId, {
        recordDate: data.recordDate || undefined,
        weightG: data.weightG,
        healthEvent: data.healthEvent,
        temperamentNotes: data.temperamentNotes || undefined,
        qualityRating: data.qualityRating,
      });
      reset({
        recordDate: new Date().toISOString().slice(0, 10),
        qualityRating: 'B',
        healthEvent: 'NONE',
      });
      onSuccess?.();
    } catch (err) {
      setError('Failed to save ranging record');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ranging Milestone</CardTitle>
        <CardDescription>Per-bird weight, health and conformation for a ranging milestone</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Bird selection */}
          <div className="space-y-2">
            <Label htmlFor="bird">Bird</Label>
            <select
              id="bird"
              value={selectedBirdId}
              onChange={(e) => setSelectedBirdId(e.target.value)}
              className={selectClass}
            >
              {birds.length === 0 && <option value="">No birds banded yet</option>}
              {birds.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bandNumber}
                </option>
              ))}
            </select>
            <div className="flex gap-2 pt-1">
              <Input
                placeholder="New band number"
                value={newBandNumber}
                onChange={(e) => setNewBandNumber(e.target.value)}
              />
              <Button type="button" variant="outline" onClick={handleBandBird} disabled={banding}>
                {banding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Band
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recordDate">Record Date</Label>
              <Input id="recordDate" type="date" {...register('recordDate')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weightG">Weight (g)</Label>
              <Input id="weightG" type="number" step="1" min="0" placeholder="700" {...register('weightG')} />
              {errors.weightG && <p className="text-sm text-red-500">{errors.weightG.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="qualityRating">Conformation Grade</Label>
              <select id="qualityRating" {...register('qualityRating')} className={selectClass}>
                {QUALITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="healthEvent">Health Event</Label>
              <select id="healthEvent" {...register('healthEvent')} className={selectClass}>
                {HEALTH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="temperamentNotes">Temperament Notes</Label>
            <Textarea
              id="temperamentNotes"
              placeholder="Behavioural / temperament observations"
              {...register('temperamentNotes')}
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={loading || !selectedBirdId}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Milestone'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
