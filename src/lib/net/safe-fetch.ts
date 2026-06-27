// Proteção SSRF central. Todo fetch de URL EXTERNA não-confiável (download de
// imagem da fonte, scraper de URL submetida pelo agente) deve passar por aqui:
// valida o host (bloqueia loopback / IPs privados RFC1918 / link-local IMDS
// 169.254.169.254) E segue redirects MANUALMENTE, revalidando cada salto —
// senão uma URL pública que redireciona pra um IP interno burla a checagem.

// IPv4 privado/loopback/link-local (RFC1918 + 127/8 + 169.254/16 IMDS + 0/8).
function isPrivateIPv4(h: string): boolean {
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const o = m.slice(1, 5).map((n) => parseInt(n, 10));
  if (o.some((n) => n > 255)) return true; // octeto inválido → bloqueia
  if (o[0] === 10) return true;
  if (o[0] === 127) return true;
  if (o[0] === 169 && o[1] === 254) return true; // link-local / IMDS 169.254.169.254
  if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true;
  if (o[0] === 192 && o[1] === 168) return true;
  if (o[0] === 0) return true;
  return false;
}

// Bloqueia localhost, IPs privados v4 (RFC1918), IMDS, e — o que faltava — IPv6:
// loopback (::1), unspecified (::), ULA (fc00::/7), link-local (fe80::/10) e
// IPv4-mapped (::ffff:169.254.169.254 / ::ffff:127.0.0.1), que burlavam a v1.
export function isPrivateHost(host: string): boolean {
  let h = host.toLowerCase().trim();
  // URL.hostname devolve IPv6 entre colchetes — remove pra checar.
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;

  if (h.includes(":")) {
    // IPv4-mapped IPv6: ::ffff:a.b.c.d ou ::ffff:HHHH:HHHH → extrai o IPv4 e checa.
    const mapped = h.match(/^::ffff:(.+)$/i);
    if (mapped) {
      let v4 = mapped[1];
      const hex = v4.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
      if (hex) {
        const hi = parseInt(hex[1], 16);
        const lo = parseInt(hex[2], 16);
        v4 = `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
      }
      return isPrivateIPv4(v4) || !/^\d{1,3}(\.\d{1,3}){3}$/.test(v4);
    }
    if (h === "::1" || h === "::") return true;
    if (/^f[cd]/.test(h)) return true; // ULA fc00::/7
    if (/^fe[89ab]/.test(h)) return true; // link-local fe80::/10
    return false; // outros IPv6 (públicos) — permitido
  }

  return isPrivateIPv4(h);
}

// Valida protocolo, https-em-produção e host público. Lança em URL insegura.
export function assertPublicUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`URL inválida: ${raw}`);
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error(`Protocolo não permitido: ${u.protocol}`);
  }
  if (process.env.NODE_ENV === "production" && u.protocol !== "https:") {
    throw new Error("Apenas https é aceito em produção");
  }
  if (isPrivateHost(u.hostname)) {
    throw new Error(`Host bloqueado (privado/loopback): ${u.hostname}`);
  }
  return u;
}

// fetch que segue redirects MANUALMENTE, validando o host de CADA salto.
// Fecha o SSRF por redirect (URL pública → Location interno como 169.254.169.254).
export async function safeFetch(
  url: string,
  init: RequestInit = {},
  maxHops = 5,
): Promise<Response> {
  let current = assertPublicUrl(url).toString();
  for (let hop = 0; hop <= maxHops; hop++) {
    const res = await fetch(current, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      current = assertPublicUrl(new URL(loc, current).toString()).toString();
      continue;
    }
    return res;
  }
  throw new Error("SSRF guard: redirects demais (possível loop)");
}
