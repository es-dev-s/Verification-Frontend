"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Verification Engine",
    isActive: (path: string) => path === "/",
    icon: (
      <path d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5C8 19.3 5 15.4 5 11V6l7-3zm-1.2 11.6l4.9-4.9-1.1-1.1-3.8 3.8-1.7-1.7-1.1 1.1 2.8 2.8z" />
    ),
  },
  {
    href: "/clients",
    label: "Clients",
    isActive: (path: string) => path.startsWith("/clients"),
    icon: (
      <path d="M9 11a3.5 3.5 0 110-7 3.5 3.5 0 010 7zm0 1.5c3.1 0 6 1.6 6 4.2V19H3v-2.3c0-2.6 2.9-4.2 6-4.2zm7.5-1.5a3 3 0 100-6 3 3 0 000 6zm.7 1.6c2.2.3 3.8 1.6 3.8 3.6V19h-4.5v-2.3c0-1.5-.5-2.8-1.4-3.8.7-.1 1.4-.1 2.1 0z" />
    ),
  },
];

/** App-level navigation: slim left rail on desktop, top bar on narrow screens. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <nav
        aria-label="Main"
        className="sticky top-0 z-30 flex items-center gap-1.5 border-b border-line bg-surface/95 px-3 py-2 backdrop-blur print:hidden lg:h-screen lg:w-52 lg:shrink-0 lg:flex-col lg:items-stretch lg:gap-1 lg:border-b-0 lg:border-r lg:px-3 lg:py-6"
      >
        <p className="mr-2 hidden px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-deeper sm:block lg:mb-4 lg:mr-0">
          Verification
        </p>
        {NAV_ITEMS.map((item) => {
          const active = item.isActive(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-brand-soft text-brand-deeper ring-1 ring-brand-muted"
                  : "text-ink-muted hover:bg-surface-tint hover:text-ink"
              }`}
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className={`h-4 w-4 shrink-0 fill-current ${active ? "text-brand" : ""}`}
              >
                {item.icon}
              </svg>
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
