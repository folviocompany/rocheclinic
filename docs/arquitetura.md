# Arquitetura e decisões

## Fundação

Next.js App Router e TypeScript strict. Server Components para leituras; Server Actions para login/logout, com validação Zod. Supabase Auth + PostgreSQL com RLS; sem Prisma. Tailwind CSS e componentes locais compatíveis com shadcn/ui (Button com Radix Slot/CVA), Lucide para ícones. Recharts, React Hook Form e date-fns serão adicionados nas fases que os utilizarem. Fontes DM Sans e Cormorant Garamond servidas localmente via Fontsource, sem requisições a provedores de fontes durante o uso.

O proxy renova cookies; não é a única barreira de segurança. A camada de acesso em `src/features/auth/data-access.ts` centraliza `requireMember`, valida as claims do token e busca perfil e profissional em paralelo, selecionando somente os campos necessários. Páginas e Server Actions protegidas chamam essa camada perto da leitura ou mutação. Futuras ações devem repetir essa autorização e validar entrada. Nenhuma chave administrativa é utilizada pela aplicação.

## Desempenho e experiência de navegação

- Rotas privadas são dinâmicas porque dependem da sessão e de dados por usuária. O `loading.tsx` do grupo de dashboard fornece feedback imediato e permite streaming/prefetch parcial.
- Server Actions invalidam a rota afetada com `revalidatePath`; componentes clientes não devem chamar `router.refresh()` para a mesma mutação, evitando uma segunda renderização completa.
- Consultas independentes devem usar `Promise.all`, selecionar colunas explícitas e permanecer na camada da feature responsável.
- O proxy não processa páginas públicas nem arquivos estáticos. Autorização real permanece no DAL e nas políticas RLS.
- Alterações de desempenho exigem teste de regressão em `tests/performance.test.mjs`, além da suíte funcional e do build.

## Estratégia de testes

O projeto segue ciclos vermelho-verde-refatoração. Regras puras ficam em testes unitários; integridade, RLS e funções SQL são exercitadas no PostgreSQL embarcado; contratos arquiteturais importantes têm testes de regressão. Toda mudança deve passar por `npm test`, `npm run typecheck` e `npm run build` antes de ser integrada.

## Modelo já criado

- `profiles`: vínculo explícito com Auth, nome e situação do acesso. Sem escrita por usuários comuns.
- `professionals`: vínculo único com perfil, especialidade e cor. Metadados profissionais acessíveis às integrantes ativas para a futura agenda compartilhada.
- `procedures`: pertence a exatamente uma profissional; preço em centavos inteiros, duração, retorno configurável, confirmação por padrão e desativação. A profissional lê e modifica apenas seu catálogo. Não pode transferir a propriedade ou excluir registros.
- `rooms`: salas da clínica, leitura pelas integrantes e manutenção administrativa nesta fase.
- `business_settings`: nome rocheclinic, moeda BRL e fuso configurável; registro único.
- `audit_logs`: ator, tabela, ID, operação e instante, sem cópia de dados pessoais. Usuária lê seus eventos e não pode alterá-los. Eventos administrativos têm ator nulo quando executados diretamente pelo operador.

UUIDs, referências, constraints, índices, UTC via timestamptz e atualização de timestamps no banco. Valores monetários usam inteiros em centavos e validação no servidor, dentro de um intervalo representável com segurança em JavaScript.

## Evolução do modelo

Fase 2 parcial: `clients` compartilhados e preferências de contato estão implementados. Permanecem `appointments`, `appointment_status_history` e `service_records`. O futuro agendamento referenciará procedimento e profissional com integridade composta, impedirá conflitos por profissional/sala no banco e separará ocupação compartilhável de dados pessoais e notas privadas.

Fase financeira em andamento: `receivables`, `payments` e `expenses` estão implementados. Recebível não é pagamento; pagamentos parciais são transações relacionadas e não duplicam faturamento. O dashboard consolida caixa/competência e gastos individuais/compartilhados. Permanecem categorias administráveis, recorrência, edição financeira documentada, estorno e conciliações adicionais.

Dashboard financeiro: indicadores e gráficos mensais reais por caixa/competência estão implementados. Permanecem relatórios detalhados e CSV seguro.

Fase 5: `return_reminders`, participações societárias versionadas, `profit_distributions`, reservas e ajustes. Percentuais iniciais 50/50; estimativas gerenciais, sem transferências bancárias. Retornos clínicos sempre dependem da confirmação profissional. WhatsApp somente por link e contato autorizado.

Fase 6: revisão de segurança, testes integrados, acessibilidade/responsividade, publicação e restauração verificada. Segurança e testes críticos também são feitos em cada etapa.

## Limites

Sem prontuários, diagnósticos, imagens clínicas ou dados sensíveis de saúde. Exclusão e retenção de dados de clientes precisam de política operacional antes da entrada de dados reais. O esquema futuro é planejamento, não funcionalidade já entregue. O isolamento atual de catálogos segue a decisão do usuário e substitui a hipótese do briefing de procedimentos habilitados para múltiplas profissionais.
