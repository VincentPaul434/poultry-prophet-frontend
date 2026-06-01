// Single source of truth for the settings hub. The hub cards, the per-section
// detail routes, and the breadcrumb labels all read from this catalog so they
// can never drift out of sync.

import { Sliders, User, Users, Warehouse, type LucideIcon } from "lucide-react";

export type SettingsSectionKey = "account" | "farm" | "handlers" | "alerts";

export interface SettingsSectionMeta {
  key: SettingsSectionKey;
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  emoji: string;
  // Manager-only sections are hidden from the hub for handlers and their detail
  // routes redirect handlers back to the hub (see settings-detail.tsx).
  managerOnly: boolean;
}

export const SETTINGS_SECTIONS: SettingsSectionMeta[] = [
  {
    key: "account",
    href: "/settings/account",
    title: "Account Settings",
    description: "Manage your personal account information and security.",
    icon: User,
    emoji: "👤",
    managerOnly: false,
  },
  {
    key: "farm",
    href: "/settings/farm",
    title: "Farm Settings",
    description: "Manage your farm profile and farm-related information.",
    icon: Warehouse,
    emoji: "🏡",
    managerOnly: true,
  },
  {
    key: "handlers",
    href: "/settings/handlers",
    title: "Farm Handlers",
    description: "Add and manage the people who care for your birds.",
    icon: Users,
    emoji: "🤲",
    managerOnly: true,
  },
  {
    key: "alerts",
    href: "/settings/alerts",
    title: "Alert Thresholds",
    description: "Set the ranges that trigger health and stress alerts.",
    icon: Sliders,
    emoji: "🔔",
    managerOnly: false,
  },
];

export function getSection(key: SettingsSectionKey): SettingsSectionMeta {
  const meta = SETTINGS_SECTIONS.find((s) => s.key === key);
  if (!meta) throw new Error(`Unknown settings section: ${key}`);
  return meta;
}

// Shared elsewhere (avatars, handler rows) — kept here so the settings module
// has a single helper rather than re-declaring it in each form.
export function initials(name: string | undefined) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
