import { getStore } from "@netlify/blobs";
import nodemailer from "nodemailer";

const TWELVE_DATA_API_KEY = "29323895c3884f7aa1c76b42072364e0";

function isTriggered(item) {
  const reasons = [];
  if (item.currentPrice == null) return reasons;
  if (item.percentEnabled && item.referencePrice) {
    const pct = ((item.currentPrice - item.referencePrice) / item.referencePrice) * 100;
    if (item.percentDirection === "drop" && pct <= -Math.abs(item.percentValue)) {
      reasons.push(`down ${Math.abs(pct).toFixed(1)}% from reference`);
    }
    if (item.percentDirection === "rise" && pct >= Math.abs(item.percentValue)) {
      reasons.push(`up ${pct.toFixed(1)}% from reference`);
    }
  }
  if (item.priceEnabled && item.priceValue !== "" && item.priceValue != null) {
    const target = Number(item.priceValue);
    if (item.priceDirection === "below" && item.currentPrice <= target) {
      reasons.push(`at or below $${target}`);
    }
    if (item.priceDirection === "above" && item.currentPrice >= target) {
      reasons.push(`at or above $${target}`);
    }
  }
  return reasons;
}

async function fetchPrice(symbol) {
  try {
    const res = await fetch(
      `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${TWELVE_DATA_API_KEY}`
    );
    const data = await res.json();
    if (data.status === "error" || !data.price) return null;
    const price = parseFloat(data.price);
    return isNaN(price) ? null : price;
  } catch (e) {
    return null;
  }
}

export default async () => {
  const store = getStore("pfg-market-watch");
  const board = await store.get("board", { type: "json" });
  if (!Array.isArray(board) || board.length === 0) {
    return new Response("no board data");
  }

  const alertsToSend = [];

  for (const item of board) {
    const price = await fetchPrice(item.symbol);
    if (price != null) {
      item.currentPrice = price;
      if (item.referencePrice == null) item.referencePrice = price;
      item.lastUpdated = new Date().toISOString();
      item.fetchStatus = "ok";
    } else {
      item.fetchStatus = "error";
    }

    const reasons = isTriggered(item);
    const nowTriggered = reasons.length > 0;

    if (nowTriggered && !item.alertSent) {
      alertsToSend.push({ symbol: item.symbol, label: item.label, reasons });
      item.alertSent = true;
    } else if (!nowTriggered && item.alertSent) {
      item.alertSent = false;
    }
  }

  await store.set("board", JSON.stringify(board));

  if (alertsToSend.length > 0) {
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    const notifyTo = process.env.NOTIFY_TO || gmailUser;

    if (gmailUser && gmailPass) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailPass },
      });

      const lines = alertsToSend
        .map((a) => `${a.symbol}${a.label ? ` (${a.label})` : ""}: ${a.reasons.join(", ")}`)
        .join("\n");

      await transporter.sendMail({
        from: gmailUser,
        to: notifyTo,
        subject: `Market Watch: ${alertsToSend.length} trigger${alertsToSend.length > 1 ? "s" : ""} hit`,
        text: `The following alerts triggered on your Market Watch dashboard:\n\n${lines}`,
      });
    }
  }

  return new Response(`checked ${board.length} symbol(s), ${alertsToSend.length} alert(s) sent`);
};

export const config = { schedule: "*/30 * * * *" };
