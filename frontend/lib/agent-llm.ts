import { runTool, toolSchemas, type AgentContext } from "./agent-tools";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL ?? "google/gemini-3.8-flash";
const MAX_TOOL_ROUNDS = 4;

const SYSTEM_PROMPT = `คุณคือผู้ช่วยขายหนังสือของร้าน UCP Books พูดไทยเป็นกันเอง กระชับ
มีเครื่องมือ 3 อย่าง: search_catalog, add_to_cart, checkout
กติกา:
- ค้นหาก่อนเพิ่มลงตะกร้าเสมอ อย่าเดา product_id เอง
- ถามยืนยันสั้น ๆ ก่อนเรียก checkout ทุกครั้ง (เช่น "ยืนยันซื้อเล่มนี้เลยไหม?")
- เมื่อ checkout สำเร็จ ให้ส่งลิงก์ checkout_url ให้ผู้ใช้ตรง ๆ
- ตอบสั้น ไม่ต้องอธิบายขั้นตอนภายใน`;

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
): Promise<{ reply: string; checkoutUrl?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userMessage },
  ];

  let checkoutUrl: string | undefined;

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
      return { reply: choice.content ?? "(ไม่มีคำตอบ)", checkoutUrl };
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
      messages.push({ role: "tool", tool_call_id: call.id, content: result.content });
    }
  }

  return {
    reply: "ขอโทษด้วย ตอนนี้ตัดสินใจไม่จบภายในจำนวนรอบที่กำหนด ลองพิมพ์คำสั่งให้ชัดเจนขึ้นอีกครั้งนะ",
    checkoutUrl,
  };
}
