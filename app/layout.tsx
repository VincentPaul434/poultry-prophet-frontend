import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://poultry-prophet.vercel.app"),
  title: {
    default: "Poultry Prophet | Malinaw na Records sa Bawat Batch",
    template: "%s | Poultry Prophet",
  },
  description:
    "Mag-record ng farm activity kahit mahina ang signal, mag-sync kapag may internet, at suriin ang buong batch history sa iisang sistema.",
  openGraph: {
    title: "Poultry Prophet | Tala ngayon, linaw sa bawat batch",
    description: "Offline-ready na farm recording at malinaw na batch review para sa handler at manager.",
    type: "website",
    siteName: "Poultry Prophet",
    url: "https://poultry-prophet.vercel.app/",
    images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: "Poultry Prophet — tala ngayon, linaw sa bawat batch" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Poultry Prophet | Malinaw na batch records",
    description: "Mag-record kahit offline. Mag-sync kapag may internet. Suriin sa iisang lugar.",
  },
  icons: { icon: "/icon.svg" },
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
