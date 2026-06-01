import { SettingsDetailShell } from "@/components/settings/settings-detail";
import { HandlersSection } from "@/components/settings/handlers-section";

export default function HandlersSettingsPage() {
  return (
    <SettingsDetailShell section="handlers">
      <HandlersSection />
    </SettingsDetailShell>
  );
}
