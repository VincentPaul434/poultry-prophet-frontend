import { SettingsDetailShell } from "@/components/settings/settings-detail";
import { FarmSection } from "@/components/settings/farm-section";

export default function FarmSettingsPage() {
  return (
    <SettingsDetailShell section="farm">
      <FarmSection />
    </SettingsDetailShell>
  );
}
