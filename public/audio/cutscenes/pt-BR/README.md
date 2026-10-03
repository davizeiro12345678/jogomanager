# Gravações de cutscenes em português brasileiro

## Padrão de entrega

A dublagem planejada cobre as 310 falas das 87 cenas, incluindo todas as respostas alternativas. Use **um arquivo MP3 por fala**, com interpretação em **português brasileiro neutro**. Nomeie cada arquivo com o `lineId` estável e salve-o neste diretório; por exemplo, `arrival.line.001.mp3` para o ID existente `arrival.line.001` será servido em `/audio/cutscenes/pt-BR/arrival.line.001.mp3`.

Para manter o carregamento leve, recomenda-se MP3 mono a 128 kb/s e 44,1 kHz ou 48 kHz. A duração final deve corresponder à gravação entregue, sem cortar a fala. Preserve a identidade vocal de cada personagem entre suas cenas; pronúncia, ritmo e emoção podem variar conforme o contexto.

## Manifesto e licenças

Cada gravação só pode ser incluída depois de autorizados o uso e a redistribuição no jogo. Registre no `CUTSCENE_VOICE_MANIFEST`, em `src/game/cutscene-voice-manifest.ts`, a combinação de `sceneId` e `lineId`, o personagem, o caminho MP3, a duração medida, a referência da licença e a sequência de visemas em milissegundos. O primeiro visema começa em `0ms`; inclua um visema `silence` final dentro da duração. Guarde termos e autorizações em `licenses/` e aponte `licenseRef` para o registro correspondente.

As falas de resposta também são arquivos independentes e usam os IDs explícitos em `src/content/cutscenes.ts`. Não reutilize um áudio entre respostas diferentes só porque o texto se repete. Enquanto um arquivo ou sua licença não constar no manifesto, o jogo mantém o fallback de voz atual. O manifesto permanece vazio até que os arquivos e comprovantes licenciados sejam entregues.
