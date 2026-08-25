"use client";

import Link from "next/link";
import { Heart, BookOpen, Home } from "lucide-react";

const TABS = [
  { label: "Clinique", icon: Heart, href: "/cliniques", color: "text-emerald-500" },
  { label: "École", icon: BookOpen, href: "/ecoles", color: "text-[#1565c0]" },
  { label: "Résidences & Hôtels", icon: Home, href: "/hotels", color: "text-[#f9a825]" },
];

export function CategoryTabs() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-center rounded-2xl bg-white shadow-md">
        {TABS.map((tab, i) => {
          const Icon = tab.icon;
          return (
            <div key={tab.href} className="flex items-center">
              {i > 0 && (
                <div className="h-6 w-px bg-slate-200 mx-1 sm:mx-3" />
              )}
              <Link
                href={tab.href}
                className="flex items-center gap-2 px-3 sm:px-5 py-4 text-[13px] sm:text-sm font-medium text-slate-600 hover:text-foreground transition-colors group"
              >
                <Icon className={`h-[18px] w-[18px] ${tab.color} group-hover:scale-110 transition-transform`} />
                <span>{tab.label}</span>
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
