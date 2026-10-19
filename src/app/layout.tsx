import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DesktopChrome } from "@/components/layout/desktop-chrome";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Footer } from "@/components/layout/footer";
import { LocationProvider } from "@/contexts/location-context";
import { AuthProvider } from "@/contexts/auth-context";
import { FavoritesProvider } from "@/contexts/favorites-context";
import { CompareProvider } from "@/contexts/compare-context";
import { BookingsProvider } from "@/contexts/bookings-context";
import { CompareBar } from "@/components/compare/compare-bar";
import { PwaRegister } from "@/components/pwa-register";
import { PwaSplash } from "@/components/pwa-splash";
import { PwaInstallBanner } from "@/components/pwa-install-banner";
import { TrafficTracker } from "@/components/traffic-tracker";

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
  themeColor: "#F5F3EC",
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
        {/* Symbole officiel (feuille + loupe) — PAS le logo horizontal complet. */}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Trouvetou" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* Splash PWA (crème + logo + REFONTIQ) : visible uniquement en mode
            installé, s'efface tout seul après le premier paint (cf. globals.css). */}
        <PwaSplash />
        {/* AuthProvider enveloppe favoris et réservations : ils lisent la session. */}
        <AuthProvider>
        <LocationProvider>
          <FavoritesProvider>
            <CompareProvider>
              <BookingsProvider>
        {/* Header + barre de position (desktop) — masqués sur l'accueil à partir de lg */}
        <DesktopChrome />
              <main className="flex-1 pb-20 md:pb-0">{children}</main>
              <BottomNav />
              {/* Footer — uniquement sur desktop pour ne pas gêner la nav mobile */}
              <div className="hidden md:block">
                <Footer />
              </div>
              <CompareBar />
              <PwaRegister />
              <PwaInstallBanner />
              <TrafficTracker />
              </BookingsProvider>
            </CompareProvider>
          </FavoritesProvider>
        </LocationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
