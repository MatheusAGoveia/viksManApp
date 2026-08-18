# Supabase e operação

## Projeto conectado

- project ref: `spiobabjyzxtyhcedung`;
- API: `https://spiobabjyzxtyhcedung.supabase.co`;
- cliente: apenas URL e chave publicável em `.env.local`;
- chaves secretas: somente nas Edge Functions, nunca no aplicativo.

## Banco implantado

As migrações em `supabase/migrations` criam:

- `units`, `profiles`, `services`, `barbers` e `barber_services`;
- `working_hours` e `schedule_blocks`;
- `appointments`, `appointment_events` e `client_style_profiles`;
- `push_tokens` e `notification_jobs`;
- `appointment_payments`, `promotions` e `promotion_deliveries`.

Funções públicas disponíveis ao app:

- `get_available_slots`: calcula horários válidos;
- `create_appointment`: valida regras e cria a reserva;
- `cancel_appointment`: aplica a janela de cancelamento;
- `claim_notification_jobs`: uso exclusivo do processador de lembretes.
- `activate_due_promotions` e `claim_promotion_deliveries`: uso exclusivo do processador de campanhas.

A sobreposição de atendimentos ativos é impedida no próprio Postgres. Todas as tabelas públicas têm RLS e os privilégios internos ficam no schema `private`.

## Dados iniciais

A migração inclui a unidade Betim, quatro serviços, Victor, Bruno, relação de serviços e jornada semanal. Preços, horários e regras podem ser alterados pelo painel ou por uma nova migração controlada.

## Autenticação

E-mail/senha já funciona com Supabase Auth. Antes da produção, configurar no Dashboard:

1. URL pública do site e URLs de redirecionamento do app;
2. SMTP transacional e modelos de confirmação/recuperação;
3. proteção contra abuso e limites adequados ao volume.

## Criar acesso da equipe

Primeiro, a pessoa cria uma conta normalmente. Depois, um administrador do banco atribui o papel usando o ID do usuário:

```sql
update public.profiles
set role = 'reception'
where id = (select id from auth.users where email = 'recepcao@exemplo.com');
```

Papéis reconhecidos: `client`, `barber`, `reception`, `manager` e `admin`. Não exponha uma tela pública que permita ao próprio usuário elevar o papel.

## Edge Functions

Implantadas:

- `delete-account`: exige JWT e apaga a conta autenticada;
- `send-reminders`: valida o segredo no Vault, busca trabalhos pendentes e envia push/WhatsApp.

Segredos do WhatsApp ainda necessários no ambiente remoto:

```bash
npx supabase secrets set --project-ref spiobabjyzxtyhcedung WHATSAPP_PHONE_NUMBER_ID=...
npx supabase secrets set --project-ref spiobabjyzxtyhcedung WHATSAPP_ACCESS_TOKEN=...
npx supabase secrets set --project-ref spiobabjyzxtyhcedung WHATSAPP_PROMOTION_TEMPLATE=nome_do_modelo_aprovado
```

O cron `viks-commercial-worker` já está instalado e chama a função a cada minuto. O segredo é gerado e mantido no Supabase Vault. O modelo de promoção deve ter dois parâmetros de corpo: primeiro nome e texto da oferta.

## Tipos e migrações

`src/types/database.ts` foi gerado do projeto remoto. Regere após qualquer alteração de schema:

```bash
npx supabase gen types typescript --project-id spiobabjyzxtyhcedung > src/types/database.ts
```

No fluxo assistido pelo Codex, prefira o gerador do MCP para não manipular chaves. Toda mudança de DDL deve entrar como nova migração; não edite uma migração já aplicada.

## Verificação antes de liberar

1. `npm run check` sem erros;
2. Supabase Security Advisor sem alertas;
3. conta de cliente real: cadastro, recuperação, reserva, cancelamento e exclusão;
4. conta de recepção: criar, reagendar, concluir, no-show e bloquear horário;
5. dois dispositivos tentando o mesmo horário: somente um deve conseguir;
6. push e WhatsApp em ambiente de teste;
7. backups, logs e contatos de suporte definidos.
