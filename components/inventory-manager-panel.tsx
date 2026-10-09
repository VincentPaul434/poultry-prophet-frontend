"use client";

import { useMemo, useState } from "react";
import { Loader2, PackagePlus, Plus, Save } from "lucide-react";
import { toast } from "sonner";
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
  const [openingCost, setOpeningCost] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [stockQuantity, setStockQuantity] = useState("");
  const [stockUnitCost, setStockUnitCost] = useState("");
  const [freeOfCharge, setFreeOfCharge] = useState(false);

  const activeProducts = useMemo(() => (products ?? []).filter((item) => item.active), [products]);
  const selectedProduct = useMemo(() => activeProducts.find((item) => item.id === selectedId) ?? null, [activeProducts, selectedId]);
  const purchaseQuantity = Number(stockQuantity);
  const purchaseUnitCost = Number(stockUnitCost);
  const hasPurchaseUnitCost = stockUnitCost.trim() !== "" && Number.isFinite(purchaseUnitCost) && purchaseUnitCost >= 0;
  const purchaseTotal = freeOfCharge ? 0 : purchaseQuantity > 0 && hasPurchaseUnitCost ? purchaseQuantity * purchaseUnitCost : null;
  const stockAfterPurchase = selectedProduct && purchaseQuantity > 0 ? Number(selectedProduct.stockOnHand) + purchaseQuantity : null;
  const newAverageCost = selectedProduct && purchaseTotal != null && selectedProduct.averageUnitCost != null && stockAfterPurchase != null
    ? (Number(selectedProduct.stockOnHand) * Number(selectedProduct.averageUnitCost) + purchaseTotal) / stockAfterPurchase
    : selectedProduct && purchaseTotal != null && Number(selectedProduct.stockOnHand) === 0 && stockAfterPurchase != null
      ? purchaseTotal / stockAfterPurchase
      : null;
  const blockedByUnvaluedStock = Boolean(selectedProduct && Number(selectedProduct.stockOnHand) > 0 && selectedProduct.averageUnitCost == null);

  async function submitProduct(event: React.FormEvent) {
    event.preventDefault();
    if (!brand.trim() || !unit.trim()) return;
    if (opening && Number(opening) > 0 && !openingCost) {
      toast.error(`Enter the opening price per ${unit.trim().toLowerCase()}.`);
      return;
    }
    await createProduct.mutateAsync({ productType: type, brandName: brand.trim(), productName: name.trim() || null, packageDescription: packageDescription.trim() || null, stockUnit: unit.trim().toLowerCase(), openingQuantity: opening ? Number(opening) : 0, openingUnitCost: openingCost ? Number(openingCost) : null, allowFractionalQuantity: true });
    toast.success("Product added to the farm list.");
    setBrand(""); setName(""); setPackageDescription(""); setOpening(""); setOpeningCost(""); setShowCreate(false);
  }

  async function submitStock(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedId || !stockQuantity || purchaseQuantity <= 0 || blockedByUnvaluedStock || (!freeOfCharge && (!stockUnitCost || purchaseUnitCost <= 0))) return;
    await stockIn.mutateAsync({ productId: selectedId, body: { quantity: purchaseQuantity, purchaseUnitCost: freeOfCharge ? 0 : purchaseUnitCost, freeOfCharge, stockDate: new Date().toISOString().slice(0, 10) } });
    toast.success("Stock updated.");
    setStockQuantity(""); setStockUnitCost(""); setFreeOfCharge(false);
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
          <div className="space-y-1.5"><Label>Inventory unit</Label><Input required value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="sachet, pack, bottle" /></div>
          <div className="space-y-1.5"><Label>Starting stock <span className="font-normal text-muted-foreground">(optional)</span></Label><Input type="number" min="0" step="0.001" value={opening} onChange={(event) => setOpening(event.target.value)} placeholder="0" /></div>
        </div>
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Generic name / variant (optional)" /><Input value={packageDescription} onChange={(event) => setPackageDescription(event.target.value)} placeholder="Package description (optional)" /><div className="space-y-1.5"><Label>Opening price per {unit.trim() || "unit"}</Label><Input type="number" min="0" step="0.000001" value={openingCost} onChange={(event) => setOpeningCost(event.target.value)} placeholder="₱0.00" /></div></div>
        <Button type="submit" className="mt-3" disabled={createProduct.isPending}>{createProduct.isPending ? <Loader2 className="animate-spin" /> : <Save className="size-4" />} Save product</Button>
      </form>}
      <form onSubmit={(event) => void submitStock(event)} className="grid gap-2.5 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_auto] sm:items-end">
        <div className="space-y-1.5"><Label>Add stock</Label><NativeSelect value={selectedId ?? ""} onChange={(event) => setSelectedId(event.target.value ? Number(event.target.value) : null)}><option value="">Select product</option>{activeProducts.map((item) => <option key={item.id} value={item.id}>{item.brandName} · {item.stockOnHand} {item.stockUnit}</option>)}</NativeSelect></div>
        <div className="space-y-1.5"><Label>Quantity purchased</Label><Input required type="number" min="0.001" step="0.001" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} /></div>
        <div className="space-y-1.5"><Label>Price per {selectedProduct?.stockUnit ?? "unit"}</Label><Input required={!freeOfCharge} disabled={freeOfCharge || !selectedId} type="number" min="0" step="0.000001" value={stockUnitCost} onChange={(event) => setStockUnitCost(event.target.value)} placeholder="₱0.00" /></div>
        <Button type="submit" disabled={stockIn.isPending || !selectedId || blockedByUnvaluedStock}>{stockIn.isPending ? <Loader2 className="animate-spin" /> : "Record purchase"}</Button>
        <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs sm:col-span-4"><div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"><span>Purchase total</span><strong className="tabular-nums">{purchaseTotal == null ? "—" : `₱${purchaseTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</strong><span>Stock after</span><strong className="tabular-nums">{stockAfterPurchase == null || !selectedProduct ? "—" : `${stockAfterPurchase.toLocaleString()} ${selectedProduct.stockUnit}`}</strong><span>New average</span><strong className="tabular-nums">{newAverageCost == null ? "—" : `₱${newAverageCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} / ${selectedProduct?.stockUnit}`}</strong></div></div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-4"><input type="checkbox" checked={freeOfCharge} onChange={(event) => setFreeOfCharge(event.target.checked)} /> Free or donated stock (no cash expense)</label>
        {blockedByUnvaluedStock && <p role="alert" className="text-xs text-warning-ink sm:col-span-4">Existing stock has no recorded unit cost. Set its opening cost or reconcile the old balance before adding more stock.</p>}
      </form>
      {isLoading && <p className="text-sm text-muted-foreground">Loading products…</p>}
      {!isLoading && activeProducts.length === 0 && <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No products yet. Add the usual medicine, vitamins, or feed packs.</p>}
      <div className="grid gap-2 sm:grid-cols-2">{activeProducts.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.brandName}</p><p className="text-xs text-muted-foreground">{item.productType} · {item.packageDescription ?? item.stockUnit}</p><p className="mt-1 text-xs text-muted-foreground">{item.averageUnitCost == null ? "Cost unavailable" : `Avg. ₱${Number(item.averageUnitCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} / ${item.stockUnit}`}</p></div><div className={item.lowStock ? "text-right text-sm font-bold text-warning-ink" : "text-right text-sm font-bold"}><p>{item.stockOnHand} {item.stockUnit}</p>{item.inventoryValue != null && <p className="text-xs font-normal text-muted-foreground">₱{Number(item.inventoryValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} on hand</p>}{item.lowStock && <p className="text-[11px] font-medium">Low stock</p>}</div></div>)}</div>
      {pendingUses && pendingUses.length > 0 && <div className="rounded-xl border border-warning-border bg-warning-muted/70 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-warning-ink">Stock review needed</p><span className="text-xs text-warning-ink">{pendingUses.length}</span></div><div className="mt-2 space-y-2">{pendingUses.slice(0, 3).map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-warning-border bg-background/70 p-2 text-sm"><span className="min-w-0 truncate">{item.brandName} · {item.quantity ?? "?"} {item.unit ?? "unit"}</span><Button type="button" size="sm" variant="outline" onClick={() => void retryPending.mutateAsync(item.id)} disabled={retryPending.isPending}>Apply now</Button></div>)}</div></div>}
    </CardContent>
  </Card>;
}
