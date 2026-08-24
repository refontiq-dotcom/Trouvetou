import Link from "next/link";
import { Logo } from "@/components/logo";
import { MapPin, Mail } from "lucide-react";

const CATEGORIES = [
  { href: "/hotels", label: "Hôtels & Résidences meublées" },
  { href: "/ecoles", label: "Écoles & Établissements privés" },
  { href: "/cliniques", label: "Cliniques & Santé" },
];

const NAV_LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/hotels", label: "Hôtels & Résidences" },
  { href: "/ecoles", label: "Écoles & Établissements" },
  { href: "/cliniques", label: "Cliniques & Santé" },
];

export function Footer() {
  return (
    <footer className="bg-navy text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <Logo variant="light" size="sm" />
            <p className="mt-4 max-w-md text-sm text-white/60">
              L&apos;endroit qu&apos;il vous faut, au moment qu&apos;il le faut.
              Trouvetou vous aide à trouver rapidement ce que vous cherchez,
              autour de vous — hôtels, résidences, écoles et cliniques de
              confiance.
            </p>
            <div className="mt-5 flex items-center gap-4 text-white/40 text-sm">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" /> Abidjan, Côte d&apos;Ivoire
              </span>
              <span className="flex items-center gap-1.5">
                <Mail className="h-4 w-4" /> contact@trouvetou.app
              </span>
            </div>
          </div>

          {/* Univers */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
              Univers
            </h3>
            <ul className="mt-4 space-y-3">
              {CATEGORIES.map((cat) => (
                <li key={cat.label}>
                  <Link
                    href={cat.href}
                    className="text-sm text-white/50 hover:text-accent transition-colors"
                  >
                    {cat.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
              Navigation
            </h3>
            <ul className="mt-4 space-y-3">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/50 hover:text-accent transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} Trouvetou. Tous droits réservés.
          </p>
          <div className="flex items-center gap-2 text-xs text-white/40">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            Trouvez tout, restez serein.
          </div>
        </div>
      </div>
    </footer>
  );
}
