import type { ReactNode } from "react";

// Templates não compartilham chrome do portal (header/footer/sidebar) —
// renderizam fullbleed pra Puppeteer fazer screenshot exato do canvas.
export default function SocialTemplateLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        margin: 0,
        padding: 0,
        background: "transparent",
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      {children}
    </div>
  );
}
