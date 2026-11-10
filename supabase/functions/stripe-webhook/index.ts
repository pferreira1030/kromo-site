// Avisos (webhook) do Stripe: marcam o pedido como pago, incluindo pagamentos Multibanco feitos mais tarde.
import { admin, env } from "../_shared.ts";

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

async function validSignature(raw: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts["t"]; if (!t || !parts["v1"]) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // fora do prazo de 5 minutos
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`)));
  const given = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  return given.some((g) => g.length === expected.length && [...g].reduce((acc, c, i) => acc | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Método não permitido", { status: 405 });
  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get("stripe-signature") ?? "", env("STRIPE_WEBHOOK_SECRET")))) {
    return new Response("Assinatura inválida", { status: 400 });
  }
  const event = JSON.parse(raw);
  if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
    const s = event.data.object;
    const id = s.metadata?.order_id;
    if (id && s.payment_status === "paid") {
      const { error } = await admin().from("orders").update({ status: "pago", paid_at: new Date().toISOString() }).eq("id", id).neq("status", "pago");
      if (error) { console.error(error); return new Response("Erro", { status: 500 }); }
    }
  }
  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
