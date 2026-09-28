# Lesson 02 — UCP Catalog & Cart (Go backend)

![catalog demo](media/lesson-02/demo.gif)

## Goal
เข้าใจว่า UCP endpoint หน้าตาเป็นอย่างไร และทำไมการ "expose แคตตาล็อกแบบมาตรฐาน" ถึงสำคัญกว่าการทำ REST API ปกติ เมื่อเป้าหมายคือให้ AI agent เข้ามาซื้อของแทนคนได้

## สิ่งที่ทำ
ใน `backend/catalog.go`, `backend/cart.go`, `backend/main.go`:

```
GET  /ucp/catalog              → รายการหนังสือทั้งหมด (รองรับ ?q= ค้นหา)
GET  /ucp/catalog/{id}         → รายละเอียดเล่มเดียว
POST /ucp/cart                 → สร้างตะกร้าใหม่
POST /ucp/cart/{id}/items      → เพิ่ม/แก้ไขจำนวนสินค้าในตะกร้า
GET  /ucp/cart/{id}            → ดูตะกร้า
```

หน้าแรก (`frontend/app/page.tsx`) เรียก `GET /ucp/catalog` ตรง ๆ แบบ Server Component — ไม่มี mock data ฝั่ง frontend เลย

## ทำไมต้องมี "รูปแบบมาตรฐาน" แทน REST เดิม ๆ
REST API ปกติออกแบบมาให้ **คนเขียนโค้ด** อ่าน docs แล้วเขียน client เอง แต่ agentic commerce ต้องการให้ **LLM** อ่าน schema แล้วสร้าง client เองแบบ dynamic ความต่างสำคัญคือ:

- **Field ต้องอธิบายตัวเองได้** — `price: {amount, currency}` ชัดเจนกว่า `price_cents: 45900` เพราะ LLM (และ agent ตัวอื่น) เดา unit ผิดได้ง่ายถ้าไม่มี currency กำกับ
- **การค้นหาต้องเป็น free-text ไม่ใช่แค่ filter ตาม id** — agent ไม่รู้ product id ล่วงหน้า มันรู้แค่สิ่งที่ผู้ใช้พูด (`backend/catalog.go` → `Find()`)
- **โครงสร้างต้องเหมือนกันไม่ว่าจะเรียกจากที่ไหน** — ปุ่ม "ซื้อเลย" ของมนุษย์ ([lesson 03](lesson-03.md)) กับ tool ของ agent ([lesson 06](lesson-06.md)) เรียก endpoint ชุดเดียวกันเป๊ะ ๆ

สเปก UCP จริง (ucp.dev) รองรับ category taxonomy หลายมาตรฐาน, media array, variant, seller policy ฯลฯ — ในเวิร์กช็อปนี้ตัดเหลือแค่ field ที่ UI ใช้จริง เพื่อให้อ่านโค้ดแล้วเห็นภาพได้ในไม่กี่นาที (ดู comment ใน `catalog.go`)

## เทียบกับแบบอื่น
ถ้าไม่ทำ endpoint กลางแบบนี้ ทางเลือกคือให้ agent "เดา" จากการ scrape หน้าเว็บ หรือมี integration เฉพาะทางต่อ agent framework แต่ละตัว — ทั้งสองแบบพังง่ายเมื่อ UI เปลี่ยน เพราะ agent ผูกกับ presentation layer ไม่ใช่ data contract

## ต่อยอดได้อะไร
- เพิ่ม pagination / category filter ใน `Find()` ให้ตรงสเปก UCP มากขึ้น
- เพิ่ม field `availability`, `variants` ตามสเปกจริงเมื่อแคตตาล็อกซับซ้อนขึ้น
