import { listCatalog } from "./backend";
import { runTool, type AgentContext } from "./agent-tools";

// Deterministic fallback so the /agent page works with zero setup: no
// OPENROUTER_API_KEY means no LLM reasoning, but the UCP tool calls
// underneath are identical — this proves the checkout flow itself never
// depended on the AI layer, only the *language understanding* did.
// Handles exactly three intents: search, add-to-cart-by-name, checkout.
export async function runFallbackAgent(
  message: string,
  ctx: AgentContext,
): Promise<{ reply: string; cart?: unknown; checkoutUrl?: string }> {
  const text = message.trim();
  const lower = text.toLowerCase();

  if (/(ยืนยัน|checkout|เช็คเอาท์|จ่ายเงิน|สรุปยอด)/.test(text) || /checkout/.test(lower)) {
    const result = await runTool("checkout", {}, ctx);
    if (result.checkoutUrl) {
      return {
        reply: `ยืนยันคำสั่งซื้อแล้ว ✅ ไปชำระเงินที่ Stripe ได้ที่ลิงก์นี้: ${result.checkoutUrl}`,
        checkoutUrl: result.checkoutUrl,
      };
    }
    return { reply: "ตะกร้ายังว่างอยู่ ลองบอกชื่อหนังสือที่อยากซื้อก่อนนะ" };
  }

  const buyMatch = text.match(/(?:ซื้อ|เอา|หยิบ)\s*(.+)/);
  const searchTerm = buyMatch ? buyMatch[1] : text;
  const products = await listCatalog(searchTerm);

  if (products.length === 0) {
    return { reply: `ไม่พบหนังสือที่ตรงกับ "${searchTerm}" ลองพิมพ์ชื่อเรื่องหรือหัวข้ออื่นดูนะ` };
  }

  if (buyMatch && products.length >= 1) {
    const top = products[0];
    const result = await runTool("add_to_cart", { product_id: top.id, quantity: 1 }, ctx);
    return {
      reply: `เพิ่ม "${top.title}" ลงตะกร้าแล้ว 🛒 พิมพ์ "ยืนยัน" เมื่อพร้อมชำระเงิน`,
      cart: result.cart,
    };
  }

  const list = products
    .slice(0, 4)
    .map((p) => `• ${p.title} (${p.author}) — ${(p.price.amount / 100).toLocaleString()} บาท`)
    .join("\n");
  return { reply: `เจอหนังสือเหล่านี้:\n${list}\n\nพิมพ์ "ซื้อ <ชื่อหนังสือ>" เพื่อหยิบใส่ตะกร้า` };
}
