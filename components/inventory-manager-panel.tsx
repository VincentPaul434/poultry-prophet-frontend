"use client";

import { useMemo, useState } from "react";
import { Loader2, PackagePlus, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { useBatches } from "@/hooks/use-batches";
import { useCreateFarmProduct, useFarmProducts, usePendingInventoryReview, useRetryPendingInventory, useStockInProduct } from "@/hooks/use-operations";
import type { InputProductType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

const TYPES: Array<{ value: InputProductType; label: string }> = [
  { value: "FEED", label: "Feed" }, { value: "VITAMIN", label: "Vitamin" },
  { value: "MEDICINE", label: "Medicine" }, { value: "VACCINE", label: "Vaccine" }, { value: "OTHER", label: "Other" },
];

export function InventoryManagerPanel() {
  const { data: products, isLoading } = useFarmProducts(true);
  const { data: batches } = useBatches();
  const createProduct = useCreateFarmProduct();
  const stockIn = useStockInProduct();
  const { data: pendingUses } = usePendingInventoryReview();
  const retryPending = useRetryPendingInventory();
  const [showCreate, setShowCreate] = useState(false);
  const [type, setType] = useState<InputProductType>("MEDICINE");
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [packageDescription, setPackageDescription] = useState("");
  const [unit, setUnit] = useState("sachet");
  const [opening, setOpening] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [stockQuantity, setStockQuantity] = useState("");
  const [stockCost, setStockCost] = useState("");
  const [stockBatch, setStockBatch] = useState("");

  const activeProducts = useMemo(() => (products ?? []).filter((item) => item.active), [products]);

  async function submitProduct(event: React.FormEvent) {
    event.preventDefault();
    if (!brand.trim() || !unit.trim()) return;
    await createProduct.mutateAsync({ productType: type, brandName: brand.trim(), productName: name.trim() || null, packageDescription: packageDescription.trim() || null, stockUnit: unit.trim().toLowerCase(), openingQuantity: opening ? Number(opening) : 0, allowFractionalQuantity: true });
    toast.success("Product added to the farm list.");
    setBrand(""); setName(""); setPackageDescription(""); setOpening(""); setShowCreate(false);
  }

  async function submitStock(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedId || !stockQuantity || Number(stockQuantity) <= 0) return;
    await stockIn.mutateAsync({ productId: selectedId, body: { quantity: Number(stockQuantity), totalCost: stockCost ? Number(stockCost) : null, batchId: stockBatch ? Number(stockBatch) : null, recordExpense: Boolean(stockCost), stockDate: new Date().toISOString().slice(0, 10) } });
    toast.success("Stock updated.");
    setStockQuantity(""); setStockCost(""); setStockBatch("");
  }

  return <Card className="shadow-none">
    <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 pb-2">
      <CardTitle className="flex items-center gap-2 text-base"><PackagePlus className="size-4 text-primary" /> Farm products and stock</CardTitle>
      <Button type="button" variant="outline" size="sm" onClick={() => setShowCreate((value) => !value)}><Plus className="size-4" /> {showCreate ? "Close" : "Add product"}</Button>
    </CardHeader>
    <CardContent className="space-y-4 p-4 pt-2">
      {showCreate && <form onSubmit={(event) => void submitProduct(event)} className="rounded-xl border bg-muted/20 p-3">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Product / brand</Label><Input required value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="Baby Stag Booster" /></div>
          <div className="space-y-1.5"><Label>Type</Label><NativeSelect value={type} onChange={(event) => setType(event.target.value as InputProductType)}>{TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</NativeSelect></div>
          <div className="space-y-1.5"><Label>Unit</Label><Input required value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="sachet, pack, bottle" /></div>
          <div className="space-y-1.5"><Label>Starting stock <span className="font-normal text-muted-foreground">(optional)</span></Label><Input type="number" min="0" step="0.001" value={opening} onChange={(event) => setOpening(event.target.value)} placeholder="0" /></div>
        </div>
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Generic name / variant (optional)" /><Input value={packageDescription} onChange={(event) => setPackageDescription(event.target.value)} placeholder="Package description (optional)" /></div>
        <Button type="submit" className="mt-3" disabled={createProduct.isPending}>{createProduct.isPending ? <Loader2 className="animate-spin" /> : <Save className="size-4" />} Save product</Button>
      </form>}
      <form onSubmit={(event) => void submitStock(event)} className="grid gap-2.5 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_auto] sm:items-end">
        <div className="space-y-1.5"><Label>Add stock</Label><NativeSelect value={selectedId ?? ""} onChange={(event) => setSelectedId(event.target.value ? Number(event.target.value) : null)}><option value="">Select product</option>{activeProducts.map((item) => <option key={item.id} value={item.id}>{item.brandName} · {item.stockOnHand} {item.stockUnit}</option>)}</NativeSelect></div>
        <div className="space-y-1.5"><Label>Quantity</Label><Input required type="number" min="0.001" step="0.001" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} /></div>
        <div className="space-y-1.5"><Label>Cost <span className="font-normal text-muted-foreground">(optional)</span></Label><Input type="number" min="0" step="0.01" value={stockCost} onChange={(event) => setStockCost(event.target.value)} placeholder="₱" /></div>
        <Button type="submit" disabled={stockIn.isPending || !selectedId}>{stockIn.isPending ? <Loader2 className="animate-spin" /> : "Add stock"}</Button>
        <div className="sm:col-span-4"><NativeSelect aria-label="Optional batch for dedicated purchase" className="text-sm" value={stockBatch} onChange={(event) => setStockBatch(event.target.value)}><option value="">Farm-wide stock (no batch cost link)</option>{batches?.map((batch) => <option key={batch.id} value={batch.id}>Dedicated to {batch.name}</option>)}</NativeSelect></div>
      </form>
      {isLoading && <p className="text-sm text-muted-foreground">Loading products…</p>}
      {!isLoading && activeProducts.length === 0 && <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No products yet. Add the usual medicine, vitamins, or feed packs.</p>}
      <div className="grid gap-2 sm:grid-cols-2">{activeProducts.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.brandName}</p><p className="text-xs text-muted-foreground">{item.productType} · {item.packageDescription ?? item.stockUnit}</p></div><div className={item.lowStock ? "text-right text-sm font-bold text-warning-ink" : "text-right text-sm font-bold"}><p>{item.stockOnHand} {item.stockUnit}</p>{item.lowStock && <p className="text-[11px] font-medium">Low stock</p>}</div></div>)}</div>
      {pendingUses && pendingUses.length > 0 && <div className="rounded-xl border border-warning-border bg-warning-muted/70 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-warning-ink">Stock review needed</p><span className="text-xs text-warning-ink">{pendingUses.length}</span></div><div className="mt-2 space-y-2">{pendingUses.slice(0, 3).map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-warning-border bg-background/70 p-2 text-sm"><span className="min-w-0 truncate">{item.brandName} · {item.quantity ?? "?"} {item.unit ?? "unit"}</span><Button type="button" size="sm" variant="outline" onClick={() => void retryPending.mutateAsync(item.id)} disabled={retryPending.isPending}>Apply now</Button></div>)}</div></div>}
    </CardContent>
  </Card>;
}
