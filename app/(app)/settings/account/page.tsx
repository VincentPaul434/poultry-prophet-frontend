import { SettingsDetailShell } from "@/components/settings/settings-detail";
import { AccountSection } from "@/components/settings/account-section";

export default function AccountSettingsPage() {
  return (
    <SettingsDetailShell section="account">
      <AccountSection />
    </SettingsDetailShell>
  );
}
