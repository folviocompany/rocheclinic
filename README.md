# rocheclinic

Sistema privado de gestão para Ester e Dra. Izabela. Fase 1: fundação, autenticação, perfis, layout responsivo e isolamento dos procedimentos por profissional. Identidade em rosa pastel, branco suave, champanhe e marrom rosé.

## Executar

Requer Node.js 22.13+ e npm. Instale com `npm ci`, copie `.env.example` para `.env.local` e execute `npm run dev`. Acesse http://127.0.0.1:3000.

Sem as variáveis, a tela de login mostra configuração pendente e bloqueia o envio. Não há modo demonstrativo, credenciais embutidas ou bypass de autenticação.

## Configurar Supabase

1. Crie um projeto Supabase privado administrativamente. Em Authentication, desative **Allow new users to sign up**, login anônimo e provedores não utilizados. Use e-mail e senha. Configure proteção contra tentativas abusivas e limites no serviço Auth antes da produção.
2. Em um banco novo, aplique todas as migrations de `supabase/migrations` na ordem do nome. Nas evoluções, use Supabase CLI com `supabase link --project-ref ...` e `supabase db push`; não reaplique migrations já executadas.
3. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` com a URL e a chave publicável do projeto. Nunca use `service_role` ou chave secreta nessas variáveis.
4. Crie as duas contas em Authentication → Users pelo processo administrativo. Defina senhas fortes e compartilhe-as por canal privado; nenhuma senha deve entrar no repositório. Este MVP não implementa convite nem recuperação de senha na interface: o suporte de acesso é administrativo.
5. Adapte e execute uma vez `supabase/admin/provision-professional.sql`: substitua os dois UUIDs reais de Auth. O script cria ou atualiza Ester e Dra. Izabela de forma transacional. Não existe cadastro público ou criação automática de perfil por metadados do usuário.
6. Confirme o fuso em `business_settings`: inicialmente America/Manaus. A clínica deve validar esse fuso antes do módulo de agenda.
7. Reinicie o servidor após preencher o ambiente. Entre com cada conta e verifique `/inicio` e `/configuracoes`.

Para revogar acesso, altere `profiles.active` para `false` pelo SQL Editor. As políticas verificam a situação atual no banco. Ajustes de identidade, vínculo, salas e configuração são administrativos nesta fase.

## Verificação

- `npm run typecheck`: TypeScript estrito.
- `npm test`: executa a migration em PostgreSQL embarcado (PGlite), simulando os papéis e `auth.uid()` do Supabase. Testa RLS, isolamento de catálogos, bloqueio de elevação de permissão, anonimato, contas sem vínculo, desativação, auditoria e constraints.
- `npm run build`: build de produção Next.js.

Os testes locais não substituem a validação do Supabase Auth hospedado. Antes de produção, testar com duas contas reais de teste: login válido/inválido, logout, expiração/renovação da sessão, acesso direto sem sessão e revogação de acesso. Usar dados fictícios exclusivamente no ambiente de teste.

## Implementado e próximos módulos

Implementado: autenticação privada por Supabase, autorização no servidor, RLS, perfis profissionais, cadastro compartilhado de clientes, catálogo de procedimentos isolado por profissional e dashboard financeiro mensal. O financeiro separa faturado/recebido, competência/caixa, pagamentos parciais, gastos individuais/compartilhados e resultado gerencial estimado. Há auditoria das alterações críticas e testes das políticas do banco.

Ainda não implementado: agenda e atendimentos, complementos financeiros como recorrência, estorno e edição documentada, relatórios CSV, retornos, distribuição de lucros e backup automatizado. O dashboard exibe somente dados reais cadastrados; não há métricas simuladas.

Veja [arquitetura e plano](docs/arquitetura.md) e [publicação e backup](docs/operacao.md).
