// DNS-MX-Check für Email-Domains.
//
// Verhindert Bounce-Kaskaden wie Zor (04.05.2026: meisterwerkstatt-oemer.de
// existierte in DNS überhaupt nicht, Email war im Impressum aber Domain tot).
//
// API:
//   checkEmailDomain(email, opts) → Promise<{ ok, status, reason, domain, mxHosts }>
//
// status: 'mx_ok' | 'no_mx_a_only' | 'no_dns' | 'invalid_email' | 'timeout' | 'error'
//   ok=true nur bei 'mx_ok'. 'no_mx_a_only' ist warn (RFC-5321-Fallback,
//   aber für Cold-Mail unzuverlässig). 'no_dns' = harte Bounce-Garantie.

import dns from 'node:dns/promises';

const DEFAULT_TIMEOUT_MS = 5000;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout (${ms}ms): ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function extractDomain(email) {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes('@')) return null;
  const parts = trimmed.split('@');
  if (parts.length !== 2) return null;
  const local = parts[0];
  const domain = parts[1];
  if (!local || !domain) return null;
  // Minimal-Sanity: domain hat mindestens einen Punkt.
  if (!domain.includes('.')) return null;
  return domain;
}

export async function checkEmailDomain(email, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const domain = extractDomain(email);

  if (!domain) {
    return {
      ok: false,
      status: 'invalid_email',
      reason: `Email-Format ungültig: "${email}"`,
      domain: null,
      mxHosts: [],
    };
  }

  // 1. MX-Lookup
  try {
    const mx = await withTimeout(dns.resolveMx(domain), timeoutMs, `MX ${domain}`);
    if (Array.isArray(mx) && mx.length > 0) {
      const hosts = mx
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
        .map((m) => m.exchange);
      return {
        ok: true,
        status: 'mx_ok',
        reason: null,
        domain,
        mxHosts: hosts,
      };
    }
    // resolveMx returned [] → seltener Fall, behandeln wie kein MX
  } catch (e) {
    // ENODATA = MX-Record fehlt. ENOTFOUND = Domain existiert nicht.
    if (e.code === 'ENOTFOUND') {
      return {
        ok: false,
        status: 'no_dns',
        reason: `Domain "${domain}" existiert nicht im DNS (ENOTFOUND)`,
        domain,
        mxHosts: [],
      };
    }
    if (e.code !== 'ENODATA' && !String(e.message).startsWith('Timeout')) {
      // Echter DNS-Fehler — propagieren als 'error'
      return {
        ok: false,
        status: 'error',
        reason: `DNS-Fehler (${e.code ?? 'unknown'}): ${e.message}`,
        domain,
        mxHosts: [],
      };
    }
    if (String(e.message).startsWith('Timeout')) {
      return {
        ok: false,
        status: 'timeout',
        reason: e.message,
        domain,
        mxHosts: [],
      };
    }
    // ENODATA: Domain existiert, aber kein MX-Record → A-Record-Fallback prüfen
  }

  // 2. A-Record-Fallback (RFC 5321 §5.1: bei fehlendem MX wird A genutzt)
  try {
    const a = await withTimeout(dns.resolve4(domain), timeoutMs, `A ${domain}`);
    if (Array.isArray(a) && a.length > 0) {
      return {
        ok: false, // bewusst false — Cold-Mail an Domains ohne MX bouncen oft
        status: 'no_mx_a_only',
        reason: `Domain "${domain}" hat A-Record aber keinen MX (RFC-5321-Fallback, Bounce-Risiko)`,
        domain,
        mxHosts: [],
      };
    }
  } catch (e) {
    if (e.code === 'ENOTFOUND') {
      return {
        ok: false,
        status: 'no_dns',
        reason: `Domain "${domain}" existiert nicht im DNS (ENOTFOUND beim A-Lookup)`,
        domain,
        mxHosts: [],
      };
    }
    if (String(e.message).startsWith('Timeout')) {
      return {
        ok: false,
        status: 'timeout',
        reason: e.message,
        domain,
        mxHosts: [],
      };
    }
    // ENODATA bei A → kein A-Record. Fall-through.
  }

  return {
    ok: false,
    status: 'no_dns',
    reason: `Domain "${domain}" hat weder MX noch A-Record (effektiv tot)`,
    domain,
    mxHosts: [],
  };
}

// Bequemlichkeits-Helper für Batch-Checks mit Concurrency-Limit.
export async function checkEmailsConcurrent(emails, opts = {}) {
  const concurrency = opts.concurrency ?? 5;
  const results = new Array(emails.length);
  let i = 0;

  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= emails.length) return;
      results[idx] = {
        email: emails[idx],
        ...(await checkEmailDomain(emails[idx], opts)),
      };
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, emails.length) }, worker);
  await Promise.all(workers);
  return results;
}
