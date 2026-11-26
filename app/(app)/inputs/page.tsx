"use client";

import { useLocale as useDisplayLocale } from "@/components/locale-provider";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Package } from "lucide-react";
import { useBatches } from "@/hooks/use-batches";
import { useFarmInputPage } from "@/hooks/use-operations";
import { useAuth } from "@/lib/auth-context";
import type { InputProductType } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InventoryManagerPanel } from "@/components/inventory-manager-panel";
import { PageHeader } from "@/components/page-header";

const PRODUCT_TYPES: { value: InputProductType; label: string }[] = [
  { value: "FEED", label: "Feed" },
  { value: "VITAMIN", label: "Vitamin" },
  { value: "MEDICINE", label: "Medicine" },
  { value: "VACCINE", label: "Vaccine" },
  { value: "OTHER", label: "Other" },
];

export default function InputsPage() {
  const { display: displayText } = useDisplayLocale();
  const router = useRouter();
  const { user, isManager, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user && !isManager) router.replace("/dashboard");
  }, [authLoading, isManager, router, user]);

  if (authLoading || !user) return null;
  if (!isManager) {
    return <div className="mx-auto w-full max-w-3xl rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{displayText("Product records are available inside each batch.")}</div>;
  }

  return <ManagerInputsPage />;
}

function ManagerInputsPage() {
  const { display: displayText } = useDisplayLocale();
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
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <PageHeader icon={Package} title={displayText("Products")} description={displayText("Manage inventory and review product history.")} />

      <nav data-testid="product-tabs" className="grid grid-cols-2 rounded-xl border bg-muted/30 p-1" role="tablist" aria-label={displayText("Product pages")}>
        <Button
          variant="ghost"
          type="button"
          role="tab"
          aria-selected={activeTab === "inventory"}
          onClick={() => setActiveTab("inventory")}
          className={activeTab === "inventory" ? "min-h-11 rounded-lg bg-background text-sm font-semibold shadow-sm" : "min-h-11 rounded-lg text-sm font-semibold text-muted-foreground"}
        >
          {displayText("Inventory")}</Button>
        <Button
          variant="ghost"
          type="button"
          role="tab"
          aria-selected={activeTab === "history"}
          onClick={() => setActiveTab("history")}
          className={activeTab === "history" ? "min-h-11 rounded-lg bg-background text-sm font-semibold shadow-sm" : "min-h-11 rounded-lg text-sm font-semibold text-muted-foreground"}
        >
          {displayText("History")}{" "}{logPage ? `(${logPage.totalItems})` : ""}
        </Button>
      </nav>

      {activeTab === "inventory" ? (
        <InventoryManagerPanel />
      ) : (
        <section className="space-y-3" aria-label={displayText("Product history")}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <NativeSelect
              aria-label={displayText("Filter product records by batch")}
              value={filterBatch}
              onChange={(event) => {
                setFilterBatch(event.target.value);
                setHistoryPage(0);
              }}
            >
              <option value="all">{displayText("All batches")}</option>
              <option value="farm">{displayText("Farm-wide / no batch")}</option>
              {batches?.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
            </NativeSelect>
            <NativeSelect
              aria-label={displayText("Filter product records by type")}
              value={filterType}
              onChange={(event) => {
                setFilterType(event.target.value as typeof filterType);
                setHistoryPage(0);
              }}
            >
              <option value="ALL">{displayText("All product types")}</option>
              {PRODUCT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </NativeSelect>
          </div>

          {isLoading && <p className="text-sm text-muted-foreground">{displayText("Loading records…")}</p>}
          {!isLoading && logs.length > 0 && (
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>{displayText("Date")}</TableHead>
                    <TableHead className="min-w-52">{displayText("Product")}</TableHead>
                    <TableHead>{displayText("Type")}</TableHead>
                    <TableHead>{displayText("Batch")}</TableHead>
                    <TableHead className="text-right">{displayText("Quantity")}</TableHead>
                    <TableHead className="text-right">{displayText("Cost")}</TableHead>
                    <TableHead className="text-right">{displayText("Status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const typeLabel = PRODUCT_TYPES.find((item) => item.value === log.productType)?.label ?? log.productType;
                    const status = log.inventoryStatus === "DEDUCTED"
                      ? <Badge variant="secondary">{displayText("Stock deducted")}</Badge>
                      : log.inventoryStatus === "PENDING_STOCK_REVIEW"
                        ? <Badge variant="secondary">{displayText("Needs review")}</Badge>
                        : log.inventoryStatus === "UNTRACKED"
                          ? <Badge variant="outline">{displayText("Not tracked")}</Badge>
                          : <Badge variant="secondary">{displayText("Recorded")}</Badge>;

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
                          {log.quantity != null ? `${Number(log.quantity).toLocaleString()} ${log.unit ?? "units"}` : <span className="text-muted-foreground">{displayText("Not measured")}</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {log.calculatedCost != null ? `₱${Number(log.calculatedCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">{status}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {!isLoading && logs.length === 0 && (
            <Card className="border-dashed shadow-none">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">{displayText("No product records match this view.")}</CardContent>
            </Card>
          )}

          {!isLoading && logPage && logPage.totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm text-muted-foreground">
              <span>{logPage.totalItems} {displayText("records")}</span>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={!logPage.hasPrevious} onClick={() => setHistoryPage((current) => Math.max(0, current - 1))}>
                  <ChevronLeft className="size-4" />
                  {displayText("Previous")}</Button>
                <span>{displayText("Page")}{" "}{logPage.page + 1} {displayText("of")}{" "}{logPage.totalPages}</span>
                <Button type="button" variant="outline" size="sm" disabled={!logPage.hasNext} onClick={() => setHistoryPage((current) => current + 1)}>
                  {displayText("Next")}<ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
