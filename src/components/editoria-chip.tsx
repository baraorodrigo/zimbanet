import { EDITORIA_LABEL, type EditoriaSlug } from "@/lib/db/types";

// Mapa slug → classe da pílula colorida definida em globals.css (.zb-tag-*).
// Os tokens existem no CSS mas estavam mortos: cards usavam o kicker dourado
// genérico, então as editorias ficavam indistinguíveis. Centralizo aqui pra
// não duplicar o map em 3 componentes.
const TAG_CLASS: Record<EditoriaSlug, string> = {
  cidade: "zb-tag-cidade",
  politica: "zb-tag-politica",
  esporte: "zb-tag-esporte",
  cultura: "zb-tag-cultura",
  policia: "zb-tag-policia",
  praias: "zb-tag-praias",
  economia: "zb-tag-economia",
  opiniao: "zb-tag-opiniao",
};

export type EditoriaChipProps = {
  editoria: EditoriaSlug;
  size?: "sm" | "md";
  className?: string;
};

export default function EditoriaChip({
  editoria,
  size = "md",
  className = "",
}: EditoriaChipProps) {
  const sizeCls = size === "sm" ? "text-[10px] px-1.5 py-[2px]" : "";
  return (
    <span className={`zb-tag ${TAG_CLASS[editoria]} ${sizeCls} ${className}`}>
      {EDITORIA_LABEL[editoria]}
    </span>
  );
}
