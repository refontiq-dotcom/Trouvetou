"use client";

import Link from "next/link";
import { Heart, BookOpen, Home } from "lucide-react";

const TABS = [
  { label: "Clinique", icon: Heart, href: "/cliniques", color: "text-success" },
  { label: "École", icon: BookOpen, href: "/ecoles", color: "text-primary" },
  { label: "Résidence", icon: Home, href: "/hotels", color: "text-accent" },
];

export function CategoryTabs() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-center gap-0 border-b border-border">
        {TABS.map((tab, i) => {
          const Icon = tab.icon;
          return (
            <div key={tab.href} className="flex items-center">
              {i > 0 && (
                <div className="h-8 w-px bg-border mx-2 sm:mx-4" />
              )}
              <Link
                href={tab.href}
                className="flex items-center gap-2 px-3 sm:px-6 py-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
              >
                <Icon className={`h-5 w-5 ${tab.color} group-hover:scale-110 transition-transform`} />
                <span>{tab.label}</span>
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
