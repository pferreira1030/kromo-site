// Email "pedido confirmado" com o aspeto do site FRAMIQ (tabelas e estilos inline, para funcionar no Gmail, Outlook e telemóveis).
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const euros = (cents: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(cents / 100);

const HEAD = `font-family:'Syne','Arial Black',Helvetica,Arial,sans-serif;font-weight:800;`;
const BODY = `font-family:'Instrument Sans',Helvetica,Arial,sans-serif;`;

export function paymentEmail(o: { name: string; siteType: string; cents: number; note?: string | null; link: string; logoSrc: string }) {
  const note = o.note
    ? `<tr><td style="padding:0 40px 8px"><table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="4" bgcolor="#FFB627" style="border-radius:4px"></td>
        <td style="padding:6px 0 6px 16px;${BODY}font-size:15px;line-height:1.6;color:#C9D3EA;font-style:italic">${esc(o.note)}</td></tr></table></td></tr>`
    : "";
  return `<!doctype html>
<html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
<body style="margin:0;padding:0;background:#070F1E">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">O seu pedido foi confirmado. Falta o pagamento de ${euros(o.cents)} para começarmos.</div>
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#070F1E" style="background:#070F1E"><tr><td align="center" style="padding:28px 12px">
<table width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-radius:28px;overflow:hidden;background:#0A1426">

<!-- barra de cor -->
<tr><td><table width="100%" cellpadding="0" cellspacing="0"><tr>
  <td height="6" width="34%" bgcolor="#27D3FF" style="font-size:0;line-height:0">&nbsp;</td>
  <td height="6" width="33%" bgcolor="#FFB627" style="font-size:0;line-height:0">&nbsp;</td>
  <td height="6" width="33%" bgcolor="#FF5A36" style="font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>

<!-- cabeçalho -->
<tr><td style="padding:26px 40px 22px"><table width="100%" cellpadding="0" cellspacing="0"><tr>
  <td width="44" valign="middle"><img src="${o.logoSrc}" width="38" height="38" alt="" style="display:block;border:0;border-radius:11px"></td>
  <td valign="middle" style="${HEAD}font-size:23px;color:#EEF2F8;letter-spacing:.5px">FRAMIQ</td>
  <td align="right" valign="middle"><span style="${BODY}display:inline-block;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#27D3FF;border:1px solid #27D3FF;border-radius:99px;padding:6px 12px;white-space:nowrap">Confirmado</span></td>
</tr></table></td></tr>

<!-- hero -->
<tr><td bgcolor="#2150FF" style="background:#2150FF;background-image:linear-gradient(135deg,#2150FF 0%,#1E7BFF 55%,#27D3FF 100%);padding:44px 40px 40px">
  <div style="${HEAD}font-size:36px;line-height:1.08;letter-spacing:-1px;color:#FFFFFF">Olá <span style="color:#FFE08A">${esc(o.name)}</span>, o seu pedido está confirmado.</div>
  <div style="${BODY}font-size:17px;line-height:1.6;color:#EAF1FF;margin-top:16px">Analisámos o que nos pediu e podemos avançar. Falta só o pagamento para começarmos o seu projeto.</div>
</td></tr>

<!-- resumo -->
<tr><td style="padding:30px 40px 8px"><table width="100%" cellpadding="0" cellspacing="0" bgcolor="#0F1C38" style="background:#0F1C38;border:1px solid #223158;border-radius:20px"><tr><td style="padding:24px 26px">
  <div style="${BODY}font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#8FA0C6">Projeto</div>
  <div style="${HEAD}font-size:21px;color:#EEF2F8;margin-top:4px">${esc(o.siteType)}</div>
  <div style="height:1px;background:#223158;margin:18px 0;line-height:1px;font-size:1px">&nbsp;</div>
  <div style="${BODY}font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#8FA0C6">Valor a pagar</div>
  <div style="${HEAD}font-size:46px;line-height:1.1;letter-spacing:-1.5px;color:#FFB627;margin-top:4px">${euros(o.cents)}</div>
  <div style="${BODY}font-size:13px;color:#8FA0C6;margin-top:6px">Cartão ou MB WAY</div>
</td></tr></table></td></tr>
${note}

<!-- botão -->
<tr><td align="center" style="padding:28px 40px 12px"><table cellpadding="0" cellspacing="0"><tr>
  <td align="center" bgcolor="#FFB627" style="border-radius:99px;background:#FFB627"><a href="${o.link}" style="${HEAD}display:inline-block;font-size:18px;color:#070F1E;text-decoration:none;padding:18px 44px;border-radius:99px">Pagar agora &rarr;</a></td>
</tr></table></td></tr>

<!-- passos -->
<tr><td style="padding:26px 40px 8px"><table width="100%" cellpadding="0" cellspacing="0"><tr>
  <td width="33%" valign="top" style="padding-right:8px"><div style="${HEAD}font-size:26px;color:#27D3FF">1</div><div style="${BODY}font-size:14px;line-height:1.5;color:#C9D3EA;margin-top:2px">Paga em segurança, online</div></td>
  <td width="33%" valign="top" style="padding:0 4px"><div style="${HEAD}font-size:26px;color:#FFB627">2</div><div style="${BODY}font-size:14px;line-height:1.5;color:#C9D3EA;margin-top:2px">Começamos o desenho logo a seguir</div></td>
  <td width="33%" valign="top" style="padding-left:8px"><div style="${HEAD}font-size:26px;color:#FF5A36">3</div><div style="${BODY}font-size:14px;line-height:1.5;color:#C9D3EA;margin-top:2px">O seu site no ar em cerca de 14 dias</div></td>
</tr></table></td></tr>

<!-- ligação alternativa -->
<tr><td style="padding:22px 40px 30px"><div style="${BODY}font-size:13px;line-height:1.6;color:#8FA0C6">Se o botão não abrir, copie esta ligação para o browser:<br><a href="${o.link}" style="color:#27D3FF;word-break:break-all">${o.link}</a></div></td></tr>

<!-- rodapé -->
<tr><td bgcolor="#070F1E" style="background:#070F1E;padding:26px 40px 30px;border-top:1px solid #16233F">
  <div style="${HEAD}font-size:22px;color:#EEF2F8;letter-spacing:.5px">FRAMIQ<span style="color:#27D3FF">.</span></div>
  <div style="${BODY}font-size:13px;line-height:1.6;color:#8FA0C6;margin-top:6px">Estúdio de websites · Porto e Lisboa<br>Não pediu este orçamento? Pode ignorar este email.</div>
</td></tr>

</table></td></tr></table></body></html>`;
}
