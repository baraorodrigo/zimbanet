import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Token de agente: gerado uma vez, mostrado ao admin, guardado só como hash.
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw.trim()).digest("hex");
}

export function generateToken(agentId: string): { raw: string; hash: string } {
  const raw = `zmb_${agentId}_${randomBytes(24).toString("hex")}`;
  return { raw, hash: hashToken(raw) };
}

export function verifyToken(raw: string, hash: string): boolean {
  const a = Buffer.from(hashToken(raw), "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
