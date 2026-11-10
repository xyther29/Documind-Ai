import React from "react";
import { Link } from "../../lib/router";
import { BookOpen, Mail, Shield, ExternalLink, Terminal } from "lucide-react";
import { GithubIcon } from "./icons";

export const PublicFooter: React.FC = () => {
  return (
    <footer className="bg-navy text-slate-300 border-t border-navy-hover pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-navy-hover">
          {/* Brand Column */}
          <div className="md:col-span-1 flex flex-col gap-3">
            <Link href="/" className="flex items-center gap-2 text-white">
              <div className="w-7 h-7 rounded bg-electric flex items-center justify-center text-white">
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-lg tracking-tight">DocuMind AI</span>
            </Link>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your knowledge. Connected. Understood.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              An AI-powered research and knowledge workspace built for students, researchers, and technical professionals.
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-navy-dark text-[11px] font-mono text-electric-subtle border border-slate-700">
              <Terminal className="w-3 h-3 text-electric" />
              <span>Milestone 1.4 Baseline Active</span>
            </div>
          </div>

          {/* Research & Platform */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3 font-mono">
              Platform
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/demo" className="hover:text-white transition-colors text-slate-300 font-semibold inline-flex items-center gap-1">
                  <span>Interactive Demo</span>
                  <span className="px-1 py-0.2 rounded text-[9px] bg-electric/20 text-electric font-mono">Live</span>
                </Link>
              </li>
              <li>
                <Link href="/features" className="hover:text-white transition-colors text-slate-300">
                  Core Capabilities
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="hover:text-white transition-colors text-slate-300">
                  Retrieval Pipeline
                </Link>
              </li>
              <li>
                <Link href="/use-cases" className="hover:text-white transition-colors text-slate-300">
                  Use Cases & Workflows
                </Link>
              </li>
            </ul>
          </div>

          {/* Project & Community */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3 font-mono">
              Research & Project
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/about" className="hover:text-white transition-colors text-slate-300">
                  Mission & Manifesto
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors text-slate-300">
                  Contact & Feedback
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/xyther29/Documind-AI"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors text-slate-300 inline-flex items-center gap-1"
                >
                  <GithubIcon className="w-3 h-3" />
                  <span>GitHub Repository</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/xyther29/Documind-AI/issues"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors text-slate-300 inline-flex items-center gap-1"
                >
                  <span>Issue Tracker</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                </a>
              </li>
            </ul>
          </div>

          {/* Trust & Legal */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3 font-mono">
              Trust & Legal
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors text-slate-300 inline-flex items-center gap-1">
                  <Shield className="w-3 h-3 text-teal" />
                  <span>Privacy Policy (Draft)</span>
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors text-slate-300">
                  Terms of Service (Draft)
                </Link>
              </li>
              <li>
                <a
                  href="mailto:hritikmaurya24@gmail.com"
                  className="hover:text-white transition-colors text-slate-300 inline-flex items-center gap-1"
                >
                  <Mail className="w-3 h-3" />
                  <span>Maintainer Email</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <p>© 2026 DocuMind AI. Built by xyther29. Developed under open research guidelines.</p>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="text-slate-400">
              Interactive Prototype: <code className="text-electric-subtle">/demo</code>
            </span>
            <span>·</span>
            <span className="text-slate-400">
              Backend: <code className="text-electric-subtle">FastAPI + Python 3.12</code>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
