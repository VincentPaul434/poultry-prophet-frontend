"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, FlaskConical, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { RouteGuard } from "@/components/route-guard";
import { PageBackLink } from "@/components/page-back-link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useBatches } from "@/hooks/use-batches";
import { useGenerateTestBatch, useTestLabStatus } from "@/hooks/use-test-lab";
import { ApiError } from "@/lib/api-client";
import type { GenerateTestBatchResponse, TestLabProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function TestLabPage() {
  const status = useTestLabStatus();
  const { data: batches, isLoading: batchesLoading } = useBatches();
  const generate = useGenerateTestBatch();
  const [sourceBatchId, setSourceBatchId] = useState("");
  const [profile, setProfile] = useState<TestLabProfile>("REALISTIC");
  const [result, setResult] = useState<GenerateTestBatchResponse | null>(null);

  const sources = useMemo(
    () => (batches ?? []).filter((batch) =>
      batch.status === "ACTIVE"
      && !batch.name.startsWith("[TEST COPY]")
      && batch.initialPopulation >= 20),
    [batches]
  );
  const selectedSourceBatchId = sourceBatchId || (sources[0] ? String(sources[0].id) : "");

  async function createTestCopy() {
    if (!selectedSourceBatchId) {
      toast.error("Choose a source batch first.");
      return;
    }
    try {
      const created = await generate.mutateAsync({
        sourceBatchId: Number(selectedSourceBatchId),
        profile,
        confirmation: "CREATE_TEST_COPY",
      });
      setResult(created);
      toast.success(profile === "ANALYTICS_PACK" ? "Analytics test pack is ready." : "100-day test batch is ready.");
    } catch (error) {
      const message = error instanceof ApiError
        && profile === "ANALYTICS_PACK"
        && error.status === 400
        && error.message === "Bad Request"
        ? "The backend is not updated for Analytics Pack yet. Restart or redeploy it, then refresh this page."
        : error instanceof ApiError
          ? error.message
          : "Test batch could not be generated.";
      toast.error(message);
    }
  }

  return (
    <RouteGuard managerOnly>
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <PageBackLink destination="dashboard" />

        <header className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FlaskConical className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Local Test Lab</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gumawa ng 100-day test copy in one step. Hindi mababago ang original batch.
            </p>
          </div>
        </header>

        {status.isLoading && (
          <div className="flex min-h-32 items-center justify-center rounded-xl border">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Checking Test Lab" />
          </div>
        )}

        {status.data && !status.data.enabled && (
          <Alert variant="destructive">
            <ShieldCheck aria-hidden="true" />
            <AlertTitle>Test Lab is locked</AlertTitle>
            <AlertDescription>{status.data.message}</AlertDescription>
          </Alert>
        )}

        {status.isError && (
          <Alert variant="destructive">
            <AlertTitle>Test Lab is unavailable</AlertTitle>
            <AlertDescription>Make sure you are signed in as manager and the local backend is running.</AlertDescription>
          </Alert>
        )}

        {status.data?.enabled && (
          <Card className="shadow-none">
            <CardHeader className="p-4 pb-2 sm:p-5 sm:pb-2">
              <CardTitle className="text-lg">Generate test batch</CardTitle>
              <CardDescription>Uses your current local database and login. No extra test account is needed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-2 sm:p-5 sm:pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="test-source">Source batch</Label>
                <NativeSelect
                  id="test-source"
                  value={selectedSourceBatchId}
                  onChange={(event) => setSourceBatchId(event.target.value)}
                  disabled={batchesLoading || generate.isPending}
                >
                  {sources.length === 0 && <option value="">No eligible batch</option>}
                  {sources.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.name} · {batch.currentPopulation}/{batch.initialPopulation}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">Data pattern</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  <ProfileButton
                    active={profile === "REALISTIC"}
                    title="Realistic"
                    detail="9 observation days; best for consultation"
                    onClick={() => setProfile("REALISTIC")}
                  />
                  <ProfileButton
                    active={profile === "DAILY_COVERAGE"}
                    title="Every day"
                    detail="100 observation days; best for chart testing"
                    onClick={() => setProfile("DAILY_COVERAGE")}
                  />
                                  <ProfileButton
                    active={profile === "ANALYTICS_PACK"}
                    title="Analytics pack"
                    detail="Daily history plus hatch and task cases"
                    onClick={() => setProfile("ANALYTICS_PACK")}
                  />
                </div>
              </fieldset>

              <div className="rounded-xl border border-success-border bg-success-muted px-3 py-2 text-sm text-success">
                <span className="font-semibold">Safe copy:</span> the system creates a new `[TEST COPY]` batch and keeps the selected batch unchanged.
              </div>

              <Button
                type="button"
                className="h-12 w-full text-base"
                disabled={!selectedSourceBatchId || sources.length === 0 || generate.isPending}
                onClick={createTestCopy}
              >
                {generate.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FlaskConical aria-hidden="true" />}
                {generate.isPending ? "Generating records…" : profile === "ANALYTICS_PACK" ? "Generate analytics test pack" : "Generate 100-day test batch"}
              </Button>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card className="border-success-border bg-success-muted/60 shadow-none">
            <CardContent className="space-y-3 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-bold text-success">Test batch ready</p>
                  <p className="mt-1 break-words text-sm text-success">{result.batchName}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <ResultFact label="Population" value={`${result.finalPopulation}/${result.initialPopulation}`} />
                <ResultFact label="Events" value={result.eventCount} />
                <ResultFact label="Observations" value={result.observationCount} />
                <ResultFact label="Reports" value={result.reportCount} />
              </div>
              <Button render={<Link href={`/batches/${result.batchId}`} />} className="h-11 w-full sm:w-auto">
                Open test batch <ArrowRight aria-hidden="true" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </RouteGuard>
  );
}

function ProfileButton({
  active,
  title,
  detail,
  onClick,
}: {
  active: boolean;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-20 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
        active ? "border-primary bg-primary/10" : "bg-background hover:border-primary/40"
      )}
    >
      <span className="block font-semibold">{title}</span>
      <span className="mt-1 block text-xs text-muted-foreground">{detail}</span>
    </button>
  );
}

function ResultFact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-success-border bg-background/80 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-bold tabular-nums">{value}</p>
    </div>
  );
}
