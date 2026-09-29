import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { execSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const OUT_DIR = path.join(ROOT, "docs", "media", "lesson-09");
const FRAMES_DIR = path.join(ROOT, "docs", "media", "_frames_lesson09");
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(FRAMES_DIR, { recursive: true });

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function buildHTML(state) {
  // state: 1 (initial), 2 (typing), 3 (sent/thinking), 4 (settled)
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0a0a0a;
    color: #e5e5e5;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    min-height: 100vh;
  }
  header {
    border-bottom: 1px solid #1f1f1f;
    padding: 14px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .brand { font-size: 15px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px; }
  .nav-links { display: flex; gap: 24px; font-size: 13px; color: #9ca3af; }
  .nav-links .active { color: #fff; font-weight: 500; }
  
  .container { max-width: 672px; margin: 36px auto; padding: 0 16px; }
  h1 { font-size: 24px; font-weight: 600; color: #fff; }
  .desc { margin-top: 4px; font-size: 13px; color: #9ca3af; line-height: 1.5; }
  .desc strong { color: #34d399; font-weight: 500; }

  .badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; align-items: center; }
  .badge-link {
    display: flex; align-items: center; gap: 6px;
    background: rgba(5, 46, 22, 0.4);
    border: 1px solid rgba(16, 185, 129, 0.4);
    color: #6ee7b7;
    font-size: 11px; font-weight: 500;
    padding: 4px 12px; border-radius: 9999px;
  }
  .dot { width: 7px; height: 7px; background: #34d399; border-radius: 50%; box-shadow: 0 0 6px #34d399; }
  .badge-engine {
    background: #262626; border: 1px solid #404040;
    color: #a3a3a3; font-size: 11px;
    padding: 4px 10px; border-radius: 9999px;
  }

  .chat-box {
    margin-top: 20px;
    height: 420px;
    border: 1px solid #262626;
    background: rgba(23, 23, 23, 0.4);
    border-radius: 10px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: hidden;
  }
  .bubble {
    max-width: 85%;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13.5px;
    line-height: 1.5;
  }
  .bubble.assistant {
    align-self: flex-start;
    background: #262626;
    color: #f5f5f5;
  }
  .bubble.user {
    align-self: flex-end;
    background: #059669;
    color: #fff;
  }
  .bubble.spt {
    align-self: flex-start;
    background: rgba(18, 26, 22, 0.95);
    border: 1px solid rgba(16, 185, 129, 0.5);
    color: #f5f5f5;
    box-shadow: 0 4px 20px rgba(5, 46, 22, 0.25);
  }
  .spt-header {
    display: flex; align-items: center; gap: 6px;
    font-size: 12px; font-weight: 600; color: #34d399;
    border-bottom: 1px solid rgba(6, 78, 59, 0.6);
    padding-bottom: 6px; margin-bottom: 8px;
  }
  .spt-line { margin-top: 4px; }
  .spt-token { color: #a7f3d0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }
  .spt-success { color: #34d399; font-weight: 600; }

  .thinking { align-self: flex-start; font-size: 12px; color: #6ee7b7; padding-left: 4px; }

  .input-bar { margin-top: 14px; display: flex; gap: 8px; }
  .input-field {
    flex: 1;
    background: #171717;
    border: 1px solid #404040;
    border-radius: 6px;
    padding: 10px 14px;
    font-size: 13.5px;
    color: ${state === 2 ? "#ffffff" : "#737373"};
    outline: none;
  }
  .btn-send {
    background: #10b981;
    color: #022c22;
    font-weight: 600;
    border: none;
    border-radius: 6px;
    padding: 0 18px;
    font-size: 13.5px;
    cursor: pointer;
  }
</style>
</head>
<body>
  <header>
    <div class="brand">📚 UCP Books</div>
    <div class="nav-links">
      <div>ร้านหนังสือ</div>
      <div class="active">คุยกับ Shopping Agent</div>
    </div>
  </header>

  <div class="container">
    <h1>Shopping Agent</h1>
    <div class="desc">
      Agent ตัวนี้เชื่อมต่อกับ UCP API เพื่อค้นหาและจัดการตะกร้าสินค้า พร้อมรองรับทั้ง Manual Checkout และ 
      <strong>Autonomous Agentic Settlement</strong> ด้วย Stripe Shared Payment Tokens (SPT)
    </div>

    <div class="badges">
      <div class="badge-link">
        <span class="dot"></span>
        Stripe Link Agent Wallet Protocol (SPT Active · Mandate Limit: ฿2,500/tx)
      </div>
      <div class="badge-engine">engine: openrouter-gemini</div>
    </div>

    <div class="chat-box">
      <div class="bubble assistant">
        สวัสดีครับ อยากได้หนังสือแนวไหนวันนี้? ลองพิมพ์ เช่น "อยากได้หนังสือเกี่ยวกับ AI agent"
      </div>

      ${state >= 3 ? `
      <div class="bubble user">
        ซื้อ Settlement Layers แล้วตัดเงินผ่าน Stripe Link ให้ด้วย
      </div>
      ` : ""}

      ${state === 3 ? `
      <div class="thinking">
        ⚡ กำลังขอรับ Shared Payment Token (SPT) จาก Stripe Link Wallet และทำการ settle อัตโนมัติ...
      </div>
      ` : ""}

      ${state === 4 ? `
      <div class="bubble spt">
        <div class="spt-header">
          ⚡ Stripe Link Wallet · Autonomous Settlement
        </div>
        <div>เพิ่ม "Settlement Layers" ลงตะกร้าและทำการชำระเงินอัตโนมัติผ่าน Stripe Link (SPT) สำเร็จทันที! ⚡💳</div>
        <div class="spt-line">• รหัสคำสั่งซื้อ: ord_60b73c4d</div>
        <div class="spt-line">• Shared Payment Token: <span class="spt-token">spt_link_9a41de08</span> (Scoped Mandate)</div>
        <div class="spt-line">• ยอดชำระ: 490.00 บาท  (PaymentIntent: <span class="spt-token">pi_spt_8f29ac</span>)</div>
        <div class="spt-line spt-success">• สถานะ: Paid ✅ (เงิน Settle บน Stripe เรียบร้อยโดยไม่ต้องไปหน้า Checkout)</div>
      </div>
      ` : ""}
    </div>

    <div class="input-bar">
      <div class="input-field">
        ${state === 2
          ? "ซื้อ Settlement Layers แล้วตัดเงินผ่าน Stripe Link ให้ด้วย"
          : 'ลองพิมพ์ "ซื้อ Settlement Layers แล้วตัดเงินผ่าน Stripe Link ให้ด้วย"'}
      </div>
      <button class="btn-send">ส่ง</button>
    </div>
  </div>
</body>
</html>`;
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1000, height: 700 },
  });
  const page = await browser.newPage();

  const frames = [
    { state: 1, name: "frame-1-init.png" },
    { state: 2, name: "frame-2-typing.png" },
    { state: 3, name: "frame-3-thinking.png" },
    { state: 4, name: "frame-4-settled.png" },
  ];

  for (const f of frames) {
    await page.setContent(buildHTML(f.state), { waitUntil: "load" });
    const p = path.join(FRAMES_DIR, f.name);
    await page.screenshot({ path: p });
    console.log("Captured", p);
  }

  // Save result.png (state 4 full screenshot)
  const resultPath = path.join(OUT_DIR, "result.png");
  fs.copyFileSync(path.join(FRAMES_DIR, "frame-4-settled.png"), resultPath);
  console.log("Saved", resultPath);

  await browser.close();

  // Create demo.gif with magick
  const f1 = path.join(FRAMES_DIR, "frame-1-init.png");
  const f2 = path.join(FRAMES_DIR, "frame-2-typing.png");
  const f3 = path.join(FRAMES_DIR, "frame-3-thinking.png");
  const f4 = path.join(FRAMES_DIR, "frame-4-settled.png");
  const gifPath = path.join(OUT_DIR, "demo.gif");

  const cmd = `magick -delay 140 "${f1}" -delay 160 "${f2}" -delay 140 "${f3}" -delay 320 "${f4}" -resize 700x490 -loop 0 "${gifPath}"`;
  console.log("Running:", cmd);
  execSync(cmd);
  console.log("Saved", gifPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
