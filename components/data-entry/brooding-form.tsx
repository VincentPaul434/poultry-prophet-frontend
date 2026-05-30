'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { recordApi } from '@/lib/api';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Mirrors backend CreateRecordRequest (DailyRecordController).
const recordSchema = z.object({
  recordDate: z.string().optional(),
  temperatureC: z.coerce.number().min(0).max(60),
  mortalityCount: z.coerce.number().int().min(0),
  feedIntakeG: z.coerce.number().min(0),
  waterIntakeMl: z.coerce.number().min(0),
  behaviorNotes: z.string().optional(),
});

type RecordFormData = z.infer<typeof recordSchema>;

interface BroodingFormProps {
  batchId: string;
  onSuccess?: () => void;
}

export function BroodingForm({ batchId, onSuccess }: BroodingFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RecordFormData>({
    resolver: zodResolver(recordSchema),
    defaultValues: {
      recordDate: new Date().toISOString().slice(0, 10),
    },
  });

  const onSubmit = async (data: RecordFormData) => {
    setLoading(true);
    setError(null);
    try {
      await recordApi.create(batchId, {
        recordDate: data.recordDate || undefined,
        temperatureC: data.temperatureC,
        mortalityCount: data.mortalityCount,
        feedIntakeG: data.feedIntakeG,
        waterIntakeMl: data.waterIntakeMl,
        behaviorNotes: data.behaviorNotes || undefined,
      });
      onSuccess?.();
    } catch (err) {
      setError('Failed to save daily record');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Record</CardTitle>
        <CardDescription>Environmental, mortality and intake observations for the batch</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recordDate">Record Date</Label>
              <Input id="recordDate" type="date" {...register('recordDate')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="temperatureC">Temperature (°C)</Label>
              <Input id="temperatureC" type="number" step="0.1" placeholder="33" {...register('temperatureC')} />
              {errors.temperatureC && (
                <p className="text-sm text-red-500">{errors.temperatureC.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="mortalityCount">Mortality Count</Label>
              <Input id="mortalityCount" type="number" min="0" placeholder="0" {...register('mortalityCount')} />
              {errors.mortalityCount && (
                <p className="text-sm text-red-500">{errors.mortalityCount.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedIntakeG">Feed Intake (g)</Label>
              <Input id="feedIntakeG" type="number" step="0.1" min="0" placeholder="0" {...register('feedIntakeG')} />
              {errors.feedIntakeG && (
                <p className="text-sm text-red-500">{errors.feedIntakeG.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="waterIntakeMl">Water Intake (mL)</Label>
              <Input id="waterIntakeMl" type="number" step="0.1" min="0" placeholder="0" {...register('waterIntakeMl')} />
              {errors.waterIntakeMl && (
                <p className="text-sm text-red-500">{errors.waterIntakeMl.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="behaviorNotes">Behaviour Notes</Label>
            <Textarea
              id="behaviorNotes"
              placeholder="Any notable behaviour, health or environment observations"
              {...register('behaviorNotes')}
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Record'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
