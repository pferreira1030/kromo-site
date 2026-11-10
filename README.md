# FRAMIQ: site, gestão de pedidos e pagamento SIBS

Ficheiros:

| Ficheiro | Para quê |
|---|---|
| `index.html` | O site. O formulário de contacto cria um pedido na base de dados. |
| `admin.html` | Página do gestor: vê pedidos, define o valor, confirma e envia o email de pagamento. |
| `pagar.html` | Página que o cliente abre a partir do email e onde paga (SIBS). |
| `config.js` | Endereço e chave pública do Supabase. |
| `supabase/` | Base de dados (`schema.sql`) e funções do servidor. |

## Como funciona

1. O cliente preenche o formulário no site. O pedido fica com o estado **Novo**.
2. O gestor entra em `admin.html`, abre o pedido, define o valor e clica em **Confirmar e enviar pagamento**.
3. O cliente recebe um email com o botão **Pagar agora** (`pagar.html?t=...`).
4. O cliente paga com cartão, MB WAY ou referência Multibanco no formulário da SIBS.
5. A SIBS avisa o sistema (webhook) e o pedido passa a **Pago**.

Sem `config.js` preenchido, `admin.html` abre em **modo demonstração** (dados de exemplo, emails simulados).

## Configuração (uma vez)

### 1. Supabase (base de dados e login)
1. Crie um projeto em https://supabase.com (plano gratuito).
2. Em **SQL Editor**, cole e execute `supabase/schema.sql`.
3. Em **Authentication → Users → Add user**, crie o utilizador do gestor (email e palavra-passe).
4. No SQL Editor, autorize esse email: `insert into public.managers (email) values ('o-seu-email@exemplo.pt');`
5. Em **Settings → API**, copie o *Project URL* e a chave *anon* para `config.js`.

### 2. Email (Resend)
1. Crie conta em https://resend.com e uma API key.
2. Para enviar a qualquer cliente, verifique o seu domínio no Resend. Sem domínio só consegue enviar para o seu próprio email (remetente `onboarding@resend.dev`).

### 3. SIBS
Peça à SIBS as credenciais do SIBS Gateway (ambiente de testes primeiro): `terminalId`, `clientId`, token Bearer, e a chave de cifra dos webhooks. Confirme com a SIBS os endereços do ambiente de testes e de produção.

### 4. Publicar as funções
Com o Supabase CLI (https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase secrets set \
  SITE_URL=https://pferreira1030.github.io/kromo-site \
  RESEND_API_KEY=... EMAIL_FROM="FRAMIQ <pedidos@o-seu-dominio.pt>" \
  SIBS_TERMINAL_ID=... SIBS_CLIENT_ID=... SIBS_BEARER_TOKEN=... \
  SIBS_WEBHOOK_SECRET=... \
  SIBS_API_BASE=https://stargate.qly.site1.sibs.pt \
  SIBS_WIDGET_BASE=https://spg.qly.site1.sibs.pt
supabase functions deploy confirm-order get-checkout sibs-webhook
```

`SIBS_API_BASE` e `SIBS_WIDGET_BASE` acima são os de testes. Em produção use os que a SIBS indicar.
Métodos de pagamento: `SIBS_PAYMENT_METHODS` (por omissão `CARD,MBWAY,REFERENCE`).

### 5. Webhook na SIBS
No backoffice da SIBS, configure o endereço de notificações para:

```
https://SEU_PROJECT_REF.supabase.co/functions/v1/sibs-webhook
```

e guarde a mesma chave de cifra em `SIBS_WEBHOOK_SECRET`.

### 6. Testar
Faça um pedido pelo site, confirme-o em `admin.html` com 1 €, abra o email e pague no ambiente de testes da SIBS.

## Segurança
- A chave `anon` em `config.js` é pública por desenho. Quem visita o site só consegue **criar** pedidos; ler e alterar exige login de um email que esteja em `managers`.
- O valor cobrado vem sempre da base de dados, nunca do browser.
- As chaves da SIBS e do Resend ficam só nos *secrets* do Supabase, nunca neste repositório.
