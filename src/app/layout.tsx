import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Footer } from "@/components/layout/footer";
import { LocationBar } from "@/components/location/location-bar";
import { LocationProvider } from "@/contexts/location-context";
import { FavoritesProvider } from "@/contexts/favorites-context";
import { CompareProvider } from "@/contexts/compare-context";
import { BookingsProvider } from "@/contexts/bookings-context";
import { CompareBar } from "@/components/compare/compare-bar";
import { PwaRegister } from "@/components/pwa-register";
import { PwaInstallBanner } from "@/components/pwa-install-banner";

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#00215E",
  viewportFit: "cover",
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
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Trouvetou" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <LocationProvider>
          <FavoritesProvider>
            <CompareProvider>
              <BookingsProvider>
        {/* Header desktop — navigation complète */}
        <div className="hidden md:block">
          <Header />
        </div>
        {/* Barre de position — desktop uniquement (le mobile passe par la bottom-nav) */}
        <div className="hidden md:block">
          <LocationBar />
        </div>
              <main className="flex-1 pb-20 md:pb-0">{children}</main>
              <BottomNav />
              {/* Footer — uniquement sur desktop pour ne pas gêner la nav mobile */}
              <div className="hidden md:block">
                <Footer />
              </div>
              <CompareBar />
              <PwaRegister />
              <PwaInstallBanner />
              </BookingsProvider>
            </CompareProvider>
          </FavoritesProvider>
        </LocationProvider>
      </body>
    </html>
  );
}
