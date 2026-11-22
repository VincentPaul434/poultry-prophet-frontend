"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useBatches } from "@/hooks/use-batches";
import { useFarmInputPage } from "@/hooks/use-operations";
import { useAuth } from "@/lib/auth-context";
import type { FarmInputLog, InputProductType } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InventoryManagerPanel } from "@/components/inventory-manager-panel";
import { PageContainer, PageHeader } from "@/components/page-header";

const PRODUCT_TYPES: { value: InputProductType; label: string }[] = [
  { value: "FEED", label: "Feed" },
  { value: "VITAMIN", label: "Vitamin" },
  { value: "MEDICINE", label: "Medicine" },
  { value: "VACCINE", label: "Vaccine" },
  { value: "OTHER", label: "Other" },
];

export default function InputsPage() {
  const router = useRouter();
  const { user, isManager, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user && !isManager) router.replace("/dashboard");
  }, [authLoading, isManager, router, user]);

  if (authLoading || !user) return null;
  if (!isManager) {
    return <div className="mx-auto w-full max-w-3xl rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Product records are available inside each batch.</div>;
  }

  return <ManagerInputsPage />;
}

function ManagerInputsPage() {
  const { data: batches } = useBatches();
  const [activeTab, setActiveTab] = useState<"inventory" | "history">("inventory");
  const [filterBatch, setFilterBatch] = useState("all");
  const [filterType, setFilterType] = useState<"ALL" | InputProductType>("ALL");
  const [historyPage, setHistoryPage] = useState(0);
  const { data: logPage, isLoading } = useFarmInputPage({
    page: historyPage,
    size: 20,
    batchId: filterBatch !== "all" && filterBatch !== "farm" ? Number(filterBatch) : undefined,
    farmWide: filterBatch === "farm",
    productType: filterType === "ALL" ? undefined : filterType,
  });
  const logs = logPage?.items ?? [];
  const batchNames = useMemo(
    () => new Map((batches ?? []).map((batch) => [batch.id, batch.name])),
    [batches],
  );

  return (
    <PageContainer className="space-y-5 sm:space-y-10">
      <PageHeader variant="ledger" title="Products" description="Manage inventory and review product history." />

      <nav data-testid="product-tabs" className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Product pages">
        <Button
          variant="outline"
          type="button"
          role="tab"
          aria-selected={activeTab === "inventory"}
          onClick={() => setActiveTab("inventory")}
          className="min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold shadow-none aria-selected:border-primary aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:hover:bg-primary/90"
        >
          Inventory
        </Button>
        <Button
          variant="outline"
          type="button"
          role="tab"
          aria-selected={activeTab === "history"}
          onClick={() => setActiveTab("history")}
          className="min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold shadow-none aria-selected:border-primary aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:hover:bg-primary/90"
        >
          History {logPage ? `(${logPage.totalItems})` : ""}
        </Button>
      </nav>

      {activeTab === "inventory" ? (
        <InventoryManagerPanel />
      ) : (
        <section className="space-y-3" aria-label="Product history">
          <div className="flex flex-col gap-2 sm:flex-row">
            <NativeSelect
              className="w-full sm:w-auto"
              selectClassName="min-h-11 text-base md:text-sm"
              aria-label="Filter product records by batch"
              value={filterBatch}
              onChange={(event) => {
                setFilterBatch(event.target.value);
                setHistoryPage(0);
              }}
            >
              <option value="all">All batches</option>
              <option value="farm">Farm-wide / no batch</option>
              {batches?.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
            </NativeSelect>
            <NativeSelect
              className="w-full sm:w-auto"
              selectClassName="min-h-11 text-base md:text-sm"
              aria-label="Filter product records by type"
              value={filterType}
              onChange={(event) => {
                setFilterType(event.target.value as typeof filterType);
                setHistoryPage(0);
              }}
            >
              <option value="ALL">All product types</option>
              {PRODUCT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </NativeSelect>
          </div>

          {isLoading && <p className="text-sm text-muted-foreground">Loading records…</p>}
          {!isLoading && logs.length > 0 && (
            <div className="space-y-3 md:hidden">
              {logs.map((log) => {
                const typeLabel = PRODUCT_TYPES.find((item) => item.value === log.productType)?.label ?? log.productType;
                return <article key={log.id} className="min-w-0 rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><h3 className="break-words font-semibold">{log.brandName}</h3>{log.productName && <p className="break-words text-sm text-muted-foreground">{log.productName}</p>}{log.purpose && <p className="break-words text-sm text-muted-foreground">{log.purpose}</p>}</div>
                    <ProductHistoryStatus status={log.inventoryStatus} />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div><dt className="text-xs text-muted-foreground">Date</dt><dd>{new Date(log.recordedAt).toLocaleDateString()}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Type</dt><dd>{typeLabel}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Batch</dt><dd className="break-words">{log.batchId == null ? "Farm-wide" : batchNames.get(log.batchId) ?? `Batch ${log.batchId}`}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Quantity</dt><dd className="break-words tabular-nums">{log.quantity != null ? `${Number(log.quantity).toLocaleString()} ${log.unit ?? "units"}` : "Not measured"}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Cost</dt><dd className="tabular-nums">{log.calculatedCost != null ? `₱${Number(log.calculatedCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</dd></div>
                  </dl>
                </article>;
              })}
            </div>
          )}
          {!isLoading && logs.length > 0 && (
            <div className="hidden overflow-hidden rounded-xl border md:block">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="min-w-52">Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const typeLabel = PRODUCT_TYPES.find((item) => item.value === log.productType)?.label ?? log.productType;
                    return (
                      <TableRow key={log.id}>
                        <TableCell>{new Date(log.recordedAt).toLocaleDateString()}</TableCell>
                        <TableCell className="min-w-52 whitespace-normal">
                          <p className="font-semibold">{log.brandName}</p>
                          {log.productName && <p className="text-xs text-muted-foreground">{log.productName}</p>}
                          {log.purpose && <p className="text-xs text-muted-foreground">{log.purpose}</p>}
                        </TableCell>
                        <TableCell>{typeLabel}</TableCell>
                        <TableCell>{log.batchId == null ? "Farm-wide" : batchNames.get(log.batchId) ?? `Batch ${log.batchId}`}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {log.quantity != null ? `${Number(log.quantity).toLocaleString()} ${log.unit ?? "units"}` : <span className="text-muted-foreground">Not measured</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {log.calculatedCost != null ? `₱${Number(log.calculatedCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right"><ProductHistoryStatus status={log.inventoryStatus} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {!isLoading && logs.length === 0 && (
            <Card className="border-dashed shadow-none">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">No product records match this view.</CardContent>
            </Card>
          )}

          {!isLoading && logPage && logPage.totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm text-muted-foreground">
              <span>{logPage.totalItems} records</span>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={!logPage.hasPrevious} onClick={() => setHistoryPage((current) => Math.max(0, current - 1))}>
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>
                <span>Page {logPage.page + 1} of {logPage.totalPages}</span>
                <Button type="button" variant="outline" size="sm" disabled={!logPage.hasNext} onClick={() => setHistoryPage((current) => current + 1)}>
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </PageContainer>
  );
}

function ProductHistoryStatus({ status }: { status: FarmInputLog["inventoryStatus"] }) {
  if (status === "DEDUCTED") return <Badge variant="secondary">Stock deducted</Badge>;
  if (status === "PENDING_STOCK_REVIEW") return <Badge variant="secondary">Needs review</Badge>;
  if (status === "UNTRACKED") return <Badge variant="outline">Not tracked</Badge>;
  return <Badge variant="secondary">Recorded</Badge>;
}
