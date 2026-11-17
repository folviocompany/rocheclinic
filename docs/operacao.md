# Publicação e operação

As funções da Vercel ficam fixadas em `iad1` no `vercel.json`, alinhadas ao projeto Supabase em East US (North Virginia). Se o banco for migrado no futuro, atualize essa configuração e o teste de desempenho no mesmo Pull Request.

## Vercel

Após validar a Fase 1 no Supabase: importar o repositório na Vercel, selecionar Next.js e configurar as duas variáveis de `.env.example` por ambiente. Build: `npm run build`. Usar um projeto Supabase separado para desenvolvimento/homologação. Configurar Site URL do Auth para o domínio HTTPS definitivo; evitar redirects com curingas em produção. Não há callback de convite implementado nesta fase.

Validar login, logout, cookies, bloqueio de `/inicio` e `/configuracoes` sem sessão, autorização por perfil e RLS com duas contas de teste. Validar políticas no projeto remoto antes de inserir dados reais. Cadastro público deve estar desligado. A aplicação não foi publicada automaticamente: publicação é a Fase 6 do plano acordado.

## Backup no Supabase Free

Não depender de restauração gerenciada do plano gratuito. Preparar uma rotina externa diária antes da operação real. Com Supabase CLI autenticado em ambiente administrativo, exportar esquema e dados separadamente usando `supabase db dump` (schema) e `supabase db dump --data-only --use-copy` (dados). Selecionar explicitamente os schemas necessários e verificar na versão instalada quais schemas gerenciados são excluídos. Nunca supor que um dump do schema public inclui identidades Auth ou arquivos Storage.

Guardar exports criptografados fora do repositório, com acesso restrito, retenção acordada (ponto inicial: 7 diários e 4 semanais) e alerta em falhas. Não registrar strings de conexão ou senhas em logs. Documentar separadamente a recuperação das contas Auth: perfis referenciam UUIDs, portanto sua recuperação deve preservar o vínculo de identidade de modo compatível com o Supabase. Não restaurar senhas manualmente.

Antes de produção e depois periodicamente, testar restauração em projeto isolado: restaurar esquema/dados e identidades pelo processo suportado, verificar contagens, FKs, RLS e login das duas contas de teste; registrar duração e resultado. Não restaurar sobre produção durante o ensaio. A rotina automatizada e o ensaio remoto ainda precisam ser configurados e executados; este documento não os considera concluídos.

## Referências técnicas

- Next.js: https://nextjs.org/docs/app/guides/authentication
- Proxy: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- Supabase SSR: https://supabase.com/docs/guides/auth/server-side/creating-a-client

As versões instaladas e reproduzíveis estão no package-lock.json.
