import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export const metadata: Metadata = {
  title: {
    default: "Trouvetou — Trouvez tout, restez serein",
    template: "%s — Trouvetou",
  },
  description:
    "Trouvetou, le comparateur multi-secteur qui référence hôtels, résidences meublées, écoles et cliniques partout en Afrique de l'Ouest.",
  keywords: [
    "trouvetou",
    "hôtels",
    "résidences meublées",
    "annonces",
    "écoles",
    "cliniques",
    "Côte d'Ivoire",
    "comparateur",
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
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
