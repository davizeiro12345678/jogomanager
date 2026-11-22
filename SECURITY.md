# Política de segurança — Pro Football Manager 3D

> **Divulgação coordenada · proteção de usuários · verificação antes de publicar**
>
> Este documento rege o tratamento de vulnerabilidades relativas ao código e às integrações do **Pro Football Manager 3D**, acessível pelo domínio canônico [jogomanager.com](https://jogomanager.com). Última revisão documental: **22 de novembro de 2026**. Uma política escrita não prova que controles de produção estejam habilitados, operacionais ou livres de falhas.

[README](README.md) · [GitHub Security](https://github.com/davizeiro12345678/jogomanager/security) · [Advisories](https://github.com/davizeiro12345678/jogomanager/security/advisories) · [Contato oficial](https://jogomanager.com/contato)

## 1. Versões atendidas e limites

O projeto não usa atualmente um catálogo público de releases SemVer com manutenção paralela confirmada. As versões **5.1.x, 5.0.x e 4.0.x** que constavam no template padrão **não eram uma declaração válida de suporte** e não devem ser reutilizadas.

| Artefato/ambiente                                       | Política de manutenção                                                                           | Limite de confiança                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| **Aplicação efetivamente publicada no domínio oficial** | Falhas críticas e de alto impacto são priorizadas conforme exposição e possibilidade de correção | Somente a revisão e configuração comprovadamente implantadas refletem risco dos usuários |
| **Branch main**                                         | Código de integração estável sujeito a testes e correções                                        | Pode divergir da versão pública por falta de deploy, cache ou configuração               |
| **PRs e branches de integração**                        | Correções e regressões durante desenvolvimento                                                   | Não são automaticamente versões suportadas ou publicadas                                 |
| **Staging/homologação**                                 | Ambientes efêmeros ou isolados, quando provisionados                                             | Nunca devem compartilhar credenciais ou dados pessoais de produção                       |
| **Versões antigas e cópias externas**                   | Sem garantia de patches ou suporte continuado                                                    | Não inferir cobertura a partir da presença de tags, pacotes ou arquivos                  |

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

| Etapa           | Critério                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Recebimento** | Confirmar canal privado, classificar o componente e evitar cópias não necessárias de evidências sensíveis         |
| **Triagem**     | Avaliar impacto, pré-condições, versão exposta, possibilidade de exploração e mitigação imediata                  |
| **Contenção**   | Se necessário, reduzir exposição por configuração, desabilitar fluxo comprometido ou rotacionar credenciais       |
| **Correção**    | Corrigir causa raiz, adicionar regressão e revisar operações adjacentes                                           |
| **Validação**   | Executar testes, segurança, comparação de estado, homologação e verificar SHA efetivamente publicado              |
| **Divulgação**  | Coordenar descrição pública e orientações após correção/mitigação, evitando detalhes desnecessários de exploração |

Não existe SLA contratual público ou tempo de resposta garantido. A ordem de atendimento depende da gravidade, do alcance e da capacidade operacional. Se possível, comunicações de atualização são realizadas no canal privado original.

### Priorização indicativa

- **Crítica:** execução remota não autorizada, acesso privilegiado amplo, comprometimento de chaves, exfiltração significativa, cobrança fraudulenta/controle de inventário ou comprometimento de contas em escala.
- **Alta:** bypass de autenticação, RLS/IDOR acessível, falha relevante de webhook, autorização indevida de sessões, XSS explorável ou alteração ilícita de resultados.
- **Média:** exposição limitada, falhas com pré-requisitos elevados, abuso de recursos ou configurações vulneráveis com impacto demonstrável.
- **Baixa/informativa:** problemas limitados ou hardening sem cenário realista de exploração; ainda devem ser avaliados.

A classificação final considera alcance real, propriedades do ambiente e evidências. CVSS, EPSS, KEV e avisos de fornecedores são insumos, não substitutos de análise contextual.

## 5. Modelo de ameaças por componente

| Superfície                         | Riscos a verificar                                                                                           | Controles/validações esperados                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| **Frontend, SSR e rotas públicas** | XSS, injeção de HTML, vazamento por cache, CSP permissiva, origem indevida, dados internos em SSR            | Sanitização e encoding, CSP compatível com provedores, headers testados, SSR sem secrets, cache privado correto       |
| **Autenticação e OAuth**           | Redirect indevido, state/nonce inválidos, sessão/cookie exposto, recuperação insegura, MFA contornado        | Callback allowlist, validação de estado, cookies seguros, revogação, testes E2E de logout/recuperação/MFA             |
| **Supabase PostgreSQL e Realtime** | Falha de RLS, acesso cruzado entre usuários, RPC com privilégios amplos, migração destrutiva                 | Least privilege, RLS e ACL explícitas, replay SQL descartável, teste de usuários cruzados e migrações forward-only    |
| **Stripe, loja e concessões**      | Webhook forjado, replay, divergência live/sandbox, concessão dupla, manipulação de valor pelo browser        | Assinatura e idempotência, validação do evento, conta/ambiente, consistência transacional e reconciliação             |
| **MatchSim, saves e economia**     | Manipulação de save, moeda ou conquista por cliente, replays falsos, alteração de seed                       | Autoridade server-side para recompensas, checkpoints, validação de progressão e testes de determinismo                |
| **Multiplayer e chat**             | Cross-room, impersonação, replay, abuso de fila, flood, fraude no placar, links maliciosos                   | Tickets expiráveis, sala e escopo, seq/ack, autorização de mensagens, rate limits, auditoria e moderação proporcional |
| **Importadores e APIs externas**   | Credenciais vazadas, SSRF, dados não confiáveis, explosão de concorrência, corrupção de tabelas              | Allowlist de origem, validação Zod, retries limitados, quotas e transações com reconciliação                          |
| **Cloudflare, DNS e CDN**          | Origem exposta, configuração incorreta, WAF que bloqueia login, cache de dados pessoais, 403/503             | TLS/HTTPS, WAF calibrado, rate limiting por rota, headers, regras de cache e canários públicos                        |
| **GitHub Actions e supply chain**  | PR malicioso, ação não fixada, token com escrita excessiva, dependência comprometida, segredo em artefato    | SHA pinning, permissions mínimas, revisão de dependências, análise estática, lockfiles e ausência de secrets em PRs   |
| **VPS e recuperação**              | SSH administrativo público, root comprometido, kernel defasado, segredos em process args, restore inoperante | Acesso restrito, patches, telemetria, isolamento, segredos não expostos, backup externo e restauração ensaiada        |

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

| Configuração                                      | Objetivo e requisito de validação                                                                                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ruleset da main**                               | Exigir PR, bloquear exclusão e force push, exigir check crítico no HEAD e resolução das conversas; preservar merge pelo mantenedor único com zero aprovações obrigatórias até haver revisor independente disponível |
| **Dependabot alerts e security updates**          | Detectar CVEs de dependências e propor correções, sem auto-merge nem alteração silenciosa de versões                                                                                                                |
| **Dependency graph / Dependabot version updates** | Manter dependências npm e GitHub Actions inventariadas e atualizadas por PR, com CI                                                                                                                                 |
| **Secret scanning / push protection**             | Alertar sobre tokens já presentes e tentar bloquear novos segredos antes do push; conferir disponibilidade da funcionalidade no plano/repositório                                                                   |
| **Code scanning / CodeQL**                        | Analisar JS/TS e publicar achados na aba Security; conferir execução real e permissões                                                                                                                              |
| **Private vulnerability reporting**               | Permitir que pesquisadores enviem relatórios confidenciais de forma verificável                                                                                                                                     |
| **Permissões do GITHUB_TOKEN**                    | Usar read-only por padrão; elevar apenas por job que realmente precise e nunca fornecer secrets a código de PR não confiável                                                                                        |
| **Actions/OIDC**                                  | Restringir actions a fornecedores confiáveis, fixar SHAs, permitir apenas audiências/roles necessárias e proteger ambientes de deploy conforme capacidade da conta                                                  |
| **Branch release**                                | Garantir checks no SHA exato e impedir bypass de admins/bots sem autorização formal e rastreável                                                                                                                    |

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

## 10. Matriz de prioridades e tomada de decisão

A gravidade é determinada por **impacto**, **explorabilidade**, **exposição do ambiente** e **facilidade de mitigação**, não apenas pelo nome de uma CVE. A política de atendimento abaixo orienta a triagem; **não constitui SLA contratual nem prazo de resposta garantido**.

| Prioridade indicativa            | Exemplos de impacto                                                                                                  | Resposta esperada                                                                                                        |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **P0 — incidente crítico ativo** | Chave privilegiada comprometida, fraude financeira em curso, tomada de contas em escala ou exfiltração significativa | Contenção imediata proporcional, revogação/rotação, preservação de evidências e suspensão seletiva de operações de risco |
| **P1 — risco alto confirmado**   | Bypass de autenticação/RLS, replay de webhook com concessão indevida, XSS com roubo de sessão ou escrita cross-room  | Bloquear release, limitar superfície exposta e preparar correção testada com prioridade                                  |
| **P2 — impacto moderado**        | Falha explorável com condições restritas, vazamento limitado, concorrência insegura ou abuso de recursos             | Confirmar cenário, reduzir permissões, criar regressão e planejar implantação                                            |
| **P3 — baixo impacto/hardening** | Controles preventivos incompletos, achados de scanner sem rota explorável demonstrada ou cabeçalho melhorável        | Validar achado, priorizar conforme risco e documentar justificativa                                                      |
| **P4 — informativo**             | Hipótese sem reprodução, recomendação geral ou falso positivo documentado                                            | Registrar contexto e reclassificar se surgirem evidências                                                                |

**Fatores que elevam prioridade:** dados ou recursos de vários jogadores, dinheiro/entitlements, credenciais administrativas, acesso não autenticado, exploração ativa, ausência de mitigação e dependências expostas. Evidência contraditória deve constar da análise; não atribuir severidade máxima automaticamente.

### Ficha interna de triagem (sem segredos)

| Campo         | O que registrar                                                          |
| ------------- | ------------------------------------------------------------------------ |
| Identificação | ID interno, data UTC, canal confidencial e analista responsável          |
| Recurso       | Serviço/rota, ambiente, dependência, SHA publicado e owner               |
| Impacto       | Confidencialidade, integridade, disponibilidade, alcance e pré-condições |
| Reprodução    | Teste autorizado mínimo, dados sintéticos e resultado observado          |
| Exploração    | Evidências de exploração, limitações, CVSS/EPSS/KEV se pertinentes       |
| Contenção     | Mudança realizada, autorização, confirmação e possível efeito colateral  |
| Correção      | PR, testes de regressão, scanners, homologação, canário e rollback       |
| Conclusão     | Estado final, evidência revisada, comunicação e ações preventivas        |

## 11. Fronteiras de confiança: operações que exigem autorização

### Navegador, SSR e Cloudflare

O navegador, o armazenamento local e os dados fornecidos pelo cliente devem ser considerados **não confiáveis**. O SSR deve serializar somente dados permitidos; toda rota que escreve requer autenticação, autorização do recurso e validação de entrada. A Cloudflare adiciona proteção e roteamento, mas **não transforma** um endpoint sem autorização em seguro.

- **Cache:** dados de conta, sessão, checkout, inventário, save ou resposta com identificadores pessoais não devem ser compartilhados entre usuários por CDN. Revisar `Cache-Control`, `Vary`, cookies, URLs e chaves de cache por rota.
- **CSP e cabeçalhos:** minimizar origens, separar recursos de script, pagamento, mídia e OAuth; revisar `frame-ancestors`, `connect-src`, `script-src`, políticas de referrer e `nosniff`. Um relaxamento exige justificativa, teste de exploração e teste dos fluxos legítimos.
- **CORS/CSRF:** CORS não substitui autorização; rotas com cookie precisam de proteção adequada contra requisições cross-site. Não adicionar `Access-Control-Allow-Origin: *` a uma API autenticada como “correção” de erro do frontend.
- **Roteamento:** Custom Domain de Worker, Load Balancer, DNS e hospedagem legada podem disputar o mesmo hostname. Confirmar domínio servido, origem, certificado, health e aplicação correta após cada alteração. Registrar e remover regras temporárias de diagnóstico.
- **Disponibilidade:** WAF e rate limiting por rota devem permitir login legítimo, callbacks, webhooks assinados e acessibilidade, sem liberar indiscriminadamente as operações administrativas.

### Supabase, banco e identidade

- **RLS/ACL:** testar usuário A, usuário B, anônimo e papel de serviço separadamente; exigir `WITH CHECK` apropriado em escritas, além de `USING` para leitura.
- **Privilégios:** usar a chave publicável somente com políticas apropriadas; service role e acesso SQL privilegiado ficam no servidor. Revisar funções `SECURITY DEFINER`, `search_path`, permissões de execução e ownership.
- **Histórico SQL:** migrações canônicas avançam em ordem; o acervo em `supabase/migration-archive/` **não** deve ser reaplicado como um segundo baseline. Testes destrutivos pertencem a instâncias descartáveis.
- **OAuth:** validar state/PKCE, redirect URI estrita, allowlist de retorno e identidade após callback. Passkeys exigem RP ID/origens coerentes e autenticação servidor. Erros HTTP 200/302 não provam sessão.
- **Privacidade:** logs e relatórios não devem incorporar tokens de sessão, senhas, códigos OTP, dados completos de identidade ou conteúdo privado dos jogadores.

### Stripe, compras e economia

O evento da Stripe só pode produzir consequência **depois** de assinatura validada, seleção explícita de ambiente, checagem de objeto/estado/conta e autorização de compra. A operação de banco deve ser durável e idempotente; o navegador é um cliente observador da concessão, nunca a autoridade.

| Prova                             | Resultado obrigatório                                                     |
| --------------------------------- | ------------------------------------------------------------------------- |
| Assinatura inválida/ausente       | Rejeição sem escrita nem concessão                                        |
| Evento de outro ambiente          | Rejeição; nenhuma mistura de sandbox/live                                 |
| Sessão pendente, vencida ou falha | Sem entrega indevida                                                      |
| Evento legítimo pago              | Benefício entregue ao titular correto após confirmação servidor           |
| Reenvio do mesmo evento           | Sem nova moeda, item, assinatura ou benefício                             |
| Falha transitória de banco        | Registro de retry, sem “ack” falso e sem perda silenciosa                 |
| Estorno/cancelamento              | Política de reconciliação explícita, auditável e sem alteração arbitrária |
| Operação cruzada de contas        | Rejeição independentemente do que o frontend exibe                        |

**Importante:** um teste que envia um webhook com assinatura falsa é um **teste negativo**. Não prova pagamento realizado, endpoint inscrito na Stripe, assinatura válida nem entrega fim a fim. Em homologação, usar contas, usuários, preços e chaves **de teste**; não confirmar compras live.

### Multiplayer, antirreplay e saves

Os clientes não podem decidir placar, carteira, posição competitiva ou resultado persistente. Tickets devem estar vinculados a identidade, escopo de sala, validade e permissões, com sequência/correlação suficiente para rejeitar duplicação e mensagens fora de ordem. A reconexão deve restaurar estado canônico sem execução dupla. Em 2×2, cada participante deve ocupar assento e equipe autorizados. Replays e hashes precisam ser consistentes com o motor servidor.

Jogos locais e saves importados são dados potencialmente manipulados. Persistência na nuvem e concessão de vantagens exigem validação de progressão e posse pelo servidor. Testes precisam rejeitar tentativas de copiar a carreira, a carteira ou os resultados de outro jogador.

## 12. Segurança do ciclo de desenvolvimento e cadeia de suprimentos

O repositório usa GitHub Actions, CodeQL, verificações de qualidade e Dependabot conforme os arquivos presentes. **Ativação de produtos na interface do GitHub requer confirmação administrativa**; a simples presença de um workflow, um badge ou uma configuração em Markdown não prova proteção operacional.

### Regras para alterações propostas

1. Trabalhar em branch e PR com objetivo, superfície afetada, dependências, contexto de ameaça e rollback.
2. Fixar versões e preservar lockfile; verificar mudanças de dependências transitivas, ações e permissões GitHub.
3. Em PRs não confiáveis, não fornecer segredos, tokens de escrita, privilégios de publicação nem dados de produção.
4. Passar lint, TypeScript, testes, verificações estáticas, banco e gates de performance **sem relaxar limites**. Fail, cancelled, skipped obrigatório ou ausência de artefato é bloqueio.
5. Executar homologação proporcional ao impacto com identidade e serviços **isolados**; comparar o código servido ao SHA do PR.
6. Fazer revisão independente quando disponível e registrar decisões de exceção; não exigir aprovação impossível do único mantenedor como forma de simular segurança.
7. Depois de implantar, verificar health, release SHA, rotas, comportamento legítimo e telemetria; preparar reversão antes de mutações de alto impacto.

### Aprovação de dependências e atualizações

Uma atualização de pacote ou ação só está pronta quando existirem: release notes relevantes, hashes/assinaturas quando disponíveis, licença/permissões revisadas, resultado de SCA e verificação de build, teste e performance. Alertas de Dependabot, CodeQL, npm audit, NPMScan ou outro scanner **não** são equivalentes a exploração confirmada; resultados devem ser correlacionados e classificados.

Se um artefato de build ou log contiver credencial, **não** publicar o artefato como prova: bloquear distribuição e iniciar o protocolo de incidente e rotação.

## 13. Procedimentos de incidente por categoria

Os passos abaixo são guias operacionais, **não** autorização para executar ações destrutivas ou acessar sistemas sem escopo. Em todos os casos, preservar evidência, reduzir impacto e registrar quem aprovou a mudança.

| Incidente                                              | Primeira contenção                                                             | Verificação antes de encerrar                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| **Token/segredo exposto**                              | Revogar/rotacionar no provedor e limitar integrações afetadas                  | Consumidores atualizados, logs revisados, ausência de uso indevido, novos secrets fora de artefatos |
| **Conta tomada/OAuth indevido**                        | Revogar sessões/credenciais comprometidas e reduzir o fluxo afetado            | Callback, PKCE, RLS, recuperação e MFA testados com usuários próprios                               |
| **Webhook/benefício fraudulento**                      | Suspender concessões inseguras, não necessariamente toda a loja                | Assinatura, ambiente, ledger, replay, reembolso e usuário titular reconciliados                     |
| **RLS/IDOR confirmado**                                | Restringir política/rota vulnerável e investigar leituras históricas           | Negativos cross-user e testes de migração em ambiente isolado                                       |
| **Malware ou suspeita de root comprometido no VPS**    | Isolar o host sem perder a trilha forense e o acesso de recuperação autorizado | Reinstalação/reconstituição confiável quando necessária, rotação de chaves e restore comprovado     |
| **CSP quebrada ou regressão de segurança no frontend** | Revisar mudança de origem e voltar política conhecida, se necessário           | Login, Stripe, 3D, analytics consentido e testes de injeção legítimos                               |
| **DNS/Cloudflare/Load Balancer**                       | Suspender mudanças concorrentes e confirmar ownership do hostname              | Worker e origem corretos, HTTPS, resposta real das rotas, cache e health                            |
| **Abuso multiplayer**                                  | Revogar tickets e limitar salas/usuários afetados                              | Replay determinístico, reconexão, permissões, ranking e antirreplay                                 |
| **Indisponibilidade/restauração**                      | Preservar estado, identificar janela e impedir writes conflitantes             | Backup externo **restaurado em ambiente isolado**, integridade, consistência e dados dos jogadores  |

### Sequência operacional comum

- **Detectar:** registrar horário UTC, sintomas, sinais, relatórios independentes, âmbito e severidade preliminar.
- **Conter:** privilegiar medidas reversíveis, mínimas e registradas; diferenciar bloqueio temporário de correção definitiva.
- **Investigar:** salvar request IDs e logs sanitizados, determinar o primeiro commit/configuração afetado e verificar dependências.
- **Corrigir:** trabalhar em branch, criar regressão e validar cenários legítimos e maliciosos em staging.
- **Recuperar:** comparar SHA aprovado/implantado, autorização, banco, filas, pagamentos e rotas; não confundir HTTP 200 com serviço completo.
- **Aprender:** registrar causa raiz, impacto efetivo versus potencial, ação preventiva, responsáveis e data de reavaliação.

### Backup, continuidade e restauração

Uma rotina de backup só está comprovada se um snapshot **íntegro e restaurável** tiver sido testado em destino separado, com chaves de acesso independentes. Para cada serviço crítico, definir responsáveis, RPO, RTO, retenção e método de restauração; **não inferir** valores de RPO/RTO sem um exercício documentado. Restaurar uma cópia em produção sem análise pode sobrescrever saves ou eventos Stripe legítimos.

O teste de recuperação deve preservar cadeia de eventos, integridade de carteiras e compras, relações de tabelas, contas e políticas de acesso. A restauração deve ser compatível com a revisão do aplicativo que será utilizada; se não houver evidência, classificar como **pendente**.

## 14. Privacidade, dados de jogadores e artefatos de auditoria

O jogo pode envolver dados de jogadores, incluindo perfis de pessoas menores de idade. Reduzir ao mínimo dados coletados e exibidos em alertas, tickets, vídeos, screenshots e amostras de QA. Não publicar identificadores de usuário, e-mail completo, nome real, endereço, credenciais, mensagens privadas, informações de pagamento nem dados de saúde. Revisar obrigações aplicáveis de proteção de dados conforme as jurisdições em que o serviço opere, sem presumir base legal específica.

- **Coleta:** preferir dados sintéticos e request IDs; capturar apenas o necessário para a investigação.
- **Acesso:** restringir evidências ao operador e revisores autorizados, com registro de acesso quando suportado.
- **Trânsito/armazenamento:** transferir por canal protegido; criptografar e separar evidências do repositório público.
- **Retenção e exclusão:** definir política explícita por categoria e obrigação; não prometer prazo que ainda não esteja implementado.
- **Notificação:** avaliar comunicação a titulares, fornecedores e autoridades de acordo com avaliação jurídica e impacto real; não divulgar prematuramente detalhes que ampliem a exploração.
- **Redação pública:** publicar identificação da correção, versões, mitigações e referências, mas retirar segredos, payloads exploráveis e informação pessoal.

## 15. Critérios de encerramento e evidências

| Situação           | Evidência mínima para marcar como concluída                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| Correção em código | Diff auditado, teste de regressão, revisão e CI no SHA exato                                                   |
| Autenticação       | Conta de teste própria autenticada, retorno correto, sessão persistente, logout e permissões cross-user        |
| Stripe             | Pagamento **sandbox real**, webhook assinado e entregue, reconciliação e uma concessão idempotente             |
| Multiplayer        | 1×1 e 2×2 reais com usuários independentes, desconexão/reconexão, resultado autoritativo e logs                |
| Cloudflare/edge    | Regras e hostname verificados, origem saudável, HTTP real, TLS, sem exposição de cache privado                 |
| Banco/RLS          | Migração isolada, negativos por papel/usuário, ausência de acesso elevado no cliente                           |
| Host/VPS           | Patches ativados, acesso administrativo confiável, backup restaurado e monitoramento confirmado                |
| Release            | Gate obrigatório aprovado, SHA servido, rollback ensaiado e observabilidade sem incidentes críticos conhecidos |

**Estados válidos em relatórios:** confirmado com evidência; implementado, mas não homologado; parcialmente validado; bloqueado; não verificado; não aplicável. Nunca converter “planejado”, “configurado no código”, “scan sem achado” ou “teste de mock passou” em “seguro em produção”.

A [auditoria de proteções do repositório](docs/security/repository-protections-2026-11-21.md), o [contrato de desempenho](docs/critical-performance.md) e a [documentação de autenticação](docs/auth-methods.md) são referências complementares. Em caso de conflito, confirmar configuração atual e resultado do último SHA, registrando a divergência antes de mudar a política.

## 16. Programa verificável de proteção e preparação para auditoria

O [plano de segurança Cloudflare, Supabase e garantias do site](docs/security/cloudflare-supabase-assurance-2026.md) é a matriz operacional de **controles verificados versus pendências**, com escopo, prioridade, critérios de aprovação, dependências, responsabilidades e fontes oficiais.

Na conferência de **22/11/2026**, o plano registra TLS Cloudflare Full (strict), HTTPS obrigatório, WAF, rate limiting e Bot Fight Mode habilitados. **DNSSEC continuava pendente de validação no registrador**, e o Load Balancer legado do domínio principal permanecia desativado intencionalmente para evitar conflito com o Worker. Tais configurações não substituem testes de fluxo, análise de logs ou revisão de políticas.

No Supabase, os avisos de auditoria devem ser **classificados antes de qualquer mutação**: tabelas com RLS ativo sem política podem estar corretamente bloqueadas por padrão; grants GraphQL precisam ser verificados por papel e usuário; funções `SECURITY DEFINER` exigem inspeção de privilégios e superfícies expostas. Não conceder acesso ampliado apenas para eliminar um aviso do linter.

**Certificações e selos:** esta política **não** declara ISO 27001, SOC 2, PCI DSS, WCAG AA, conformidade LGPD certificada ou uma chancela OWASP. Qualquer alegação pública deve informar organização emissora, versão da norma, escopo, validade e evidência verificável. Os testes internos e o uso de plataformas certificadas são apenas **insumos** para auditoria; consulte a trilha de avaliação no documento vinculado.

**Gate de segurança de release:** bloquear a publicação se houver bypass de autenticação/RLS, segredo exposto, concessão de compra não autenticada ou perda de isolamento entre produção/staging. Exigir evidência de testes negativos, revisões, scripts idempotentes e rollback, com correções auditáveis e sem falsificar os gates de performance.

**Contato e escopo:** [Security Advisories](https://github.com/davizeiro12345678/jogomanager/security/advisories) · [Contato inicial](https://jogomanager.com/contato) · [Repositório](https://github.com/davizeiro12345678/jogomanager).

Obrigado a quem contribui com relatos responsáveis, reproduzíveis e cuidadosos com a segurança e a privacidade dos jogadores.
