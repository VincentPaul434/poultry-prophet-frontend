"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { financeApi, incubationApi, inputApi, operationsAnalyticsApi, taskApi } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { CompleteIncubationRequest, CreateFarmInputRequest, CreateFinancialTransactionRequest, CreateIncubationCycleRequest, CreateTaskRequest, UpdateTaskStatusRequest } from "@/lib/types";

export function useIncubationCycles(enabled = true) { return useQuery({ queryKey: qk.incubation, queryFn: incubationApi.list, enabled }); }
export function useCreateIncubationCycle() { const qc = useQueryClient(); return useMutation({ mutationFn: (body: CreateIncubationCycleRequest) => incubationApi.create(body), onSuccess: () => qc.invalidateQueries({ queryKey: qk.incubation }) }); }
export function useCompleteIncubation() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ id, body }: { id: number; body: CompleteIncubationRequest }) => incubationApi.complete(id, body), onSuccess: () => qc.invalidateQueries({ queryKey: qk.incubation }) }); }
export function useCreateIncubationBatch() { const qc = useQueryClient(); return useMutation({ mutationFn: (id: number) => incubationApi.createBatch(id), onSuccess: () => qc.invalidateQueries({ queryKey: qk.batches.all }) }); }
export function useFarmInputs(batchId?: number, cycleId?: number, enabled = true) { return useQuery({ queryKey: [...qk.inputs, batchId, cycleId], queryFn: () => inputApi.list(batchId, cycleId), enabled }); }
export function useCreateFarmInput() { const qc = useQueryClient(); return useMutation({ mutationFn: (body: CreateFarmInputRequest) => inputApi.create(body), onSuccess: () => { qc.invalidateQueries({ queryKey: qk.inputs }); qc.invalidateQueries({ queryKey: qk.batches.all }); } }); }
export function useTasks(mine = false) { return useQuery({ queryKey: [...qk.tasks, { mine }], queryFn: () => taskApi.list(mine) }); }
export function useCreateTask() { const qc = useQueryClient(); return useMutation({ mutationFn: (body: CreateTaskRequest) => taskApi.create(body), onSuccess: () => qc.invalidateQueries({ queryKey: qk.tasks }) }); }
export function useUpdateTaskStatus() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ id, body }: { id: number; body: UpdateTaskStatusRequest }) => taskApi.updateStatus(id, body), onSuccess: () => qc.invalidateQueries({ queryKey: qk.tasks }) }); }
export function useFinanceTransactions(enabled = true) { return useQuery({ queryKey: qk.finance, queryFn: financeApi.list, enabled }); }
export function useCreateFinanceTransaction() { const qc = useQueryClient(); return useMutation({ mutationFn: (body: CreateFinancialTransactionRequest) => financeApi.create(body), onSuccess: () => { qc.invalidateQueries({ queryKey: qk.finance }); qc.invalidateQueries({ queryKey: qk.operationsAnalytics }); } }); }
export function useOperationsAnalytics(enabled = true) { return useQuery({ queryKey: qk.operationsAnalytics, queryFn: () => operationsAnalyticsApi.get(), enabled, staleTime: 30_000 }); }
