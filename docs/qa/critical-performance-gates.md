# Gates críticos de desempenho

O workflow `Quality gates` executa os limites de desempenho em todo pull request,
push para `main` e execução manual. O job `critical-performance` reprova quando
qualquer job obrigatório falha, é cancelado ou é ignorado. Os relatórios continuam
sendo publicados como artefatos quando uma medição reprova.

## Limites absolutos

O Lighthouse mobile executa três medições de cada uma das cinco páginas definidas
em `.lighthouserc.mobile.cjs`. Cada limite usa severidade `error` e agregação
`pessimistic`: uma execução fora do limite reprova a página.

| Medição        | Limite     |
| -------------- | ---------- |
| Performance    | ≥ 98/100   |
| LCP            | ≤ 2.500 ms |
| TBT            | ≤ 200 ms   |
| CLS            | ≤ 0,1      |
| Acessibilidade | ≥ 90/100   |

O limiar de performance 98 é absoluto. Ele não significa melhorar a versão anterior
em 98%, nem aceitar uma regressão de 2%. Os limites existentes não são reduzidos
quando uma versão falha.

O job de build também executa `npm run bundle:check`, que valida os limites
absolutos de tamanho e as separações de catálogo, worker, física, editor e 3D
descritas em `scripts/bundle-report.mjs`.

## Comparação de bundles

O workflow reutilizável `bundle-impact.yml` compila base e candidato no mesmo
runner e usa o mesmo analisador. Compara o total e o fechamento dos imports
estáticos de home, nova carreira, partida rápida, partida 3D, palco cinematográfico,
editor e worker. A comparação considera gzip nível 9 e Brotli qualidade 6.

`compare-bundle-reports.mjs --check` reprova qualquer aumento de bytes comprimidos,
inclusive em uma superfície isolada, ou qualquer superfície/medição obrigatória
ausente. `bundle-impact.json` e `bundle-impact.md` identificam as violações. Brotli
nesse relatório estima tamanho de transporte; a compressão real do host precisa
ser confirmada pelos cabeçalhos HTTP.

## Construção de `MatchSim` no mesmo ambiente

`match-setup-performance` compara as duas revisões no mesmo processo de orquestração
e runner. Ele exige a versão de Node de `.nvmrc` e o mesmo diretório físico de
dependências. Uma escalação Flamengo/Palmeiras é serializada uma única vez e usada
por ambas as revisões.

O protocolo é base, candidato, candidato, base (ABBA). Cada passagem usa um processo
novo, 3.000 construções de aquecimento e 31 lotes de 1.000 construções. O relatório
guarda CPU de processo e tempo de parede por construção, ambiente e hash da fixture.
O gate considera as 62 amostras de CPU de cada revisão. A ordem alternada reduz a
influência de aquecimento e deriva de frequência; CPU de processo evita atribuir
simples espera por outro processo ao construtor.

O limite relativo novo reprova um aumento material acima de 10% quando o limite
inferior do intervalo bootstrap de 99% também excede 10%. O bootstrap usa 4.096
reamostragens com semente fixa. Essa margem protege contra pequenas oscilações de
runner e não altera os limites absolutos de Lighthouse ou de bundles. Variação
excessiva continua visível no intervalo e nas amostras; o teste não é uma garantia
de latência em todos os dispositivos.

Antes dos lotes, cada passagem compara 21 checkpoints completos: três sementes,
com sete estados entre o início e 1.800 passos sequenciais. Mudanças no estado
determinístico, fixture ou ambiente reprovam a comparação independentemente do
resultado de CPU. Uma mudança intencional no contrato de simulação exige revisão
desse contrato; não deve ser ocultada desativando a verificação.

Para reproduzir em um checkout do candidato com dependências instaladas:

```sh
git worktree add --detach ../jogomanager-performance-base BASE_SHA
ln -s "$PWD/node_modules" ../jogomanager-performance-base/node_modules
npm run perf:match-setup -- ../jogomanager-performance-base . match-setup-results
```

Esse teste mede construção repetida com cache aquecido, como o caso `new MatchSim`
do benchmark existente. Ele não mede carregamento frio da aplicação, FPS, GPU,
tempo de uma partida inteira ou eficiência do instrumento CodSpeed. O histórico
CodSpeed permanece complementar; resultados de jobs com imagens/kernels distintos
não substituem esta comparação no mesmo ambiente.

## Estresse executado

`simulation-stress` executa `npm run test:stress`, incluindo 200 sementes até o
término e 200 replays independentes. Compara passos, estatísticas, gols, finalizações
e eventos, além do limite de bola parada. O teste tem timeout explícito de 600 s e
o job tem 15 minutos.

O relatório JSON precisa conter a suíte completa com asserções executadas e
aprovadas. `verify-stress-report.mjs` reprova relatório ausente, vazio, ignorado ou
com falhas. A suíte permanece separada dos testes rápidos para ser executada uma
única vez no job obrigatório, e não depende de um agendamento externo.

## Verificação dos próprios gates

`npm run test:performance-gates` verifica os limites de Lighthouse e os caminhos
negativos: regressão de um byte em startup, superfície ausente, medição inválida,
regressão material de CPU e suíte de estresse ignorada. Esses testes validam a
decisão dos gates; a evidência de desempenho vem das execuções reais, não dessas
fixtures.
