"use client";

import { useEffect, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; content: string };

export default function AgentPage() {
  const [turns, setTurns] = useState<Turn[]>([
    { role: "assistant", content: "สวัสดีครับ อยากได้หนังสือแนวไหนวันนี้? ลองพิมพ์ เช่น \"อยากได้หนังสือเกี่ยวกับ AI agent\"" },
  ]);
  const [input, setInput] = useState("");
  const [cartId, setCartId] = useState<string | null>(null);
  const [backendUsed, setBackendUsed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, loading]);

  async function send() {
    const message = input.trim();
    if (!message || loading) return;
    setInput("");
    const nextTurns: Turn[] = [...turns, { role: "user", content: message }];
    setTurns(nextTurns);
    setLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: nextTurns.slice(0, -1),
          cart_id: cartId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "agent error");

      setCartId(data.cart_id);
      setBackendUsed(data.backend);
      setTurns((t) => [...t, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setTurns((t) => [
        ...t,
        { role: "assistant", content: `เกิดข้อผิดพลาด: ${err instanceof Error ? err.message : String(err)}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Shopping Agent</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Agent ตัวนี้เรียก UCP endpoint เดียวกับปุ่ม &ldquo;ซื้อเลย&rdquo; ในหน้าเว็บ ผ่านเครื่องมือ
        search_catalog / add_to_cart / checkout
        {backendUsed && (
          <span className="ml-2 rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
            engine: {backendUsed}
          </span>
        )}
      </p>

      <div
        ref={scrollRef}
        className="mt-6 flex h-[420px] flex-col gap-3 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-900/40 p-4"
      >
        {turns.map((t, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
              t.role === "user"
                ? "self-end bg-emerald-600 text-white"
                : "self-start bg-neutral-800 text-neutral-100"
            }`}
          >
            {t.content}
          </div>
        ))}
        {loading && <div className="self-start text-xs text-neutral-500">กำลังคิด...</div>}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder='ลองพิมพ์ "ซื้อ Settlement Layers" แล้วพิมพ์ "ยืนยัน"'
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <button
          onClick={send}
          disabled={loading}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          ส่ง
        </button>
      </div>
    </div>
  );
}
