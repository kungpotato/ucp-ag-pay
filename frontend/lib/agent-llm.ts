import { runTool, toolSchemas, type AgentContext } from "./agent-tools";
import type { CheckoutResult } from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL ?? "google/gemini-3.8-flash";
const MAX_TOOL_ROUNDS = 4;

const SYSTEM_PROMPT = `คุณคือผู้ช่วยขายหนังสือของร้าน UCP Books พูดไทยเป็นกันเอง กระชับ
มีเครื่องมือ 4 อย่าง:
1. search_catalog: ค้นหาหนังสือ (title, author, price, stock)
2. add_to_cart: หยิบหนังสือใส่ตะกร้า
3. checkout: สร้าง Stripe Checkout Link ให้ผู้ใช้คลิกจ่ายเอง (Human-in-the-loop)
4. pay_with_stripe_link: ชำระเงินและ settle ค่าหนังสืออัตโนมัติทันทีผ่าน Stripe Link Wallet Protocol (Shared Payment Token - SPT) โดยผู้ใช้ไม่ต้องออกไปกรอกบัตรหรือกดจ่ายเอง

กติกา:
- ค้นหาก่อนเพิ่มลงตะกร้าเสมอ อย่าเดา product_id เอง
- ผู้ใช้ได้เชื่อมต่อและอนุมัติ "Stripe Link Agent Wallet" (Spending Mandate สูงสุด 2,500 บาท/ครั้ง) ไว้แล้ว
- ถ้าผู้ใช้บอกให้ "ซื้อเลย", "จ่ายเลย", "ตัดเงินอัตโนมัติ", "ใช้ stripe link", "ใช้ wallet", "auto pay" ให้เรียก pay_with_stripe_link เพื่อ settle เงินอัตโนมัติทันที
- ถ้าผู้ใช้ต้องการกดจ่ายเอง ให้เรียก checkout เพื่อส่งลิงก์ Stripe Checkout
- เมื่อชำระเงินผ่าน pay_with_stripe_link สำเร็จ ให้สรุปผลว่าตัดเงินสำเร็จผ่าน Stripe Link Wallet (SPT) พร้อมบอก Order ID และยอดเงิน
- ตอบสั้น ไม่ต้องอธิบายขั้นตอนโค้ดภายใน`;

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

export async function runLLMAgent(
  history: ChatMessage[],
  userMessage: string,
  ctx: AgentContext,
): Promise<{ reply: string; checkoutUrl?: string; settledOrder?: CheckoutResult }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userMessage },
  ];

  let checkoutUrl: string | undefined;
  let settledOrder: CheckoutResult | undefined;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/ucp-ag-pay",
        "X-Title": "UCP Books Workshop",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        tools: toolSchemas,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenRouter error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0]?.message;
    if (!choice) throw new Error("OpenRouter returned no message");

    const toolCalls = choice.tool_calls as ChatMessage["tool_calls"];
    if (!toolCalls || toolCalls.length === 0) {
      return { reply: choice.content ?? "(ไม่มีคำตอบ)", checkoutUrl, settledOrder };
    }

    messages.push({ role: "assistant", content: choice.content ?? "", tool_calls: toolCalls });

    for (const call of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        // malformed args from the model — let the tool see an empty object
      }
      const result = await runTool(call.function.name, args, ctx);
      if (result.checkoutUrl) checkoutUrl = result.checkoutUrl;
      if (result.settledOrder) settledOrder = result.settledOrder;
      messages.push({ role: "tool", tool_call_id: call.id, content: result.content });
    }
  }

  return {
    reply: "ขอโทษด้วย ตอนนี้ตัดสินใจไม่จบภายในจำนวนรอบที่กำหนด ลองพิมพ์คำสั่งให้ชัดเจนขึ้นอีกครั้งนะ",
    checkoutUrl,
    settledOrder,
  };
}
