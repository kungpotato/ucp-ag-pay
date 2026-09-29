import { listCatalog } from "./backend";
import { runTool, type AgentContext } from "./agent-tools";
import type { CheckoutResult } from "./types";

// Deterministic fallback so the /agent page works with zero setup: no
// OPENROUTER_API_KEY means no LLM reasoning, but the UCP tool calls
// underneath are identical — this proves the checkout flow itself never
// depended on the AI layer, only the *language understanding* did.
// Handles intents: search, add-to-cart-by-name, manual checkout, and
// autonomous Stripe Link Wallet Protocol settlement via Shared Payment Tokens (SPTs).
export async function runFallbackAgent(
  message: string,
  ctx: AgentContext,
): Promise<{ reply: string; cart?: unknown; checkoutUrl?: string; settledOrder?: CheckoutResult }> {
  const text = message.trim();
  const lower = text.toLowerCase();
  const isAutonomousPay = /(stripe link|link wallet|ตัดเงิน|จ่ายเลย|auto|อัตโนมัติ|spt|wallet)/i.test(text);

  const buyMatch = text.match(/(?:ซื้อ|เอา|หยิบ)\s*(.+)/);
  const searchTerm = buyMatch
    ? buyMatch[1].replace(/(?:แล้ว|ช่วย)?(?:ตัดเงิน|จ่าย|ผ่าน|ด้วย|stripe|link|wallet|อัตโนมัติ|เลย)+/gi, "").trim()
    : text;

  if (isAutonomousPay && (!buyMatch || !searchTerm)) {
    const result = await runTool("pay_with_stripe_link", {}, ctx);
    if (result.settledOrder) {
      return {
        reply: `⚡ ชำระเงินสำเร็จอัตโนมัติผ่าน Stripe Link Wallet (SPT) แล้ว!\n• รหัสคำสั่งซื้อ: ${result.settledOrder.order_id}\n• Shared Payment Token: ${result.settledOrder.shared_payment_token}\n• สถานะ: Paid (Succeeded) ✅\nระบบ settle เงินเรียบร้อยแล้วโดยคุณไม่ต้องคลิกออกไปหน้าเว็บหรือกรอกบัตรเลย`,
        settledOrder: result.settledOrder,
      };
    }
    return { reply: "ตะกร้ายังว่างอยู่ ลองบอกชื่อหนังสือที่อยากซื้อก่อนนะ" };
  }

  if (/(ยืนยัน|checkout|เช็คเอาท์|จ่ายเงิน|สรุปยอด)/.test(text) || /checkout/.test(lower)) {
    const result = await runTool("checkout", {}, ctx);
    if (result.checkoutUrl) {
      return {
        reply: `ยืนยันคำสั่งซื้อแล้ว ✅ ไปชำระเงินที่ Stripe ได้ที่ลิงก์นี้: ${result.checkoutUrl}\n(หรือพิมพ์ "ตัดเงินผ่าน Stripe Link" หากต้องการให้ Agent settle อัตโนมัติ)`,
        checkoutUrl: result.checkoutUrl,
      };
    }
    return { reply: "ตะกร้ายังว่างอยู่ ลองบอกชื่อหนังสือที่อยากซื้อก่อนนะ" };
  }

  const products = await listCatalog(searchTerm);

  if (products.length === 0) {
    return { reply: `ไม่พบหนังสือที่ตรงกับ "${searchTerm}" ลองพิมพ์ชื่อเรื่องหรือหัวข้ออื่นดูนะ` };
  }

  if (buyMatch && products.length >= 1) {
    const top = products[0];
    const addResult = await runTool("add_to_cart", { product_id: top.id, quantity: 1 }, ctx);
    if (isAutonomousPay) {
      const payResult = await runTool("pay_with_stripe_link", {}, ctx);
      if (payResult.settledOrder) {
        return {
          reply: `เพิ่ม "${top.title}" ลงตะกร้าและทำการชำระเงินอัตโนมัติผ่าน Stripe Link Wallet (SPT) สำเร็จทันที! ⚡💳\n• รหัสคำสั่งซื้อ: ${payResult.settledOrder.order_id}\n• Shared Payment Token: ${payResult.settledOrder.shared_payment_token}\n• ยอดชำระ: ${(top.price.amount / 100).toLocaleString()} บาท\n• สถานะ: Paid ✅ (ไม่ต้องไปหน้า Stripe Checkout)`,
          cart: addResult.cart,
          settledOrder: payResult.settledOrder,
        };
      }
    }
    return {
      reply: `เพิ่ม "${top.title}" ลงตะกร้าแล้ว 🛒\nพิมพ์ "ยืนยัน" เพื่อรับลิงก์ไปจ่ายเงิน หรือพิมพ์ "ตัดเงินผ่าน Stripe Link" เพื่อชำระเงินอัตโนมัติทันที`,
      cart: addResult.cart,
    };
  }

  const list = products
    .slice(0, 4)
    .map((p) => `• ${p.title} (${p.author}) — ${(p.price.amount / 100).toLocaleString()} บาท`)
    .join("\n");
  return { reply: `เจอหนังสือเหล่านี้:\n${list}\n\nพิมพ์ "ซื้อ <ชื่อหนังสือ>" เพื่อหยิบใส่ตะกร้า` };
}
