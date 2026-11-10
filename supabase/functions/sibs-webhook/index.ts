// Notificações (webhook) da SIBS: confirmam pagamentos, incluindo referências Multibanco pagas mais tarde.
// A SIBS envia o corpo cifrado com AES-256-GCM: corpo em base64, IV em X-Initialization-Vector e tag em X-Authentication-Tag.
import { admin, env } from "../_shared.ts";

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function decrypt(body: string, ivB64: string, tagB64: string): Promise<any> {
  const key = await crypto.subtle.importKey("raw", b64(env("SIBS_WEBHOOK_SECRET")), "AES-GCM", false, ["decrypt"]);
  const data = b64(body.trim());
  const tag = b64(tagB64);
  const joined = new Uint8Array(data.length + tag.length); // WebCrypto espera ciphertext + tag
  joined.set(data); joined.set(tag, data.length);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(ivB64), tagLength: 128 }, key, joined);
  return JSON.parse(new TextDecoder().decode(plain));
}

const reply = (n: unknown, status = 200) =>
  new Response(JSON.stringify({ statusCode: String(status), statusMsg: status === 200 ? "Success" : "Error", notificationID: n }), {
    status, headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Método não permitido", { status: 405 });
  try {
    const iv = req.headers.get("X-Initialization-Vector") ?? "";
    const tag = req.headers.get("X-Authentication-Tag") ?? "";
    const n = await decrypt(await req.text(), iv, tag);

    if (n.paymentStatus === "Success" && n.transactionID) {
      const { error } = await admin().from("orders")
        .update({ status: "pago", paid_at: new Date().toISOString() })
        .eq("sibs_transaction_id", n.transactionID).neq("status", "pago");
      if (error) throw error;
    }
    return reply(n.notificationID);
  } catch (e) {
    console.error("Webhook SIBS inválido", e);
    return reply(null, 400); // a SIBS volta a tentar
  }
});
