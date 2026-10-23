# Estado das proteções e plano de ativação

Estado revisado em 19 de outubro de 2026 (UTC), incluindo a ativação remota da proteção contra senhas vazadas descrita abaixo.

## Supabase de produção

O projeto `JogoManager - Produção` respondeu como `ACTIVE_HEALTHY`. O Security Advisor retornou:

- **11 tabelas com RLS ligado e sem políticas** (`INFO`). Em nove tabelas públicas desse grupo, confirmei que `anon` e `authenticated` não têm permissão de `SELECT`; RLS também está ligado. Isso mantém os dados fora do acesso normal da API, embora as rotas de servidor que dependem dessas tabelas devam continuar sendo revisadas.
- **20 objetos visíveis no schema GraphQL para `anon` e 42 para `authenticated`** (`WARN`). A visibilidade do schema torna nomes e estrutura descobríveis; o acesso às linhas ainda depende das permissões e das políticas RLS. Revogar `SELECT` em massa pode quebrar telas e consultas existentes. Revisar os objetos e remover apenas permissões que não sejam necessárias.
- **`mutate_player_career` é executável por `authenticated`** (`WARN`). A função exige papel autenticado, valida `auth.uid()`, limita a operação a salvar ou apagar um dos três espaços próprios e usa `SET search_path TO ''` com nomes de tabelas qualificados. A permissão é necessária para o fluxo de salvamento; não a revogar sem substituir o fluxo.
- **Proteção contra senhas vazadas:** ativada no Supabase Dashboard → Authentication → Sign In / Providers → Email. A consulta posterior ao Security Advisor não retorna mais `auth_leaked_password_protection`. A documentação atual informa que a verificação de senhas vazadas exige plano Pro ou superior: [Password security](https://supabase.com/docs/guides/auth/password-security).

As políticas consultadas em tabelas de carreira, perfil, compras, carteira e notificações restringem linhas ao usuário autenticado correspondente. A checagem foi somente leitura; nenhuma migração foi aplicada ao banco.

## Google Cloud e Cloudflare

O código local inclui avaliação score-based do reCAPTCHA Enterprise no checkout de convidado, configuração Terraform de Cloud Armor em modo preview e o roteiro para enviar Cloudflare Logpush ao Google SecOps. Esses arquivos **preparam** integrações; não comprovam serviços ativados na conta.

No ambiente local desta sessão, o `gcloud` existe, mas não há credencial CLI Google ativa nem projeto selecionado. O Console web autenticado foi usado para verificar os produtos Google; a conta Cloudflare também foi consultada. As variáveis locais do reCAPTCHA estão vazias. A existência de configuração local ou de template não comprova que os serviços Google estejam ativos no tráfego de produção.

O JogoManager em Cloudflare Workers não é um alvo compatível direto para Web Security Scanner. O scanner exige um alvo público compatível, como App Engine, GKE ou Compute Engine; use um ambiente de teste e exclua rotas que alterem dados. Consulte a [visão geral oficial](https://docs.cloud.google.com/security-command-center/docs/concepts-web-security-scanner-overview).

## Ativação do failover e das detecções

1. **reCAPTCHA Enterprise:** crie uma chave limitada aos hostnames reais, restrinja a chave de API ao serviço Enterprise e configure as variáveis de build/Worker descritas em [`google-security-integrations.md`](google-security-integrations.md). Comece em `observe`; só mude para `enforce` depois de conferir tráfego legítimo e o comportamento quando a API Google estiver indisponível.
2. **Cloud Armor:** prepare uma cópia atualizada do Worker como origem no Google Cloud, atrás de um HTTPS Application Load Balancer. Anexe a política Terraform, revise os logs de preview e teste login, salvamento, loja e multiplayer antes de bloquear tráfego.
3. **Web Security Scanner e SCC:** habilite os serviços disponíveis no projeto e escaneie primeiro um hostname de staging compatível. O scanner pode percorrer links e, em scans customizados, enviar formulários; use uma conta de teste de baixo privilégio e exclua caminhos com efeitos colaterais.
4. **Google SecOps:** crie um feed Cloudflare e um job Logpush com o menor conjunto de campos que permita a detecção. Defina retenção, acesso aos logs e alertas com responsáveis. A documentação oficial descreve o [feed Cloudflare para Google SecOps](https://docs.cloud.google.com/chronicle/docs/ingestion/default-parsers/cloudflare).
5. **Failover real:** documente e ensaie a troca da origem para o balanceador Google, a validação do hostname/certificado e a reversão. Se o cenário de emergência também incluir indisponibilidade do DNS/conta Cloudflare, prepare um caminho de DNS sob controle independente; a política Cloud Armor sozinha não troca tráfego.
6. **Segredos:** grave chaves e segredos somente no armazenamento protegido do provedor que os executa. Não os inclua em `VITE_*`, Git, arquivos Wrangler ou mensagens.

Cloud Armor só filtra tráfego que passa pelo balanceador ao qual a política está anexada. Web Security Scanner não substitui análise de código e não certifica ausência de vulnerabilidades. O Google SecOps precisa receber e interpretar eventos antes de gerar detecções úteis.

## Atualização em 19 de outubro de 2026

- **Supabase Auth:** ativei e salvei `Prevent use of leaked passwords` em Authentication → Sign In / Providers → Email no projeto de produção. Reabri a configuração e confirmei o switch ligado; uma nova consulta ao Security Advisor já não retorna `auth_leaked_password_protection`. A checagem vale para cadastro e alteração de senha.
- **Chaves públicas e segredos:** `VITE_SUPABASE_PUBLISHABLE_KEY` é a chave pública usada pelo navegador; renomeá-la sem `VITE_` não a tornaria secreta, pois o cliente precisa enviá-la. `SUPABASE_SERVICE_ROLE_KEY` é sensível e a listagem de bindings do Worker `jogomanager-web` confirmou seu tipo como `secret_text`; valores secretos não foram lidos. Não há binding `VITE_SUPABASE_SERVICE_ROLE_KEY`. As outras variáveis `VITE_*` encontradas no Worker são identificadores/tokens públicos de cliente: Google Analytics, Logo.dev, PostHog e token de cliente de pagamento. Mantenha credenciais privadas fora de `VITE_*`; a documentação do [PostHog](https://posthog.com/docs/privacy) e do [Logo.dev](https://www.logo.dev/products/logo-api) classifica seus tokens de projeto/publicáveis como próprios para uso no cliente.
- **Fraud Defense:** o projeto `Sscxz` já tem uma chave de site chamada `jogomanager`, mas o assistente de integração está na etapa 1/3. O código local faz uma avaliação de risco do reCAPTCHA no checkout de convidado; isso não equivale ao Google Transaction Defense. A lista de bindings do Worker não contém configurações `GOOGLE_*`, e as variáveis locais estão vazias, então a avaliação em produção ainda não está ativa. Para ativá-la faltam uma chave de API restrita ao reCAPTCHA Enterprise e os respectivos bindings secretos/configuração no Worker. O nível Essentials inclui até 10.000 avaliações mensais por organização; sem faturamento, novas avaliações falham ao exceder a cota. Com faturamento, avaliações acima da franquia podem gerar cobrança conforme o nível contratado ([regras de faturamento](https://docs.cloud.google.com/recaptcha/docs/billing-information)).
- **Google SecOps:** o Console mostra a tela de instalação e pede contato com o representante de Cloud para obter uma instância. Não há instância/feed Cloudflare confirmado; o template Logpush não é uma integração ativa.
- **Web Security Scanner:** não há configurações de scan. O formulário exige um app hospedado em App Engine, GKE ou Compute Engine; o Worker Cloudflare atual não é um alvo compatível.
- **Security Command Center:** o Console informa que é necessária uma organização Google Cloud. O projeto atual não atende esse pré-requisito.
- **Cloud Armor:** permanece apenas o template Terraform em modo preview. Não há Load Balancer nem origem alternativa Google conectada ao tráfego do Worker.
