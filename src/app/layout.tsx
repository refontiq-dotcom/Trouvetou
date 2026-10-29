import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DesktopChrome } from "@/components/layout/desktop-chrome";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Footer } from "@/components/layout/footer";
import { LocationProvider } from "@/contexts/location-context";
import { FavoritesProvider } from "@/contexts/favorites-context";
import { CompareProvider } from "@/contexts/compare-context";
import { BookingsProvider } from "@/contexts/bookings-context";
import { CompareBar } from "@/components/compare/compare-bar";
import { PwaRegister } from "@/components/pwa-register";
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
  maximumScale: 1,
  userScalable: false,
  themeColor: "#102a72",
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
        {process.env.NODE_ENV !== "production" && (
          // Dev uniquement : le service worker met en cache les chunks
          // /_next/static/ en « cache-first », ce qui peut resservir un ancien
          // bundle référençant des modules supprimés (ex. l'erreur « ListingCard:
          // href undefined » après suppression d'un composant). On purge avant
          // l'hydration, puis on recharge une seule fois (garde sessionStorage
          // contre les boucles de reload).
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{if(!("serviceWorker" in navigator))return;if(sessionStorage.getItem("tv_sw_purged"))return;var purge=function(){return navigator.serviceWorker.getRegistrations().then(function(rs){var unreg=rs.length>0;return Promise.all(rs.map(function(r){return r.unregister()})).then(function(){return window.caches?caches.keys():Promise.resolve([])}).then(function(ks){var hit=ks.filter(function(n){return n.indexOf("trouvetou")===0});return Promise.all(hit.map(function(n){return caches.delete(n)})).then(function(){return unreg||hit.length>0;});});}).catch(function(){return false;});};purge().then(function(changed){sessionStorage.setItem("tv_sw_purged","1");if(changed)location.reload();});}catch(e){sessionStorage.setItem("tv_sw_purged","1");}})();`,
            }}
          />
        )}
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" href="/brand/TrouveTout_logo_fond_transparent.png" />
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
      </body>
    </html>
  );
}
