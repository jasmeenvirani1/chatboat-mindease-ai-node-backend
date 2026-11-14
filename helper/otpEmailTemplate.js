// Branded HTML email for OTP / password reset codes.
const LOGO_URL = process.env.EMAIL_LOGO_URL || "https://astria.fyi/astria_logo_circle.png";
const SITE_URL = process.env.FRONTEND_URL || "https://astria.fyi";

const buildOtpEmail = ({ otp, minutes = 10, supportEmail = "support@astria.fyi" }) => {
  const digits = String(otp)
    .split("")
    .map(
      (d) =>
        `<td style="padding:0 4px;"><div style="width:44px;height:56px;line-height:56px;text-align:center;font-size:28px;font-weight:700;color:#4c1d95;background:#f5f0ff;border:1px solid #ddd0f7;border-radius:12px;font-family:'Segoe UI',Arial,sans-serif;">${d}</div></td>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your Astria verification code</title></head>
<body style="margin:0;padding:0;background:#0f0a1e;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Use your one-time code to reset your password. It expires in ${minutes} minutes.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0a1e;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(124,58,237,0.35);">
        <tr><td align="center" style="background:linear-gradient(135deg,#2e1065 0%,#6d28d9 55%,#a855f7 100%);background-color:#4c1d95;padding:36px 24px 30px;">
          <img src="${LOGO_URL}" width="76" height="76" alt="Astria" style="display:block;border-radius:50%;border:2px solid rgba(255,255,255,0.35);margin:0 auto 14px;">
          <div style="font-size:26px;font-weight:700;letter-spacing:6px;color:#ffffff;text-transform:uppercase;">Astria</div>
          <div style="font-size:12px;letter-spacing:2px;color:#e9d5ff;margin-top:6px;">✦ &nbsp;YOUR COSMIC COMPANION&nbsp; ✦</div>
        </td></tr>
        <tr><td style="padding:36px 32px 12px;text-align:center;">
          <h1 style="margin:0 0 10px;font-size:22px;color:#1f1237;font-weight:700;">Verify your identity</h1>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#5b5370;">Use the one-time code below to continue resetting your password.</p>
        </td></tr>
        <tr><td align="center" style="padding:24px 16px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>${digits}</tr></table>
        </td></tr>
        <tr><td align="center" style="padding:16px 32px 4px;">
          <span style="display:inline-block;background:#faf5ff;border:1px solid #e9d5ff;color:#6d28d9;font-size:13px;font-weight:600;padding:8px 16px;border-radius:999px;">⏱ Expires in ${minutes} minutes</span>
        </td></tr>
        <tr><td style="padding:24px 32px 8px;">
          <div style="border-top:1px solid #efe9fb;padding-top:20px;font-size:13px;line-height:1.6;color:#7a7191;">
            🔒 <strong style="color:#4c1d95;">Keep this code private.</strong> Astria will never ask you for it by phone, chat or email. If you didn't request this, you can safely ignore this message — your account stays secure.
          </div>
        </td></tr>
        <tr><td align="center" style="background:#faf8ff;padding:22px 24px;margin-top:16px;">
          <div style="font-size:12px;color:#8a82a3;line-height:1.7;">
            Need help? <a href="mailto:${supportEmail}" style="color:#6d28d9;text-decoration:none;font-weight:600;">${supportEmail}</a><br>
            <a href="${SITE_URL}" style="color:#8a82a3;text-decoration:none;">astria.fyi</a> &nbsp;·&nbsp; © ${new Date().getFullYear()} Astria. All rights reserved.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = `Astria – Verify your identity\n\nYour verification code is ${otp}.\nIt is valid for ${minutes} minutes.\n\nIf you didn't request this, ignore this email.\nNeed help? ${supportEmail}`;
  return { html, text };
};

module.exports = { buildOtpEmail };
