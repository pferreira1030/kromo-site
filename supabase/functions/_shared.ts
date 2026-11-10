// Utilitários partilhados pelas funções
import { createClient } from "npm:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

export const env = (k: string, fallback = "") => Deno.env.get(k) ?? fallback;

// Cliente com permissões totais (só dentro das funções, nunca no browser)
export const admin = () => createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

export const sibsBase = () => env("SIBS_API_BASE", "https://stargate.qly.site1.sibs.pt");
export const sibsWidgetBase = () => env("SIBS_WIDGET_BASE", "https://spg.qly.site1.sibs.pt");

export const sibsHeaders = () => ({
  "Content-Type": "application/json",
  "Authorization": `Bearer ${env("SIBS_BEARER_TOKEN")}`,
  "X-IBM-Client-Id": env("SIBS_CLIENT_ID"),
});

export const euros = (cents: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(cents / 100);

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env("EMAIL_FROM", "Kromo <onboarding@resend.dev>"), to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Falha ao enviar email (${res.status}): ${await res.text()}`);
}
