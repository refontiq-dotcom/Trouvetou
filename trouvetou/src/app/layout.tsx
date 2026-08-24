import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { LocationProvider } from "@/contexts/location-context";
import { LocationBar } from "@/components/location/location-bar";

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
      <body className="min-h-full flex flex-col bg-background text-foreground font-[family-name:var(--font-poppins)]">
        <LocationProvider>
          <Header />
          <LocationBar />
          <main className="flex-1">{children}</main>
          <Footer />
        </LocationProvider>
      </body>
    </html>
  );
}
