import { notFound } from "next/navigation";
import { getProduct } from "@/lib/backend";
import { formatMoney } from "@/lib/types";
import BuyButton from "./buy-button";

export default async function BookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let product;
  try {
    product = await getProduct(id);
  } catch {
    notFound();
  }

  return (
    <div className="grid gap-8 sm:grid-cols-[280px_1fr]">
      <img
        src={product.image_url}
        alt={product.title}
        className="aspect-[3/4] w-full rounded-lg object-cover"
      />
      <div>
        <h1 className="text-2xl font-semibold">{product.title}</h1>
        <p className="mt-1 text-neutral-400">{product.author}</p>
        <p className="mt-4 text-neutral-300">{product.description}</p>
        <p className="mt-6 text-2xl font-semibold text-emerald-400">
          {formatMoney(product.price)}
        </p>
        <p className="mt-1 text-xs text-neutral-500">เหลือในสต็อก {product.stock} เล่ม</p>
        <BuyButton productId={product.id} />
        <p className="mt-3 text-xs text-neutral-600">
          กดปุ่มนี้จะสร้าง UCP cart → เพิ่มสินค้า → เปิด Stripe Checkout (test mode)
          — flow เดียวกับที่ agent ใช้ในหน้า{" "}
          <a href="/agent" className="underline">
            /agent
          </a>
        </p>
      </div>
    </div>
  );
}
