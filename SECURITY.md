# Política de segurança — Pro Football Manager 3D

## Escopo e versões atendidas

A equipe mantém a aplicação publicada em **https://jogomanager.com** e os componentes do repositório conforme sua prioridade e criticidade. **Não existe suporte público confirmado às versões fictícias `5.1.x`, `5.0.x` ou `4.0.x`** anteriormente exibidas neste arquivo de modelo. Branches de integração, previews e recursos experimentais não são automaticamente versões suportadas ou lançadas.

Componentes relevantes: frontend, APIs/Workers, autenticação Supabase, pagamentos Stripe, multiplayer, banco de dados e infraestrutura associada. A existência de um componente no repositório não indica que ele esteja ativado em produção.

## Como reportar uma vulnerabilidade

1. Use preferencialmente a funcionalidade **Private vulnerability reporting** do GitHub, caso esteja habilitada na aba **Security** deste repositório. O acesso correspondente fica em [Security Advisories](https://github.com/davizeiro12345678/jogomanager/security/advisories).
2. Se essa opção não estiver disponível, faça contato inicial pelo [canal oficial de contato](https://jogomanager.com/contato), **sem anexar payloads de exploração, tokens, dados pessoais ou instruções sensíveis**. Combine um canal privado apropriado antes de enviar detalhes técnicos.
3. No relatório privado, inclua componente afetado, impacto, pré-condições, passos mínimos de reprodução seguros, versão ou SHA e mitigação sugerida. Não execute testes em contas ou dados de terceiros.

Evite abrir GitHub Issues públicos com provas de exploração ou informações que possam ajudar um atacante. Não há autorização geral para ataques automatizados contra produção. Escaneamentos ativos com autenticação, alteração de estado, carga ou pagamentos devem ocorrer apenas em **staging isolado e autorizado**, com limites, escopo e plano de reversão definidos.

## Tratamento

Os relatos são triados conforme exposição, gravidade, explorabilidade e impacto sobre usuários. Uma correção somente é considerada validada após testes funcionais e de regressão, verificação da implantação no ambiente afetado e confirmação de headers/rotas quando aplicável. Não há prazo de resposta ou SLA público garantido neste documento.

## Diretrizes para contribuidores

- Nunca inclua chaves Stripe, service-role Supabase, credenciais de Cloudflare/VPS, cookies de sessão, webhooks secretos ou dados de usuários em código, logs, PRs e artefatos.
- Utilize ambientes de teste separados, privilégios mínimos, RLS e autorização por identidade/escopo para acesso a dados.
- Mantenha checks obrigatórios, revisão de alterações de autenticação e segurança, testes de fluxo real e plano de rollback antes de publicar.
- Em CSP, preserve funcionalidades legítimas de OAuth e checkout; não retire `unsafe-inline` nem ative COEP indiscriminadamente sem testes do SSR e dos provedores.
- Não atribua a ausência de achados em um scanner à ausência de vulnerabilidades. Consulte também o histórico de migrações, dependências e o comportamento efetivo do site publicado.

Esta política substitui o conteúdo de exemplo do template e pode ser atualizada conforme os canais privados e os processos do projeto forem formalizados.
