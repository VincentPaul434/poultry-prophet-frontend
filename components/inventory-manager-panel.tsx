"use client";

import { useLocale as useDisplayLocale } from "@/components/locale-provider";

import { useMemo, useState } from "react";
import { Loader2, PackagePlus, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { todayIso } from "@/lib/format";
import { useAdjustInventory, useCreateFarmProduct, useFarmProducts, usePendingInventoryReview, useRetryPendingInventory, useSetReorderLevel, useStockInProduct } from "@/hooks/use-operations";
import type { CreateFarmProductRequest, InputProductType, InventoryAdjustmentRequest, StockInRequest } from "@/lib/types";
import { ManagerIntentRecovery, useManagerIntentRecovery } from "@/components/manager-intent-recovery";
import { StockConfirmationNotice } from "@/components/stock-confirmation-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const TYPES: Array<{ value: InputProductType; label: string }> = [
  { value: "FEED", label: "Feed" }, { value: "VITAMIN", label: "Vitamin" },
  { value: "MEDICINE", label: "Medicine" }, { value: "VACCINE", label: "Vaccine" }, { value: "OTHER", label: "Other" },
];

export function InventoryManagerPanel() {
  const { display: displayText } = useDisplayLocale();
  const { data: products, isLoading, isError } = useFarmProducts(true);
  const createProduct = useCreateFarmProduct();
  const productRecovery = useManagerIntentRecovery<CreateFarmProductRequest>("PRODUCT_CREATE");
  const stockIn = useStockInProduct();
  const stockRecovery = useManagerIntentRecovery<StockInRequest>("STOCK_IN");
  const adjust = useAdjustInventory();
  const adjustmentRecovery = useManagerIntentRecovery<InventoryAdjustmentRequest>("STOCK_ADJUSTMENT");
  const setReorder = useSetReorderLevel();
  const [reminderProductId, setReminderProductId] = useState<number | null>(null);
  const [reminderLevel, setReminderLevel] = useState("");
  const [reminderError, setReminderError] = useState("");
  const [openingReorder, setOpeningReorder] = useState("");
  const [productError, setProductError] = useState("");
  const { data: pendingUses } = usePendingInventoryReview();
  const retryPending = useRetryPendingInventory();
  const [showCreate, setShowCreate] = useState(false);
  const [showStock, setShowStock] = useState(false);
  const [type, setType] = useState<InputProductType>("MEDICINE");
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [packageDescription, setPackageDescription] = useState("");
  const [unit, setUnit] = useState("sachet");
  const [allowFractional, setAllowFractional] = useState(true);
  const [opening, setOpening] = useState("");
  const [openingCost, setOpeningCost] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [stockQuantity, setStockQuantity] = useState("");
  const [stockUnitCost, setStockUnitCost] = useState("");
  const [freeOfCharge, setFreeOfCharge] = useState(false);
  const [stockError, setStockError] = useState("");

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
    if (!productRecovery.ready || productRecovery.intents.length > 0) { setProductError(displayText("Review the previous request before saving another.")); return; }
    if (opening && Number(opening) > 0 && !openingCost) {
      toast.error(`Enter the opening price per ${unit.trim().toLowerCase()}.`);
      return;
    }
    setProductError("");
    try {
      await createProduct.mutateAsync({ productType: type, brandName: brand.trim(), productName: name.trim() || null, packageDescription: packageDescription.trim() || null, stockUnit: unit.trim().toLowerCase(), openingQuantity: opening ? Number(opening) : 0, openingUnitCost: openingCost ? Number(openingCost) : null, reorderLevel: openingReorder === "" ? null : Number(openingReorder), allowFractionalQuantity: allowFractional });
      toast.success("Product added to the farm list.");
      setBrand(""); setName(""); setPackageDescription(""); setOpening(""); setOpeningCost(""); setOpeningReorder(""); setAllowFractional(true); setShowCreate(false);
    } catch { setProductError(displayText("The request may have been saved. Close this window and retry the original details.")); }
  }

  async function submitStock(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedId || !stockQuantity || purchaseQuantity <= 0 || blockedByUnvaluedStock || (!freeOfCharge && (!stockUnitCost || purchaseUnitCost <= 0))) return;
    if (!stockRecovery.ready || stockRecovery.intents.some((intent) => intent.targetId === String(selectedId))) { setStockError(displayText("Review the previous request before saving another.")); return; }
    setStockError("");
    try {
      await stockIn.mutateAsync({ productId: selectedId, body: { quantity: purchaseQuantity, purchaseUnitCost: freeOfCharge ? 0 : purchaseUnitCost, freeOfCharge, stockDate: todayIso() } });
      toast.success("Stock updated.");
      setStockQuantity(""); setStockUnitCost(""); setFreeOfCharge(false); setShowStock(false);
    } catch { setStockError(displayText("The request may have been saved. Close this window and retry the original details.")); }
  }

  function openStockDialog(productId: number) {
    setSelectedId(productId);
    setStockQuantity("");
    setStockUnitCost("");
    setFreeOfCharge(false);
    setStockError("");
    setShowStock(true);
  }

  return <section className="space-y-4" aria-labelledby="farm-products-heading">
    <div className="flex items-center justify-between gap-3">
      <h2 id="farm-products-heading" className="flex items-center gap-2 text-base font-semibold"><PackagePlus className="hidden size-4 text-primary sm:inline" /> {displayText("Farm products and stock")}</h2>
      <Button type="button" variant="outline" size="sm" disabled={!productRecovery.ready || productRecovery.intents.length > 0} onClick={() => { setProductError(""); setShowCreate(true); }}><Plus className="size-4" /><span className="sm:hidden">{displayText("Add")}</span><span className="hidden sm:inline">{displayText("Add product")}</span></Button>
    </div>
    <StockConfirmationNotice products={products ?? []} />
    <ManagerIntentRecovery intents={productRecovery.intents} ready={productRecovery.ready} isError={productRecovery.isError} busy={createProduct.isPending} describe={(intent) => `${intent.payload.brandName} · ${intent.payload.openingQuantity ?? 0} ${intent.payload.stockUnit} · ${displayText("Price per unit")} ${intent.payload.openingUnitCost ?? "—"}`} retry={(intent) => createProduct.mutateAsync(intent.payload)} />
    <ManagerIntentRecovery intents={stockRecovery.intents} ready={stockRecovery.ready} isError={stockRecovery.isError} busy={stockIn.isPending} describe={(intent) => `${activeProducts.find((item) => item.id === Number(intent.targetId))?.brandName ?? `${displayText("Product")} ${intent.targetId}`} · ${intent.payload.quantity} · ${intent.payload.stockDate ?? ""} · ${intent.payload.freeOfCharge ? displayText("Free or donated stock") : `${displayText("Price per unit")} ${intent.payload.purchaseUnitCost ?? "—"}`}`} retry={(intent) => stockIn.mutateAsync({ productId: Number(intent.targetId), body: intent.payload })} />
    <ManagerIntentRecovery intents={adjustmentRecovery.intents} ready={adjustmentRecovery.ready} isError={adjustmentRecovery.isError} busy={adjust.isPending} describe={(intent) => `${activeProducts.find((item) => item.id === Number(intent.targetId))?.brandName ?? `${displayText("Product")} ${intent.targetId}`} · ${intent.payload.quantityDelta} · ${intent.payload.reason}`} retry={(intent) => adjust.mutateAsync({ productId: Number(intent.targetId), body: intent.payload })} />
    <Dialog open={reminderProductId != null} onOpenChange={(open) => { if (!open) setReminderProductId(null); }}>
      <DialogContent><DialogHeader><DialogTitle>{displayText("Low-stock reminder")}</DialogTitle><DialogDescription>{displayText("Choose the remaining amount that should trigger a reminder. Leave blank to turn it off.")}</DialogDescription></DialogHeader>
        <form onSubmit={async (event) => { event.preventDefault(); if (reminderProductId == null) return; setReminderError(""); try { await setReorder.mutateAsync({ productId: reminderProductId, reorderLevel: reminderLevel.trim() === "" ? null : Number(reminderLevel) }); setReminderProductId(null); toast.success("Reminder saved."); } catch { setReminderError("Could not save the reminder. Try again."); } }} className="space-y-3">
          <Label htmlFor="reorder-level">{displayText("Remind at or below")}</Label><Input id="reorder-level" type="number" min="0" step="0.001" value={reminderLevel} onChange={(event) => setReminderLevel(event.target.value)} />{reminderError && <p role="alert" className="text-destructive">{reminderError}</p>}<Button type="submit" disabled={setReorder.isPending}>{displayText("Save reminder")}</Button>
        </form>
      </DialogContent>
    </Dialog>
    <div className="space-y-4">
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{displayText("Add farm product")}</DialogTitle>
            <DialogDescription>{displayText("Add the product once, then track purchases and usage from the inventory table.")}</DialogDescription>
          </DialogHeader>
          <form id="add-product-form" onSubmit={(event) => void submitProduct(event)} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="product-brand">{displayText("Product / brand")}</Label><Input id="product-brand" required value={brand} onChange={(event) => setBrand(event.target.value)} placeholder={displayText("Baby Stag Booster")} /></div>
              <div className="space-y-1.5"><Label htmlFor="product-type">{displayText("Type")}</Label><NativeSelect id="product-type" value={type} onChange={(event) => setType(event.target.value as InputProductType)}>{TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</NativeSelect></div>
              <div className="space-y-1.5"><Label htmlFor="product-unit">{displayText("Inventory unit")}</Label><Input id="product-unit" required value={unit} onChange={(event) => setUnit(event.target.value)} placeholder={displayText("sachet, pack, bottle")} /></div>
              <div className="space-y-1.5"><Label htmlFor="product-precision">{displayText("Quantity precision")}</Label><NativeSelect id="product-precision" value={allowFractional ? "fractional" : "whole"} onChange={(event) => setAllowFractional(event.target.value === "fractional")}><option value="fractional">{displayText("Allow fractional quantities")}</option><option value="whole">{displayText("Whole units only")}</option></NativeSelect></div>
              <div className="space-y-1.5"><Label htmlFor="product-reorder">{displayText("Low-stock reminder (optional)")}</Label><Input id="product-reorder" type="number" min="0" step="0.001" value={openingReorder} onChange={(event) => setOpeningReorder(event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="product-opening-stock">{displayText("Starting stock")}{" "}<span className="font-normal text-muted-foreground">{displayText("(optional)")}</span></Label><Input id="product-opening-stock" type="number" min="0" step={allowFractional ? "0.001" : "1"} value={opening} onChange={(event) => setOpening(event.target.value)} placeholder="0" /></div>
              <div className="space-y-1.5"><Label htmlFor="product-name">{displayText("Generic name / variant")}{" "}<span className="font-normal text-muted-foreground">{displayText("(optional)")}</span></Label><Input id="product-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={displayText("Vitamin booster")} /></div>
              <div className="space-y-1.5"><Label htmlFor="product-package">{displayText("Package description")}{" "}<span className="font-normal text-muted-foreground">{displayText("(optional)")}</span></Label><Input id="product-package" value={packageDescription} onChange={(event) => setPackageDescription(event.target.value)} placeholder={displayText("100 sachets per box")} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="product-opening-cost">{displayText("Opening price per")}{" "}{unit.trim() || "unit"} <span className="font-normal text-muted-foreground">{displayText("(required when starting stock is added)")}</span></Label><Input id="product-opening-cost" type="number" min="0" step="0.000001" value={openingCost} onChange={(event) => setOpeningCost(event.target.value)} placeholder="₱0.00" /></div>
            </div>
            {productError && <p role="alert" className="text-sm text-destructive">{productError}</p>}
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>{displayText("Cancel")}</Button>
            <Button type="submit" form="add-product-form" disabled={createProduct.isPending || !productRecovery.ready || productRecovery.intents.length > 0}>{createProduct.isPending ? <Loader2 className="animate-spin" /> : <Save className="size-4" />} {displayText("Save product")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showStock} onOpenChange={setShowStock}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{displayText("Add stock")}</DialogTitle>
            <DialogDescription>{selectedProduct ? `${selectedProduct.brandName} · ${Number(selectedProduct.stockOnHand).toLocaleString()} ${selectedProduct.stockUnit} on hand` : "Record a purchase for this product."}</DialogDescription>
          </DialogHeader>
          <form id="add-stock-form" onSubmit={(event) => void submitStock(event)} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="stock-quantity">{displayText("Quantity purchased")}</Label><Input id="stock-quantity" required type="number" min={selectedProduct?.allowFractionalQuantity === false ? "1" : "0.001"} step={selectedProduct?.allowFractionalQuantity === false ? "1" : "0.001"} value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="stock-unit-cost">{displayText("Price per")}{" "}{selectedProduct?.stockUnit ?? "unit"}</Label><Input id="stock-unit-cost" required={!freeOfCharge} disabled={freeOfCharge || !selectedId} type="number" min="0" step="0.000001" value={stockUnitCost} onChange={(event) => setStockUnitCost(event.target.value)} placeholder="₱0.00" /></div>
            </div>
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs"><div className="grid grid-cols-2 gap-x-4 gap-y-1"><span>{displayText("Purchase total")}</span><strong className="text-right tabular-nums">{purchaseTotal == null ? "₱0.00" : `₱${purchaseTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</strong><span>{displayText("Stock after")}</span><strong className="text-right tabular-nums">{stockAfterPurchase == null || !selectedProduct ? `0 ${selectedProduct?.stockUnit ?? "unit"}` : `${stockAfterPurchase.toLocaleString()} ${selectedProduct.stockUnit}`}</strong><span>{displayText("New average")}</span><strong className="text-right tabular-nums">{newAverageCost == null ? `₱0.00 / ${selectedProduct?.stockUnit ?? "unit"}` : `₱${newAverageCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} / ${selectedProduct?.stockUnit}`}</strong></div></div>
            <Label className="flex items-center gap-2"><Checkbox checked={freeOfCharge} onCheckedChange={setFreeOfCharge} /> {displayText("Free or donated stock (no cash expense)")}</Label>
            {blockedByUnvaluedStock && <p role="alert" className="text-xs text-warning-ink">{displayText("Existing stock has no recorded unit cost. Set its opening cost or reconcile the old balance before adding more stock.")}</p>}
            {stockError && <p role="alert" className="text-sm text-destructive">{stockError}</p>}
          </form>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setShowStock(false)}>{displayText("Cancel")}</Button><Button type="submit" form="add-stock-form" disabled={stockIn.isPending || !selectedId || blockedByUnvaluedStock || !stockRecovery.ready || stockRecovery.intents.some((intent) => intent.targetId === String(selectedId))}>{stockIn.isPending ? <Loader2 className="animate-spin" /> : <Save className="size-4" />} {displayText("Record purchase")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      {isLoading && <p className="text-sm text-muted-foreground">{displayText("Loading products…")}</p>}
      {isError && <p role="alert" className="rounded-lg border border-warning-border bg-warning-muted/50 p-3 text-sm text-warning-ink">{displayText("Could not load stock or check its demo history. Reconnect and try again.")}</p>}
      {!isLoading && !isError && activeProducts.some((item) => item.demoStockHistory === undefined) && <p className="rounded-lg border border-warning-border bg-warning-muted/50 p-3 text-sm text-warning-ink">{displayText("Demo stock history is unavailable. Verify stock and prices before relying on them.")}</p>}
      {!isLoading && !isError && activeProducts.length === 0 && <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{displayText("No products yet. Add the usual medicine, vitamins, or feed packs.")}</p>}
      {!isLoading && !isError && activeProducts.length > 0 && <div className="space-y-3 md:hidden">
        {activeProducts.map((item) => {
          const typeLabel = TYPES.find((productType) => productType.value === item.productType)?.label ?? item.productType;
          const averageUnitCost = item.averageUnitCost == null ? null : Number(item.averageUnitCost);
          const inventoryValue = item.inventoryValue == null ? null : Number(item.inventoryValue);

          return <article key={item.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold">{item.brandName}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{typeLabel} · {item.stockUnit}</p>
                {item.demoStockHistory && <p className="mt-1 text-xs font-semibold text-warning-ink">{displayText("Demo stock in history · verify on hand and cost")}</p>}
              </div>
              {item.lowStock ? <Badge variant="secondary">{displayText("Low stock")}</Badge> : item.valuationStatus === "UNVALUED" ? <Badge variant="outline">{displayText("Cost needed")}</Badge> : <Badge variant="secondary">{displayText("Tracked")}</Badge>}
            </div>
            <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-xl bg-muted/40 text-sm">
              <div className="border-r border-border/60 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">{displayText("On hand")}</p>
                <p className={item.lowStock ? "mt-0.5 font-bold text-warning-ink" : "mt-0.5 font-semibold"}>{Number(item.stockOnHand).toLocaleString()} {item.stockUnit}</p>
              </div>
              <div className="px-3 py-2.5">
                <p className="text-xs text-muted-foreground">{displayText("Average cost")}</p>
                <p className="mt-0.5 font-semibold tabular-nums">{averageUnitCost == null ? "₱0.00" : `₱${averageUnitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`}</p>
              </div>
              <div className="col-span-2 flex items-center justify-between border-t border-border/60 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">{displayText("Inventory value")}</p>
                <p className="font-semibold tabular-nums">{inventoryValue == null ? "₱0.00" : `₱${inventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
              </div>
            </div>
            <Button type="button" variant="outline" className="mt-3 min-h-11 w-full" aria-label={`Set low-stock reminder for ${item.brandName}`} onClick={() => { setReminderProductId(item.id); setReminderLevel(item.reorderLevel == null ? "" : String(item.reorderLevel)); setReminderError(""); }}>{displayText("Low-stock reminder")}</Button>
            <Button type="button" className="mt-4 h-11 w-full" onClick={() => openStockDialog(item.id)}><Plus className="size-4" /> {displayText("Add stock")}</Button>
          </article>;
        })}
      </div>}
      {!isLoading && !isError && activeProducts.length > 0 && <div className="hidden overflow-hidden rounded-xl border md:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="min-w-52">{displayText("Product")}</TableHead>
              <TableHead>{displayText("Type")}</TableHead>
              <TableHead>{displayText("Unit")}</TableHead>
              <TableHead className="text-right">{displayText("On hand")}</TableHead>
              <TableHead className="text-right">{displayText("Average cost")}</TableHead>
              <TableHead className="text-right">{displayText("Inventory value")}</TableHead>
              <TableHead className="text-right">{displayText("Status")}</TableHead>
              <TableHead className="text-right">{displayText("Action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeProducts.map((item) => {
              const typeLabel = TYPES.find((productType) => productType.value === item.productType)?.label ?? item.productType;
              const averageUnitCost = item.averageUnitCost == null ? null : Number(item.averageUnitCost);
              const inventoryValue = item.inventoryValue == null ? null : Number(item.inventoryValue);

              return <TableRow key={item.id}>
                <TableCell className="min-w-52 whitespace-normal">
                  <p className="font-semibold">{item.brandName}</p>
                  {(item.productName || item.packageDescription) && <p className="mt-0.5 text-xs text-muted-foreground">{[item.productName, item.packageDescription].filter(Boolean).join(" · ")}</p>}
                  {item.demoStockHistory && <p className="mt-1 text-xs font-semibold text-warning-ink">{displayText("Demo stock in history · verify on hand and cost")}</p>}
                </TableCell>
                <TableCell>{typeLabel}</TableCell>
                <TableCell className="text-muted-foreground">{item.stockUnit}</TableCell>
                <TableCell className={item.lowStock ? "text-right font-bold text-warning-ink" : "text-right font-semibold"}>{Number(item.stockOnHand).toLocaleString()} <span className="font-normal text-muted-foreground">{item.stockUnit}</span></TableCell>
                <TableCell className="text-right tabular-nums">{averageUnitCost == null ? <span className="text-muted-foreground">—</span> : `₱${averageUnitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`}</TableCell>
                <TableCell className="text-right tabular-nums">{inventoryValue == null ? <span className="text-muted-foreground">—</span> : `₱${inventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</TableCell>
                <TableCell className="text-right">{item.lowStock ? <Badge variant="secondary">{displayText("Low stock")}</Badge> : item.valuationStatus === "UNVALUED" ? <Badge variant="outline">{displayText("Cost needed")}</Badge> : <Badge variant="secondary">{displayText("Tracked")}</Badge>}</TableCell>
                <TableCell className="text-right"><Button type="button" size="sm" variant="outline" aria-label={`Set low-stock reminder for ${item.brandName}`} onClick={() => { setReminderProductId(item.id); setReminderLevel(item.reorderLevel == null ? "" : String(item.reorderLevel)); setReminderError(""); }}>Reminder</Button>{" "}<Button type="button" size="sm" variant="outline" onClick={() => openStockDialog(item.id)}><Plus className="size-4" /> {displayText("Add stock")}</Button></TableCell>
              </TableRow>;
            })}
          </TableBody>
        </Table>
      </div>}
      {pendingUses && pendingUses.length > 0 && <div className="rounded-xl border border-warning-border bg-warning-muted/70 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-warning-ink">{displayText("Stock review needed")}</p><span className="text-xs text-warning-ink">{pendingUses.length}</span></div><div className="mt-2 space-y-2">{pendingUses.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-warning-border bg-background/70 p-2 text-sm"><span className="min-w-0 truncate">{item.brandName} · {item.quantity ?? "?"} {item.unit ?? "unit"}</span><Button type="button" size="sm" variant="outline" onClick={() => void retryPending.mutateAsync(item.id)} disabled={retryPending.isPending}>{displayText("Apply now")}</Button></div>)}</div></div>}
    </div>
  </section>;
}
