# Carreira de jogador: migração de saves com CAS

Esta entrega **não está ativa em produção** até que a migração SQL e a versão do aplicativo
tenham sido implantadas e testadas juntas.

## Motivo

A versão antiga fazia `upsert` sem comparar o save anterior. Um dispositivo
offline podia sobrescrever progresso mais recente. A hora do aparelho e
`revision` no envelope local não representam uma revisão de nuvem.

## Novo contrato

- O PostgreSQL guarda `sync_revision` por usuário e espaço. Começa em 1;
  somente a RPC autenticada pode avançar esse número.
- Uma nova carreira usa `expectedRevision=0`. Uma edição ou exclusão exige
  a última revisão devolvida pelo servidor.
- A RPC executa a comparação e a gravação em uma única transação SQL.
- Quando a revisão não coincide, ela devolve `conflict`, sem alterar o save.
- Uma exclusão mantém o registro com `deleted_at` e incrementa a revisão.
  Isso impede que uma fila antiga recrie o save sem aviso.
- Retrocessos na temporada/semana ou troca da identidade de um atleta ativo
  são rejeitados mesmo quando a revisão coincide.
- Saves pessoais não certificam conquistas, moedas ou resultados oficiais.

## Regras da interface

- Conflitos não são resolvidos automaticamente por timestamp.
- A versão local e sua operação pendente permanecem disponíveis.
- O arquivo de atletas permite exportar o JSON e baixar/restaurar backups
  de exclusões. Restaurar não garante substituir um save de nuvem concorrente.
- Os estados de login, conexão e save confirmado são distintos.
- Até uma resolução explícita de divergências, **não prometer sincronização
  perfeita**: os dados locais divergentes são preservados, mas a nuvem
  continua com a versão confirmada mais recente.

## Ordem segura para implantação

1. Fazer backup verificável das linhas atuais em `player_careers`; registrar
   esquema, RLS, permissões, contagem por usuário e tamanho das carreiras.
2. Rodar a migração `0035_player_career_atomic_sync.sql` em ambiente de teste.
3. Executar cenários da lista abaixo como usuário autenticado e como anônimo.
4. Planejar uma janela curta de transição: a migração revoga escrita direta
   dos clientes antigos, então a API e o cliente novos devem entrar juntos.
5. Validar os três espaços, recuperação de guest e migração de saves antigos.
6. Confirmar que logs não incluem conteúdo de saves nem tokens.
7. Monitorar erros, conflitos, tempo de RPC e tamanho da fila offline.
8. Só então liberar gradualmente. Não descartar o banco antigo nem apagar
   tombstones durante o lançamento.

## Cenários obrigatórios de integração

- Duas sessões carregam revisão 1: a primeira grava revisão 2 e a segunda
  recebe `conflict`, sem sobrescrever a primeira.
- A segunda sessão fica offline por várias semanas, volta e não consegue
  substituir o progresso da primeira sem uma resolução intencional.
- Uma exclusão na revisão 2 cria tombstone revisão 3. A fila com revisão 2
  não consegue recriar a carreira.
- Um backup restaurado após exclusão pode criar revisão 4, com autorização
  e sem atropelar revisões concorrentes.
- Uma atualização de temporada 3 para temporada 2 é rejeitada.
- Um save ativo não aceita troca silenciosa de `seed`; após tombstone,
  é possível iniciar nova identidade com a revisão correta.
- Um usuário não consegue ler ou alterar espaço de outra conta. `anon`
  não possui permissão EXECUTE na RPC.
- Dados truncados, JSON inválido e estados com tamanho maior que o limite
  são rejeitados com erro recuperável.
- A criação do terceiro atleta não modifica os outros dois.
- Fila offline mantém operação quando a rede ou o servidor falha.
- Restauração/exportação local continua funcional sem login.

## Política de recuperação

Não efetuar rollback destrutivo da coluna `sync_revision` ou dos tombstones.
Se a nova API apresentar erros, interromper as gravações de nuvem, preservar
fila local e backups, corrigir a API e retomar. Restaurar permissões amplas
de escrita direta desfaz a proteção contra sobrescrita e não é um rollback seguro.

## Limitações atuais

O processo ainda precisa de testes com banco real e duas sessões. A interface
preserva conflitos e oferece exportação/backup, mas ainda não disponibiliza
fusão automática de decisões incompatíveis entre dispositivos.
