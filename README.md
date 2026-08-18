# Viks Man — aplicativo universal

MVP de agendamento da Viks Man para Android, iOS e web, construído com Expo, React Native e Supabase. O cliente usa a mesma conta e a mesma agenda em diferentes dispositivos; a recepção trabalha sobre os mesmos dados.

## Estado atual

- interface responsiva de 320 px a monitores grandes, com navegação própria para mobile e desktop;
- catálogo de serviços, barbeiros e unidade Betim;
- disponibilidade calculada pela jornada, bloqueios, duração e intervalo;
- reserva protegida contra dois clientes no mesmo horário;
- cadastro, login, recuperação de senha, edição e exclusão da conta;
- próximos horários, histórico, cancelamento e reagendamento;
- painel de recepção com visão diária/semanal, clientes, encaixes, status e bloqueios;
- agendamento em grupo de até seis pessoas, gorjeta opcional e divisão sugerida;
- pagamento manual por PIX, baixa pela recepção e histórico de parcelas;
- catálogo, profissionais, regras e chave PIX administráveis pelo painel;
- campanhas segmentadas e agendadas para WhatsApp, sempre com consentimento;
- fila de confirmação, alteração, cancelamento e lembretes;
- RLS em todas as tabelas públicas e funções privilegiadas isoladas no schema privado;
- Edge Functions `delete-account` e `send-reminders` implantadas no Supabase.

Sem variáveis do Supabase, o projeto mantém dados demonstrativos para permitir revisão visual. Com `.env.local`, os fluxos usam o projeto real.

## Rodar localmente

Requer Node.js 22.13 ou superior.

```powershell
npm install
Copy-Item .env.example .env.local
npm run web
```

Preencha em `.env.local`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE
```

Outros comandos:

```bash
npm start          # Expo Go / emuladores
npm run android
npm run ios        # requer macOS para simulador iOS
npm run check      # TypeScript, lint e exportação web
```

## Publicar na Vercel

O repositório já inclui a configuração de build do Expo Web em `vercel.json`.
Ao importar o GitHub na Vercel, use a raiz do repositório. A configuração aplica:

- build command: `npm run export:web`;
- output directory: `dist`;
- install command: `npm install`;
- fallback de SPA para `/book`, `/login`, `/admin` e demais rotas.

As configurações públicas do Supabase usadas pelo bundle web ficam em
`.env.production`. Chaves privadas nunca devem ser adicionadas a esse arquivo.

## Estrutura

- `src/app`: telas, navegação responsiva e painel administrativo;
- `src/context`: autenticação e sincronização de agendamentos;
- `src/lib`: cliente Supabase e notificações;
- `src/types/database.ts`: tipos gerados diretamente do banco remoto;
- `supabase/migrations`: schema, políticas, regras e funções SQL versionadas;
- `supabase/functions`: exclusão de conta e processamento de lembretes;
- `docs/SUPABASE_E_OPERACAO.md`: configuração do ambiente e da equipe;
- `docs/ESCOPO_MVP.md`: recorte funcional e itens posteriores;
- `docs/LOJAS_E_PUBLICACAO.md`: pendências para App Store, Google Play e web.

## Pendências externas para produção

- credenciais e modelos aprovados da conta oficial do WhatsApp;
- SMTP transacional para confirmação e recuperação por e-mail;
- projeto Expo/EAS, credenciais Apple/Google e builds em aparelhos físicos;
- ícone quadrado oficial, política de privacidade e URLs públicas de suporte/exclusão;
- criação das contas da equipe e atribuição dos papéis de recepção/administração.

O agendador do Supabase já executa lembretes e campanhas a cada minuto. Não há SMS no produto. O PIX é manual: o app calcula total, gorjeta e divisão, mas a recepção confirma o recebimento.

Consulte [docs/SUPABASE_E_OPERACAO.md](docs/SUPABASE_E_OPERACAO.md) antes de liberar o ambiente para clientes reais.
