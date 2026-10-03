# Narração com ElevenLabs

A narração autenticada usa `eleven_v4_turbo` pelo WebSocket Text to Dialogue. A chave precisa ter permissão de Text to Speech e deve ficar no segredo do servidor `ELEVENLABS_API_KEY`; nunca use o prefixo `VITE_` nem grave o valor no repositório.

O servidor tenta estes modelos, nesta ordem:

1. `eleven_v4_turbo` (padrão)
2. `eleven_v4`
3. `eleven_flash_v2_5`
4. `eleven_multilingual_v2`

As alternativas ainda usam créditos da conta ElevenLabs. Sem chave ou quando o serviço está indisponível, o jogo pode usar a voz gratuita de síntese instalada no navegador/dispositivo; as vozes disponíveis dependem do sistema.

Para configurar a chave no Worker, use Wrangler autenticado e digite-a no prompt interativo:

```powershell
npx.cmd wrangler secret put ELEVENLABS_API_KEY --name jogomanager-web
```

A mudança do segredo não publica código por si só; publique o Worker depois que o código atualizado estiver no checkout autorizado.
