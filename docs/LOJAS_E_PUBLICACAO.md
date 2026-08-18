# Compatibilidade com App Store, Google Play e web

## O que já está preparado

- Expo SDK 57 e React Native com uma base universal para iOS, Android e web.
- Rotas com Expo Router e exportação web estática.
- Identificadores de pacote `com.viksman.app`.
- Perfis de build de desenvolvimento, preview e produção no `eas.json`.
- Backend Supabase com RLS, conta, agenda sincronizada e exclusão pelo app.
- Solicitação contextual de notificações e consentimento separado para WhatsApp.
- Interface responsiva para celulares, tablets e web desktop.

## O que falta antes de publicar

- Conta Apple Developer e conta Google Play Console.
- Projeto Expo/EAS vinculado e credenciais de assinatura.
- Ícone quadrado oficial da marca em alta resolução, ícone adaptativo Android e tela de abertura final.
- URL pública de suporte e política de privacidade em HTML.
- Formulários App Privacy e Data safety preenchidos com o comportamento real do backend e SDKs.
- Capturas de tela, descrição, palavras-chave, classificação etária e dados para revisão.
- Configuração final de SMTP, WhatsApp, monitoramento e plano de suporte.
- Testes em aparelhos físicos e distribuição TestFlight/Play Internal Testing.

## Regras que influenciam o produto

- Se houver criação de conta, a exclusão deve poder ser iniciada dentro do app. No Google Play também será necessária uma página pública para solicitar exclusão.
- Se o Google for oferecido como login principal no iOS, deve existir uma opção equivalente compatível com a regra de Login Services da Apple; Sign in with Apple é a escolha usual.
- Agendamentos, cortes, produtos físicos e serviços consumidos fora do app não usam compra interna das lojas. Pix, Apple Pay, Google Pay ou cartão por um provedor externo são os caminhos adequados.
- Fotos de referência, localização, notificações e contatos só devem solicitar permissão no momento de uso e com explicação clara.
- O app deve permitir navegar pelo catálogo sem login; autenticação deve ser exigida apenas quando necessária para reservar ou acessar dados pessoais.

## Publicação web

`npm run export:web` gera o site estático em `dist/`; `npm run export:sites` também cria o worker de hospedagem. A versão web usa o mesmo Supabase dos aplicativos. Um domínio próprio, analytics consentido e as páginas legais ainda são decisões comerciais.

## Dependências

O `expo-doctor` aprova a combinação atual do SDK 57. O `npm audit` ainda aponta avisos transitivos em ferramentas do Metro/Expo; o reparo automático forçado propõe voltar para um SDK antigo e não deve ser aplicado. O correto é acompanhar os patches oficiais do Expo e atualizar com `npx expo install --fix` quando a correção compatível estiver disponível.

## Referências oficiais

- [Expo Router: Android, iOS e web](https://docs.expo.dev/router/introduction/)
- [Expo: builds para as lojas](https://docs.expo.dev/deploy/build-project/)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple: exclusão de conta no app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Google Play: exclusão de conta](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Google Play: política de pagamentos](https://support.google.com/googleplay/android-developer/answer/10281818)
