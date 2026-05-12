import Link from "next/link";
import Icon from "./icon";

/**
 * Section header: title + flex hairline + optional link.
 * Mirrors `.zb-section-head` from the spec.
 */
export default function SectionHead({
  title,
  href = "#",
  link = "Ver todas",
}: {
  title: string;
  href?: string;
  link?: string | null;
}) {
  return (
    <div className="zb-section-head">
      <h2>{title}</h2>
      <span className="zb-rule" aria-hidden />
      {link && (
        <Link href={href} className="shrink-0">
          {link} <Icon name="arrow" size={14} />
        </Link>
      )}
    </div>
  );
}
