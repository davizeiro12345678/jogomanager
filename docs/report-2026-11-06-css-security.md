# CSS sob demanda e auditoria defensiva — 06/11/2026

## Implementado
- Root SSR escolhe folhas para home, loja, tabelas, editorial e jogo. CSS crítico continua no head; CSS de componentes permanece associado às rotas. Não é seguro adiar todo CSS para depois da primeira pintura.
- /new não inicializa o mundo nem hidrata o catálogo remoto ao abrir. O download opcional e a descoberta de clubes começam na etapa 4; clubes incluídos no jogo continuam disponíveis offline.
- Cache de HTML público anônimo substitui o no-cache padrão por s-maxage=300. Cookie, autorização, Set-Cookie, APIs, métodos não seguros, erros e páginas privadas não recebem cache compartilhado. Private/no-store explícitos são preservados. Isso permite cache; não comprova cache HIT nem um TTFB publicado específico.
- Overrides corrigidos nos dois lockfiles: re2js 2.9.1, seroval 1.7.7, qs 6.17.1 e @hono/node-server 2.1.6. Scanner de dependências: nenhum advisory conhecido em 94 dependências de produção.
- Finding de ranking corrigido em migração forward 0048, aplicada e lida de volta no banco. Argumentos legados de vitórias/partidas/temporadas são ignorados. Função pública de ranking já mascara esses contadores. Execução anon do heartbeat: negada.

## Evidências
- Semgrep 1.184.0: 90 regras, 1.453 arquivos (src, scripts, cloudflare, services, infra, .github e funções antigas). Dois alertas HTTP em scripts de teste chamando exclusivamente 127.0.0.1:4197/4198; não são chamadas públicas inseguras. Sem exclusões adicionadas para ocultá-los. Sete arquivos tiveram análise parcial por sintaxe TypeScript não reconhecida; não é prova de ausência de vulnerabilidades.
- Revisão de autenticação, carteira, compras, claims e saves não demonstrou outro bypass. Scanner rápido e linter revisados, sem alterar findings já ignorados pelo usuário. Tabelas sem política permanecem bloqueadas, não foram liberadas.
- Testes focados: 56 aprovações; verificação de fontes/SSR CSS: 6 aprovações. Lint completo: zero erros e avisos. Harness: build OK.
- Navegador móvel 393×851 e desktop 1280×1800: /, /produtos, /tabelas, /guias e /new responderam 200, sem overflow horizontal ou erros de execução. Etapas de criação chegaram à lista real de clubes; screenshots inspecionadas.
- Pedidos ativos não destrutivos no preview: cron sem segredo e com segredo falso retornaram 401; webhook Stripe com assinatura falsa retornou 400. Todos no-store. Nenhuma compra, cobrança, dado privado ou save foi alterado pelos probes.

## Limites e trabalho restante
- Não é pentest completo nem certificação de segurança. Ataques de carga, exploração destrutiva e tentativas em provedores externos não foram realizados.
- Não foram executados testes autenticados reais entre duas contas nem cobrança/entrega reais. Contratos de segurança com mocks não substituem isso.
- CSS de gameplay continua compartilhado; divisão fina de todos os painéis do jogo ainda requer auditoria de dependências/seletores e regressão visual. Editorial é uma família, não uma folha por artigo.
- Lighthouse ≥98, FCP <1,1s, comparação comprimida de bundles, stress 200 jogos e workflow Quality gates completo não foram demonstrados nesta execução. Bloqueiam publicação. Nenhuma publicação foi feita; velocidade do site publicado não foi alegada como melhorada.