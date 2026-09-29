// Drives the real running app (frontend on :3000, backend on :8080) with a
// headless Chrome and saves PNG frames used to build docs/media/*/demo.gif
// and result.png. Not part of the shipped app — pure documentation tooling.
// Usage: node capture.mjs   (expects `npm run dev` in frontend/ and
// `go run .` in backend/ already running, plus a valid .env at repo root)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const FRAMES_DIR = path.join(ROOT, "docs", "media", "_frames");
const CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

fs.mkdirSync(FRAMES_DIR, { recursive: true });

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return out;
}

const env = loadEnv(path.join(ROOT, ".env"));

function signStripeEvent(sessionId, eventType, secret) {
  const payload = JSON.stringify({
    id: "evt_demo_" + crypto.randomBytes(4).toString("hex"),
    object: "event",
    type: eventType,
    data: { object: { id: sessionId, object: "checkout.session" } },
  });
  const ts = Math.floor(Date.now() / 1000).toString();
  const signedPayload = `${ts}.${payload}`;
  const sig = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  return { payload, header: `t=${ts},v1=${sig}` };
}

async function sendWebhook(sessionId, eventType) {
  const { payload, header } = signStripeEvent(sessionId, eventType, env.STRIPE_WEBHOOK_SECRET);
  const res = await fetch("http://localhost:8080/webhooks/stripe", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Stripe-Signature": header },
    body: payload,
  });
  if (!res.ok) throw new Error(`webhook post failed: ${res.status} ${await res.text()}`);
}

let shotIndex = 0;
async function shot(page, name) {
  shotIndex += 1;
  const file = path.join(FRAMES_DIR, `${String(shotIndex).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file });
  console.log("captured", file);
  return file;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function typeAndSend(page, message) {
  const input = await page.waitForSelector('input[placeholder*="ซื้อ"]');
  await input.click({ clickCount: 3 });
  await input.type(message, { delay: 15 });
  await shot(page, "agent-typed");
  await input.press("Enter");
  // The send button flips to disabled while the /api/agent call is in
  // flight; wait for it to go disabled, then re-enabled, so we screenshot
  // after the reply has actually rendered instead of racing the fetch.
  await page.waitForFunction(
    () => {
      const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "ส่ง");
      return btn?.disabled === true;
    },
    { timeout: 5000 },
  ).catch(() => {});
  await page.waitForFunction(
    () => {
      const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "ส่ง");
      return btn && btn.disabled === false;
    },
    { timeout: 30000 },
  );
}

async function main() {
  const executablePath = CHROME_PATHS.find((p) => fs.existsSync(p));
  if (!executablePath) throw new Error("Google Chrome not found at expected path");

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    defaultViewport: { width: 1000, height: 700 },
  });
  const page = await browser.newPage();

  // --- Lesson 02: catalog -------------------------------------------------
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle0" });
  await shot(page, "home");
  await sleep(300);
  await shot(page, "home-2");

  const firstBook = await page.waitForSelector('a[href^="/book/"]');
  await firstBook.click();
  await page.waitForNetworkIdle({ idleTime: 300 });
  await shot(page, "book-detail");

  // --- Lesson 03/04: manual buy -> Stripe checkout ------------------------
  const buyBtn = await page.waitForSelector("button");
  await buyBtn.click();
  await page.waitForFunction(() => location.hostname.includes("stripe.com"), { timeout: 15000 });
  await sleep(1500);
  await shot(page, "stripe-empty");

  await page.waitForSelector('input[placeholder="email@example.com"]');
  await page.type('input[placeholder="email@example.com"]', "buyer@example.com", { delay: 10 });
  const cardRadio = await page.waitForSelector('input[value="card"], [role="radio"][name*="card" i], input[type="radio"]:nth-of-type(2)');
  await cardRadio.click().catch(() => {});
  await sleep(500);

  const cardNumber = await page.waitForSelector('input[placeholder*="1234"]');
  await cardNumber.type("4242424242424242", { delay: 8 });
  const exp = await page.waitForSelector('input[placeholder*="MM"]');
  await exp.type("1230", { delay: 8 });
  const cvc = await page.waitForSelector('input[placeholder="CVC"]');
  await cvc.type("123", { delay: 8 });
  const name = await page.waitForSelector('input[placeholder*="name" i]');
  await name.type("Kittisak Demo", { delay: 8 });
  await shot(page, "stripe-filled");

  const payBtn = await page.waitForSelector('button[type="submit"], button ::-p-text(Pay)');
  await payBtn.click().catch(async () => {
    const [btn] = await page.$x("//button[contains(., 'Pay')]");
    if (btn) await btn.click();
  });
  await page.waitForFunction(() => location.pathname.startsWith("/success"), { timeout: 20000 });
  await sleep(500);
  await shot(page, "success-pending");

  const url = new URL(page.url());
  const orderId = url.searchParams.get("order_id");
  console.log("order id:", orderId);

  // Look up the Stripe session id for this order from the backend so we can
  // sign a realistic webhook event, then flip the order to paid — exactly
  // what `stripe listen --forward-to ...` would have delivered for real.
  const order = await fetch(`http://localhost:8080/orders/${orderId}`).then((r) => r.json());
  await sendWebhook(order.stripe_session_id, "checkout.session.completed");

  await page.reload({ waitUntil: "networkidle0" });
  await sleep(300);
  await shot(page, "success-paid");

  // --- Lesson 06/07: shopping agent ---------------------------------------
  await page.goto("http://localhost:3000/agent", { waitUntil: "networkidle0" });
  await shot(page, "agent-empty");

  await typeAndSend(page, "อยากได้หนังสือเกี่ยวกับ AI agent");
  await shot(page, "agent-search-result");

  await typeAndSend(page, "เอาเล่มแรกเลย 1 เล่ม");
  await shot(page, "agent-added");

  await typeAndSend(page, "ยืนยันครับ ชำระเงินเลย");
  await sleep(300);
  await shot(page, "agent-checkout-link");

  // --- Lesson 09: autonomous settlement (Stripe Link + SPT) ---------------
  await page.goto("http://localhost:3000/agent", { waitUntil: "networkidle0" });
  await shot(page, "lesson09-empty");

  await typeAndSend(page, "ซื้อ Settlement Layers แล้วตัดเงินผ่าน Stripe Link ให้ด้วย");
  await sleep(1000);
  await shot(page, "lesson09-spt-settled");

  await browser.close();
  console.log("done. frames in", FRAMES_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
