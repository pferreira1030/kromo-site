# FRAMIQ: site, gestão de pedidos e pagamento Stripe

Ficheiros:

| Ficheiro | Para quê |
|---|---|
| `index.html` | O site. O formulário de contacto cria um pedido na base de dados. |
| `admin.html` | Página do gestor: vê pedidos, define o valor, confirma e envia o email de pagamento. |
| `pagar.html` | Página que o cliente abre a partir do email e onde paga (Stripe). |
| `config.js` | Endereço e chave pública do Supabase. |
| `supabase/` | Base de dados (`schema.sql`) e funções do servidor. |

## Como funciona

1. O cliente preenche o formulário no site. O pedido fica com o estado **Novo**.
2. O gestor entra em `admin.html`, abre o pedido, define o valor e clica em **Confirmar e enviar pagamento**.
3. O cliente recebe um email com o botão **Pagar agora** (`pagar.html?t=...`).
4. O cliente paga com cartão, MB WAY ou Multibanco na página segura do Stripe.
5. O Stripe avisa o sistema (webhook) e o pedido passa a **Pago**.

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

### 3. Stripe (pagamentos)
1. Crie conta em https://stripe.com/pt (pode registar-se como particular ou empresário em nome individual).
2. Fique em **modo de teste** (interruptor "Test mode"). Em **Developers → API keys** copie a *Secret key* (`sk_test_...`).
3. Em **Settings → Payment methods**, ative cartões, MB WAY e Multibanco (a disponibilidade depende da conta).
4. Em **Developers → Webhooks → Add endpoint**:
   - Endpoint URL: `https://SEU_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`
   - Eventos: `checkout.session.completed` e `checkout.session.async_payment_succeeded`
   - Copie o *Signing secret* (`whsec_...`).

### 4. Segredos no Supabase
Em **Edge Functions → Secrets**:

| Nome | Valor |
|---|---|
| `SITE_URL` | `https://pferreira1030.github.io/kromo-site` |
| `RESEND_API_KEY` | chave `re_...` do Resend |
| `EMAIL_FROM` | `FRAMIQ <onboarding@resend.dev>` (com domínio verificado: `FRAMIQ <pedidos@o-seu-dominio.pt>`) |
| `STRIPE_SECRET_KEY` | `sk_test_...` (em produção, `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` |

### 5. Testar
Faça um pedido pelo site, confirme-o em `admin.html` com 1 € e pague com o cartão de teste `4242 4242 4242 4242` (qualquer data futura e qualquer CVC). O pedido passa a **Pago**.

Para cobrar a sério: ative a conta Stripe (identidade e IBAN) e troque as chaves de teste pelas reais.

## Segurança
- A chave `anon` em `config.js` é pública por desenho. Quem visita o site só consegue **criar** pedidos; ler e alterar exige login de um email que esteja em `managers`.
- O valor cobrado vem sempre da base de dados, nunca do browser.
- As chaves do Stripe e do Resend ficam só nos *secrets* do Supabase, nunca neste repositório.
