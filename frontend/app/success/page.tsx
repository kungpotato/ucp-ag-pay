import Link from "next/link";
import { getOrder } from "@/lib/backend";
import { formatMoney } from "@/lib/types";

// This page is intentionally a Server Component that re-fetches on every
// visit (no client polling): Stripe sends the webhook to the Go backend in
// parallel with redirecting the browser here, so the order can legitimately
// still say "pending_payment" for a moment. Reload to see it flip to "paid".
export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string }>;
}) {
  const { order_id } = await searchParams;
  if (!order_id) {
    return <Result title="ไม่พบ order_id" body="ลิงก์นี้ไม่สมบูรณ์" tone="warn" />;
  }

  // Fetch outside the JSX-returning branches below: React doesn't render
  // synchronously, so a try/catch wrapped around returned JSX can't actually
  // catch a rendering error — only around the await itself.
  let result: { title: string; body: string; tone: "ok" | "warn" };
  try {
    const order = await getOrder(order_id);
    result =
      order.status === "paid"
        ? {
            title: "ชำระเงินสำเร็จ 🎉",
            body: `ยอดชำระ ${formatMoney(order.total)} — order ${order.id}`,
            tone: "ok",
          }
        : {
            title: "กำลังรอ Stripe ยืนยัน webhook...",
            body: `สถานะปัจจุบัน: ${order.status}. รีเฟรชหน้านี้อีกครั้งในไม่กี่วินาที (ดู lesson 07)`,
            tone: "warn",
          };
  } catch (err) {
    result = {
      title: "เรียกสถานะ order ไม่สำเร็จ",
      body: err instanceof Error ? err.message : String(err),
      tone: "warn",
    };
  }

  return <Result {...result} />;
}

function Result({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "ok" | "warn";
}) {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-neutral-800 bg-neutral-900/40 p-8 text-center">
      <h1 className={`text-xl font-semibold ${tone === "ok" ? "text-emerald-400" : "text-amber-400"}`}>
        {title}
      </h1>
      <p className="mt-3 text-sm text-neutral-400">{body}</p>
      <Link href="/" className="mt-6 inline-block text-sm underline">
        กลับหน้าร้าน
      </Link>
    </div>
  );
}
