# Oracle Cloud + Cloudflare + Supabase: integração segura do JogoManager

Data do runbook: 23/10/2026. **Status: configuração preparada, não implantada.**

## Topologia recomendada

- **jogomanager.com** permanece apontando para o Worker **jogomanager-web** na Cloudflare. Não substituir origem, DNS ou roteamento do domínio principal sem comparação de produção e rollback.
- **Supabase** continua sendo a fonte da verdade de usuários, autenticação, saves, compras e catálogo. Instância de produção: projeto **lguqnwvsfeefxamzeyos** (região us-west-2). Não mover tabelas nem duplicar o banco por padrão.
- **Oracle Cloud Infrastructure (OCI)** é uma capacidade **adicional** para tarefas de CPU intensiva, relatórios, importações agendadas, processamento de dados e jobs isolados. Só habilitar ingress depois de existir uma VM/container funcional, com credenciais seguras e orçamento aprovado.
- **Cloudflare Tunnel + Access** (ou endpoint privado autenticado equivalente) protege eventual hostname `compute.jogomanager.com`. Não publicar SSH, Postgres 5432 nem console administrativo na internet. O tráfego OCI -> Supabase deve usar HTTPS/TLS e autenticação adequada em cada serviço.

## Fase 1: OCI (exige conta/tenancy do proprietário)

1. Confirmar **home region**, compartment e limites **Always Free**: A1 Flex permite até 1.500 OCPU-h e 9.000 GB-h mensais dentro das condições da Oracle (equivalente a 2 OCPU + 12 GiB de RAM para um mês com 750h). Verificar capacidade e limites de boot volume antes de provisionar. Não assumir que recursos acima das cotas são gratuitos.
2. Criar VCN e sub-rede, e VM Ampere A1 (Ubuntu ARM64) dimensionada dentro do orçamento. Usar chave SSH com acesso restrito e atualizações de segurança. Montar block volume somente se necessário.
3. Rodar o serviço em contêiner sem root, com limite de memória/CPU, restart policy, healthcheck e logs estruturados. Aplicar security lists/NSG que **não exponham** portas internas ao mundo.
4. Criar usuário técnico de privilégio mínimo. Armazenar segredos em OCI Vault ou mecanismo de secrets com controle de acesso; nunca commitar tokens, senhas, connection strings, chaves de API ou `service_role`.
5. Habilitar monitoramento da VM: OCPU, memória, disco e rede com alertas, e instalar um agente de log se necessário. Conferir plano/cobrança antes de ligar recursos pagos.

## Fase 2: Cloudflare

1. Instalar `cloudflared` como serviço na VM, autenticado em túnel de propriedade da conta Cloudflare. Criar hostname separado (exemplo `compute.jogomanager.com`) e associar a `http://127.0.0.1:8787` somente quando um endpoint de saúde local responder 200. Configurar regra de fallback 404.
2. Exigir **Cloudflare Access**, service tokens rotacionáveis e verificação de identidade no próprio serviço. Não permitir bypass direto pelo IP da VM. Usar rate limiting em rotas caras.
3. Evitar `Cache Everything` em login, saves, compras, perfis, tokens e requisições autorizadas; garantir `Cache-Control: private, no-store`. Estáticos versionados podem ser cacheados com TTL longo.
4. **Não** alterar o DNS principal `jogomanager.com` nem rotas do Worker para OCI durante o piloto; reservar migração somente após testes de carga, rollback e comparação de Web Vitals.

## Fase 3: Supabase

1. Servidor OCI acessa a **Data API HTTPS** para operações suportadas. Para consultas intensivas, usar RPC com políticas adequadas ou worker privado; preferir conexão Postgres com pooler se houver requisito e documentação para o plano atual. Não expor connection string no frontend.
2. A chave **publishable** é a única chave que pode ser visível no cliente. Chaves secretas e `service_role` ficam somente no servidor com cofre e rotação; ações com ele exigem autorização própria, pois ignoram RLS.
3. Limitar taxa e concorrência de jobs; usar filas, backpressure, paginação e idempotência. Iniciar por trabalhos não críticos e cargas pequenas para medir efeito sobre CPU/IOPS.
4. Monitorar `pg_stat_activity`, `pg_stat_statements`, tamanho do banco, cache hits, IOPS e conexões. Não confundir `shared_buffers` com RAM física da instância.

## Portas de aceitação: não aprovar até que passem

| Gate | Prova necessária | Estado agora |
|---|---|---|
| VM OCI | Instância ativa, configuração/cota verificada, healthcheck | **Pendente** |
| Rede privada | Tunnel e Access, sem portas abertas indevidamente | **Pendente** |
| Cloudflare | Healthcheck e logs de requests no host secundário, TLS válido | **Pendente** |
| Supabase | Job de teste idempotente com logs e medição do custo incremental | **Pendente** |
| Segurança | Sem exposição de segredos ou bypass RLS, revisão de permissões | **Pendente** |
| Performance | Baseline e pós com carga e janela iguais, p50/p75/p95 e CWV mobile/desktop | **Pendente** |
| Reversão | Desabilitar roteamento Oracle sem afetar jogos, saves ou compras | **Pendente** |

## Métricas verificáveis (antes/depois)

A ferramenta SQL só revela **snapshots do Postgres**, não CPU física, RAM total ou série histórica de IOPS do compute. Para essas três métricas, usar Supabase **Reports > Database** nos mesmos intervalos de tempo, com picos e médias; correlacionar com Cloudflare Analytics, chamadas por segundo e tamanho do tráfego, para que melhoria não seja confundida com queda de acesso.

Recomendações oficiais: [Oracle Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm), [Supabase Reports](https://supabase.com/docs/guides/observability/reports), [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/).
