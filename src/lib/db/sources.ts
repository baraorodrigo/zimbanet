// Constantes e tipos de Source — separado de actions/sources.ts porque
// arquivos "use server" só podem exportar funções async.

export const SOURCE_TYPES = ["rss", "scraper", "api", "social", "google_alerts"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_PRIORITIES = ["high", "medium", "low"] as const;
export type SourcePriority = (typeof SOURCE_PRIORITIES)[number];
