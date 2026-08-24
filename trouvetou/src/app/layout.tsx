import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { LocationProvider } from "@/contexts/location-context";
import { FavoritesProvider } from "@/contexts/favorites-context";
import { CompareProvider } from "@/contexts/compare-context";
import { CompareBar } from "@/components/compare/compare-bar";
import { LocationBar } from "@/components/location/location-bar";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: {
    default: "Trouvetou — Trouvez tout, tout simplement.",
    template: "%s — Trouvetou",
  },
  description:
    "Trouvetou, le comparateur multi-secteur qui référence hôtels, résidences meublées, écoles, cliniques et restaurants partout en Afrique de l'Ouest.",
  keywords: [
    "trouvetou",
    "hôtels",
    "résidences meublées",
    "annonces",
    "écoles",
    "cliniques",
    "restaurants",
    "Côte d'Ivoire",
    "comparateur",
    "proximité",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1565c0" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-[family-name:var(--font-poppins)]">
        <LocationProvider>
          <FavoritesProvider>
            <CompareProvider>
              <Header />
              <LocationBar />
              <main className="flex-1">{children}</main>
              <Footer />
              <CompareBar />
              <PwaRegister />
            </CompareProvider>
          </FavoritesProvider>
        </LocationProvider>
      </body>
    </html>
  );
}
