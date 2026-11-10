// Chamada pela página de pagamento do cliente (pagar.html).
// Dado o token do email, cria (ou retoma) a sessão de pagamento do Stripe e devolve o endereço onde o cliente paga.
// Com { check: true } só verifica no Stripe se o pagamento já foi feito.
import { admin, cors, env, euros, json, stripe } from "../_shared.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  let body: { token?: string; check?: boolean };
  try { body = await req.json(); } catch { return json({ error: "Pedido inválido" }, 400); }
  const token = body.token ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(token)) return json({ error: "Ligação inválida." }, 400);

  const db = admin();
  const { data: o } = await db.from("orders").select("*").eq("pay_token", token).maybeSingle();
  if (!o) return json({ error: "Ligação inválida." }, 404);

  const view = { name: o.name, site_type: o.site_type, amount_cents: o.amount_cents, amount: o.amount_cents ? euros(o.amount_cents) : null };

  if (o.status === "pago") return json({ status: "pago", ...view });
  if (o.status !== "confirmado" || !o.amount_cents) {
    return json({ status: o.status, ...view, error: "Este pedido ainda não está disponível para pagamento." }, 409);
  }

  // Já existe uma sessão: ver se foi paga ou se ainda está aberta
  if (o.stripe_session_id) {
    const { ok, data: s } = await stripe(`/checkout/sessions/${o.stripe_session_id}`);
    if (ok && s.payment_status === "paid") {
      await db.from("orders").update({ status: "pago", paid_at: new Date().toISOString() }).eq("id", o.id);
      return json({ status: "pago", ...view });
    }
    if (ok && s.status === "open" && s.url && !body.check) return json({ status: "confirmado", url: s.url, ...view });
    if (body.check) return json({ status: "confirmado", pending: ok && s.status === "complete", ...view });
  } else if (body.check) {
    return json({ status: "confirmado", ...view });
  }

  // Criar uma sessão nova (o preço vem sempre da base de dados, nunca do browser)
  const site = env("SITE_URL").replace(/\/$/, "");
  const { ok, data } = await stripe("/checkout/sessions", {
    mode: "payment",
    locale: "pt",
    success_url: `${site}/pagar.html?t=${token}&done=1`,
    cancel_url: `${site}/pagar.html?t=${token}`,
    customer_email: o.email,
    client_reference_id: o.id,
    "metadata[order_id]": o.id,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": String(o.amount_cents),
    "line_items[0][price_data][product_data][name]": `FRAMIQ - ${o.site_type ?? "Website"}`,
  });
  if (!ok || !data.url) {
    console.error("Stripe checkout falhou", JSON.stringify(data));
    return json({ error: "Não foi possível iniciar o pagamento. Tente novamente dentro de instantes." }, 502);
  }
  await db.from("orders").update({ stripe_session_id: data.id }).eq("id", o.id);
  return json({ status: "confirmado", url: data.url, ...view });
});
