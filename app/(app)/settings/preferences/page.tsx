import { SettingsDetailShell } from "@/components/settings/settings-detail";
import { PreferencesSection } from "@/components/settings/preferences-section";

export default function PreferencesSettingsPage() {
  return (
    <SettingsDetailShell section="preferences">
      <PreferencesSection />
    </SettingsDetailShell>
  );
}
