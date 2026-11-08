# Reset offline de carreira

O reset de carreira é uma operação destrutiva composta por duas fronteiras: a carreira cloud autenticada e o compartimento local do proprietário. O fluxo autenticado primeiro confirma que não há save/flush/outbox pendente, adquire o Web Lock exclusivo `manager3d.career.lock.account-<owner>`, exclui a carreira cloud e só então chama `clearLocalCareer`.

`clearLocalCareer` usa `idb-keyval.delMany` para apagar carreira, timestamp, snapshots e outbox em uma única transação IndexedDB. Em seguida lê todas as chaves novamente; somente se nenhuma existir remove e verifica o espelho `localStorage`. Falha de IndexedDB, leitura confirmatória ou remoção do espelho retorna `false`, preserva o espelho quando possível e nunca é convertida em sucesso por `resetCareerSafely`.

Save local, enqueue e flush autenticados usam o mesmo lock e uma versão monotônica no compartimento. O reset avança a versão antes do wipe; uma operação que já capturou a versão anterior e só consegue o lock depois é descartada, em vez de recriar a fila. Uma aba que começa a salvar depois do preflight não pode executar a gravação cloud enquanto outra aba mantém o reset. O compartimento visitante também usa chaves próprias e a limpeza inclui apenas suas chaves legadas sem dono.

Browsers sem `navigator.locks.request` não oferecem uma garantia cross-tab demonstrável sem alterar o backend para aceitar uma versão/tombstone de reset. Nessa situação, `withCareerLock` informa `acquired: false` e o reset autenticado falha fechado: nenhuma exclusão remota ou local é iniciada. Saves locais ainda podem ser preservados no espelho/IndexedDB e uploads ficam pendentes, mas o aplicativo não finge que a corrida entre abas foi coordenada.
