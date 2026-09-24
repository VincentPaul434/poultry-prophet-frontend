"use client";

import { useMemo, useState } from "react";
import { Clock3, Loader2, Package, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useBatches } from "@/hooks/use-batches";
import { useCreateFarmInput, useFarmInputs } from "@/hooks/use-operations";
import { useLocalDraft } from "@/hooks/use-local-draft";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/components/locale-provider";
import { ApiError } from "@/lib/api-client";
import type { FarmInputLog, InputProductType } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRODUCT_TYPES: { value: InputProductType; label: string }[] = [
  { value: "FEED", label: "Feed" },
  { value: "VITAMIN", label: "Vitamin" },
  { value: "MEDICINE", label: "Medicine" },
  { value: "VACCINE", label: "Vaccine" },
  { value: "OTHER", label: "Other" },
];

const UNITS = ["packs", "sachets", "kg", "liters", "bottles", "Other"];
const selectClass = "h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function localDateTimeNow() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function InputsPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const { data: batches } = useBatches();
  const { data: logs, isLoading } = useFarmInputs();
  const create = useCreateFarmInput();
  const [filterBatch, setFilterBatch] = useState("all");
  const [filterType, setFilterType] = useState<"ALL" | InputProductType>("ALL");
  const [formError, setFormError] = useState("");
  const [lastSaved, setLastSaved] = useState("");
  const initialDraft = useMemo(() => ({ batchId: "", productType: "FEED" as InputProductType, brandName: "", productName: "", quantity: "", unit: "", purpose: "", notes: "", recordedAt: localDateTimeNow() }), []);
  const draft = useLocalDraft(user ? `pp_draft:inputs:${user.userId}:${user.farmId ?? "none"}` : null, initialDraft);
  const { batchId, productType, brandName, productName, quantity, unit, purpose, notes, recordedAt } = draft.value;

  const batchNames = useMemo(() => new Map((batches ?? []).map((batch) => [batch.id, batch.name])), [batches]);
  const recentProducts = useMemo(() => {
    const seen = new Set<string>();
    return (logs ?? []).filter((log) => {
      const key = `${log.productType}:${log.brandName}:${log.productName ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return log.productType === productType;
    }).slice(0, 5);
  }, [logs, productType]);
  const visibleLogs = (logs ?? []).filter((log) => {
    const batchMatches = filterBatch === "all"
      || (filterBatch === "farm" && log.batchId == null)
      || String(log.batchId) === filterBatch;
    return batchMatches && (filterType === "ALL" || log.productType === filterType);
  });

  function applyRecentProduct(log: FarmInputLog) {
    draft.setValue((current) => ({
      ...current,
      productType: log.productType,
      brandName: log.brandName,
      productName: log.productName ?? "",
      unit: log.unit ?? "",
      purpose: log.purpose ?? "",
    }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    if (!batchId) return setFormError("Select the batch that received this product.");
    if (!brandName.trim()) return setFormError("Enter the product or brand name.");
    if ((productType === "MEDICINE" || productType === "VACCINE") && !purpose.trim()) return setFormError("Add the purpose for this medicine or vaccine.");
    if (quantity && (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0)) return setFormError("Quantity must be greater than zero, or leave it blank.");

    try {
      await create.mutateAsync({
        batchId: Number(batchId),
        recordedAt: recordedAt ? new Date(recordedAt).toISOString() : null,
        productType,
        brandName: brandName.trim(),
        productName: productName.trim() || null,
        quantity: quantity ? Number(quantity) : null,
        unit: unit.trim() || null,
        purpose: purpose.trim() || null,
        notes: notes.trim() || null,
      });
      toast.success("Saved product record");
      setLastSaved(`${brandName.trim()} was recorded for ${batchNames.get(Number(batchId)) ?? "the selected batch"}.`);
      draft.clearDraft();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Could not save the product record.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Package className="size-6" aria-hidden="true" /></div>
          <div><h1 className="text-3xl font-bold tracking-tight">{t("inputs.title")}</h1><p className="text-sm text-muted-foreground">{t("inputs.description")}</p></div>
        </div>
      </header>

      <Card className="overflow-hidden shadow-sm">
        <div className="h-1.5 bg-primary" />
        <CardHeader>
          <CardTitle>{t("inputs.record")}</CardTitle>
          <CardDescription>{t("inputs.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {draft.hasDraft && <p role="status" className="mb-4 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground">Draft restored. Review the batch and date, then save when the connection is available.</p>}
          <form onSubmit={submit} className="space-y-6" noValidate>
            <div className="grid gap-4 rounded-2xl bg-muted/40 p-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="input-batch">{t("common.batch")} <span className="text-destructive">*</span></Label><select id="input-batch" required className={selectClass} value={batchId} onChange={(event) => draft.setValue((current) => ({ ...current, batchId: event.target.value }))}><option value="">Select batch</option>{batches?.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="input-type">{t("common.type")}</Label><select id="input-type" className={selectClass} value={productType} onChange={(event) => draft.setValue((current) => ({ ...current, productType: event.target.value as InputProductType }))}>{PRODUCT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></div>
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="input-date">{t("inputs.usedAt")}</Label><div className="relative"><Clock3 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input id="input-date" type="datetime-local" value={recordedAt} onChange={(event) => draft.setValue((current) => ({ ...current, recordedAt: event.target.value }))} className="pl-10" /></div></div>
            </div>

            {recentProducts.length > 0 && <div className="space-y-2"><p className="text-sm font-semibold">{t("inputs.recent")}</p><div className="flex flex-wrap gap-2">{recentProducts.map((log) => <button key={log.id} type="button" onClick={() => applyRecentProduct(log)} className="min-h-10 rounded-full border bg-background px-3 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"><Sparkles className="mr-1.5 inline size-3.5 text-primary" aria-hidden="true" />{log.brandName}</button>)}</div></div>}

            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="brand-name">{t("inputs.brand")} <span className="text-destructive">*</span></Label><Input id="brand-name" required value={brandName} onChange={(event) => draft.setValue((current) => ({ ...current, brandName: event.target.value }))} placeholder="Example: Baby Stag Booster" /><p className="text-xs text-muted-foreground">Record the product name even when quantity is not measured.</p></div><div className="space-y-2"><Label htmlFor="product-name">{t("inputs.variant")} <span className="font-normal text-muted-foreground">({t("common.optional")})</span></Label><Input id="product-name" value={productName} onChange={(event) => draft.setValue((current) => ({ ...current, productName: event.target.value }))} placeholder="Variant, supplier, or description" /></div></div>

            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_1.5fr]"><div className="space-y-2"><Label htmlFor="input-quantity">{t("common.quantity")} <span className="font-normal text-muted-foreground">({t("common.optional")})</span></Label><Input id="input-quantity" type="number" min="0" step="0.01" inputMode="decimal" value={quantity} onChange={(event) => draft.setValue((current) => ({ ...current, quantity: event.target.value }))} placeholder="Example: 1" /></div><div className="space-y-2"><Label htmlFor="input-unit">{t("common.unit")} <span className="font-normal text-muted-foreground">({t("common.optional")})</span></Label><select id="input-unit" className={selectClass} value={unit} onChange={(event) => draft.setValue((current) => ({ ...current, unit: event.target.value }))}><option value="">Choose unit</option>{UNITS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><p className="rounded-xl border border-dashed px-3 py-3 text-sm leading-5 text-muted-foreground">{t("inputs.noMeasure")}</p></div>

            {(productType === "MEDICINE" || productType === "VACCINE") && <div className="space-y-2"><Label htmlFor="input-purpose">{t("common.purpose")} <span className="text-destructive">*</span></Label><Input id="input-purpose" required value={purpose} onChange={(event) => draft.setValue((current) => ({ ...current, purpose: event.target.value }))} placeholder="Treatment, vaccination, deworming, or symptom observed" /></div>}
            <div className="space-y-2"><Label htmlFor="input-notes">{t("common.notes")} <span className="font-normal text-muted-foreground">({t("common.optional")})</span></Label><Input id="input-notes" value={notes} onChange={(event) => draft.setValue((current) => ({ ...current, notes: event.target.value }))} placeholder="Short context for the manager" /></div>

            {formError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{formError}</p>}
            <Button type="submit" disabled={create.isPending} className="w-full sm:w-auto">{create.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}{t("common.save")} product record</Button>
            {lastSaved && <p role="status" aria-live="polite" className="rounded-xl border border-emerald-300/50 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">Saved: {lastSaved}</p>}
          </form>
        </CardContent>
      </Card>

      <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-semibold">{t("inputs.title")}</h2><p className="text-sm text-muted-foreground">{t("inputs.description")}</p></div>{logs && <Badge variant="outline" className="w-fit rounded-full">{visibleLogs.length} shown</Badge>}</div>
        <div className="grid gap-2 sm:flex"><select aria-label="Filter product records by batch" className={selectClass} value={filterBatch} onChange={(event) => setFilterBatch(event.target.value)}><option value="all">All batches</option><option value="farm">Farm-wide / no batch</option>{batches?.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</select><select aria-label="Filter product records by type" className={selectClass} value={filterType} onChange={(event) => setFilterType(event.target.value as typeof filterType)}><option value="ALL">All product types</option>{PRODUCT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></div>
        {isLoading && <p className="text-sm text-muted-foreground">Loading product records…</p>}
        <div className="grid gap-3 sm:grid-cols-2">{visibleLogs.map((log) => <Card key={log.id} className="shadow-none"><CardContent className="flex items-start justify-between gap-3 p-4"><div className="min-w-0"><p className="truncate font-semibold">{log.productType} · {log.brandName}{log.productName ? ` — ${log.productName}` : ""}</p><p className="mt-1 text-sm text-muted-foreground">{log.batchId == null ? "Farm-wide" : batchNames.get(log.batchId) ?? `Batch ${log.batchId}`} · {new Date(log.recordedAt).toLocaleString()}</p><p className="mt-1 text-sm text-muted-foreground">{log.quantity != null ? `${log.quantity} ${log.unit ?? "units"}` : "Quantity not measured"}{log.purpose ? ` · ${log.purpose}` : ""}</p></div><Badge variant="secondary" className="shrink-0">Recorded</Badge></CardContent></Card>)}</div>
        {!isLoading && visibleLogs.length === 0 && <Card className="border-dashed shadow-none"><CardContent className="p-8 text-center text-sm text-muted-foreground">No product records match this view.</CardContent></Card>}
      </section>
    </div>
  );
}
