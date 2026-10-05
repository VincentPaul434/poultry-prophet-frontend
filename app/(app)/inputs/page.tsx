"use client";

import { useMemo, useState } from "react";
import { Loader2, Package, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useBatches } from "@/hooks/use-batches";
import { useCreateFarmInput, useFarmInputs } from "@/hooks/use-operations";
import { useLocalDraft } from "@/hooks/use-local-draft";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import type { FarmInputLog, InputProductType } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { InventoryManagerPanel } from "@/components/inventory-manager-panel";

const PRODUCT_TYPES: { value: InputProductType; label: string }[] = [
  { value: "FEED", label: "Feed" }, { value: "VITAMIN", label: "Vitamin" }, { value: "MEDICINE", label: "Medicine" }, { value: "VACCINE", label: "Vaccine" }, { value: "OTHER", label: "Other" },
];
const UNITS = ["packs", "sachets", "kg", "liters", "bottles", "Other"];
function localDateTimeNow() { const now = new Date(); const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000); return local.toISOString().slice(0, 16); }

export default function InputsPage() {
  const { user } = useAuth();
  const { data: batches } = useBatches();
  const { data: logs, isLoading } = useFarmInputs();
  const create = useCreateFarmInput();
  const [filterBatch, setFilterBatch] = useState("all");
  const [filterType, setFilterType] = useState<"ALL" | InputProductType>("ALL");
  const [formError, setFormError] = useState("");
  const [lastSaved, setLastSaved] = useState("");
  const [activeTab, setActiveTab] = useState<"record" | "history">("history");
  const [showOptional, setShowOptional] = useState(false);
  const initialDraft = useMemo(() => ({ batchId: "", productType: "FEED" as InputProductType, brandName: "", productName: "", quantity: "", unit: "", purpose: "", notes: "", recordedAt: localDateTimeNow() }), []);
  const draft = useLocalDraft(user ? `pp_draft:inputs:${user.userId}:${user.farmId ?? "none"}` : null, initialDraft);
  const { batchId, productType, brandName, productName, quantity, unit, purpose, notes, recordedAt } = draft.value;
  const batchNames = useMemo(() => new Map((batches ?? []).map((batch) => [batch.id, batch.name])), [batches]);
  const recentProducts = useMemo(() => { const seen = new Set<string>(); return (logs ?? []).filter((log) => { const key = `${log.productType}:${log.brandName}:${log.productName ?? ""}`; if (seen.has(key) || log.productType !== productType) return false; seen.add(key); return true; }).slice(0, 3); }, [logs, productType]);
  const visibleLogs = (logs ?? []).filter((log) => { const batchMatches = filterBatch === "all" || (filterBatch === "farm" && log.batchId == null) || String(log.batchId) === filterBatch; return batchMatches && (filterType === "ALL" || log.productType === filterType); });

  function applyRecentProduct(log: FarmInputLog) { draft.setValue((current) => ({ ...current, productType: log.productType, brandName: log.brandName, productName: log.productName ?? "", unit: log.unit ?? "", purpose: log.purpose ?? "" })); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setFormError("");
    if (!batchId) return setFormError("Select the batch that received this product.");
    if (!brandName.trim()) return setFormError("Enter the product or brand name.");
    if ((productType === "MEDICINE" || productType === "VACCINE") && !purpose.trim()) return setFormError("Add the purpose for this medicine or vaccine.");
    if (quantity && (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0)) return setFormError("Quantity must be greater than zero, or leave it blank.");
    try {
      await create.mutateAsync({ batchId: Number(batchId), recordedAt: recordedAt ? new Date(recordedAt).toISOString() : null, productType, brandName: brandName.trim(), productName: productName.trim() || null, quantity: quantity ? Number(quantity) : null, unit: unit.trim() || null, purpose: purpose.trim() || null, notes: notes.trim() || null });
      toast.success("Saved product record"); setLastSaved(`${brandName.trim()} was recorded for ${batchNames.get(Number(batchId)) ?? "the selected batch"}.`); draft.clearDraft();
    } catch (error) { setFormError(error instanceof ApiError ? error.message : "Could not save the product record."); }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <header className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Package className="size-5" aria-hidden="true" /></div><div><h1 className="text-2xl font-bold tracking-tight">Product history</h1><p className="text-sm text-muted-foreground">To record a product, open the batch first.</p></div></header>
      {user?.role === "MANAGER" && <InventoryManagerPanel />}
      <div className="grid grid-cols-2 rounded-xl border bg-muted/30 p-1" role="tablist" aria-label="Product records"><button type="button" role="tab" aria-selected={activeTab === "record"} onClick={() => setActiveTab("record")} className={activeTab === "record" ? "min-h-11 rounded-lg bg-background text-sm font-semibold shadow-sm" : "min-h-11 rounded-lg text-sm font-semibold text-muted-foreground"}>Record</button><button type="button" role="tab" aria-selected={activeTab === "history"} onClick={() => setActiveTab("history")} className={activeTab === "history" ? "min-h-11 rounded-lg bg-background text-sm font-semibold shadow-sm" : "min-h-11 rounded-lg text-sm font-semibold text-muted-foreground"}>History {logs ? `(${logs.length})` : ""}</button></div>
      {activeTab === "record" ? (
        <Card className="shadow-none"><CardHeader className="p-4 pb-2"><CardTitle className="text-base">Record product used</CardTitle><CardDescription>Batch, product, type, and date are enough.</CardDescription></CardHeader><CardContent className="p-4 pt-2">
          {draft.hasDraft && <p role="status" className="mb-3 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs">Draft restored. Check the batch before saving.</p>}
          <form onSubmit={submit} className="space-y-3" noValidate>
            <div className="grid gap-2.5 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="input-batch">Batch <span className="text-destructive">*</span></Label><NativeSelect id="input-batch" required value={batchId} onChange={(e) => draft.setValue((current) => ({ ...current, batchId: e.target.value }))}><option value="">Select batch</option>{batches?.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</NativeSelect></div><div className="space-y-1.5"><Label htmlFor="input-type">Product type <span className="text-destructive">*</span></Label><NativeSelect id="input-type" required value={productType} onChange={(e) => draft.setValue((current) => ({ ...current, productType: e.target.value as InputProductType }))}>{PRODUCT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</NativeSelect></div></div>
            {recentProducts.length > 0 && <div className="space-y-1.5"><p className="text-xs font-semibold text-muted-foreground">Recent products</p><div className="flex gap-2 overflow-x-auto pb-1">{recentProducts.map((log) => <button key={log.id} type="button" onClick={() => applyRecentProduct(log)} className="min-h-10 shrink-0 rounded-full border bg-background px-3 text-xs font-semibold hover:border-primary/50 hover:bg-muted"><Sparkles className="mr-1 inline size-3 text-primary" aria-hidden="true" />{log.brandName}</button>)}</div></div>}
            <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_12rem]"><div className="space-y-1.5"><Label htmlFor="brand-name">Product / brand <span className="text-destructive">*</span></Label><Input id="brand-name" required value={brandName} onChange={(e) => draft.setValue((current) => ({ ...current, brandName: e.target.value }))} placeholder="Baby Stag Booster" /></div><div className="space-y-1.5"><Label htmlFor="input-date">Date / time <span className="text-destructive">*</span></Label><Input id="input-date" type="datetime-local" required value={recordedAt} onChange={(e) => draft.setValue((current) => ({ ...current, recordedAt: e.target.value }))} /></div></div>
            {(productType === "MEDICINE" || productType === "VACCINE") && <div className="space-y-1.5"><Label htmlFor="input-purpose">Purpose <span className="text-destructive">*</span></Label><Input id="input-purpose" required value={purpose} onChange={(e) => draft.setValue((current) => ({ ...current, purpose: e.target.value }))} placeholder="Treatment, vaccination, deworming…" /></div>}
            <details open={showOptional} onToggle={(e) => setShowOptional(e.currentTarget.open)} className="rounded-lg border px-3"><summary className="flex min-h-10 cursor-pointer items-center text-sm font-semibold">More details <span className="ml-1 font-normal text-muted-foreground">(optional)</span></summary><div className="grid gap-2.5 pb-3 sm:grid-cols-2"><Input aria-label="Product variant" value={productName} onChange={(e) => draft.setValue((current) => ({ ...current, productName: e.target.value }))} placeholder="Variant / supplier" /><div className="grid grid-cols-2 gap-2"><Input aria-label="Quantity" type="number" min="0" step="0.01" inputMode="decimal" value={quantity} onChange={(e) => draft.setValue((current) => ({ ...current, quantity: e.target.value }))} placeholder="Quantity" /><NativeSelect aria-label="Unit" value={unit} onChange={(e) => draft.setValue((current) => ({ ...current, unit: e.target.value }))}><option value="">Unit</option>{UNITS.map((item) => <option key={item} value={item}>{item}</option>)}</NativeSelect></div><Input aria-label="Notes" value={notes} onChange={(e) => draft.setValue((current) => ({ ...current, notes: e.target.value }))} placeholder="Short note" /></div></details>
            {formError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{formError}</p>}<Button type="submit" disabled={create.isPending} className="h-11 w-full sm:w-auto">{create.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />} Save product record</Button>{lastSaved && <p role="status" aria-live="polite" className="rounded-lg border border-success-border bg-success-muted px-3 py-2 text-xs text-success">Saved: {lastSaved}</p>}
          </form>
        </CardContent></Card>
      ) : (
        <section className="space-y-3"><div className="flex flex-col gap-2 sm:flex-row"><NativeSelect aria-label="Filter product records by batch" value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}><option value="all">All batches</option><option value="farm">Farm-wide / no batch</option>{batches?.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</NativeSelect><NativeSelect aria-label="Filter product records by type" value={filterType} onChange={(e) => setFilterType(e.target.value as typeof filterType)}><option value="ALL">All product types</option>{PRODUCT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</NativeSelect></div>{isLoading && <p className="text-sm text-muted-foreground">Loading records…</p>}<div className="grid gap-2 sm:grid-cols-2">{visibleLogs.map((log) => <Card key={log.id} className="shadow-none"><CardContent className="p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{log.productType} · {log.brandName}</p><p className="mt-1 text-xs text-muted-foreground">{log.batchId == null ? "Farm-wide" : batchNames.get(log.batchId) ?? `Batch ${log.batchId}`} · {new Date(log.recordedAt).toLocaleDateString()}</p><p className="mt-1 text-xs text-muted-foreground">{log.quantity != null ? `${log.quantity} ${log.unit ?? "units"}` : "Quantity not measured"}{log.purpose ? ` · ${log.purpose}` : ""}</p></div><Badge variant="secondary">Recorded</Badge></div></CardContent></Card>)}</div>{!isLoading && visibleLogs.length === 0 && <Card className="border-dashed shadow-none"><CardContent className="p-8 text-center text-sm text-muted-foreground">No product records match this view.</CardContent></Card>}</section>
      )}
    </div>
  );
}
