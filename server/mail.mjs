// Transactional email, zero dependencies: posts to a provider's HTTP API with fetch.
// Default provider is Resend (https://resend.com). Gated on env vars:
//   RESEND_API_KEY   your Resend API key
//   MAIL_FROM        a verified sender, e.g. "Oneiratory <noreply@oneiratory.com>"
//                    (for testing before you own a domain, Resend allows "onboarding@resend.dev")
// When these are unset, mail is "not configured" and the caller falls back to the
// dev flow (the sign-in link is returned to the browser instead of emailed).

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const MAIL_FROM = process.env.MAIL_FROM || '';
const BRAND = 'Oneiratory';

export function mailConfigured() {
  return !!(RESEND_API_KEY && MAIL_FROM);
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Send the one-time sign-in link. `link` is a fully-qualified URL to auth.html?token=...
export async function sendMagicLink(email, link) {
  if (!mailConfigured()) throw new Error('mail_not_configured');
  const safeLink = esc(link);
  const subject = `Your ${BRAND} sign-in link`;
  const text =
    `Sign in to ${BRAND} by opening this link (valid for 15 minutes):\n\n${link}\n\n` +
    `If you did not request this, you can safely ignore this email.`;
  const html =
    `<div style="font-family:Georgia,'Times New Roman',serif;color:#282440;max-width:520px;margin:0 auto;padding:24px">` +
      `<p style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.6">` +
        `Sign in to <b>${BRAND}</b> by clicking the button below. The link is valid for 15 minutes and can be used once.</p>` +
      `<p style="margin:24px 0"><a href="${safeLink}" style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;font-weight:600;color:#ffffff;background:#bb6647;border:1px solid #a5583b;border-radius:6px;padding:12px 22px;text-decoration:none;display:inline-block">Sign in to ${BRAND}</a></p>` +
      `<p style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:12.5px;color:#5c567c;line-height:1.6">Or paste this link into your browser:<br><span style="word-break:break-all">${safeLink}</span></p>` +
      `<p style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:12.5px;color:#948dae;line-height:1.6;margin-top:24px">If you did not request this, you can safely ignore this email.</p>` +
    `</div>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + RESEND_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ from: MAIL_FROM, to: [email], subject, text, html }),
  });
  if (!r.ok) {
    let detail = '';
    try { detail = JSON.stringify(await r.json()); } catch { /* ignore */ }
    throw new Error('mail_send_failed:' + r.status + ':' + detail.slice(0, 200));
  }
  return true;
}
