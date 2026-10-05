import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "Poultry Prophet | Batch Monitoring for Gamefowl Farms",
    template: "%s | Poultry Prophet",
  },
  description:
    "Record batch health observations, population changes, product use, and farm finances in one traceable system for managers and handlers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      {/* Browser extensions may add attributes to body before hydration. */}
      <body suppressHydrationWarning className="min-h-full bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
