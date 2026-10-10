/*
 * Принимает заявку из лид-магнита и пересылает её эксперту в Telegram.
 *
 * Токен бота и chat_id хранятся НЕ здесь, а в настройках проекта на Netlify:
 * Project configuration → Environment variables:
 *   TELEGRAM_BOT_TOKEN — токен от @BotFather
 *   TELEGRAM_CHAT_ID   — ваш chat_id (число от @userinfobot)
 *
 * Перед первой заявкой откройте своего бота в Telegram и нажмите «Старт»,
 * иначе Telegram не разрешит боту написать вам.
 */

const MAX = 300; // ограничение длины одного поля, чтобы никто не прислал «простыню»

function clean(value) {
  return String(value == null ? "" : value).trim().slice(0, MAX);
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { ok: false, error: "Only POST" });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error("Не заданы TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID в Environment variables");
    return json(500, { ok: false, error: "Server is not configured" });
  }

  let lead;
  try {
    lead = await req.json();
  } catch (e) {
    return json(400, { ok: false, error: "Bad JSON" });
  }

  if (!clean(lead.name) || !clean(lead.contact)) {
    return json(400, { ok: false, error: "Name and contact are required" });
  }

  const answers = Array.isArray(lead.answers) ? lead.answers.slice(0, 20) : [];
  const scores = lead.scores && typeof lead.scores === "object" ? lead.scores : {};
  const utm = lead.utm && typeof lead.utm === "object" ? lead.utm : {};

  const lines = [
    "✨ Новая заявка на расшифровку",
    "",
    "Имя: " + clean(lead.name),
    "Дата рождения: " + clean(lead.birthDate),
    "Мессенджер: " + clean(lead.messenger),
    "Контакт: " + clean(lead.contact),
    "",
    "Архетип: " + clean(lead.result),
    "Баллы: " + Object.keys(scores).map((k) => clean(k) + " " + Number(scores[k] || 0)).join(", "),
    "",
    "Ответы:",
    ...answers.map((a, i) => (i + 1) + ". " + clean(a && a.question) + " — " + clean(a && a.answer))
  ];

  const utmText = Object.keys(utm).map((k) => clean(k) + "=" + clean(utm[k])).join(", ");
  if (utmText) lines.push("", "UTM: " + utmText);
  lines.push("", "Время: " + clean(lead.createdAt));

  const tg = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: lines.join("\n").slice(0, 4000) })
  });

  if (!tg.ok) {
    console.error("Telegram ответил ошибкой:", tg.status, await tg.text());
    return json(502, { ok: false, error: "Telegram error" });
  }

  return json(200, { ok: true });
};
