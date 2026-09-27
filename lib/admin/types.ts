export type AdminOverview = {
  artists: { id: string; name: string; nationality: string | null }[];
  artworks: { id: string; title: string; image_rights_state: string; is_published: boolean; source_name: string }[];
  rightsQueue: { id: string; title: string; image_rights_state: string; source_name: string }[];
  listings: { id: string; artwork_id: string; status: string; is_demo: boolean; last_verified_at: string | null; expires_at: string | null }[];
  syncRuns: { id: string; source_name: string; status: string; started_at: string; records_seen: number; records_upserted: number; records_rejected: number; error_summary: unknown }[];
  auditLogs: { id: string; action: string; resource_type: string; resource_id: string | null; created_at: string }[];
  diagnostics: { sampleSize: number; events: Record<string, number>; recommendationProvider: string; availableSources: string[] };
};
