// O gestor confirma um pedido: guarda o valor e envia ao cliente o email com a ligação de pagamento.
import { createClient } from "npm:@supabase/supabase-js@2";
import { admin, cors, env, euros, json, sendEmail } from "../_shared.ts";
import { paymentEmail } from "../_email.ts";
import { LOGO_B64 } from "../_logo.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  // 1. Quem chama tem de ser um gestor autenticado
  const auth = req.headers.get("Authorization") ?? "";
  const userClient = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: u } = await userClient.auth.getUser();
  const email = u?.user?.email?.toLowerCase();
  if (!email) return json({ error: "Sessão inválida. Entre de novo." }, 401);

  const db = admin();
  const { data: mgr } = await db.from("managers").select("email").ilike("email", email).maybeSingle();
  if (!mgr) return json({ error: "Esta conta não tem permissão de gestor." }, 403);

  // 2. Validar o pedido
  let body: { order_id?: string; amount_cents?: number; note?: string };
  try { body = await req.json(); } catch { return json({ error: "Pedido inválido" }, 400); }
  const { order_id, amount_cents, note } = body;
  if (!order_id) return json({ error: "Falta o pedido." }, 400);

  const { data: order } = await db.from("orders").select("*").eq("id", order_id).maybeSingle();
  if (!order) return json({ error: "Pedido não encontrado." }, 404);
  if (order.status === "pago") return json({ error: "Este pedido já foi pago." }, 409);
  if (order.status === "recusado") return json({ error: "Este pedido foi recusado." }, 409);

  const cents = Math.round(Number(amount_cents ?? order.amount_cents));
  if (!Number.isFinite(cents) || cents < 100 || cents > 10_000_000) {
    return json({ error: "Indique um valor entre 1 € e 100 000 €." }, 400);
  }

  // 3. Guardar como confirmado
  const { error: upErr } = await db.from("orders").update({
    status: "confirmado",
    amount_cents: cents,
    manager_note: note ?? order.manager_note,
    confirmed_at: order.confirmed_at ?? new Date().toISOString(),
    // novo valor invalida um checkout SIBS anterior
    sibs_transaction_id: cents === order.amount_cents ? order.sibs_transaction_id : null,
  }).eq("id", order.id);
  if (upErr) return json({ error: upErr.message }, 500);

  // 4. Enviar o email com a ligação de pagamento
  const site = env("SITE_URL").replace(/\/$/, "");
  const link = `${site}/pagar.html?t=${order.pay_token}`;
  const html = paymentEmail({ name: order.name, siteType: order.site_type ?? "Website", cents, note, link, logoSrc: "cid:framiq-logo" });

  try {
    await sendEmail(order.email, `Pedido confirmado: pague ${euros(cents)} para começarmos`, html, [
      { filename: "logo.png", content: LOGO_B64, content_type: "image/png", content_id: "framiq-logo" },
    ]);
  } catch (e) {
    const m = (e as Error).message;
    const teste = m.includes("testing emails") || m.includes("verify a domain");
    return json({
      error: teste
        ? "Pedido confirmado, mas o email não saiu: o Resend ainda está em modo de teste e só envia para o email da conta Resend. Verifique um domínio em resend.com/domains para enviar a clientes."
        : `Pedido confirmado, mas o email falhou: ${m}`,
      saved: true,
    }, 502);
  }
  await db.from("orders").update({ email_sent_at: new Date().toISOString() }).eq("id", order.id);
  return json({ ok: true, amount_cents: cents });
});
