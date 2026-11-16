# JogoManager | Rollout controlado do catálogo via VPS e Cloudflare

**Status 04/11/2026: não ativar ainda.** Descoberta via conta Cloudflare:
- `catalog.jogomanager.com`: registro A proxied para `194.163.188.190`.
- Tunnel `jogomanager-vps-catalog-20261026`: inativo, zero conexões.
- Ingress configurado: `hostname: catalog.jogomanager.com`, path `^/v1/public/clubs$`, service `https://127.0.0.1:443`, fallback `http_status:404`.
- Repositório documenta gateway público em `127.0.0.1:3092`. O salto entre 443 e 3092 **não foi comprovado**.
- Observação externa: `/v1/public/clubs?limit=1&page=0` retornou HTTP 200 com JSON array; `/metrics` e `/healthz` retornaram 404. Isso não confirma qual origem atende a solicitação.

## Sequência obrigatória

1. **Recuperação SSH antes de mudanças de rede:** validar VNC root e host keys em ambas as VPS. Na Plus 6, aplicar primeiro o portão de segurança em `SECURITY-GATE.md`.
2. No console da VPS 8, execute `bash ops/vps/integration-audit.sh` e registre portas ativas, cloudflared, nginx, TLS, NTP e cache local sem imprimir secrets. Verifique com `ss -ltnp` se o gateway escuta *apenas* loopback e se 443 encaminha somente a rota pública correta.
3. Teste o proxy de origem isoladamente por hostname/loopback com validação de TLS; compare `id, crest_url` e contagem de escudos com Supabase público, sem credenciais de service role.
4. Confirme o `cloudflared` operacional na VPS 8 e o Tunnel **healthy**, validando ingress restrito, TLS e fallback 404. **Não** substitua DNS antes de ter conexões saudáveis e plano de reversão testado.
5. Em janela aprovada, altere somente o DNS pertinente para CNAME do Tunnel, quando apropriado à arquitetura escolhida. Preserve TTL e registre configuração anterior. Faça testes GET públicos e verifique que login, compras, saves, dashboards e métricas continuam inacessíveis nesse hostname.
6. Compare p50/p95 do catálogo, taxas 5xx, erros, hit ratio, fallback Supabase, consumo e tempo do primeiro byte com a linha de base.
7. Somente então habilite `VPS_CATALOG_ENABLED=1` **no servidor canário**, mantendo a variável fora do bundle/browser. Em falhas, `VPS_CATALOG_ENABLED=0` restaura a consulta original. A reversão DNS/Tunnel é separada da flag.
8. Integre a Plus 6 apenas depois de confirmar limpeza do host, endpoints internos, identidade SSH, sua CA independente, health checks e comparação de desempenho. Não configurar como failover ou origem ativa por conveniência.

## Escopo e segurança

O gateway é somente `GET /v1/public/clubs`; cache público `id, crest_url`, TTL limitado; não usar para JWT, usuários, permissões, pagamentos, saldo, dados privados ou saves. Rate limit deve proteger a origem sem bloquear bots legítimos do site público. Credenciais do Supabase service role nunca passam para o cache público.

## Gates de observabilidade

Armazene logs estruturados **sem IP pessoal, Authorization, cookies ou segredos**: total de GET públicos, p50/p95 por rota, falhas na origem, cache HIT/MISS, 5xx e fallback. Conserve a fonte autoritativa no Supabase. Comparar duas VPS somente com cargas, versões e janelas equivalentes. Os testes do WCOM-457 medem conexão externa e não hardware interno.
