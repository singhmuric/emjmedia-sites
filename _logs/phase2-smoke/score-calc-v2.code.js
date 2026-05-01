// Score Calc + Build Sheet Row — Phase-2.
// Patches:
//   P2: email-domain-mismatch — Score-Penalty -10 + signal-Tag
//   P4: no-ssl — Score-Boost +5 + signal-Tag (statisch aus URL-Scheme,
//        unabhängig vom Haiku-Signal — verhindert Drift)

const leadCtxAll = $('HTML Truncate + Merge Context').all();
const haikuAll = $input.all();

function parseHaikuJson(content) {
  if (!content || typeof content !== 'string') return null;
  let s = content.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(s); } catch (e) { /* */ }
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) { /* */ } }
  return null;
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function haikuErrorReason(haikuItem) {
  if (!haikuItem) return 'no_item';
  if (haikuItem.error) {
    const msg = (typeof haikuItem.error === 'string' ? haikuItem.error : (haikuItem.error.message || JSON.stringify(haikuItem.error)));
    return 'http_err:' + String(msg).slice(0, 40);
  }
  if (haikuItem.type === 'error' && haikuItem.error) {
    return 'api_err:' + String(haikuItem.error.type || haikuItem.error.message || 'unknown').slice(0, 40);
  }
  if (!haikuItem.content || !Array.isArray(haikuItem.content) || !haikuItem.content[0]) {
    return 'no_content';
  }
  const t = haikuItem.content[0].text;
  if (!t) return 'empty_text';
  return 'parse_fail:' + String(t).replace(/[\n\r\t]/g, ' ').slice(0, 40);
}

function appendTag(summary, tag) {
  const s = String(summary || '').trim();
  if (!s) return tag;
  if (s.split(',').map(x => x.trim()).includes(tag)) return s;
  return (s + ', ' + tag).slice(0, 80);
}

const out = [];
for (let i = 0; i < leadCtxAll.length; i++) {
  const ctx = leadCtxAll[i].json;
  const haikuItem = haikuAll[i] && haikuAll[i].json;
  let signals = null;
  let haikuError = false;
  let errReason = '';
  if (!haikuItem || haikuItem.error || haikuItem.type === 'error') {
    haikuError = true;
    errReason = haikuErrorReason(haikuItem);
  } else if (haikuItem.content && Array.isArray(haikuItem.content) && haikuItem.content[0] && haikuItem.content[0].text) {
    signals = parseHaikuJson(haikuItem.content[0].text);
    if (!signals) {
      haikuError = true;
      errReason = haikuErrorReason(haikuItem);
    }
  } else {
    haikuError = true;
    errReason = haikuErrorReason(haikuItem);
  }

  let score = 0;
  let summary = '';

  if (haikuError) {
    summary = ('HAIKU_ERR ' + errReason).slice(0, 80);
  } else {
    if (ctx._website_unreachable) {
      score += 30;
    } else {
      // P4: statisches no_ssl-Signal aus URL-Scheme — überschreibt Haiku-Drift.
      // no_ssl trägt 25 (wie bisher der Haiku-no_ssl), zusätzlich +5 Boost wenn
      // das statische Signal aktiv ist (signalisiert: deutlich pitch-relevant).
      const noSslStatic = !!ctx._no_ssl;
      if (noSslStatic) score += 25 + 5;
      else if (signals.no_ssl) score += 25; // Fallback falls Haiku doch was hat
      if (signals.mobile_broken) score += 20;
      if (signals.stale_copyright) {
        const yr = parseInt(String(signals.stale_copyright).match(/\d{4}/)?.[0] || '0', 10);
        if (yr && yr <= 2020) score += 15;
      }
      if (signals.generic_stock_look) score += 10;
      if (signals.load_time_slow) score += 10;
      if (signals.no_clear_cta) score += 8;
      if (signals.no_impressum_link) score += 6;
      if (signals.no_phone_in_header) score += 5;
      if (signals.no_meta_description) score += 3;
    }
    const rc = Number(ctx.review_count) || 0;
    if (rc < 10) score -= 10;
    if (rc > 100) score += 5;
    const gr = Number(ctx.google_rating) || 0;
    if (gr && gr < 3.5) score -= 15;

    summary = (signals && signals.summary) ? String(signals.summary).slice(0, 80) : '';

    // P4: signal-Tag "no-ssl" statisch ergänzen (entkoppelt von Haiku)
    if (ctx._no_ssl && !ctx._website_unreachable) {
      summary = appendTag(summary, 'no-ssl');
    }
  }

  // P2: Domain-Mismatch — Penalty + Tag (auch bei Haiku-Fehler relevant)
  if (ctx._email_domain_mismatch) {
    score -= 10;
    summary = appendTag(summary, 'email-domain-mismatch');
  }

  score = clamp(score, 0, 100);

  const email = ctx._email || '';
  const notes = ctx._inhaber ? ('inhaber:' + ctx._inhaber) : '';

  out.push({
    json: {
      lead_id: ctx.lead_id,
      business_name: ctx.business_name,
      address: ctx.address,
      phone: ctx.phone,
      email: email,
      website_url: ctx.website_url,
      google_rating: ctx.google_rating != null ? ctx.google_rating : '',
      review_count: ctx.review_count != null ? ctx.review_count : '',
      score: score,
      signal_summary: summary,
      status: haikuError ? 'new' : 'scored',
      pitch_date: '',
      notes: notes
    }
  });
}
return out;
