import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "UCP Books — Agentic Payment Workshop",
  description: "Next.js book shop demonstrating UCP checkout + Stripe settlement + an AI shopping agent.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
        <header className="border-b border-neutral-800">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              📚 UCP Books
            </Link>
            <nav className="flex gap-6 text-sm text-neutral-400">
              <Link href="/" className="hover:text-neutral-100">
                ร้านหนังสือ
              </Link>
              <Link href="/agent" className="hover:text-neutral-100">
                คุยกับ Shopping Agent
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-6 py-10 text-xs text-neutral-600">
          Workshop project — UCP-inspired checkout · Go backend · Stripe test mode settlement
        </footer>
      </body>
    </html>
  );
}
