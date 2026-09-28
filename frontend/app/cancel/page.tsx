import Link from "next/link";

export default function CancelPage() {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-neutral-800 bg-neutral-900/40 p-8 text-center">
      <h1 className="text-xl font-semibold text-neutral-300">ยกเลิกการชำระเงิน</h1>
      <p className="mt-3 text-sm text-neutral-500">ไม่มีการตัดเงินเกิดขึ้น ตะกร้าของคุณยังอยู่</p>
      <Link href="/" className="mt-6 inline-block text-sm underline">
        กลับหน้าร้าน
      </Link>
    </div>
  );
}
