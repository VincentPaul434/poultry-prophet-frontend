"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCreateRecord, useRecords } from "@/hooks/use-records";
import { useBatch } from "@/hooks/use-batches";
import { ApiError } from "@/lib/api-client";
import { formatDate, todayIso } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function DataEntryPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = use(params);
  const { data: batch } = useBatch(batchId);
  const { data: records } = useRecords(batchId, 14);
  const createRecord = useCreateRecord(batchId);

  const [form, setForm] = useState({
    recordDate: todayIso(),
    temperatureC: "",
    mortalityCount: "0",
    feedIntakeG: "",
    waterIntakeMl: "",
    behaviorNotes: "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createRecord.mutateAsync({
        recordDate: form.recordDate || null,
        temperatureC: Number(form.temperatureC),
        mortalityCount: Number(form.mortalityCount),
        feedIntakeG: Number(form.feedIntakeG),
        waterIntakeMl: Number(form.waterIntakeMl),
        behaviorNotes: form.behaviorNotes || null,
      });
      toast.success("Daily record logged");
      setForm((f) => ({
        ...f,
        temperatureC: "",
        mortalityCount: "0",
        feedIntakeG: "",
        waterIntakeMl: "",
        behaviorNotes: "",
      }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save record");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2 text-muted-foreground"
          render={<Link href={`/batches/${batchId}`} />}
        >
          <ArrowLeft className="size-4" /> Back to batch
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Daily record</h1>
        <p className="text-sm text-muted-foreground">
          {batch ? batch.name : "Batch"} — log today&apos;s brooding/ranging observations.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New entry</CardTitle>
            <CardDescription>Submitting recomputes indicators and alerts.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recordDate">Date</Label>
                <Input
                  id="recordDate"
                  type="date"
                  value={form.recordDate}
                  onChange={(e) => set("recordDate", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="temperatureC">Temperature °C</Label>
                  <Input
                    id="temperatureC"
                    type="number"
                    step="0.1"
                    min={0}
                    max={60}
                    required
                    value={form.temperatureC}
                    onChange={(e) => set("temperatureC", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mortalityCount">Mortality count</Label>
                  <Input
                    id="mortalityCount"
                    type="number"
                    min={0}
                    required
                    value={form.mortalityCount}
                    onChange={(e) => set("mortalityCount", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="feedIntakeG">Feed intake (g)</Label>
                  <Input
                    id="feedIntakeG"
                    type="number"
                    step="0.1"
                    min={0}
                    required
                    value={form.feedIntakeG}
                    onChange={(e) => set("feedIntakeG", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="waterIntakeMl">Water intake (ml)</Label>
                  <Input
                    id="waterIntakeMl"
                    type="number"
                    step="0.1"
                    min={0}
                    required
                    value={form.waterIntakeMl}
                    onChange={(e) => set("waterIntakeMl", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="behaviorNotes">Behaviour notes</Label>
                <Textarea
                  id="behaviorNotes"
                  rows={3}
                  value={form.behaviorNotes}
                  onChange={(e) => set("behaviorNotes", e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={createRecord.isPending}>
                {createRecord.isPending && <Loader2 className="size-4 animate-spin" />}
                Save record
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent entries</CardTitle>
            <CardDescription>Latest {records?.length ?? 0} records</CardDescription>
          </CardHeader>
          <CardContent>
            {!records || records.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No records yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Temp</TableHead>
                    <TableHead className="text-right">Mort.</TableHead>
                    <TableHead className="text-right">Feed</TableHead>
                    <TableHead className="text-right">Water</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{formatDate(r.recordDate)}</TableCell>
                      <TableCell className="text-right">{r.temperatureC}</TableCell>
                      <TableCell className="text-right">{r.mortalityCount}</TableCell>
                      <TableCell className="text-right">{r.feedIntakeG}</TableCell>
                      <TableCell className="text-right">{r.waterIntakeMl}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
