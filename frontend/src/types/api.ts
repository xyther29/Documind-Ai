/**
 * TypeScript API contracts matching FastAPI backend schemas.
 */

export interface HealthResponse {
  status: "ok" | string;
  documents_count: number;
  chunks_count: number;
}

export interface DocumentMeta {
  doc_id: string;
  filename: string;
  page_count: number;
  chunk_count: number;
  file_size_bytes: number;
  created_at: string;
}

export interface DocumentListResponse {
  documents: DocumentMeta[];
  total: number;
}

export interface SearchResult {
  chunk_id: string;
  doc_id: string;
  filename: string;
  text: string;
  start_page: number;
  end_page: number;
  pages: number[];
  page_citation: string;
  score: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total_results: number;
}

export interface AskRequest {
  question: string;
  doc_id?: string | null;
  top_k?: number;
}

export interface AskResponse {
  question: string;
  answer: string;
  sources: SearchResult[];
  fallback_used: boolean;
  fallback_reason?: string | null;
}

/**
 * Frontend conversational Q&A entry state.
 */
export interface QAEntry {
  id: string;
  question: string;
  scopeLabel: string;
  scopeDocId: string | null;
  answer?: string;
  sources?: SearchResult[];
  fallback_used?: boolean;
  fallback_reason?: string | null;
  status: "loading" | "success" | "error";
  errorMessage?: string;
  timestamp: string;
}
