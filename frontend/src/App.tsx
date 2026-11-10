import React, { useEffect, useState, useCallback } from "react";
import { Header } from "./components/Header";
import { UploadDropZone } from "./components/UploadDropZone";
import { DocumentLibrary } from "./components/DocumentLibrary";
import { QAWorkspace } from "./components/QAWorkspace";
import { fetchDocuments, deleteDocument, checkHealth, type AuthMode } from "./lib/api";
import type { DocumentMeta, HealthResponse, QAEntry } from "./types/api";

import { RouterProvider, usePathname, Link } from "./lib/router";
import { AuthProvider } from "./context/AuthContext";
import { PublicHeader } from "./components/public/PublicHeader";
import { PublicFooter } from "./components/public/PublicFooter";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

import { LandingPage } from "./pages/public/LandingPage";
import { FeaturesPage } from "./pages/public/FeaturesPage";
import { HowItWorksPage } from "./pages/public/HowItWorksPage";
import { UseCasesPage } from "./pages/public/UseCasesPage";
import { AboutPage } from "./pages/public/AboutPage";
import { ContactPage } from "./pages/public/ContactPage";
import { PrivacyPage } from "./pages/public/PrivacyPage";
import { TermsPage } from "./pages/public/TermsPage";
import { NotFoundPage } from "./pages/public/NotFoundPage";

import { LoginPage } from "./pages/auth/LoginPage";
import { SignUpPage } from "./pages/auth/SignUpPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { AuthCallbackPage } from "./pages/auth/AuthCallbackPage";

/**
 * Interactive Workspace for DocuMind AI.
 * Operates in "authenticated" mode (for /app/*) or "guest" mode (for /demo/*).
 */
function WorkspaceApp({ mode = "guest" }: { mode?: AuthMode }) {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [entries, setEntries] = useState<QAEntry[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(true);
  const [loadingHealth, setLoadingHealth] = useState<boolean>(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    setLoadingHealth(true);
    try {
      const data = await checkHealth();
      setHealth(data);
    } catch (_) {
      setHealth(null);
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    setLoadingDocs(true);
    setLibraryError(null);
    try {
      const data = await fetchDocuments(mode);
      setDocuments(data.documents);

      // If selected document was deleted elsewhere, reset scope to All Documents
      setSelectedDocId((prev) => {
        if (prev && !data.documents.some((d) => d.doc_id === prev)) {
          return null;
        }
        return prev;
      });
    } catch (err: any) {
      setLibraryError(err.message || "Failed to load document library");
    } finally {
      setLoadingDocs(false);
    }
  }, [mode]);

  // Initial load
  useEffect(() => {
    loadHealth();
    loadDocuments();
  }, [loadHealth, loadDocuments]);

  // Handle successful upload: refresh library & health metrics, and select new doc
  async function handleUploadSuccess(newDoc: DocumentMeta) {
    await loadDocuments();
    await loadHealth();
    setSelectedDocId(newDoc.doc_id);
  }

  // Handle document deletion
  async function handleDeleteDocument(docId: string, filename: string) {
    try {
      await deleteDocument(docId, mode);
      if (selectedDocId === docId) {
        setSelectedDocId(null);
      }
      await loadDocuments();
      await loadHealth();
    } catch (err: any) {
      alert(`Could not delete "${filename}": ${err.message}`);
      throw err;
    }
  }

  return (
    <div className="h-screen flex flex-col bg-canvas text-slateText-primary overflow-hidden">
      {/* Application Header with Return to Public Site */}
      <Header
        health={health}
        loadingHealth={loadingHealth}
        onRefreshHealth={loadHealth}
        mode={mode}
      />

      {/* Guest Mode Informational Banner */}
      {mode === "guest" && (
        <div className="bg-electric/10 border-b border-electric/20 px-4 py-1.5 flex items-center justify-between text-xs text-electric shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider font-mono text-[10px] bg-electric text-white px-1.5 py-0.5 rounded">
              Guest Demo
            </span>
            <span className="text-slateText-primary font-medium">
              You are exploring DocuMind in guest mode (1 document, 5 questions per session).
            </span>
          </div>
          <Link
            href="/signup"
            className="font-bold underline hover:text-electric-hover shrink-0 ml-2"
          >
            Create an Account for Unlimited Vaults →
          </Link>
        </div>
      )}

      {/* Main Body: Responsive Sidebar + Conversational Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar: Ingestion & Document Library */}
        <aside
          className="w-full md:w-80 lg:w-96 bg-surface border-r border-border flex flex-col shrink-0 h-[40vh] md:h-full overflow-hidden"
          aria-label="Document Ingestion & Library"
        >
          {/* Upload Section */}
          <div className="p-4 border-b border-border bg-surface shrink-0">
            <UploadDropZone onUploadSuccess={handleUploadSuccess} mode={mode} />
          </div>

          {/* Library Section */}
          <div className="p-4 flex-1 flex flex-col min-h-0 bg-tint/30 overflow-hidden">
            <DocumentLibrary
              documents={documents}
              selectedDocId={selectedDocId}
              loading={loadingDocs}
              error={libraryError}
              onSelectScope={setSelectedDocId}
              onDeleteDocument={handleDeleteDocument}
            />
          </div>
        </aside>

        {/* Conversational Q&A Workspace */}
        <QAWorkspace
          documents={documents}
          selectedDocId={selectedDocId}
          onSelectDoc={setSelectedDocId}
          entries={entries}
          setEntries={setEntries}
          mode={mode}
        />
      </div>
    </div>
  );
}

/**
 * Editorial wrapper for all public marketing pages
 */
function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-canvas text-slateText-primary">
      <PublicHeader />
      <main className="flex-1 flex flex-col">{children}</main>
      <PublicFooter />
    </div>
  );
}

/**
 * Dynamic route dispatcher matching the URL pathname
 */
function RouteDispatcher() {
  const pathname = usePathname();

  // 1. Protected Authenticated Workspace (/app and /app/*)
  if (pathname === "/app" || pathname.startsWith("/app/")) {
    return (
      <ProtectedRoute>
        <WorkspaceApp mode="authenticated" />
      </ProtectedRoute>
    );
  }

  // 2. Guest Demo Workspace (/demo and /demo/*)
  if (pathname === "/demo" || pathname.startsWith("/demo/")) {
    return <WorkspaceApp mode="guest" />;
  }

  // 3. Authentication & Account Recovery Routes
  if (pathname === "/login") {
    return (
      <PublicLayout>
        <LoginPage />
      </PublicLayout>
    );
  }

  if (pathname === "/signup") {
    return (
      <PublicLayout>
        <SignUpPage />
      </PublicLayout>
    );
  }

  if (pathname === "/forgot-password") {
    return (
      <PublicLayout>
        <ForgotPasswordPage />
      </PublicLayout>
    );
  }

  if (pathname === "/reset-password") {
    return (
      <PublicLayout>
        <ResetPasswordPage />
      </PublicLayout>
    );
  }

  if (pathname === "/auth/callback") {
    return <AuthCallbackPage />;
  }

  // 4. Public marketing & documentation routes
  switch (pathname) {
    case "/":
      return (
        <PublicLayout>
          <LandingPage />
        </PublicLayout>
      );
    case "/features":
      return (
        <PublicLayout>
          <FeaturesPage />
        </PublicLayout>
      );
    case "/how-it-works":
      return (
        <PublicLayout>
          <HowItWorksPage />
        </PublicLayout>
      );
    case "/use-cases":
      return (
        <PublicLayout>
          <UseCasesPage />
        </PublicLayout>
      );
    case "/about":
      return (
        <PublicLayout>
          <AboutPage />
        </PublicLayout>
      );
    case "/contact":
      return (
        <PublicLayout>
          <ContactPage />
        </PublicLayout>
      );
    case "/privacy":
      return (
        <PublicLayout>
          <PrivacyPage />
        </PublicLayout>
      );
    case "/terms":
      return (
        <PublicLayout>
          <TermsPage />
        </PublicLayout>
      );
    default:
      return (
        <PublicLayout>
          <NotFoundPage />
        </PublicLayout>
      );
  }
}

export function App() {
  return (
    <AuthProvider>
      <RouterProvider>
        <RouteDispatcher />
      </RouterProvider>
    </AuthProvider>
  );
}
export default App;
