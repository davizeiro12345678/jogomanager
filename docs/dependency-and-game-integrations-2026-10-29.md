# Dependências e integrações do jogo — 29/10/2026

Esta continuação do PR #96 atualiza o conjunto restante compatível, melhora o ciclo de vida de recursos do navegador e amplia as evidências de produção. A aprovação depende dos checks do commit final; este documento não autoriza publicação com gates incompletos.

## Dependências

| Área                       | Antes                                            | Agora                                              |
| -------------------------- | ------------------------------------------------ | -------------------------------------------------- |
| Formulários                | resolvers 5.9.2                                  | 6.0.2                                              |
| E-mail                     | SDK 0.3.1; render 2.1.1 e cópia transitiva 2.0.6 | SDK 0.5.0; um renderizador 2.2.0                   |
| MCP                        | SDK Lovable 3.0.5; protocolo 1.32.1              | 3.3.1; 1.32.2                                      |
| Configuração Vite/TanStack | 2.26.5                                           | 2.27.0                                             |
| Servidor                   | Nitro 3.0.260603-beta                            | 3.0.260903-beta                                    |
| Bundlers                   | Rolldown 1.2.1; esbuild 0.28.1                   | 1.2.15; 0.28.2                                     |
| Cloudflare                 | Wrangler 4.152.0                                 | 4.154.0                                            |
| TypeScript                 | 5.9.3; tipos Node 26                             | 6.0.3; tipos Node 24.19.2, alinhados ao runtime 24 |
| Benchmarks                 | Tinybench 5.1; CodSpeed 5.7.1                    | 6.2.2; 6.1.0                                       |
| Ícones                     | Lucide 1.61                                      | 1.63                                               |
| Serviço auxiliar           | MongoDB driver 6.21                              | 7.7                                                |

O override do renderizador evita a cópia antiga fixada pelo agregador de componentes de e-mail. A cadeia `html-to-text` passa a 10.0.1, sem o `deepmerge` antigo. O override global antigo de `entities` do bloco pnpm foi removido. O override de Nitro fica restrito ao peer do configurador Lovable: o intervalo upstream de pré-lançamento exclui a nova versão, embora o build com a versão explicitamente escolhida passe. A instalação limpa deve continuar funcionando sem `--force` e sem `--legacy-peer-deps`.

As datas de publicação dos pacotes alterados foram conferidas. PostHog 1.441.2 e painéis 4.15.0 continuam até as versões seguintes cumprirem a janela de 24 horas; o SDK de e-mail fica em 0.5.0 pela mesma razão. Não foram adicionadas exceções ao Bun. TypeScript 7 não substitui diretamente o compilador: o lint atual precisa da API JavaScript e declara suporte a TypeScript `<6.1.0`. Referências: [compatibilidade do lint](https://typescript-eslint.io/users/dependency-versions/), [transição do compilador](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), [upgrade MongoDB](https://www.mongodb.com/docs/drivers/node/current/reference/upgrade/).

O agregador de e-mail ainda puxa componentes individuais marcados como deprecated pelo publicador; instalação sem avisos de depreciação não foi comprovada. Eles não aparecem como vulnerabilidades conhecidas na auditoria atual.

## Integrações e fronteiras

- Screen Wake Lock opcional nas partidas rápida e de carreira e nos replays. Só solicita ao habilitar, durante reprodução visível; libera ao pausar, ocultar ou sair. Grants atrasados são liberados, e recusas por bateria ou política não causam loop de tentativas nem alteram a simulação.
- Web Share de vídeos de replay a partir de um segundo clique explícito após finalizar a gravação, preservando a ativação exigida pelo navegador. Cancelamento é normal; download continua disponível quando o formato ou a política não permitem compartilhar. Nenhum upload automático foi adicionado.
- MediaRecorder com dono explícito para o stream, encerramento idempotente, liberação dos tracks em erro ou desmontagem e extensão baseada no MIME efetivo, incluindo MP4 quando suportado. A interface encerra clipes após 60 segundos.
- As APIs opcionais ficam fora dos módulos de simulação e dos caminhos públicos iniciais. A gravação não passa objetos do renderizador para saves ou resultados oficiais.

## Validação

O workflow auxiliar usa banco MongoDB descartável em loopback para verificar corrida de claims, rejeição de escrita por processos antigos, persistência lida por outra conexão e índices de expiração. O teste recusa a URI de produção e nunca usa `MONGODB_URI`.

O diagnóstico de startup compara a base real do PR e o candidato com as mesmas dependências. Preserva CPU profiles, timeline do Chrome, LCP observado, screenshots e HTML. O throttling real desse diagnóstico é diferente da simulação do Lighthouse; seus resultados não substituem o gate móvel nem certificam FPS físico.

Antes do primeiro envio desta revisão: instalação npm limpa, árvore npm válida, Bun frozen-lockfile, build, TypeScript 6, lint sem avisos, orçamento absoluto de bundles, 20 testes focados, 33 contratos Node e 12 testes auxiliares passaram. A auditoria npm completa reportou zero vulnerabilidades conhecidas. A suíte completa e os gates do commit final ainda precisam ser confirmados no CI, incluindo o novo contrato MongoDB e o Lighthouse móvel que reprovou a revisão anterior.

Publicação exige também backend pronto e SHA compilado de `/api/health` idêntico ao release aprovado. Nenhum segredo ou serviço de produção foi alterado nesta etapa.
