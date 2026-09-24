"use client";

import { Check, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { LANGUAGE_LABELS, type Language } from "@/lib/i18n";
import { useLocale } from "@/components/locale-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function PreferencesSection() {
  const { language, setLanguage, t } = useLocale();
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle>{t("settings.language")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(LANGUAGE_LABELS) as Language[]).map((option) => (
            <Button key={option} type="button" variant={language === option ? "default" : "outline"} className="h-12 justify-between rounded-xl" aria-pressed={language === option} onClick={() => setLanguage(option)}>
              {LANGUAGE_LABELS[option]}
              {language === option && <Check className="size-5" aria-hidden="true" />}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("settings.appearance")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Button type="button" variant={theme !== "dark" ? "default" : "outline"} className="h-12 justify-between rounded-xl" aria-pressed={theme !== "dark"} onClick={() => setTheme("light")}>
            <span className="inline-flex items-center gap-2"><Sun className="size-5" aria-hidden="true" />{t("settings.light")}</span>
            {theme !== "dark" && <Check className="size-5" aria-hidden="true" />}
          </Button>
          <Button type="button" variant={theme === "dark" ? "default" : "outline"} className="h-12 justify-between rounded-xl" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>
            <span className="inline-flex items-center gap-2"><Moon className="size-5" aria-hidden="true" />{t("settings.dark")}</span>
            {theme === "dark" && <Check className="size-5" aria-hidden="true" />}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
