import React, { useEffect, useState, useCallback } from "react";
import { Header } from "./components/Header";
import { UploadDropZone } from "./components/UploadDropZone";
import { DocumentLibrary } from "./components/DocumentLibrary";
import { QAWorkspace } from "./components/QAWorkspace";
import { fetchDocuments, deleteDocument, checkHealth } from "./lib/api";
import type { DocumentMeta, HealthResponse, QAEntry } from "./types/api";

import { RouterProvider, usePathname } from "./lib/router";
import { PublicHeader } from "./components/public/PublicHeader";
import { PublicFooter } from "./components/public/PublicFooter";

import { LandingPage } from "./pages/public/LandingPage";
import { FeaturesPage } from "./pages/public/FeaturesPage";
import { HowItWorksPage } from "./pages/public/HowItWorksPage";
import { UseCasesPage } from "./pages/public/UseCasesPage";
import { AboutPage } from "./pages/public/AboutPage";
import { ContactPage } from "./pages/public/ContactPage";
import { PrivacyPage } from "./pages/public/PrivacyPage";
import { TermsPage } from "./pages/public/TermsPage";
import { AuthNoticePage } from "./pages/public/AuthNoticePage";
import { NotFoundPage } from "./pages/public/NotFoundPage";

/**
 * Interactive Demo Workspace (Single-Document Prototype)
 * Preserved from Milestone 1.4 baseline under route /app
 */
function WorkspaceApp() {
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
      const data = await fetchDocuments();
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
  }, []);

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
      await deleteDocument(docId);
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
      />

      {/* Main Body: Responsive Sidebar + Conversational Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar: Ingestion & Document Library */}
        <aside
          className="w-full md:w-80 lg:w-96 bg-surface border-r border-border flex flex-col shrink-0 h-[40vh] md:h-full overflow-hidden"
          aria-label="Document Ingestion & Library"
        >
          {/* Upload Section */}
          <div className="p-4 border-b border-border bg-surface shrink-0">
            <UploadDropZone onUploadSuccess={handleUploadSuccess} />
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

  // Interactive prototype workspace
  if (pathname === "/app" || pathname.startsWith("/app/")) {
    return <WorkspaceApp />;
  }

  // Public marketing & documentation routes
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
    case "/login":
    case "/signup":
      return (
        <PublicLayout>
          <AuthNoticePage />
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
    <RouterProvider>
      <RouteDispatcher />
    </RouterProvider>
  );
}
export default App;
