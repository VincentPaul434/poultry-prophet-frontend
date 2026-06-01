import { SettingsDetailShell } from "@/components/settings/settings-detail";
import { ThresholdsSection } from "@/components/settings/thresholds-section";

export default function AlertsSettingsPage() {
  return (
    <SettingsDetailShell section="alerts">
      <ThresholdsSection />
    </SettingsDetailShell>
  );
}
