# Janela de otimização de 24/10/2026

Início registrado:14:57:51UTC (11:57:51 em São Paulo); janela solicitada de uma hora. Base467b735fa324ab063be3dec97702d98119a01a64. Resultado final e capturas estão no relatório exportado; não inferir publicação em produção a partir do commit.

## CPU e movimento

Perfis de CPU identificaram cálculo de pose autorada e mistura de22canais cujo resultado era descartado quando a marcha procedural tinha peso1. PlayerLocomotionPose evita esse caminho; marcha parcial e ações retêm a composição anterior. Scratch e direção são reutilizados no rig detalhado e no LowPlayers. AthleteGazeMotion suaviza somente olhar aditivo, com resposta exponencial equivalente a10/20/30/60Hz; não retarda o impacto autorado.

ABBA,6amostras/revisão e6aquecimentos por carga/bloco, Node24.22.1/EPYC9V74/dependências idênticas. Checksums iguais nas cinco cargas. Os dados são exploratórios; o bootstrap pareado exato não corrige dependência serial.

| Carga | Base ms | Candidato ms | Variação | IC99% da razão |
|---|---:|---:|---:|---|
|66mil poses de corrida|251,941|70,668|−71,95%|[0,2463;0,3199]|
|66mil poses mistas|221,753|95,072|−57,13%|[0,4135;0,4592]|
|8seeds×300ticks|44,636|45,757|+2,51%|[0,8077;1,3647]|
|88mil contatos|145,334|142,010|−2,29%|[0,9160;1,0004]|
|16cabeças próximas, antes da passagem final do cabelo|514,618|513,087|−0,30%|[0,8840;1,1049]|

Não há ganho demonstrado nas três últimas cargas. Não extrapolar para FPS ou física inteira. CodSpeed passa de22 para25cenários, incluindo adaptador real de22atletas e distribuição mista. O run40102465084 anterior confirmou22instrumentados/upload; o novoSHA precisa do próprioCI.

## Física

advanceAthlete calcula duração/resposta exponencial/limite de velocidade uma vez por chamada, preservando a ordem das operações dos139Hz. Vento consulta massa uma vez em vez de duas.12mil estados/remainders e8mil ticks com80checkpoints passaram antes da campanha longa.

Campanha adicional:100partidas completas com Rapier real,2.979.014pares de ticks,9.968pares de checkpoints completos,197.500pares de quadros de replay amostrado idênticos. id/createdAt dos replays excluídos; demais campos preservados. Esta comparação não substitui o gate obrigatório de200seeds com replay independente.

O harness inicial compartilhava objetos mutáveis de configuração entre as duas partidas. O problema foi reproduzido em base×base e candidato×candidato; ambas passaram com fixtures independentes. Somente a execução corrigida de100partidas compõe a evidência válida. Não foi um defeito novo do jogo.

## Torcida, sombras e jogador

Torcida tem afiliação por setor independente da cor da camisa: comemoração do time que marcou e surpresa dos demais. Cache exato do fallback estático evita selecionar novamente assentos quando câmera/projeção/limites não mudam; Worker saudável continua consumindo respostas pendentes. Medição isolada:1000atualizações17,887→0,0565ms;1000→1chamada, mesmo checksum. Não representa o caminho Worker nem GPU.

Custos: atributo de afiliação adiciona61.440bytes nos três pools de5120instâncias, mais dados de preparação. Mantidos lotes/atlas. Câmera ortográfica de sombras é ajustada no espaço da luz para incluir campo, redes e atletas em salto; antes havia clipping nos três horários testados. Mesmo mapa/resolução/luzes/passes, porém mais projetores podem ficar visíveis no mapa e a densidade de texels diminui no volume maior.

Olhos20,9%mais amplos, boca12%mais larga e nariz/narinas ajustados à superfície. Cabelo curto/médio tem contorno menos uniforme, menor volume lateral e fluxo varrido; outros oito estilos byte a byte preservados nos20casos testados. Contagens de vértices, índices, partes e materiais preservadas. Continua estilizado, não fotorealista.

## Validação e limites

Testes diferenciais da locomoção:2520combinações×22canais. Teste de integração executa o callback real do rig com MatchSim, esqueleto e camadas reais, confirmando impacto0,4 a10/20/30/60Hz sem mutar o estado canônico. Torcida: cache exato, gols1–0/0–1 e100ciclos de protocolo com Workers simulados; isso não equivale a100Workers de navegador.

Capturas reais Chromium134headless-shell/SwiftShader. Sessão prolongada instrumenta recursos somente sob resourceProbe=1 no benchmark; nenhum timer extra na cena comum. Sem certificação de GPU física/FPS. Não há mudanças de conta, banco, pagamentos, serviços contratados ou produção. Limites de release não foram afrouxados; crescimento moderado de bundle autorizado não equivale a aprovação dos demais gates.

Referências técnicas consultadas via Context7: Three.jsr186 manual/shadows (câmera ortográfica do mapa), documentação Rapier.js de snapshots/timestep. Preservamos o passo fixo; igualdade local não constitui garantia de determinismo entre plataformas distintas.

Verificação da integração antes da publicação:2118testes/390arquivos aprovados, TypeScript e lint sem erros/avisos; builds gráfico e de produção aprovados. A sessão prolongada de recursos e o stress obrigatório continuam registrados no relatório final exportado. O novo SHA permanece em rascunho até todos os gates críticos serem aprovados.
