import type { AgentPermissions } from "./permissions";

// Presets de papel/permissão dos agentes. Módulo comum (sem "use server"),
// importado tanto pela server action quanto pelo formulário cliente.
export const AGENT_PRESETS: Record<
  string,
  { label: string; type: string; permissions: AgentPermissions }
> = {
  editor: {
    label: "Editor — edita rascunho + SEO",
    type: "editor",
    permissions: { read: ["articles", "drafts", "analytics"], write: ["article_content", "slug"] },
  },
  seo: {
    label: "SEO — só slug/tags",
    type: "seo",
    permissions: { read: ["articles"], write: ["slug"] },
  },
  radar: {
    label: "Operador do radar — roda o pipeline",
    type: "radar",
    permissions: { read: ["analytics"], write: ["radar"] },
  },
  director: {
    label: "Diretor — só leitura (coordenação)",
    type: "director",
    permissions: { read: ["all"], write: [] },
  },
};
