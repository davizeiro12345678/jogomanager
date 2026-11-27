# Cache público e proteção da CDN

O cache de aplicação aceita somente projeções públicas e conserva namespaces separados. Sessões, saves, saldos, permissões e payloads privados de provedores não são elegíveis.

O carregamento compartilhado tem prazo padrão de 15 segundos. Ao expirar ou falhar, a entrada é removida; uma conclusão tardia não pode substituir outra consulta. A capacidade física padrão é de 16 consultas simultâneas por namespace e por instância, inclusive consultas cujas entradas foram expulsas. Acima disso, novas chaves recebem indisponibilidade temporária; leitores da mesma entrada pendente continuam compartilhando uma única promessa. Uma consulta expirada que não pode ser cancelada ocupa a capacidade até sua conclusão real, impedindo que expiração/evicção permita uma avalanche adicional no banco.

Este limite é local à instância e complementa controles de rate limit da aplicação e do banco; não é um limite global do projeto Supabase. O limite não cancela uma consulta SQL já em execução. Erros não são armazenados como resultados válidos.

Respostas privadas, autenticadas, com cookies definidos, métodos de escrita e erros substituem as três políticas por `no-store`: `Cache-Control`, `CDN-Cache-Control` e `Cloudflare-CDN-Cache-Control`. Isso fecha a ambiguidade em que um cabeçalho específico da CDN tinha precedência sobre a proteção do navegador. Os assets públicos imutáveis continuam usando os contratos existentes.

As regras administrativas de uma zona podem sobrepor diretivas da origem. Nenhuma regra remota foi alterada nesta sessão: o SentinelX não retornou uma integração Cloudflare cadastrada. Antes da publicação, revisar se regras de cache da zona respeitam APIs privadas/Authorization/cookies e confirmar as respostas efetivas.

Referência primária: [Cloudflare — CDN-Cache-Control e precedência](https://developers.cloudflare.com/cache/concepts/cdn-cache-control/).

Testes: `src/lib/public-read-cache.server.test.ts` cobre bursts, expiração, falha síncrona, evicção, timeout, capacidade física e conclusões tardias; `src/lib/security-headers.test.ts` cobre políticas conflitantes de CDN em respostas privadas.
