import React, { useState } from "react";
import { Link, usePathname } from "../../lib/router";
import { BookOpen, Menu, X, ArrowRight } from "lucide-react";

export interface PublicHeaderProps {
  currentPath?: string;
}

export const PublicHeader: React.FC<PublicHeaderProps> = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { href: "/features", label: "Features" },
    { href: "/how-it-works", label: "How It Works" },
    { href: "/use-cases", label: "Use Cases" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-border transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo Brand */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center text-white shadow-sm group-hover:bg-navy-hover transition-colors">
              <BookOpen className="w-4 h-4 text-electric-subtle" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-navy">
                  DocuMind
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-electric-subtle text-electric border border-electric/20 font-mono">
                  AI
                </span>
              </div>
              <span className="text-[10px] text-slateText-muted tracking-tight hidden sm:block">
                Research & Knowledge Platform
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2" aria-label="Main Navigation">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded text-xs font-semibold tracking-wide transition-colors ${
                    isActive
                      ? "text-electric bg-electric-subtle/80 font-bold"
                      : "text-slateText-secondary hover:text-navy hover:bg-tint"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Action CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-semibold text-slateText-secondary hover:text-navy px-3 py-1.5 rounded hover:bg-tint transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/app"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold text-white bg-electric hover:bg-electric-hover shadow-btn transition cursor-pointer"
            >
              <span>Launch Demo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              href="/app"
              className="px-2.5 py-1 text-xs font-bold text-white bg-electric rounded shadow-xs"
            >
              Demo
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
              className="p-1.5 rounded text-slateText-secondary hover:text-navy hover:bg-tint focus-visible:outline-2 focus-visible:outline-electric"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-surface px-4 pt-3 pb-5 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded text-sm font-medium transition ${
                    isActive
                      ? "text-electric bg-electric-subtle font-semibold"
                      : "text-slateText-primary hover:bg-tint"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
          <div className="pt-3 border-t border-border flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded text-sm font-semibold text-slateText-secondary hover:text-navy text-center border border-border"
            >
              Sign In
            </Link>
            <Link
              href="/app"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded text-sm font-bold text-white bg-electric hover:bg-electric-hover shadow-btn"
            >
              <span>Launch Demo Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
