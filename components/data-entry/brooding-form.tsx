'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import apiClient from '@/lib/api-client';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const broodingSchema = z.object({
  temperature: z.coerce.number().min(32).max(45),
  humidity: z.coerce.number().min(0).max(100),
  ventilation: z.string().min(1),
  mortalityCount: z.coerce.number().min(0),
  mortalityCause: z.string(),
  feedIntake: z.coerce.number().min(0),
  waterIntake: z.coerce.number().min(0),
  healthObservations: z.array(z.string()).default([]),
});

type BroodingFormData = z.infer<typeof broodingSchema>;

interface BroodingFormProps {
  batchId: string;
  onSuccess?: () => void;
}

const HEALTH_OPTIONS = [
  'Lameness',
  'Respiratory Issues',
  'Ascites',
  'Splayed Legs',
  'Weak Birds',
  'None',
];

const VENTILATION_OPTIONS = ['Poor', 'Fair', 'Good', 'Excellent'];
const MORTALITY_CAUSES = ['Disease', 'Culls', 'Natural', 'Unknown'];

export function BroodingForm({ batchId, onSuccess }: BroodingFormProps) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
  } = useForm<BroodingFormData>({
    resolver: zodResolver(broodingSchema),
    defaultValues: {
      healthObservations: [],
    },
  });

  const healthObservations = watch('healthObservations');

  const toggleHealth = (option: string) => {
    const current = healthObservations || [];
    const updated = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
    setValue('healthObservations', updated);
  };

  const onSubmit = async (data: BroodingFormData) => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.post(`/batches/${batchId}/brooding-records`, {
        ...data,
        recordDate: new Date().toISOString(),
      });
      onSuccess?.();
    } catch (err) {
      setError('Failed to save brooding data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Brooding Data Entry</CardTitle>
        <CardDescription>Step {step} of 4 - Environmental & Health Conditions</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Step 1: Environment */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperature (°F)</Label>
                  <Input
                    id="temperature"
                    type="number"
                    step="0.1"
                    placeholder="95"
                    {...register('temperature')}
                  />
                  {errors.temperature && (
                    <p className="text-sm text-red-500">{errors.temperature.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="humidity">Humidity (%)</Label>
                  <Input
                    id="humidity"
                    type="number"
                    step="1"
                    placeholder="65"
                    {...register('humidity')}
                  />
                  {errors.humidity && (
                    <p className="text-sm text-red-500">{errors.humidity.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ventilation">Ventilation</Label>
                <select
                  id="ventilation"
                  {...register('ventilation')}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-base placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select ventilation level</option>
                  {VENTILATION_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                {errors.ventilation && (
                  <p className="text-sm text-red-500">{errors.ventilation.message}</p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Mortality */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mortalityCount">Mortality Count</Label>
                  <Input
                    id="mortalityCount"
                    type="number"
                    placeholder="0"
                    {...register('mortalityCount')}
                  />
                  {errors.mortalityCount && (
                    <p className="text-sm text-red-500">{errors.mortalityCount.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mortalityCause">Cause</Label>
                  <select
                    id="mortalityCause"
                    {...register('mortalityCause')}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-base placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select cause</option>
                    {MORTALITY_CAUSES.map((cause) => (
                      <option key={cause} value={cause}>
                        {cause}
                      </option>
                    ))}
                  </select>
                  {errors.mortalityCause && (
                    <p className="text-sm text-red-500">{errors.mortalityCause.message}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Intake */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="feedIntake">Feed Intake (lbs/day)</Label>
                  <Input
                    id="feedIntake"
                    type="number"
                    step="0.1"
                    placeholder="0"
                    {...register('feedIntake')}
                  />
                  {errors.feedIntake && (
                    <p className="text-sm text-red-500">{errors.feedIntake.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="waterIntake">Water Intake (gal/day)</Label>
                  <Input
                    id="waterIntake"
                    type="number"
                    step="0.1"
                    placeholder="0"
                    {...register('waterIntake')}
                  />
                  {errors.waterIntake && (
                    <p className="text-sm text-red-500">{errors.waterIntake.message}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Health */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <Label>Observed Health Conditions</Label>
                <div className="mt-3 space-y-3">
                  {HEALTH_OPTIONS.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        id={option}
                        checked={healthObservations?.includes(option) || false}
                        onCheckedChange={() => toggleHealth(option)}
                      />
                      <Label htmlFor={option} className="font-normal cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between gap-3 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1 || loading}
            >
              Previous
            </Button>

            {step < 4 ? (
              <Button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={loading}
              >
                Next
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Entry'
                )}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
