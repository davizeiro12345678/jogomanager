# Recuperação de carreira e carregamento inicial — 25/10/2026

Continuação sobre `243b32ddc1f9477be0f7daacb411a1c43ad6b7c1`, com comparação adicional contra `main` em `5a75fef3662e3750917df1c2259169e4ed9f24d3`. O checkout compartilhado foi preservado; estas alterações foram preparadas em cópia isolada. [Dados e hashes](data/career-startup-followup-2026-10-25.json).

## Correções verificadas

| Situação | Antes | Depois | Evidência |
|---|---|---|---|
| Nova gravação durante migração assíncrona | O envio atrasado ainda podia usar a rodada antiga | Relê fila, revisão, operação e estado durável antes de gravar ou enviar | Falha reproduzida antes; teste passa enviando somente a rodada nova |
| Troca de conta durante preparação | A migração podia ser persistida depois da troca de proprietário | Confere o proprietário novamente antes da persistência | Falha reproduzida antes; teste mantém estado e fila originais, sem enviar |
| Exclusão durante preparação | A continuação não relia a remoção da fila | Retorna sem recriar ou enviar a carreira excluída | Regressão específica passa |
| Falha no carregamento da migração | O código permitia preparação assíncrona, sem cobertura dessa falha | Conserva carreira e fila para recuperação | Teste confirma nenhum upload |
| Entrada sem save | A migração trazia o motor de carreira/temporada no caminho inicial | Importa a migração somente quando há estado a migrar | Build, tipos, testes e restauração real no navegador |
| Arquivos comuns de roteamento | Roteador e serialização RPC saíam fragmentados | Agrupa somente esses módulos, mantendo corpos das rotas e abas pesadas separados | Verificador de bundle e fluxos interativos |

A simulação autoritativa, sementes, sequência do Worker, tabelas de preços e regras de atestação não foram alteradas neste complemento. A preparação continua preservando o backup bruto antes de migrar um save.

## Tamanho antes e depois

Mesmo Node 24.22.0, instalação de dependências e configuração de build. Valores abaixo são **bytes gzip estimados**, não FPS, uso percentual de CPU/GPU ou tempo real de carregamento. A referência anterior de produto é idêntica entre `32e42a9` e `243b32d`.

| Caminho | Main de referência | Antes desta correção | Depois | Redução nesta correção | Gate gzip + Brotli contra main |
|---|---:|---:|---:|---:|---|
| Página inicial | 167.786 | 169.607 | 167.142 | 1.45% | Passou |
| Nova carreira | 438.766 | 467.619 | 390.882 | 16.41% | Passou |
| Partida rápida | 302.375 | 307.952 | 305.533 | 0.79% | Pendente |
| Match 3D | 563.824 | 588.377 | 546.636 | 7.09% | Passou |
| Palco cinematográfico | 537.727 | 543.329 | 540.879 | 0.45% | Pendente |
| Editor | 178.356 | 182.587 | 180.174 | 1.32% | Pendente |
| Simulação Worker | 28.419 | 13.731 | 13.731 | 0.00% | Passou |

O limite absoluto de bundle passa. O gate relativo continua falhando em partida rápida, editor e palco cinematográfico; nenhum limite, cenário ou regra foi relaxado. O relatório JSON inclui também Brotli e o total de JS, inclusive arquivos lazy.

## Restauração e segurança no navegador

Edge local com contextos isolados de visitante e dados sintéticos. Foram verificados:

- Exportação de carreira nova e save antigo, seguida de importação em outro perfil e recarga.
- Oito seções preservadas por hash: jogadores, escalação, banco, finanças, calendário, resultados, histórico e histórico do treinador.
- Clube, temporada/rodada, ano, data da cópia e versão apresentados antes do download; JSON validado antes de baixar.
- Rejeição de arquivo de carreira no editor e de personalizações na carreira, preservando o save existente.
- Versão futura de save preservada para recuperação, sem downgrade ou substituição silenciosa.
- Loja e produtos em desktop/mobile: 1.500 moedas identificado como melhor relação, pacote dominado de 200 moedas indisponível e comparação correta com 500 moedas; catálogo simulado, sem cobrança.
- Falha simulada de armazenamento: interface conserva o progresso em memória, informa falha e permite exportar; uma gravação posterior confirmada persiste o estado mais recente.

Todos os quatro fluxos terminaram sem erro JavaScript registrado. A geração das fixtures também passou. Um novo build reproduziu os mesmos arquivos JS/CSS usados no navegador, conferidos por SHA-256.

## Validação e limites

- Suíte completa: 2.229 testes em 408 arquivos, seguida da regressão final de exclusão na suíte focada de 19 testes em dois arquivos. O teste de estresse de 200 partidas é um job separado de CI.
- Tipos, lint com zero avisos, 23 testes dos contratos de desempenho, build e limite absoluto de bundle: aprovados.
- O lint local ignorou somente saídas geradas e o harness de navegador não versionado; as regras e o comando de CI permanecem intactos.
- Uma tentativa inicial foi invalidada por arquivos temporários removidos pelo ambiente e por lint concorrente com geração de assets. A repetição usou temporários persistentes e passou; esses erros não foram contados como bugs do jogo.
- O preview inicial foi bloqueado no sandbox. Após autorização explícita do usuário, os testes locais foram executados. Não houve compra, escrita de dados de produção, aumento pago de compute ou deploy.
- O CI do pai `243b32d` aprovou CPU de construção, simulação de 200 partidas, replay de banco, contratos 3D, WASM, auditoria e desktop. Bundle relativo e Lighthouse mobile ainda bloqueavam a publicação; o novo commit deve receber seus próprios checks.
- As medições gráficas históricas e o lote de 690 partidas permanecem limitados às revisões descritas nos relatórios anteriores. Este complemento não certifica GPU em partida animada nem cobertura de todos os clubes.
