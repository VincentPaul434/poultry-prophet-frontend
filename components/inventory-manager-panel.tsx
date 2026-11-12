"use client";

import { useMemo, useState } from "react";
import { Loader2, PackagePlus, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { todayIso } from "@/lib/format";
import { useCreateFarmProduct, useFarmProducts, usePendingInventoryReview, useRetryPendingInventory, useStockInProduct } from "@/hooks/use-operations";
import type { InputProductType } from "@/lib/types";
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
  const { data: products, isLoading } = useFarmProducts(true);
  const createProduct = useCreateFarmProduct();
  const stockIn = useStockInProduct();
  const { data: pendingUses } = usePendingInventoryReview();
  const retryPending = useRetryPendingInventory();
  const [showCreate, setShowCreate] = useState(false);
  const [showStock, setShowStock] = useState(false);
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
    await stockIn.mutateAsync({ productId: selectedId, body: { quantity: purchaseQuantity, purchaseUnitCost: freeOfCharge ? 0 : purchaseUnitCost, freeOfCharge, stockDate: todayIso() } });
    toast.success("Stock updated.");
    setStockQuantity(""); setStockUnitCost(""); setFreeOfCharge(false); setShowStock(false);
  }

  function openStockDialog(productId: number) {
    setSelectedId(productId);
    setStockQuantity("");
    setStockUnitCost("");
    setFreeOfCharge(false);
    setShowStock(true);
  }

  return <section className="space-y-4" aria-labelledby="farm-products-heading">
    <div className="flex items-center justify-between gap-3">
      <h2 id="farm-products-heading" className="flex items-center gap-2 text-base font-semibold"><PackagePlus className="hidden size-4 text-primary sm:inline" /> Farm products and stock</h2>
      <Button type="button" variant="outline" size="sm" onClick={() => setShowCreate(true)}><Plus className="size-4" /><span className="sm:hidden">Add</span><span className="hidden sm:inline">Add product</span></Button>
    </div>
    <div className="space-y-4">
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add farm product</DialogTitle>
            <DialogDescription>Add the product once, then track purchases and usage from the inventory table.</DialogDescription>
          </DialogHeader>
          <form id="add-product-form" onSubmit={(event) => void submitProduct(event)} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="product-brand">Product / brand</Label><Input id="product-brand" required value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="Baby Stag Booster" /></div>
              <div className="space-y-1.5"><Label htmlFor="product-type">Type</Label><NativeSelect id="product-type" value={type} onChange={(event) => setType(event.target.value as InputProductType)}>{TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</NativeSelect></div>
              <div className="space-y-1.5"><Label htmlFor="product-unit">Inventory unit</Label><Input id="product-unit" required value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="sachet, pack, bottle" /></div>
              <div className="space-y-1.5"><Label htmlFor="product-opening-stock">Starting stock <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="product-opening-stock" type="number" min="0" step="0.001" value={opening} onChange={(event) => setOpening(event.target.value)} placeholder="0" /></div>
              <div className="space-y-1.5"><Label htmlFor="product-name">Generic name / variant <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="product-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Vitamin booster" /></div>
              <div className="space-y-1.5"><Label htmlFor="product-package">Package description <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="product-package" value={packageDescription} onChange={(event) => setPackageDescription(event.target.value)} placeholder="100 sachets per box" /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="product-opening-cost">Opening price per {unit.trim() || "unit"} <span className="font-normal text-muted-foreground">(required when starting stock is added)</span></Label><Input id="product-opening-cost" type="number" min="0" step="0.000001" value={openingCost} onChange={(event) => setOpeningCost(event.target.value)} placeholder="₱0.00" /></div>
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" form="add-product-form" disabled={createProduct.isPending}>{createProduct.isPending ? <Loader2 className="animate-spin" /> : <Save className="size-4" />} Save product</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showStock} onOpenChange={setShowStock}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add stock</DialogTitle>
            <DialogDescription>{selectedProduct ? `${selectedProduct.brandName} · ${Number(selectedProduct.stockOnHand).toLocaleString()} ${selectedProduct.stockUnit} on hand` : "Record a purchase for this product."}</DialogDescription>
          </DialogHeader>
          <form id="add-stock-form" onSubmit={(event) => void submitStock(event)} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="stock-quantity">Quantity purchased</Label><Input id="stock-quantity" required type="number" min="0.001" step="0.001" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="stock-unit-cost">Price per {selectedProduct?.stockUnit ?? "unit"}</Label><Input id="stock-unit-cost" required={!freeOfCharge} disabled={freeOfCharge || !selectedId} type="number" min="0" step="0.000001" value={stockUnitCost} onChange={(event) => setStockUnitCost(event.target.value)} placeholder="₱0.00" /></div>
            </div>
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs"><div className="grid grid-cols-2 gap-x-4 gap-y-1"><span>Purchase total</span><strong className="text-right tabular-nums">{purchaseTotal == null ? "₱0.00" : `₱${purchaseTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</strong><span>Stock after</span><strong className="text-right tabular-nums">{stockAfterPurchase == null || !selectedProduct ? `0 ${selectedProduct?.stockUnit ?? "unit"}` : `${stockAfterPurchase.toLocaleString()} ${selectedProduct.stockUnit}`}</strong><span>New average</span><strong className="text-right tabular-nums">{newAverageCost == null ? `₱0.00 / ${selectedProduct?.stockUnit ?? "unit"}` : `₱${newAverageCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} / ${selectedProduct?.stockUnit}`}</strong></div></div>
            <Label className="flex items-center gap-2"><Checkbox checked={freeOfCharge} onCheckedChange={setFreeOfCharge} /> Free or donated stock (no cash expense)</Label>
            {blockedByUnvaluedStock && <p role="alert" className="text-xs text-warning-ink">Existing stock has no recorded unit cost. Set its opening cost or reconcile the old balance before adding more stock.</p>}
          </form>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setShowStock(false)}>Cancel</Button><Button type="submit" form="add-stock-form" disabled={stockIn.isPending || !selectedId || blockedByUnvaluedStock}>{stockIn.isPending ? <Loader2 className="animate-spin" /> : <Save className="size-4" />} Record purchase</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      {isLoading && <p className="text-sm text-muted-foreground">Loading products…</p>}
      {!isLoading && activeProducts.length === 0 && <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No products yet. Add the usual medicine, vitamins, or feed packs.</p>}
      {!isLoading && activeProducts.length > 0 && <div className="space-y-3 md:hidden">
        {activeProducts.map((item) => {
          const typeLabel = TYPES.find((productType) => productType.value === item.productType)?.label ?? item.productType;
          const averageUnitCost = item.averageUnitCost == null ? null : Number(item.averageUnitCost);
          const inventoryValue = item.inventoryValue == null ? null : Number(item.inventoryValue);

          return <article key={item.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold">{item.brandName}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{typeLabel} · {item.stockUnit}</p>
              </div>
              {item.lowStock ? <Badge variant="secondary">Low stock</Badge> : item.valuationStatus === "UNVALUED" ? <Badge variant="outline">Cost needed</Badge> : <Badge variant="secondary">Tracked</Badge>}
            </div>
            <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-xl bg-muted/40 text-sm">
              <div className="border-r border-border/60 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">On hand</p>
                <p className={item.lowStock ? "mt-0.5 font-bold text-warning-ink" : "mt-0.5 font-semibold"}>{Number(item.stockOnHand).toLocaleString()} {item.stockUnit}</p>
              </div>
              <div className="px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Average cost</p>
                <p className="mt-0.5 font-semibold tabular-nums">{averageUnitCost == null ? "₱0.00" : `₱${averageUnitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`}</p>
              </div>
              <div className="col-span-2 flex items-center justify-between border-t border-border/60 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Inventory value</p>
                <p className="font-semibold tabular-nums">{inventoryValue == null ? "₱0.00" : `₱${inventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
              </div>
            </div>
            <Button type="button" className="mt-4 h-11 w-full" onClick={() => openStockDialog(item.id)}><Plus className="size-4" /> Add stock</Button>
          </article>;
        })}
      </div>}
      {!isLoading && activeProducts.length > 0 && <div className="hidden overflow-hidden rounded-xl border md:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="min-w-52">Product</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">On hand</TableHead>
              <TableHead className="text-right">Average cost</TableHead>
              <TableHead className="text-right">Inventory value</TableHead>
              <TableHead className="text-right">Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
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
                </TableCell>
                <TableCell>{typeLabel}</TableCell>
                <TableCell className="text-muted-foreground">{item.stockUnit}</TableCell>
                <TableCell className={item.lowStock ? "text-right font-bold text-warning-ink" : "text-right font-semibold"}>{Number(item.stockOnHand).toLocaleString()} <span className="font-normal text-muted-foreground">{item.stockUnit}</span></TableCell>
                <TableCell className="text-right tabular-nums">{averageUnitCost == null ? <span className="text-muted-foreground">—</span> : `₱${averageUnitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`}</TableCell>
                <TableCell className="text-right tabular-nums">{inventoryValue == null ? <span className="text-muted-foreground">—</span> : `₱${inventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</TableCell>
                <TableCell className="text-right">{item.lowStock ? <Badge variant="secondary">Low stock</Badge> : item.valuationStatus === "UNVALUED" ? <Badge variant="outline">Cost needed</Badge> : <Badge variant="secondary">Tracked</Badge>}</TableCell>
                <TableCell className="text-right"><Button type="button" size="sm" variant="outline" onClick={() => openStockDialog(item.id)}><Plus className="size-4" /> Add stock</Button></TableCell>
              </TableRow>;
            })}
          </TableBody>
        </Table>
      </div>}
      {pendingUses && pendingUses.length > 0 && <div className="rounded-xl border border-warning-border bg-warning-muted/70 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-warning-ink">Stock review needed</p><span className="text-xs text-warning-ink">{pendingUses.length}</span></div><div className="mt-2 space-y-2">{pendingUses.slice(0, 3).map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-warning-border bg-background/70 p-2 text-sm"><span className="min-w-0 truncate">{item.brandName} · {item.quantity ?? "?"} {item.unit ?? "unit"}</span><Button type="button" size="sm" variant="outline" onClick={() => void retryPending.mutateAsync(item.id)} disabled={retryPending.isPending}>Apply now</Button></div>)}</div></div>}
    </div>
  </section>;
}
