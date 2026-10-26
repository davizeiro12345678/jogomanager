# Torcida, anatomia e CPU — 24/10/2026

Base: ac3aa26987317c3ee6b2b9fdbc68aed7b5e1f3e7. Cinco subagentes, revisão central. Pequeno crescimento do bundle autorizado pelo solicitante; isso não constitui aprovação automática dos outros gates e os limites existentes não foram alterados.

## Mudanças

- Cartões da torcida WebGL2: quatro gestos com oito fases por gesto (32 tiles64×128), atlas512×512. Mesmos lotes/triângulos, mas memóriaRGBA passa de32KiB para1MiB sem mipmaps (~1,33MiB com mipmaps). WebGPU permanece estático. Normais acompanham o shear do tronco; shader recebe nova chave de cache.
- Cabeças: planos malar/bucal suaves compartilhados com as superfícies faciais existentes; mesma topologia/identidade. Sampler interno reutiliza vetores e morfologia e evita cálculo de normais imediatamente descartado. Não equivale a um modelo fotorealista novo.
- Contato com o solo: linha afim de altura composta substitui quatro transformações completas da sola, mantendo o perfil real da chuteira. Lista canônica de articulações evita Object.keys por clamp. Oracle independente compara12288 avaliações de sola e2048 soluções completas, tolerâncias1e-12/1e-11. Não há mudança de relógio ou regras de simulação.
- Rapier: sem giro, retorna antes da leitura WASM de velocidade e hypot. Limiar, subpassos e solver preservados. Testes de regressão verificam cinco subpassos e uma leitura de velocidade em vez de seis no cenário30Hz sem giro.
- CodSpeed: seis cenários adicionais de contato22atletas/recuperação e construção de cabeça em três LODs/cabelo detalhado; cobertura passa de16 para22 benchmarks. Medição local não instrumentada não equivale a resultado do serviço CodSpeed.

## Verificação local

Suíte completa:2083 testes em382arquivos passaram. Build gráfico passou; TypeScript/lint e stress executados separadamente, consultar CI do candidato para resultado final. Todos os22 benchmarks executaram localmente. Não foi medida aceleração percentual contra a base nesta etapa; não alegar ganho de FPS.

## Limitações

Ainda é uma atualização parcial do pedido de salto visual: não há nova biblioteca de animações de contato nem substituição completa do modelo humano. O atlas tem32quadros, mas não há interpolação entre tiles. Sem captura validada e campanha GPU física, qualidade visual e FPS nativo permanecem não certificados. Game Development Studio CLI não está instalado neste executor; não foram usados serviços pagos. Postman não mede kernels de física/Three; não foi aplicado tráfego artificial ao backend de produção.
