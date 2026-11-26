import { newSecureUuid } from "./uuid";

/** Keeps existing device identities while creating new ones with secure randomness. */
export async function getDeviceId() {
  if (typeof window === "undefined") throw new Error("Offline storage is not available in this browser.");
  const key = "pp_offline_device_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = newSecureUuid();
  window.localStorage.setItem(key, created);
  return created;
}
