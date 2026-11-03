# Integrar Go e C#/.NET no jogo

## O que é possível nesta hospedagem

O site e o servidor do jogo rodam numa rede de borda que executa só JavaScript e WebAssembly (WASM). Ela não executa um servidor Go nem um servidor .NET tradicional. Então as duas linguagens só entram como **módulos WASM compilados**:

- **Go**: compilado com TinyGo para WASM, roda dentro das funções do servidor.
- **C#/.NET**: compilado para WASM, roda dentro do Web Worker que já simula as partidas.

Mover o servidor inteiro para Go, ou a simulação inteira para C#, significaria hospedar fora da Lovable e reescrever o motor. Isso quebraria o replay no servidor (o anticheat do online), as regras de moedas e os testes obrigatórios de desempenho. Este plano não faz isso.

## Proposta (por etapas, cada uma medida antes de seguir)

### Etapa 1: Go no servidor (piloto)
- Primeiro módulo: validação de saves, com os limites de plausibilidade e a pontuação de risco (puro, sem acesso direto ao banco).
- O TypeScript continua chamando o banco; o Go só calcula.
- Teste de paridade: as mesmas 500 entradas precisam dar o mesmo resultado em Go e em TS antes de trocar.
- Depois, se o ganho for real: normalização dos lotes de importação do API-Football (o trecho mais pesado do servidor).

### Etapa 2: C#/.NET na inteligência (piloto)
- Primeiro módulo: a leitura tática do intervalo e a escolha de substituições da CPU, rodando dentro do Worker da partida.
- O motor da partida continua em TypeScript, porque é ele que o servidor reexecuta para validar resultados online.
- Carregado só quando uma partida começa, nunca na home nem nas páginas indexadas.
- Mesma regra de paridade: com a mesma semente, a partida tem de sair idêntica.

### Etapa 3: decisão com números
- Comparar tempo de execução, tamanho de download e tempo de abertura da partida no celular, com e sem os módulos.
- Ficar só com o que melhora. Os módulos que piorarem o carregamento ou quebrarem a paridade são removidos.

## Riscos que você precisa saber
- O runtime .NET para WASM pesa vários megabytes. Mesmo carregado só na partida, pode atrasar a abertura no celular.
- O Go via TinyGo é leve, mas o ganho em funções pequenas tende a ser modesto.
- Duas linguagens a mais aumentam a manutenção: toda regra vai existir em dois lugares até a paridade ser comprovada.

## Detalhes técnicos
- Go: TinyGo `-target=wasm`; o arquivo `.wasm` fica em `src/wasm/`; carregado em funções `*.server.ts`; a interface com o TS é só JSON.
- C#: `dotnet publish` com `browser-wasm` e AOT desligado no piloto; inicializado dentro de `simWorker`; mensagens tipadas.
- O build precisa de Go/TinyGo e do SDK .NET; os `.wasm` gerados ficam no repositório, porque o build da Lovable não compila Go nem C#.
- Os testes de paridade entram na suíte existente e nos gates de qualidade; nenhum limite de desempenho é afrouxado.
