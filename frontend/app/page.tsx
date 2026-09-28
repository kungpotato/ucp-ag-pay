import Link from "next/link";
import { listCatalog } from "@/lib/backend";
import { formatMoney } from "@/lib/types";

export default async function HomePage() {
  const products = await listCatalog();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">ร้านหนังสือ (UCP catalog demo)</h1>
      <p className="mb-8 text-sm text-neutral-400">
        รายการนี้ดึงจาก Go backend ผ่าน endpoint{" "}
        <code className="rounded bg-neutral-900 px-1.5 py-0.5">GET /ucp/catalog</code> —
        endpoint แบบเดียวกับที่ Shopping Agent เรียกใช้
      </p>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
        {products.map((p) => (
          <Link
            key={p.id}
            href={`/book/${p.id}`}
            className="group rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 transition hover:border-neutral-600"
          >
            <img
              src={p.image_url}
              alt={p.title}
              className="mb-3 aspect-[3/4] w-full rounded object-cover"
            />
            <h2 className="text-sm font-medium group-hover:text-white">{p.title}</h2>
            <p className="text-xs text-neutral-500">{p.author}</p>
            <p className="mt-2 text-sm font-semibold text-emerald-400">
              {formatMoney(p.price)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
