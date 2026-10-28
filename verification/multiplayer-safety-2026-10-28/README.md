# Verificação: multiplayer, segurança e IA

## Estado da entrega

Rascunho para revisão. O chat de sala usa identidade verificada no servidor,
acesso de leitura por RLS e limite transacional. A moderação semântica externa
e o treinador tático ficam desligados até configuração explícita. O adaptador
`MatchSimAuthority` e a coordenação de comandos foram testados localmente, mas
ainda **não há transporte online persistente, recuperação após reinício nem
integração dessa autoridade com o fluxo multiplayer existente**. O placar
oficial atual continua vindo do replay no servidor; a visualização de cada
navegador continua sendo uma simulação separada.

O webhook registra contestações de checkouts identificados como pertencentes
ao jogo, sem debitar carteira ou revogar benefício automaticamente. A tabela
é restrita ao servidor e ainda não possui uma tela operacional de revisão.

## Testes e medições

- `npm test`: 301 arquivos e 1.637 testes passaram; exclui o teste de estresse
  separado. Um novo teste de integração do motor foi executado isoladamente
  depois da coleta e também passou, usando duas identidades sintéticas.
- Testes locais da migração de chat e da migração de contestações passaram no
  PGlite auxiliar com papéis e dados fictícios. O workflow também executa os
  dois contratos em PostgreSQL; esse resultado do novo commit ainda é pendente.
- TypeScript, lint e compilação foram executados localmente. O limite absoluto
  `bundle:check` passou; a comparação com a base, porém, **falhou**.
- Na mesma máquina, a comparação de bundles mediu total gzip de 2.234.126 para
  2.236.935 bytes (+2.809) e Brotli de 2.105.433 para 2.107.911 (+2.478).
  A comparação ainda apontou aumentos de 10 bytes na carreira, 35 bytes na
  rota Match 3D e 1 byte no worker, em gzip. Nenhum limite foi alterado.
- No commit anterior do PR (`15d1dfe3f817c86e505c25bc0ec2a3186e4be7c9`),
  Quality gates falhou em bundle e Lighthouse mobile. O workflow visual gerou
  [capturas e vídeos](https://github.com/davizeiro12345678/jogomanager/actions/runs/40742061153)
  de cenas de teste; seu próprio `comparison.json` informa
  `visualAssetsComplete: false` e `physicalDeviceCertification: false`.
  Elas não comprovam uma partida online nem desempenho em aparelho físico.
- O teste anterior de substituição por lesão e suas condições estão em
  `verification/ai-injury-2026-10-28/README.md`.

## Pendente antes de publicação

1. Concluir um dono de partida com transporte autenticado, limites, persistência,
   recuperação, liquidação idempotente e renderização dos snapshots autoritativos.
2. Executar partidas completas humano × humano e humano × IA com duas contas
   reais de teste em ambiente isolado, incluindo reconexões, comandos inválidos
   e conferência do placar em ambos os clientes.
3. Testar no Stripe sandbox checkout, webhook assinado, pagamento recusado,
   reembolso e contestação; verificar entrega única e isolamento entre contas.
4. Configurar a chave existente com o procedimento seguro, revisar privacidade
   e avaliar o modelo real em partidas comparáveis e com orçamento controlado.
5. Corrigir todos os gates de desempenho, repetir os checks obrigatórios e só
   então considerar a publicação do SHA aprovado.
