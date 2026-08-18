# Recorte funcional — Viks Man

## Decisão de produto

A lista original mistura experiência do cliente, agenda operacional, CRM, financeiro e marketing. O MVP continua focado em provar uma hipótese: o cliente encontra um serviço, escolhe profissional e horário e volta a agendar sem depender da recepção.

## Entregue no MVP 0.3

### Cliente

- home, catálogo, preços, duração e profissionais;
- disponibilidade real e opção “primeiro disponível”;
- agendamento, confirmação, cancelamento, reagendamento e repetição;
- conta por e-mail, recuperação de senha e exclusão;
- agenda e histórico sincronizados entre app e web;
- preferências de push e WhatsApp com consentimento;
- interface responsiva para celular, tablet e desktop.
- grupos de até seis pessoas na mesma cadeira, gorjeta e divisão sugerida;
- chave PIX copiável e situação de pagamento no agendamento.

### Operação

- unidade, serviços, barbeiros e serviços por barbeiro;
- jornada semanal, folgas, intervalos e horários bloqueados;
- agenda diária/semanal, clientes, encaixes, reagendamento e status;
- regras de antecedência, janela de cancelamento, intervalo e agenda futura;
- restrição transacional contra sobreposição de atendimentos;
- auditoria de alterações e fila de notificações.
- gestão de serviços, profissionais, regras comerciais e chave PIX;
- registro manual de PIX e parcelas pela recepção;
- criação, segmentação, agendamento e cancelamento de promoções por WhatsApp.

### Plataforma

- Supabase Auth, Postgres, Realtime, RLS e funções SQL;
- Edge Functions para exclusão de conta e envio de lembretes;
- base universal Expo/React Native para Android, iOS e web;
- tipos TypeScript gerados do schema real e validação automática do projeto.

## Necessário antes de clientes reais

1. Configurar SMTP e as credenciais/modelos aprovados do WhatsApp Business.
2. Criar usuários da equipe e atribuir papéis de recepção, gerência ou administração.
3. Publicar política de privacidade, suporte e página de solicitação de exclusão.
4. Vincular EAS, gerar builds assinados e testar em aparelhos físicos.
5. Aprovar o ícone oficial e produzir materiais das lojas.
6. Definir e treinar a operação para atraso, no-show, encaixe e exceções.
7. Instrumentar analytics consentido e monitoramento de falhas.

## Próxima fase, após uso recorrente

- gateway para confirmação automática de PIX/cartão e cobrança por no-show;
- lista de espera, check-in e fila virtual;
- avaliações e NPS pós-atendimento;
- Viks Club, planos e controle de consumo;
- pontos, indicação, benefícios, gift cards e cupons;
- loja de produtos, agenda recorrente e dependentes;
- Google/Apple Calendar e canais externos de agendamento.

## Fora do escopo até existir demanda comprovada

- feed social, reels, comentários, seguidores e ranking público;
- simulação de corte ou análise facial por IA;
- marketplace/comunidade de barbeiros;
- ERP completo, conciliação, estoque por lote e folha de comissão;
- jornadas multicanal avançadas e dezenas de segmentações comportamentais;
- grupo simultâneo em várias cadeiras e conciliação automática de parcelas.

## Métricas para decidir o próximo investimento

Conclusão e abandono por etapa, ocupação, cancelamento/no-show, repetição em 30–45 dias e parcela de reservas feitas sem recepção. O próximo módulo deve atacar o gargalo observado nessas métricas.
