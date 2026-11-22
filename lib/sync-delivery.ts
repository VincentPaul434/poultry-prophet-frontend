import { ApiError } from "./api-client";
import type { SyncOperationRequest, SyncOperationResult, SyncOperationsRequest, SyncOperationsResponse } from "./types";

const entities = new Set(["BATCH_EVENT", "FARM_INPUT", "SELECTION_SESSION", "SELECTION_SESSION_UPDATE", "SEX_COMPOSITION", "VACCINATION_PLAN", "TASK_STATUS", "VACCINATION_SCHEDULE", "DAILY_RECORD"]);

function validDay(value: string) {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

/** Validate the wire envelope without editing or re-identifying durable commands. */
function envelopeIssue(operation: SyncOperationRequest): string | null {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(operation.operationId)) return "Invalid operation identity; retain this record for review.";
  if (operation.schemaVersion !== 1 || !entities.has(operation.entityType)) return "This offline command requires a compatible app/server version.";
  if (!Number.isSafeInteger(operation.batchId) || operation.batchId < (operation.entityType === "TASK_STATUS" ? 0 : 1)) return "This record has an invalid batch reference.";
  if (!operation.payload || typeof operation.payload !== "object" || Array.isArray(operation.payload)) return "This record has an invalid payload.";
  const value = operation.occurredAt;
  // Original sex-count queues used a farm date. The matching backend accepts
  // this exact legacy representation; never rewrite a stored occurrence time.
  if (operation.entityType === "SEX_COMPOSITION" && typeof value === "string" && validDay(value)) return null;
  if (typeof value !== "string" || !validDay(value.slice(0, 10))
    || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\.[0-9]{1,9})?(?:Z|[+-][0-9]{2}:[0-9]{2})$/.test(value)
    || !Number.isFinite(Date.parse(value))) return "Invalid occurrence time; the original record remains saved for review.";
  return null;
}

function retained(operationId: string, status: SyncOperationResult["status"], message: string): SyncOperationResult {
  // A local diagnostic is not a server acknowledgement or server timestamp.
  return { operationId, status, serverId: null, serverTime: "", message };
}

function permanentStatus(error: unknown): SyncOperationResult["status"] | null {
  if (!(error instanceof ApiError) || error.status < 400 || error.status >= 500
    || error.status === 401 || error.status === 408 || error.status === 429) return null;
  return error.status === 409 ? "CONFLICT" : "REJECTED";
}

function matchingResults(response: SyncOperationsResponse, sent: SyncOperationRequest[]) {
  const ids = new Set(sent.map(operation => operation.operationId));
  return response.results.filter(result => ids.has(result.operationId)
    && response.results.filter(candidate => candidate.operationId === result.operationId).length === 1);
}

/** A bad envelope must not poison independent batch heads in the same POST. */
export async function deliverSyncOperations(
  request: SyncOperationsRequest,
  send: (body: SyncOperationsRequest) => Promise<SyncOperationsResponse>,
  isCurrent: () => boolean,
): Promise<SyncOperationResult[]> {
  const results: SyncOperationResult[] = [];
  const valid: SyncOperationRequest[] = [];
  for (const operation of request.operations) {
    const issue = envelopeIssue(operation);
    if (issue) results.push(retained(operation.operationId, "REJECTED", issue));
    else valid.push(operation);
  }
  if (!valid.length) return results;
  const post = async (operations: SyncOperationRequest[]) => {
    if (!isCurrent()) throw new ApiError("Session changed; sign in to send the retained records.", 401);
    return send({ ...request, operations });
  };
  try {
    return [...results, ...matchingResults(await post(valid), valid)];
  } catch (error) {
    const status = permanentStatus(error);
    if (!status) throw error;
    // HTTP 400/413/422 rejects the entire request before per-operation processing.
    // Diagnose at most one singleton per selected batch head (at most 25).
    if (valid.length > 1 && error instanceof ApiError && [400, 413, 422].includes(error.status)) {
      let authPaused = false;
      for (const operation of valid) {
        if (authPaused) {
          results.push(retained(operation.operationId, "AUTH_REQUIRED", "Sign in to send this record."));
          continue;
        }
        try { results.push(...matchingResults(await post([operation]), [operation])); }
        catch (singleError) {
          authPaused = singleError instanceof ApiError && singleError.status === 401;
          const singleStatus = permanentStatus(singleError) ?? (authPaused ? "AUTH_REQUIRED" : "RETRYABLE");
          results.push(retained(operation.operationId, singleStatus,
            singleError instanceof ApiError ? singleError.message : "The server could not acknowledge this record; it will retry."));
        }
      }
      return results;
    }
    return [...results, ...valid.map(operation => retained(operation.operationId, status,
      error instanceof ApiError ? error.message : "The request needs review before it can be sent."))];
  }
}
