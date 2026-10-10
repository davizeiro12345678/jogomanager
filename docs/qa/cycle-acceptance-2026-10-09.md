# Aceitação do grande ciclo — 09/10/2026

Este registro acompanha o documento “Grande ciclo: identidade, carreiras, multiplayer, cinema e loja”. A autorização atual inclui concluir QA, entregar no GitHub e publicar. A anotação antiga de “sem deploy” no ledger descreve a etapa anterior; não cancela essa autorização. Publicação depende de o código, banco, pagamentos e testes estarem compatíveis.

## Requisitos e evidência

| Frente | Evidência disponível | Pendência para aceitação |
| --- | --- | --- |
| 1. Atleta 3D | Contrato determinístico de aparência, Hero/Studio integrados, testes de geometria, materiais e LOD; navegador identifica WebGL2 na GPU Intel Iris Xe | Comparação antes/depois sob a mesma câmera/luz; campanha completa de tempo de quadro e recursos nos dois perfis de GPU; aparelho Android real |
| 2. Jogador | Três slots versionados, envelopes/revisões/tombstones e fila serial; testes de persistência e engine; hub verificado em desktop/390 px | Auditar todos os estados narrativos e esportivos pedidos e fechar o fluxo de criação em seis etapas; testar migração com saves antigos representativos |
| 3. Treinador | Perfil compartilhado entre carreira e clube; hub com retomada; motor e testes de carreira/finanças/desenvolvimento | Completar licenças, origem/filosofia e revisão de requisitos de diretoria, torcida, comissão, imprensa e propostas |
| 4. Clube | Cinco etapas atuais, manager compartilhado, rascunho e importação/exportação existentes | O documento pede também elenco/orçamento e prévias 3D de kit/estádio; validar substituição/restauração e catálogo único |
| 5. Multiplayer | Replay final no servidor; pausa local e reinscrição após queda; teste de snapshot recuperado sem perder história de eventos | Partida real entre duas contas de teste, latência/quebra/retorno e histórico/pós-jogo; reações e presença compartilhadas |
| 6. Cinema | Módulos de direção/câmera/atores; testes de diálogo, voz opcional, timeline e runtime | Comparação visual integrada, catálogo completo de eventos, skip/retry/legendas e ciclos de recursos sem crescimento |
| 7. Painéis | Sistema visual, hub e fluxos novos; QA parcial desktop/390 px | Percorrer todos os painéis com teclado, erro/offline e movimento reduzido; revisar repetição de cartões e responsividade |
| 8. SEO | Núcleo central, testes de metadata/indexação e rotas pessoais noindex | Checagem HTTP/SSR na versão publicada e conciliação com 19 commits novos de main |
| 9. VIP/cosméticos | Contrato puro anti-pay-to-win e ofertas locais de R$19,90/R$39,90; vitrine agora oculta ofertas competitivas recusadas no servidor | Direitos conectados a benefícios visuais/slots reais; prévia/propriedade/equipado; VIP/VIP Max ainda não ativados |
| 10. Banco/pagamentos | Migrations aditivas locais, testes de fulfillment/snapshot/webhook; conta sandbox Stripe acessível | Banco remoto sem as novas tabelas/funções; configurar sandbox do Worker, webhook e testar pagamento/duplicação/cupom/renovação/troca/expiração antes de ativar planos |
| 11. IA | Cliente Messages nativo, orçamento fail-closed, corpo/SSE limitados; testes com fetch simulado | ANTHROPIC_API_KEY ausente no ambiente local e no Worker; chamada real pendente. A UI ainda agrega a resposta e não prova streaming ponta a ponta |

## Estado dos serviços reais inspecionados

- Supabase: projeto `lguqnwvsfeefxamzeyos`, ativo. Sem development branches. Migrations aplicadas até autoridade multiplayer; tabelas `store_products`, `subscriptions`, `user_purchases` presentes. `checkout_session_owners`, `user_entitlements` e journal novo não aparecem no inventário. `fulfill_store_purchase` existe; `reconcile_subscription_wallet` e `begin_payment_webhook_event` não aparecem.
- Stripe: sandbox separado Onze Interactive acessível. Dez produtos legados, sem VIP/VIP Max. Webhooks sandbox existentes apontam para Lovable, não para o Worker Cloudflare deste checkout.
- Cloudflare: OAuth autenticado. Worker `jogomanager-web` possui secrets de Supabase e pagamentos live; não lista secret da Anthropic nem secrets Stripe sandbox. Valores secretos não foram lidos nem registrados.
- GitHub: integração autenticada e origem `davizeiro12345678/jogomanager`. Após fetch, main está em `75801ed` e este branch tem 19 commits de atraso. Reconciliar alterações por merge normal depois de estabilizar o snapshot; preservar o histórico Lovable.

## Falhas da primeira suíte completa e resolução

Primeiro resultado: 220 arquivos, 1.146 testes aprovados e 11 falhas em 9 arquivos. O resultado de 44 testes focados anterior não cobria essas falhas.

- Cenários de substituição antigos forneciam jogador não registrado ou atributos diferentes da reserva oficial. Os testes agora registram explicitamente a reserva, respeitando o contrato seguro da simulação.
- Cenário de força da carreira foi ajustado para alterar a base versionada de desenvolvimento, que é a fonte dos atributos efetivos.
- Expectativas de anatomia, cache de voz e capacidades WASM foram conciliadas com pivô cervical, articulação de cabelo, revisão de voz e ABI aditiva atuais. A migração aceita enriquecimento aditivo dos dados e verifica idempotência.
- Falha real: a primeira história de eventos com sequência zero era ignorada pelo consumidor. Também era possível anunciar uma sequência sem transmitir eventos e depois ignorar a recuperação completa. `WorkerMatchView` agora atualiza a sequência consumida somente quando recebe a história; 27 testes de transporte/snapshots/Worker passaram após a correção.
- Vitrine anunciava moeda/treino/olheiro/passe que o servidor anti-pay-to-win recusava. A oferta visível agora filtra cosméticos e a descrição da loja não promete que recursos competitivos são inofensivos.

## Evidências locais anteriores

- Central: `verification/qa-cycle-2026-10-09/careers-hub-playwright-settled/shot-1.png`.
- Acesso multiplayer: `verification/qa-cycle-2026-10-09/multiplayer-access/shot-1.png` (apenas acesso sem login; não prova partida).
- Suíte completa repetida após as correções de snapshots, rig, abertura da camisa e tradução: **220 arquivos e 1.163 testes aprovados**, duração 198,70 s. O stress separado não está incluído nessa contagem.

## Verificação adicional desta etapa

- `test:stress`: nova execução aprovada, **200 seeds executadas duas vezes** (400 partidas), 405,27 s. Cada replay independente reproduziu passos, estatísticas/placar, marcadores, mapa de finalizações e eventos, dentro do guard; a primeira execução também verificou bola solta sem congelamento. Escopo: MatchSim no modo de compatibilidade, sem ativar Rapier nem conexão remota. Não substitui campanha da autoridade física ou multiplayer real.
- `wasm:test`: 18 testes Rust aprovados. Duas compilações release independentes, com Cargo targets `repro-a`/`repro-b` e saídas `verification/wasm-repro-2026-10-09/a`/`b`, produziram WASM e loader JS idênticos. WASM SHA-256: `9DBAB27A1B0C1EEC7FF82EBA841314170B64EBE32ECDBEDE6B8AFB1BE7A1D77B`, também igual ao binário incluído em `src/game/wasm/pkg`. Loader SHA-256: `3202B61CF3F78CE3DC8B51F58EDE93B89015E38CE1E92AC1B8F75457F87D0A3C`. Ambiente local sem wasm-opt: `--no-opt`, otimização release do Rust e lockfile preservados. Não certifica outros toolchains nem ganho de performance.
- TypeScript: repetido e aprovado após as correções de rig, tradução, testes e lint.
- `graphics:build`: aprovado. A medição foi reiniciada na versão compilada para evitar reinicialização por atualização do código durante a coleta.
- Medição nativa fechada: Intel Iris Xe, Alta, 1280×720, DPR 1, 60 s de aquecimento + 300 s medidos, 9.259 quadros, zero interrupções e contrato sem adaptação. Média 30,86 FPS, p95 63,10 ms, 1% low 8,20 FPS, média 208,39 draw calls, máximo 248. **Reprovou** as metas de 45 FPS e p95 até 28 ms. JSON e captura em `verification/qa-cycle-2026-10-09/native/`. Uma execução não comprova ganho sobre a base, campanha de três execuções, GPU NVIDIA ou Android.
- Lint completo: os 189 erros restantes eram de formatação em quatro arquivos. Após corrigi-los, `eslint . --quiet` terminou com exit 0. A execução anterior identificou 169 avisos; não declarar código sem avisos.
- Build de produção: repetido e aprovado após as correções finais. `bundle:check` **reprovou**: chunk Rapier de 222.338 bytes excede orçamento de 180.000 bytes. O WASM de física está separado (3.082.103 bytes), mas isso não basta para aprovar o orçamento. O guard foi preservado, não aumentado. Os guards seguintes ainda não foram certificados, pois o script interrompe na primeira falha.
- Relatório completo dos bytes em `verification/bundle-2026-10-01/current.json`: Worker estático 469.407 bytes (limite 90.000); seleção rápida startup 1.226.083 (limite 1.150.000); home startup 1.222.192 (limite 900.000). Estes também excedem os limites do script. Há catálogo `leagues` no fechamento estático do root. Requer conciliação de dependências/arquitetura; não remover autoridade física ou relaxar guard para mascarar o resultado.
- A cópia `verification/mega-update-2026-10-09/base-source` está preservada, sem alterações Git, em `cc75d5f`; servirá como base visual. Seu medidor antigo usa 5 s/60 s, diferente da campanha de aceitação atual de 60 s/300 s. Comparações curtas entre versões devem ser rotuladas como diagnóstico, não aprovação da campanha.
- HTTP remoto: domínio principal, `www` e endereço direto do Worker retornaram 200 JSON em `/api/health`, com auth/serverCredentials/database prontos. Isso confirma saúde da versão já publicada, não publicação deste ciclo nem funcionamento da loja/IA.
- QA nativa Player Studio: corpo e rosto da mesma prévia/posição/atleta em `base-studio-body.jpg`, `base-studio-face.jpg` e capturas atuais. A análise visual observou melhor encaixe facial/proporções, mas expôs gola e sombra de contato problemáticas. A sombra simplificada não é mais desenhada em portrait, que já possui ContactShadows. Testes red/green confirmaram cap atravessando o pescoço, gola abaixo do fechamento e abertura menor que a base do pescoço; a camisa agora tem abertura superior e folga geométrica. 43 testes de rig/cloth aprovados. A gola ainda merece acabamento visual; não declarar realismo fotográfico ou aprovação de todas as variantes.
- QA nativa cinema: comparação de “Apresentação à imprensa”, qualidade Mais detalhes, encenação 13 s, pause ao abrir e reprodução automática desligada. Capturas `base-cinema-press-13.jpg` e `current-cinema-press-13-fixed.jpg`. Os cartazes novos inicialmente vazavam chaves internas de tradução; teste red/green reproduziu e corrigiu as 18 mensagens de nove ambientes em PT/EN. Cena atual percorreu cinco falas, legenda completa e retorno ao catálogo. Não cobre as 87 cenas, voz real, todos os estados de erro nem recursos após 20 ciclos.

## Liberação

Não declarar este ciclo completo nem ativar vendas VIP enquanto as pendências acima estiverem abertas. O acesso a uma conta Stripe ou a presença de uma função SQL não prova compra entregue. Uma amostra gráfica parcial não prova ganho de FPS. O pedido de publicação está autorizado; seus gates técnicos ainda precisam ser satisfeitos.
