# Revisão de privacidade e tamanho dos artefatos

Esta revisão registra o snapshot existente antes das novas capturas de interface/cinema/vídeo. É uma verificação delimitada do pacote desta tarefa, não uma auditoria geral de credenciais da máquina ou da produção.

## Snapshot histórico, anterior aos vídeos

- Escopo: `verification/quality-update-20261108/`, arquivos existentes no momento da inspeção.
- Inventário: **338 arquivos, 16.058.917 bytes no total**, aproximadamente 15,32 MiB.
- Arquivos maiores que 20 MiB: **nenhum**.
- Vídeos `.mp4`, `.webm`, `.mov` ou `.mkv`: **nenhum ainda presente**.
- Os JSON brutos não foram editados, normalizados ou sobrescritos pela preparação do relatório.

A busca de conteúdo, sem imprimir valores, cobriu arquivos JSON/Markdown/log/texto/YAML e padrões de chave privada, prefixes de chaves secretas/publicáveis Supabase, tokens Stripe/GitHub, JWT, Bearer e parâmetros de URL de acesso (`token`, `access_token`, `refresh_token`, `api_key`, assinatura, segredo, senha e equivalentes). Não foram encontrados valores correspondentes. A busca adicional por nomes de credenciais retornou apenas os relatórios de testes geral/final, no título de um teste que exige bloqueio quando `SUPABASE_SERVICE_ROLE_KEY` está ausente. O match é o **nome** da variável no título, sem valor de credencial.

URLs públicas de projeto e nomes de variáveis de configuração não são por si só credenciais. Valores de chaves, inclusive publicáveis, não são necessários à revisão e devem continuar fora dos artefatos commitados. Arquivos de ambiente ignorados e o ambiente Python local de geração de gráficos não pertencem ao manifesto de entrega.

## Capturas e arquivos futuros

O inventário acima é anterior à conclusão dos novos vídeos e não certifica arquivos futuros. Repetir a verificação após a captura e revisar visualmente as telas antes de incluir mídia no commit; regex de texto não verifica pixels, áudio ou conteúdo de vídeo. Links locais de mídia podem ser entregues ao usuário sem colocar o binário no Git.

Manter vídeos volumosos fora do commit de fonte/evidência. O limiar de 20 MiB é um critério de inventário solicitado nesta tarefa, não um orçamento do jogo nem autorização para anexar automaticamente todos os arquivos menores. As capturas e JSON selecionados devem preservar a origem e as limitações de protocolo descritas em `artifact-manifest.md`.

## Verificação final após as duas gravações completas

O inventário final utilizado nesta revisão contém **546 arquivos e 202.165.029 bytes** (cerca de 202,2 MB), incluindo vídeos locais, arquivos ignorados e evidência histórica. Pequenas alterações finais deste relatório/índice não estão incluídas nessa contagem de snapshot.

Somente dois arquivos excedem 20 MiB:

| Arquivo local | Bytes | Entrega |
| --- | ---: | --- |
| `graphics/video/page@e574c5358b02cc5c15ae4d04fde8b8f7.webm` | 58.919.009 | Local, fora do Git |
| `graphics/video/page@57507cd63a8e9bfc6ab136f9d9b010bc.webm` | 57.773.125 | Local, fora do Git |

**Todos os vídeos**, inclusive os menores de cinema/interface e a tentativa falha preservada, devem permanecer fora do Git. Seus JSON de metadata e `graphics/video/video-manifest.json` mantêm caminhos, tamanhos, hashes e validação. Os dois vídeos completos são VP8, têm 364,52/364,24 s e cadência codificada de 25 FPS; isso não representa o FPS do jogo.

A varredura final usou `rg --no-ignore -I`, incluindo logs, diffs e helpers de texto ignorados. Foram buscados prefixes de chaves, JWT/Bearer, chaves privadas e parâmetros de URL com acesso. Não foi identificada credencial real ou URL com token de acesso. O único arquivo com padrões de chave/token foi `review-career-auth-cache.diff`: dois literais estáticos de testes, um `vi.stubEnv` de fixture e um Bearer de teste. Os valores não são repetidos neste resumo. Os relatórios de testes também contêm nomes de variáveis, sem seus valores reais.

Arquivos de ambiente ignorados, chaves reais e URLs com acesso embutido não pertencem ao pacote de commit. A revisão de texto não faz OCR de pixels nem examina áudio: as capturas são de contextos públicos/frescos, sem login concluído ou ticket enviado, e foram revistas visualmente no trabalho principal. Dados públicos do responsável fornecidos no pedido não são repetidos nos relatórios técnicos. Esta revisão delimitada não é auditoria de segredos da máquina inteira ou pentest de produção.