import React from "react";
import { Link } from "../../lib/router";
import { FileQuestion, ArrowRight, Home } from "lucide-react";

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-canvas text-slateText-primary selection:bg-electric-subtle selection:text-electric justify-center items-center py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 shadow-sm space-y-6 text-center">
        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-coral/10 text-coral mx-auto flex items-center justify-center">
          <FileQuestion className="w-7 h-7" />
        </div>

        {/* 404 Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tint text-xs font-mono font-semibold text-coral border border-coral/20">
          <span>Error 404 • Folio Not Found</span>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-navy tracking-tight">
            Research Route Not Found
          </h1>
          <p className="text-sm text-slateText-secondary leading-relaxed">
            The folio page or resource you are looking for does not exist in the DocuMind knowledge index.
          </p>
        </div>

        {/* CTAs */}
        <div className="space-y-3 pt-2">
          <Link
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-bold text-white bg-electric hover:bg-electric-hover shadow-btn transition cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Return to Homepage</span>
          </Link>

          <Link
            href="/app"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-slateText-secondary hover:text-navy hover:bg-tint transition cursor-pointer"
          >
            <span>Launch Interactive Demo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};
