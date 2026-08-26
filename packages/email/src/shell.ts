import { LOGO_URL, LOGO_DISPLAY_WIDTH, LOGO_DISPLAY_HEIGHT } from './logo';

export interface DetailRow {
  label: string;
  value: string;
}

export interface EmailAction {
  label: string;
  url: string;
}

export interface BuildEmailParams {
  preheaderText: string;
  headline: string;
  bodyParagraphs: string[];
  detailRows?: DetailRow[];
  primaryAction?: EmailAction;
  secondaryLink?: EmailAction;
}

export interface BuiltEmail {
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildEmail(params: BuildEmailParams): BuiltEmail {
  const { preheaderText, headline, bodyParagraphs, detailRows, primaryAction, secondaryLink } = params;

  const bodyHtml = bodyParagraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#4b5563;">${p}</p>`)
    .join('\n');

  const detailCardHtml = detailRows?.length
    ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #e5e7eb;border-radius:8px;margin:8px 0 24px;">
      <tr><td style="padding:16px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${detailRows
            .map(
              (row, i) => `
          <tr>
            <td style="padding:${i === 0 ? '0' : '8px'} 0 8px;font-size:14px;color:#6b7280;${i < detailRows.length - 1 ? 'border-bottom:1px solid #f3f4f6;' : ''}">${escapeHtml(row.label)}</td>
            <td align="right" style="padding:${i === 0 ? '0' : '8px'} 0 8px;font-size:14px;color:#111827;font-weight:500;${i < detailRows.length - 1 ? 'border-bottom:1px solid #f3f4f6;' : ''}">${escapeHtml(row.value)}</td>
          </tr>`
            )
            .join('')}
        </table>
      </td></tr>
    </table>`
    : '';

  const primaryActionHtml = primaryAction
    ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;">
      <tr><td style="border-radius:8px;background:#FF6B35;">
        <a href="${primaryAction.url}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(primaryAction.label)}</a>
      </td></tr>
    </table>`
    : '';

  const secondaryLinkHtml = secondaryLink
    ? `<p style="margin:8px 0 0;font-size:14px;"><a href="${secondaryLink.url}" style="color:#FF6B35;text-decoration:none;">${escapeHtml(secondaryLink.label)}</a></p>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(headline)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheaderText)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td align="center" style="background:#ffffff;padding:32px 40px 24px;">
              <img src="${LOGO_URL}" width="${LOGO_DISPLAY_WIDTH}" height="${LOGO_DISPLAY_HEIGHT}" alt="Dineiz" style="display:block;width:${LOGO_DISPLAY_WIDTH}px;height:${LOGO_DISPLAY_HEIGHT}px;">
            </td>
          </tr>
          <tr>
            <td style="padding:8px 40px 40px;">
              <h1 style="margin:0 0 20px;font-size:24px;font-weight:600;color:#111827;">${escapeHtml(headline)}</h1>
              ${bodyHtml}
              ${detailCardHtml}
              ${primaryActionHtml}
              ${secondaryLinkHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #e5e7eb;background:#fafafa;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">Dineiz &middot; dineiz.com</p>
              <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">Questions? Reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    headline,
    '',
    ...bodyParagraphs.map((p) => p.replace(/<[^>]+>/g, '')),
    detailRows?.length ? '' : '',
    ...(detailRows?.map((r) => `${r.label}: ${r.value}`) ?? []),
    primaryAction ? `\n${primaryAction.label}: ${primaryAction.url}` : '',
    secondaryLink ? `${secondaryLink.label}: ${secondaryLink.url}` : '',
    '',
    'Dineiz · dineiz.com',
    'Questions? Reply to this email.',
  ]
    .filter((line, i, arr) => !(line === '' && arr[i - 1] === ''))
    .join('\n')
    .trim();

  return { html, text };
}
