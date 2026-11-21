# Política de segurança — Pro Football Manager 3D

> **Divulgação coordenada · proteção de usuários · verificação antes de publicar**
>
> Este documento rege o tratamento de vulnerabilidades relativas ao código e às integrações do **Pro Football Manager 3D**, acessível pelo domínio canônico [jogomanager.com](https://jogomanager.com). Última revisão documental: **21 de novembro de 2026**. Uma política escrita não prova que controles de produção estejam habilitados, operacionais ou livres de falhas.

[README](README.md) · [GitHub Security](https://github.com/davizeiro12345678/jogomanager/security) · [Advisories](https://github.com/davizeiro12345678/jogomanager/security/advisories) · [Contato oficial](https://jogomanager.com/contato)

## 1. Versões atendidas e limites

O projeto não usa atualmente um catálogo público de releases SemVer com manutenção paralela confirmada. As versões **5.1.x, 5.0.x e 4.0.x** que constavam no template padrão **não eram uma declaração válida de suporte** e não devem ser reutilizadas.

| Artefato/ambiente | Política de manutenção | Limite de confiança |
| --- | --- | --- |
| **Aplicação efetivamente publicada no domínio oficial** | Falhas críticas e de alto impacto são priorizadas conforme exposição e possibilidade de correção | Somente a revisão e configuração comprovadamente implantadas refletem risco dos usuários |
| **Branch main** | Código de integração estável sujeito a testes e correções | Pode divergir da versão pública por falta de deploy, cache ou configuração |
| **PRs e branches de integração** | Correções e regressões durante desenvolvimento | Não são automaticamente versões suportadas ou publicadas |
| **Staging/homologação** | Ambientes efêmeros ou isolados, quando provisionados | Nunca devem compartilhar credenciais ou dados pessoais de produção |
| **Versões antigas e cópias externas** | Sem garantia de patches ou suporte continuado | Não inferir cobertura a partir da presença de tags, pacotes ou arquivos |

A manutenção do código é independente. O processo deve preservar capacidade de resposta do responsável sem sacrificar verificação de CI, controle de publicação e histórico auditável.

## 2. Relate uma vulnerabilidade de forma privada

**Canal preferencial:** [Private vulnerability reporting / Security Advisories do GitHub](https://github.com/davizeiro12345678/jogomanager/security/advisories/new), **quando a funcionalidade estiver habilitada para este repositório**. Confira a disponibilidade na [aba Security](https://github.com/davizeiro12345678/jogomanager/security); a existência do link não confirma ativação.

**Canal alternativo de contato inicial:** [jogomanager.com/contato](https://jogomanager.com/contato). Se não existir um canal privado confirmado, envie **apenas uma descrição de alto nível e um pedido de canal confidencial**; não inclua exploit, credenciais, dados de terceiros ou detalhes que permitam reprodução abusiva.

**Não use:** Issues públicos, comentários em PRs, chat comunitário, Discord, screenshots públicos ou tickets acessíveis a terceiros para divulgar cadeias de exploração, chaves secretas, tokens, conteúdo pessoal ou endpoints administrativos internos.

### Informações para um relatório privado

- Título e descrição do problema, componente afetado e cenário de impacto.
- URL pública ou caminho de código, ambiente, versão/commit SHA e horário aproximado, quando relevantes.
- Pré-requisitos, permissões de uma **conta de teste própria** e passos mínimos **seguros** de reprodução.
- Resultado observado versus resultado esperado, avaliação de explorabilidade e limites conhecidos.
- Evidência sanitizada (headers, logs com segredos omitidos, request IDs), nunca tokens em texto puro.
- Mitigação sugerida, quando possível, e forma de comunicação para esclarecer dúvidas.

Se a evidência envolver um segredo ou informação pessoal exposta, **não copie nem redistribua o valor**. Indique apenas onde o artefato aparece e sua classificação.

## 3. Política de testes e pesquisa responsável

**O repositório público não concede autorização para testes intrusivos em produção.** O acesso ao código ou ao site não autoriza exploração ativa, negação de serviço, coleta de dados, tentativa de contas de terceiros, uso de credenciais alheias ou alteração de conteúdo.

Para testar falhas com efeitos de escrita, autenticação, checkout, webhooks, SSRF, concorrência, WAF ou multiplayer:

1. Combine antes um escopo explícito com o mantenedor, incluindo domínio de **staging isolado**, identidades de teste e operações permitidas.
2. Defina limite de requisições, concorrência, duração, janela, critérios de parada e contato para incidentes.
3. Use dados sintéticos, cartões **Stripe de teste** e ambiente Supabase sem ligação à produção.
4. Interrompa a atividade ao encontrar dados de terceiros, indisponibilidade, comportamento destrutivo ou risco não previsto.
5. Apresente evidência mínima reproduzível, com limpeza de recursos de teste e plano de reversão.

**Fora do escopo sem autorização específica:** DDoS/load tests, força bruta, password spraying, enumeração massiva de contas, exploração de infraestrutura/VPS, phishing, persistência, malware, exfiltração, alterações de DNS/WAF, compras live, alteração de saldo/itens e tentativas de escapar de contêiner. Testes passivos que não criam tráfego adicional danoso continuam sujeitos às leis e aos termos aplicáveis.

## 4. Como os relatos são tratados

| Etapa | Critério |
| --- | --- |
| **Recebimento** | Confirmar canal privado, classificar o componente e evitar cópias não necessárias de evidências sensíveis |
| **Triagem** | Avaliar impacto, pré-condições, versão exposta, possibilidade de exploração e mitigação imediata |
| **Contenção** | Se necessário, reduzir exposição por configuração, desabilitar fluxo comprometido ou rotacionar credenciais |
| **Correção** | Corrigir causa raiz, adicionar regressão e revisar operações adjacentes |
| **Validação** | Executar testes, segurança, comparação de estado, homologação e verificar SHA efetivamente publicado |
| **Divulgação** | Coordenar descrição pública e orientações após correção/mitigação, evitando detalhes desnecessários de exploração |

Não existe SLA contratual público ou tempo de resposta garantido. A ordem de atendimento depende da gravidade, do alcance e da capacidade operacional. Se possível, comunicações de atualização são realizadas no canal privado original.

### Priorização indicativa

- **Crítica:** execução remota não autorizada, acesso privilegiado amplo, comprometimento de chaves, exfiltração significativa, cobrança fraudulenta/controle de inventário ou comprometimento de contas em escala.
- **Alta:** bypass de autenticação, RLS/IDOR acessível, falha relevante de webhook, autorização indevida de sessões, XSS explorável ou alteração ilícita de resultados.
- **Média:** exposição limitada, falhas com pré-requisitos elevados, abuso de recursos ou configurações vulneráveis com impacto demonstrável.
- **Baixa/informativa:** problemas limitados ou hardening sem cenário realista de exploração; ainda devem ser avaliados.

A classificação final considera alcance real, propriedades do ambiente e evidências. CVSS, EPSS, KEV e avisos de fornecedores são insumos, não substitutos de análise contextual.

## 5. Modelo de ameaças por componente

| Superfície | Riscos a verificar | Controles/validações esperados |
| --- | --- | --- |
| **Frontend, SSR e rotas públicas** | XSS, injeção de HTML, vazamento por cache, CSP permissiva, origem indevida, dados internos em SSR | Sanitização e encoding, CSP compatível com provedores, headers testados, SSR sem secrets, cache privado correto |
| **Autenticação e OAuth** | Redirect indevido, state/nonce inválidos, sessão/cookie exposto, recuperação insegura, MFA contornado | Callback allowlist, validação de estado, cookies seguros, revogação, testes E2E de logout/recuperação/MFA |
| **Supabase PostgreSQL e Realtime** | Falha de RLS, acesso cruzado entre usuários, RPC com privilégios amplos, migração destrutiva | Least privilege, RLS e ACL explícitas, replay SQL descartável, teste de usuários cruzados e migrações forward-only |
| **Stripe, loja e concessões** | Webhook forjado, replay, divergência live/sandbox, concessão dupla, manipulação de valor pelo browser | Assinatura e idempotência, validação do evento, conta/ambiente, consistência transacional e reconciliação |
| **MatchSim, saves e economia** | Manipulação de save, moeda ou conquista por cliente, replays falsos, alteração de seed | Autoridade server-side para recompensas, checkpoints, validação de progressão e testes de determinismo |
| **Multiplayer e chat** | Cross-room, impersonação, replay, abuso de fila, flood, fraude no placar, links maliciosos | Tickets expiráveis, sala e escopo, seq/ack, autorização de mensagens, rate limits, auditoria e moderação proporcional |
| **Importadores e APIs externas** | Credenciais vazadas, SSRF, dados não confiáveis, explosão de concorrência, corrupção de tabelas | Allowlist de origem, validação Zod, retries limitados, quotas e transações com reconciliação |
| **Cloudflare, DNS e CDN** | Origem exposta, configuração incorreta, WAF que bloqueia login, cache de dados pessoais, 403/503 | TLS/HTTPS, WAF calibrado, rate limiting por rota, headers, regras de cache e canários públicos |
| **GitHub Actions e supply chain** | PR malicioso, ação não fixada, token com escrita excessiva, dependência comprometida, segredo em artefato | SHA pinning, permissions mínimas, revisão de dependências, análise estática, lockfiles e ausência de secrets em PRs |
| **VPS e recuperação** | SSH administrativo público, root comprometido, kernel defasado, segredos em process args, restore inoperante | Acesso restrito, patches, telemetria, isolamento, segredos não expostos, backup externo e restauração ensaiada |

Esses itens são **controles exigidos ou a verificar**, não atestações de que todos estejam ativos. A análise de segurança deve registrar ambiente, data, comando/procedimento e evidência sem segredos.

## 6. Regras mandatórias para alterações de código

- **Segredos:** proibir tokens Stripe live/sandbox, Supabase service-role, chaves Cloudflare, senhas, cookies, certificados privados e credenciais de VPN/VPS em commits, testes, logs e artefatos. Variáveis com prefixo **VITE_** podem chegar ao cliente: nunca usá-las para segredos.
- **Identidade/autorização:** toda operação crítica autentica e autoriza no servidor; RLS não pode depender da interface. Rejeitar acesso cross-account e cross-room.
- **Pagamentos:** separar sandbox de live, conferir assinatura de webhook e processar evento de forma idempotente; não conceder compra pelo redirect do checkout.
- **Simulação:** manter seeds, checkpoints, física e estado de replay determinísticos; autoridade de resultado competitivo no servidor.
- **Headers:** mudanças em CSP, CORS, COOP/COEP, cookies ou frame-ancestors exigem teste de fluxos reais de login, OAuth, checkout, assets 3D e compatibilidade de navegador. Não relaxar políticas para corrigir um erro isolado sem investigação.
- **Banco:** versionar migrations e provar replay isolado e rollback apropriado; acesso privilegiado não vai para navegador ou action não confiável.
- **Dependências:** não ignorar avisos de alto risco sem triagem documentada, fixar actions em commits revisados e preservar lockfiles reprodutíveis.
- **Publicação:** PR, gates, autorização de release e validação do SHA publicado; qualquer falha, cancelamento ou skip de gate obrigatório é bloqueio, não sucesso.
- **Ambientes:** produção, homologação e desenvolvimento com dados e segredos isolados. Nunca executar scanners autenticados destrutivos em produção por conveniência.

Os padrões específicos de execução estão no [AGENTS.md](AGENTS.md), [contrato de performance](docs/critical-performance.md) e [workflow de qualidade](.github/workflows/quality.yml).

## 7. Proteções do GitHub: configuração e comprovação

A pasta **.github/** versiona workflows, automações de dependência e controles de qualidade, mas determinadas proteções exigem ativação **administrativa** em Settings e não podem ser habilitadas apenas adicionando um arquivo Markdown.

### Configurações recomendadas

| Configuração | Objetivo e requisito de validação |
| --- | --- |
| **Ruleset da main** | Exigir PR, bloquear exclusão e force push, exigir check crítico no HEAD e resolução das conversas; preservar merge pelo mantenedor único com zero aprovações obrigatórias até haver revisor independente disponível |
| **Dependabot alerts e security updates** | Detectar CVEs de dependências e propor correções, sem auto-merge nem alteração silenciosa de versões |
| **Dependency graph / Dependabot version updates** | Manter dependências npm e GitHub Actions inventariadas e atualizadas por PR, com CI |
| **Secret scanning / push protection** | Alertar sobre tokens já presentes e tentar bloquear novos segredos antes do push; conferir disponibilidade da funcionalidade no plano/repositório |
| **Code scanning / CodeQL** | Analisar JS/TS e publicar achados na aba Security; conferir execução real e permissões |
| **Private vulnerability reporting** | Permitir que pesquisadores enviem relatórios confidenciais de forma verificável |
| **Permissões do GITHUB_TOKEN** | Usar read-only por padrão; elevar apenas por job que realmente precise e nunca fornecer secrets a código de PR não confiável |
| **Actions/OIDC** | Restringir actions a fornecedores confiáveis, fixar SHAs, permitir apenas audiências/roles necessárias e proteger ambientes de deploy conforme capacidade da conta |
| **Branch release** | Garantir checks no SHA exato e impedir bypass de admins/bots sem autorização formal e rastreável |

**Não ativar uma exigência de uma aprovação alheia quando o único mantenedor não puder aprovar seu próprio PR.** Uma revisão independente pode ser estabelecida como procedimento adicional sem tornar a main permanentemente imergeável. Não desabilitar o gate crítico para contornar o bloqueio.

### Evidência mínima de proteção ativa

Registre a URL/ID do ruleset, seu estado de enforcement, as regras aplicadas, o nome exato dos status checks e a execução no HEAD. Para Dependabot, Secret scanning, push protection, Private vulnerability reporting e CodeQL, registre a página de configuração **e/ou** o evento/alerta efetivamente verificado. A presença do workflow ou de uma badge **não prova** que a funcionalidade administrativa foi ativada.

O inventário factual das regras GitHub, do novo CodeQL e das configurações administrativas ainda não verificadas está em [Evidências e plano de proteção do repositório (21/11/2026)](docs/security/repository-protections-2026-11-21.md).

## 8. Resposta a segredo exposto e incidente

Se um segredo for comprometido, **não basta excluir a linha e fechar o alerta**.

1. Contenha a exposição; suspenda credencial/integração comprometida se isso for necessário para proteger usuários.
2. Rotacione ou revogue o segredo **no provedor**, atualize os consumers autorizados e evite imprimir os novos valores.
3. Procure a exposição em histórico Git, PRs, ações, artefatos, logs, cache, backups e processos; avalie o período de uso.
4. Investigue ações indevidas via logs de auditoria, transações, eventos de login, banco e fornecedores.
5. Corrija a causa de vazamento, acrescente teste preventivo e valide serviços dependentes após a rotação.
6. Guarde evidências com acesso restrito; comunique terceiros afetados conforme legislação e necessidade.
7. Para incidentes que envolvam VPS ou banco: preservar trilha forense, limitar privilégios, verificar integridade e provar uma restauração isolada antes de declarar recuperação completa.

Uma varredura com **zero achados** não comprova inexistência de vulnerabilidades. Uma atualização de documentação não substitui patch de kernel, correção de CSP, configuração de RLS, rotação real de tokens ou teste de restore.

## 9. Evidências obrigatórias para liberar um ajuste de segurança

Um ajuste é considerado pronto somente quando houver evidência proporcional ao risco: diff revisável, teste de regressão, verificações estáticas e de dependências, teste em staging, logs sanitizados, comparação de comportamento legítimo e plano de rollback. Para autenticação e checkout, inclua testes reais com identidade e sandbox; para multiplayer, dispositivos/contas distintos; para VPS, recuperação de acesso e backup restaurável. Use o [PR #132](https://github.com/davizeiro12345678/jogomanager/pull/132) como referência de pendências de release e confirme sempre o último commit.

**Contato e escopo:** [Security Advisories](https://github.com/davizeiro12345678/jogomanager/security/advisories) · [Contato inicial](https://jogomanager.com/contato) · [Repositório](https://github.com/davizeiro12345678/jogomanager).

Obrigado a quem contribui com relatos responsáveis, reproduzíveis e cuidadosos com a segurança e a privacidade dos jogadores.
