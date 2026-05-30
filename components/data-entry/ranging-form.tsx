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
import apiClient from '@/lib/api-client';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const rangingSchema = z.object({
  outdoorTemp: z.coerce.number(),
  precipitation: z.boolean().default(false),
  predatorsObserved: z.array(z.string()).default([]),
  forageConsumption: z.coerce.number().min(0),
  waterIntake: z.coerce.number().min(0),
  healthIssues: z.array(z.string()).default([]),
  predatorLosses: z.array(z.object({
    species: z.string(),
    count: z.coerce.number().min(0),
    notes: z.string().optional(),
  })).default([]),
});

type RangingFormData = z.infer<typeof rangingSchema>;

interface RangingFormProps {
  batchId: string;
  onSuccess?: () => void;
}

const PREDATOR_OPTIONS = ['Hawk', 'Fox', 'Raccoon', 'Snake', 'Dog', 'Other'];
const HEALTH_ISSUES = ['Injuries', 'Behavioral Issues', 'Parasites', 'Respiratory', 'None'];

export function RangingForm({ batchId, onSuccess }: RangingFormProps) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
  } = useForm<RangingFormData>({
    resolver: zodResolver(rangingSchema),
  });

  const predatorsObserved = watch('predatorsObserved');
  const healthIssues = watch('healthIssues');
  const predatorLosses = watch('predatorLosses');

  const togglePredator = (option: string) => {
    const current = predatorsObserved || [];
    const updated = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
    setValue('predatorsObserved', updated);
  };

  const toggleHealthIssue = (option: string) => {
    const current = healthIssues || [];
    const updated = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
    setValue('healthIssues', updated);
  };

  const onSubmit = async (data: RangingFormData) => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.post(`/batches/${batchId}/ranging-records`, {
        ...data,
        recordDate: new Date().toISOString(),
      });
      onSuccess?.();
    } catch (err) {
      setError('Failed to save ranging data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ranging Data Entry</CardTitle>
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
                  <Label htmlFor="outdoorTemp">Outdoor Temperature (°F)</Label>
                  <Input
                    id="outdoorTemp"
                    type="number"
                    step="0.1"
                    placeholder="75"
                    {...register('outdoorTemp')}
                  />
                  {errors.outdoorTemp && (
                    <p className="text-sm text-red-500">{errors.outdoorTemp.message}</p>
                  )}
                </div>

                <div className="flex items-end">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="precipitation"
                      {...register('precipitation')}
                    />
                    <Label htmlFor="precipitation" className="font-normal cursor-pointer">
                      Precipitation occurred
                    </Label>
                  </div>
                </div>
              </div>

              <div>
                <Label>Predators Observed</Label>
                <div className="mt-3 space-y-3">
                  {PREDATOR_OPTIONS.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        id={`predator-${option}`}
                        checked={predatorsObserved?.includes(option) || false}
                        onCheckedChange={() => togglePredator(option)}
                      />
                      <Label htmlFor={`predator-${option}`} className="font-normal cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Intake */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="forageConsumption">Forage Consumption (lbs/day)</Label>
                  <Input
                    id="forageConsumption"
                    type="number"
                    step="0.1"
                    placeholder="0"
                    {...register('forageConsumption')}
                  />
                  {errors.forageConsumption && (
                    <p className="text-sm text-red-500">{errors.forageConsumption.message}</p>
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

          {/* Step 3: Health Issues */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <Label>Health Issues Observed</Label>
                <div className="mt-3 space-y-3">
                  {HEALTH_ISSUES.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        id={`health-${option}`}
                        checked={healthIssues?.includes(option) || false}
                        onCheckedChange={() => toggleHealthIssue(option)}
                      />
                      <Label htmlFor={`health-${option}`} className="font-normal cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Predator Losses */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <Label>Predator Losses Details</Label>
                <p className="mt-1 text-sm text-slate-600">
                  Only fill if predators were observed above
                </p>
                <div className="mt-4 space-y-4">
                  {predatorLosses && predatorLosses.length > 0 ? (
                    predatorLosses.map((loss, idx) => (
                      <Card key={idx} className="p-4">
                        <div className="space-y-3">
                          <div className="grid gap-2 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor={`species-${idx}`}>Species</Label>
                              <Input
                                id={`species-${idx}`}
                                placeholder="e.g., Hawk"
                                {...register(`predatorLosses.${idx}.species`)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`count-${idx}`}>Count</Label>
                              <Input
                                id={`count-${idx}`}
                                type="number"
                                min="0"
                                {...register(`predatorLosses.${idx}.count`)}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`notes-${idx}`}>Notes</Label>
                            <Input
                              id={`notes-${idx}`}
                              placeholder="Any details about the incident"
                              {...register(`predatorLosses.${idx}.notes`)}
                            />
                          </div>
                        </div>
                      </Card>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No predator losses recorded</p>
                  )}
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
