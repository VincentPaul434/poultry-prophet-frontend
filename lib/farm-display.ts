import type { Farm } from "./types";

export function getFarmDisplayName({
  farm,
  farmId,
  isError = false,
}: {
  farm?: Farm;
  farmId?: number | null;
  isError?: boolean;
}) {
  if (farmId == null) return "No farm assigned";
  if (isError) return "Farm unavailable";
  return farm?.name?.trim() || "Unnamed farm";
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
