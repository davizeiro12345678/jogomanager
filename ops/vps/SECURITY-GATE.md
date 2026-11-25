# JogoManager | Portão de segurança: Plus 6 e SSH/FIDO2

Atualizado em 04/11/2026. **Não é um diagnóstico forense remoto.**

## Evidência histórica e limitação

O relatório local `benchmark_seguranca_contabo_20261102.md` registra execução de um minerador com privilégios root na Plus 6. A existência dessa nota **não demonstra**, por si só, que o minerador ainda esteja ativo, nem que tenha ocorrido reinstalação limpa posteriormente. O status atual da máquina não foi verificado por sessão administrativa autenticada.

Um sistema potencialmente comprometido com root não deve ser usado como emissor de confiança, standby de produção ou ambiente para instalar novas credenciais privilegiadas, mesmo que benchmarks/HTTP retornem resultados normais.

## Condições antes de integrar a Plus 6

1. Preservar evidências e criar snapshot seguro de forma compatível com o provedor, evitando confiar exclusivamente nos logs que um atacante root pode alterar.
2. Confirmar no painel Contabo quem acessa a instância, status de backup, disco e console VNC. Não copiar senhas ou códigos de recuperação para issues/CI/chat.
3. Se o comprometimento de root for confirmado ou não puder ser excluído, **reprovisionar com imagem oficial confiável**, não apenas remover o binário do minerador.
4. Rotacionar credenciais, tokens SSH/API e segredos que a instância possa ter visto, por seus sistemas emissores. Revisar Cloudflare Tunnel, credenciais de CI, bancos e webhooks se estiveram expostos.
5. Verificar SSH de `jmadmin`, sudo interativo, VNC root e chaves do host pelo console da Contabo.
6. Confirmar integridade após reinstalação, pacotes, logs de acesso, serviços persistentes, agentes, regras de firewall e horário sincronizado.
7. Somente então gerar/confiar na CA independente da Plus 6 e testar os **dois** tokens FIDO2 com certificados de 15 min, antes do corte final do root.
8. Reexecutar os benchmarks antes/depois na instância limpa e só depois considerar túnel, failover ou balanceamento.

## VPS 8

Pode permanecer como origem atual enquanto sua integridade também é verificada. **Não** alterar o DNS de catálogo para o túnel atualmente inativo. A configuração existente espera `https://127.0.0.1:443`, enquanto o gateway do catálogo foi documentado em `127.0.0.1:3092`: confirme o eventual proxy intermediário e as regras de acesso antes de efetuar o corte.

## Política de mudança

- `ops/vps/benchmark.sh`: coleta conservadora; não instala software.
- `ops/vps/benchmark-maintenance.sh`: requer janela de manutenção autorizada e permite aumento transitório de CPU e I/O.
- `ops/vps/ssh-fido2-preflight.sh`: somente leitura; não valida autenticação física nem substitui console VNC.
- Nunca inserir chaves privadas de CA, senhas, recuperação ou segredos do Supabase/Cloudflare dentro da VPS ou do repositório.
- PR deve permanecer em rascunho e sem implantação até recuperação, testes e revisão operacional.

## Validação de status

Só é legítimo marcar "FIDO2 concluído" quando houver os quatro logins novos (primário e reserva nas duas VPS), principal `jmadmin`, sudo autenticado, testes negativos de chaves sem certificado, bloqueio de root confirmado e temporizador de reversão cancelado após sucesso.
