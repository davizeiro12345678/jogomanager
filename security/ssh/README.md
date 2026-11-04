# JogoManager SSH/FIDO2 | preparação, sem corte remoto

**Estado:** Scripts preparados, mas não executados em nenhuma VPS. Nunca execute este pacote remotamente sem acesso ao VNC Contabo testado.

## Preparação obrigatória

1. Verificar, fora de banda, as host keys das VPS core8 e plus6 pelo VNC Contabo. Não usar StrictHostKeyChecking=no.
2. Testar uma sessão VNC root e possuir backup restaurável. Não desligar root SSH nesta fase.
3. Em cada VPS, executar manualmente 01_ativar_jmadmin_no_vps.sh no VNC root. Validar senha e sudo em conexão nova.
4. No cliente com dois autenticadores físicos, executar 07_08_gerar_fido2_e_ca_cliente.sh em modo fido2 para primaria e reserva, com dois tokens distintos, PIN e toque.
5. Gerar duas CAs independentes, no mesmo script em modo ca, para core8 e plus6. A CA privada deve ficar offline, protegida por passphrase forte. Transferir APENAS a chave pública da CA de cada VPS.
6. No VNC root de cada VPS, conferir o fingerprint da CA, instalar somente a chave pública por 10_instalar_ca_na_vps.sh e testar o resultado.
7. Executar 09_11_emitir_e_testar_certificado_cliente.sh para cada servidor e para cada token, em novas conexões SSH. O certificado dura 15 minutos, e a rotina valida sudo com senha.

O corte final de root SSH e a configuração exclusiva de certificados FIDO2 exigem procedimento manual separado, rollback agendado de sshd, testes de segunda conexão, token de reserva e VNC ativo. Não estão automatizados neste pacote.

O computador WCOM-457 não possuía fingerprints conhecidos dos dois IPs na inspeção do dia 04/11/2026. Nenhum segredo de CA, PIN ou senha deve ser enviado por chat.

Referência: Apêndice A do Plano Integrado JogoManager de 04/11/2026.