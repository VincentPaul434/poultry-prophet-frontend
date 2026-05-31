"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useBatches, useCreateBatch } from "@/hooks/use-batches";
import { useLifecycleStages } from "@/hooks/use-reference";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { formatDate, todayIso } from "@/lib/format";
import type { Batch } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PendingInvitesBanner } from "@/components/pending-invites-banner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function DashboardPage() {
  const { isManager } = useAuth();
  const { data: batches, isLoading, isError, error } = useBatches();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PendingInvitesBanner />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Batches</h1>
          <p className="text-sm text-muted-foreground">
            Your farm&apos;s active game fowl batches.
          </p>
        </div>
        {isManager && <CreateBatchDialog />}
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">
            {error instanceof ApiError ? error.message : "Failed to load batches."}
          </CardContent>
        </Card>
      )}

      {batches && batches.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No batches yet.{" "}
            {isManager ? "Create your first batch to get started." : "Ask your manager to create one."}
          </CardContent>
        </Card>
      )}

      {batches && batches.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {batches.map((batch) => (
            <BatchCard key={batch.id} batch={batch} />
          ))}
        </div>
      )}
    </div>
  );
}

function BatchCard({ batch }: { batch: Batch }) {
  return (
    <Link href={`/batches/${batch.id}`} className="group">
      <Card className="h-full transition-colors group-hover:border-primary/40">
        <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
          <CardTitle className="text-base">{batch.name}</CardTitle>
          <Badge variant={batch.status === "ACTIVE" ? "default" : "secondary"}>
            {batch.status}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Stage</span>
            <span className="font-medium capitalize">{batch.stageName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Population</span>
            <span className="font-medium">
              {batch.currentPopulation} / {batch.initialPopulation}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Started</span>
            <span className="font-medium">{formatDate(batch.startDate)}</span>
          </div>
          <div className="flex items-center justify-end pt-1 text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Open <ArrowRight className="ml-1 size-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function CreateBatchDialog() {
  const [open, setOpen] = useState(false);
  const { data: stages } = useLifecycleStages();
  const createBatch = useCreateBatch();

  const [name, setName] = useState("");
  const [initialPopulation, setInitialPopulation] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [stageId, setStageId] = useState<string>("");
  const [bloodline, setBloodline] = useState("");
  const [source, setSource] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createBatch.mutateAsync({
        name,
        initialPopulation: Number(initialPopulation),
        startDate,
        stageId: Number(stageId),
        bloodline: bloodline || null,
        source: source || null,
      });
      toast.success("Batch created");
      setOpen(false);
      setName("");
      setInitialPopulation("");
      setBloodline("");
      setSource("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create batch");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" /> New batch
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>New batch</DialogTitle>
            <DialogDescription>
              Register a new game fowl batch for your farm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pop">Initial population</Label>
                <Input
                  id="pop"
                  type="number"
                  min={1}
                  required
                  value={initialPopulation}
                  onChange={(e) => setInitialPopulation(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start">Start date</Label>
                <Input
                  id="start"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stage">Lifecycle stage</Label>
              <Select value={stageId} onValueChange={(v) => setStageId(v ?? "")}>
                <SelectTrigger id="stage" className="w-full">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages?.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)} className="capitalize">
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bloodline">Bloodline</Label>
                <Input id="bloodline" value={bloodline} onChange={(e) => setBloodline(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Input id="source" value={source} onChange={(e) => setSource(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createBatch.isPending || !stageId}>
              {createBatch.isPending && <Loader2 className="size-4 animate-spin" />}
              Create batch
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
