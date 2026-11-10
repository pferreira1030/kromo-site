// O gestor confirma um pedido: guarda o valor e envia ao cliente o email com a ligação de pagamento.
import { createClient } from "npm:@supabase/supabase-js@2";
import { admin, cors, env, esc, euros, json, sendEmail } from "../_shared.ts";

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
  const html = `<!doctype html><html lang="pt-PT"><body style="margin:0;background:#EEF2F8;font-family:Arial,Helvetica,sans-serif;color:#070F1E">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden">
<tr><td style="background:#070F1E;padding:20px 32px;color:#fff;font-size:22px;font-weight:800"><img src="${site}/logo-96.png" width="36" height="36" alt="" style="vertical-align:middle;border-radius:10px;margin-right:10px"><span style="vertical-align:middle">FRAMIQ</span></td></tr>
<tr><td style="padding:32px">
<h1 style="margin:0 0 12px;font-size:26px;line-height:1.2">Olá ${esc(order.name)}, o seu pedido foi confirmado.</h1>
<p style="margin:0 0 20px;font-size:16px;line-height:1.55">Analisámos o que nos pediu e podemos avançar. Para começarmos, falta o pagamento.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F8;border-radius:14px"><tr><td style="padding:18px 20px;font-size:15px">
Projeto: <strong>${esc(order.site_type ?? "Website")}</strong><br>Valor a pagar: <strong style="font-size:22px">${euros(cents)}</strong></td></tr></table>
${note ? `<p style="margin:20px 0 0;font-size:15px;line-height:1.55"><em>${esc(note)}</em></p>` : ""}
<p style="margin:28px 0"><a href="${link}" style="background:#2150FF;color:#fff;text-decoration:none;font-weight:700;font-size:17px;padding:16px 30px;border-radius:99px;display:inline-block">Pagar agora</a></p>
<p style="margin:0;font-size:14px;color:#4a5568;line-height:1.55">Pode pagar com cartão, MB WAY ou referência Multibanco. Se o botão não abrir, copie esta ligação:<br><a href="${link}" style="color:#2150FF;word-break:break-all">${link}</a></p>
</td></tr></table></td></tr></table></body></html>`;

  try {
    await sendEmail(order.email, `Pedido confirmado: pague ${euros(cents)} para começarmos`, html);
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
