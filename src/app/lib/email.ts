type PriceAlertEmailInput = {
  to: string;
  skinName: string;
  previousPrice: number;
  currentPrice: number;
  changePercent: number;
  currency: string;
  detailUrl: string;
};

const currencyFormatter = (currency: string) =>
  new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });

const formatMoney = (value: number, currency: string) =>
  currencyFormatter(currency).format(value);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export async function sendPriceAlertEmail(input: PriceAlertEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    return { sent: false, reason: "missing_email_config" as const };
  }

  const direction = input.changePercent >= 0 ? "vzrostla" : "klesla";
  const absPercent = Math.abs(input.changePercent).toFixed(1);
  const subject = `SkinTrack: ${input.skinName} ${direction} o ${absPercent}%`;
  const previous = formatMoney(input.previousPrice, input.currency);
  const current = formatMoney(input.currentPrice, input.currency);
  const safeName = escapeHtml(input.skinName);
  const safeDetailUrl = escapeHtml(input.detailUrl);

  const text = [
    `${input.skinName} ${direction} o ${absPercent}%.`,
    `Předchozí cena: ${previous}`,
    `Aktuální cena: ${current}`,
    `Detail: ${input.detailUrl}`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
      <h1 style="font-size:20px;margin:0 0 12px">Změna ceny</h1>
      <p><strong>${safeName}</strong> ${direction} o <strong>${absPercent}%</strong>.</p>
      <p>Předchozí cena: <strong>${previous}</strong><br />Aktuální cena: <strong>${current}</strong></p>
      <p><a href="${safeDetailUrl}">Otevřít detail ve SkinTracku</a></p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Resend email failed (${response.status}): ${details}`);
  }

  return { sent: true as const };
}
