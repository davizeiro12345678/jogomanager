# PR #128 - segundo passe de implementação (09/11/2026)

## Escopo e reconciliação com a produção

Este commit continua **somente** o PR #128. O projeto Supabase
`lguqnwvsfeefxamzeyos` já recebeu as migrações de aplicação 0063, 0064 e
0065 via histórico gerenciado: **não executar de novo** nem criar uma segunda
cópia Drizzle. A Edge Function `api-football-import` foi inicialmente confirmada na versão 14 com
quota atômica de 450.000 requisições/dia UTC, 1.200/minuto e 20/segundo.
Este passe não repete deploy do importador nem muda esses limites.

**Revalidação somente de leitura em 09/11/2026 às 21:42 UTC:** a função
`api-football-import` já está **ACTIVE na versão 25**, posterior à versão 14
documentada anteriormente. A migração gerenciada
`20261109201609_api_football_raise_claim_concurrency_48_20261109` também está
aplicada. A configuração efetiva permanece habilitada com **450.000/dia** e
**1.200/minuto**. No instante observado: 244.343 requisições contabilizadas
em recibos do dia, 232.573 recibos concluídos, 2.380.556 jobs pendentes,
47 em execução e 2 indisponíveis. A janela de dez minutos tinha 4.549
requisições contabilizadas. Esses valores mudam em tempo real e não
representam o teto máximo sustentado. **Não substituir a versão 25 com os
arquivos antigos da versão 14 nem reaplicar migrações existentes.**

## Mudanças efetivas de código

- **IA tática v2 opt-in:** corrige a explicação de meio-tempo após saturação
  das faixas táticas, permitindo que o contrato de regressão anterior volte a
  passar sem remover o teste. Acrescenta cobertura defensiva do corredor de
  passe e apoio ofensivo posicional, ambas funções puras, determinísticas,
  com limites de movimento, resistência e validação de números.
  Alterações são guardadas por `tacticalAiRevision === 2`; a IA v1 de saves
  e replays anteriores não sofre alterações de posicionamento.
- **Autoridade de simulação:** novo
  `src/game/online/canonical-authoritative-engine.server.ts`, adaptador
  _somente de servidor_ da simulação `MatchSim` para o contrato
  `AuthoritativeMatchSession`: semente privada validada, tick fixo com limite
  de segurança, instantâneo público sem segredos, eventos com IDs estáveis,
  placar autoritativo, táticas aceitas/rejeitadas explicitamente, substituição
  somente de reserva inscrito e resultado de desistência determinístico.
  Ainda **não é um transporte de WebSocket/Durable Object em produção**;
  a implementação deve ser integrada à autenticação/tickets, recuperação
  após reinício, ordenação de comandos e persistência antes do rollout.
- **Primeiro frame 3D:** o WebGL2 padrão é selecionado na fase de layout
  sem esperar pela Promise de detecção WebGPU (necessária apenas para opt-in).
  O placeholder SSR inicial permanece igual. Ganho de milissegundos não
  foi medido e não deve ser fabricado.
- **CSS responsivo:** em celular ou com preferência de menor transparência/
  dados, remove o blur do cabeçalho fixo da carreira e aplica um fundo opaco.
  Em dispositivos de toque, remove hover-only motion de botão principal.
  Mantém indicadores de foco existentes; testes de contrato acrescentados.

## Validação e limites

Na cópia isolada `C:\ProgramData\SentinelX\workspace\jogomanager-pr128`:

- 11/11 testes focados de IA v2 passaram.
- 23/23 testes do adaptador e da sessão autoritativa passaram.
- 30/30 testes focados de CSS, renderer, IA e adaptador passaram.
- TypeScript global e ESLint `--max-warnings=0` aprovados.
- Teste de 200 partidas semeadas, com reprodução determinística, aprovado.
- O CI do SHA `6810738` encontrou duas falhas no teste
  `mobile-stadium-dpr.test.ts`: o mock de React invocava o componente sem
  simular `useLayoutEffect`, após a otimização do primeiro frame.
- O teste foi corrigido sem desativar verificações, na revisão `0c55395`.
  Na verificação local dessa revisão passaram **374 arquivos / 2.250 testes**,
  ESLint sem avisos e TypeScript sem erros.
- O último CI completo da nova revisão ainda precisa rodar e aprovar seu SHA
  exato; aprovação local não substitui os gates remotos.

Ainda precisa do **CI do SHA exato**, do build final, das campanhas de GPU
dedicada/integrada com os mesmos parâmetros e da ativação externa de
Firebase/FCM e transporte multiplayer. O último benchmark físico anterior
era 82,263 FPS médios e **190 frames >50 ms**, com pior pausa 800,8 ms:
esses números não foram substituídos por uma medição nova. A meta de
0 frames >50 ms ainda é **objetivo não certificado**, nunca um contador
a ser zerado por software. Lighthouse móvel havia aprovado no head
anterior; a nova revisão deve repetir todos os gates sem relaxamento.

## Continuação necessária sem duplicação

1. Resolver qualquer falha de build/CI da revisão exata e analisar traces
   de primeira pintura e stalls reais do renderer, sem suprimir amostras.
2. Integrar a sessão autoritativa via transporte real, com single-owner
   por sala, credenciais/tickets verificados no servidor e persistência
   de checkpoints/receipts; não substituir por estado de socket local.
3. Validar FCM do mesmo projeto Firebase com token de teste, SW separado,
   consentimento e revogação, sem publicar credenciais Admin no cliente.
4. Comparar CSS, UX, Lighthouse e FPS em dispositivos reais antes de merge/
   publicação. Produção do frontend permanece na revisão publicada anterior.
