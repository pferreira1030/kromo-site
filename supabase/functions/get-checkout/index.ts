// Chamada pela página de pagamento do cliente (pagar.html).
// Dado o token do email, cria (ou retoma) o checkout da SIBS e devolve o que o formulário de pagamento precisa.
// Com { check: true } só verifica na SIBS se o pagamento já foi feito.
import { admin, cors, env, euros, json, sibsBase, sibsHeaders, sibsWidgetBase } from "../_shared.ts";

const PAID = new Set(["Success"]);

async function sibsStatus(transactionID: string) {
  const r = await fetch(`${sibsBase()}/api/v1/payments/${transactionID}/status`, { headers: sibsHeaders() });
  if (!r.ok) return null;
  return await r.json().catch(() => null);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  let body: { token?: string; check?: boolean; return_url?: string };
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

  // Já existe um checkout: confirmar na SIBS se foi pago
  if (o.sibs_transaction_id) {
    const st = await sibsStatus(o.sibs_transaction_id);
    const paymentStatus = st?.paymentStatus ?? st?.returnStatus?.statusMsg;
    if (paymentStatus && PAID.has(paymentStatus)) {
      await db.from("orders").update({ status: "pago", paid_at: new Date().toISOString() }).eq("id", o.id);
      return json({ status: "pago", ...view });
    }
    if (body.check) return json({ status: "confirmado", payment_status: paymentStatus ?? null, ...view });
  } else if (body.check) {
    return json({ status: "confirmado", ...view });
  }

  // Criar um checkout novo (o preço vem sempre da base de dados, nunca do browser)
  const merchantTx = o.id.replace(/-/g, "").slice(0, 32);
  const methods = env("SIBS_PAYMENT_METHODS", "CARD,MBWAY,REFERENCE").split(",").map((s) => s.trim()).filter(Boolean);
  const payload = {
    merchant: { terminalId: Number(env("SIBS_TERMINAL_ID")), channel: "web", merchantTransactionId: merchantTx },
    transaction: {
      transactionTimestamp: new Date().toISOString(),
      description: `FRAMIQ - ${o.site_type ?? "Website"}`,
      moto: false,
      paymentType: "PURS",
      amount: { value: o.amount_cents / 100, currency: "EUR" },
      paymentMethod: methods,
    },
  };
  const r = await fetch(`${sibsBase()}/api/v1/payments`, { method: "POST", headers: sibsHeaders(), body: JSON.stringify(payload) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.transactionID || !data.formContext) {
    console.error("SIBS checkout falhou", r.status, JSON.stringify(data));
    return json({ error: "Não foi possível iniciar o pagamento. Tente novamente dentro de instantes." }, 502);
  }
  await db.from("orders").update({ sibs_transaction_id: data.transactionID, sibs_merchant_tx: merchantTx }).eq("id", o.id);

  const site = env("SITE_URL").replace(/\/$/, "");
  return json({
    status: "confirmado",
    ...view,
    transactionID: data.transactionID,
    formContext: data.formContext,
    transactionSignature: data.transactionSignature ?? null,
    widgetBase: sibsWidgetBase(),
    redirectUrl: `${site}/pagar.html?t=${token}&done=1`,
  });
});
