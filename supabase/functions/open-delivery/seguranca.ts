// Open Delivery — checagens puras (sem Deno), usadas pela open-delivery e
// testáveis fora do Supabase: anti-SSRF da URL do webhook e assinatura HMAC.

// IP privado, local, reservado ou de metadados de nuvem? (IPv4 e IPv6)
export function ipBloqueado(ip: string): boolean {
  const v = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");
  const m4 = v.match(/^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m4) {
    const [a, b] = [Number(m4[1]), Number(m4[2])];
    if ([m4[1], m4[2], m4[3], m4[4]].some((x) => Number(x) > 255)) return true;
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||          // CGNAT
      (a === 169 && b === 254) ||                    // link-local / metadados (169.254.169.254)
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19));
  }
  if (v.includes(":")) {
    if (v === "::" || v === "::1") return true;
    if (/^(fc|fd)/.test(v)) return true;            // ULA
    if (/^fe[89ab]/.test(v)) return true;           // link-local
    if (/^ff/.test(v)) return true;                 // multicast
    if (v.startsWith("fd00:ec2")) return true;      // metadados AWS IPv6
    return false;
  }
  return true; // formato desconhecido: na dúvida, bloqueia
}

// Regras da URL antes de resolver o DNS: só https, porta 443, domínio (não IP),
// sem usuário/senha embutidos, sem nomes internos.
export function urlWebhookOk(url: string): { ok: boolean; motivo?: string; host?: string } {
  let u: URL;
  try { u = new URL(url); } catch { return { ok: false, motivo: "url_invalida" }; }
  if (u.protocol !== "https:") return { ok: false, motivo: "so_https" };
  if (u.username || u.password) return { ok: false, motivo: "credencial_na_url" };
  if (u.port && u.port !== "443") return { ok: false, motivo: "porta_nao_permitida" };
  const h = u.hostname.toLowerCase();
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") ||
      h.startsWith("metadata") || !h.includes(".")) return { ok: false, motivo: "host_interno" };
  if (/^[\d.]+$/.test(h) || h.includes(":") || h.startsWith("[")) return { ok: false, motivo: "ip_literal" };
  return { ok: true, host: h };
}

export async function hmacSha256Hex(segredo: string, corpo: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(corpo));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
