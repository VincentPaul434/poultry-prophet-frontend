import type { Farm } from "./types";

export function getFarmDisplayName({
  farm,
  farmId,
  isError = false,
  authRequired = false,
}: {
  farm?: Farm;
  farmId?: number | null;
  isError?: boolean;
  authRequired?: boolean;
}) {
  const name = farm?.name?.trim();
  if (name) return name;
  if (farmId == null) return "No farm assigned";
  if (farm) return "Unnamed farm";
  if (authRequired) return "Sign in to load farm";
  if (isError) return "Farm unavailable";
  return "Loading farm…";
}

export function getHandlerFarmDisplayName(
  farm: Farm | undefined,
  farmId: number | null | undefined
) {
  const name = farm?.name?.trim();
  if (name) return name;

  const id = farm?.id ?? farmId;
  return id == null ? "Unnamed farm" : `Unnamed farm · ID ${id}`;
}
