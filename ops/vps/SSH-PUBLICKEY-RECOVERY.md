# Falha `Permission denied (publickey)`: recuperação da VPS 8

Data: 04/11/2026. Instância VPS 8: `194.163.188.190`. Usuário administrativo: `jmadmin`.

## Significado e estado conhecido

O comando Windows `ssh root@194.163.188.190` retornou `Permission denied (publickey)`. A porta 22 respondeu, mas a autenticação root NÃO foi concedida. Isso **não significa** que a conta `jmadmin` não exista, nem que uma senha local esteja incorreta. O SSH pode estar configurado para aceitar exclusivamente chaves/certificados de usuário. O script de redefinição de senha no PowerShell não alterou senha alguma.

A máquina Windows WCOM-457 não possui `~/.ssh/config` no perfil nativo; `ssh-agent` Windows estava parado na checagem, e não havia sessão autenticada nas VPS. A distribuição WSL não equivale automaticamente a um acesso autorizado e não deve ser usada para burlar controles.

## Sequência segura pelo VNC da Contabo (VPS 8)

1. No painel Contabo, abrir o console VNC **da VPS 8 verificada por ID e IP**, usando seu próprio login autorizado. Manter esta janela ativa como acesso de emergência. Não registrar senhas ou códigos em logs/GitHub/chat.
2. Confirmar a máquina e se o terminal está como root:

   ```sh
   id -un
   hostname
   ip -brief -4 address
   getent passwd jmadmin
   ```

3. Se `jmadmin` já existir, executar `passwd jmadmin` como root. Se não existir, executar interativamente o script auditado `security/ssh/01_ativar_jmadmin_no_vps.sh` por VNC ou criar a conta via procedimento da distribuição. **Nunca tentar alterar a senha da VPS 8 por um SSH que recusou a autenticação.**
4. Conferir `passwd -S jmadmin` e `id -nG jmadmin`. A indicação `P` significa senha local registrada, **não** que SSH aceite autenticação por senha.
5. Analisar sem alterar:

   ```sh
   /usr/sbin/sshd -T -C user=jmadmin,host=localhost,addr=127.0.0.1 | grep -E '^(pubkeyauthentication|passwordauthentication|permitrootlogin|trustedusercakeys|authorizedkeysfile) '
   /usr/sbin/sshd -t
   ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
   ```

6. Para novo login SSH, instalar **somente a chave pública de cliente ou CA autorizada** pelo processo FIDO2, com proprietário/permissões corretos. Verificar fingerprint SSH do HOST diretamente no VNC antes de confiar no `known_hosts`; não usar `StrictHostKeyChecking=no`. Nunca copiar chaves privadas para o servidor.
7. Em sessão **nova** autenticada como `jmadmin`, validar `id -un; sudo -v; sudo -l`, mantendo VNC root disponível. Só então executar o baseline `bash ops/vps/benchmark.sh core8 before` na máquina correta e sem root.

## Plus 6: condição adicional

A Plus 6 (`144.91.111.116`) tem um relatório de 02/11/2026 que registra execução de minerador como root, sem confirmação forense de limpeza/reinstalação desde então. Não introduzir nova CA, credenciais de confiança, deploy ou failover antes da verificação e, quando indicado, reprovisionamento e rotação de segredos. Consulte `ops/vps/SECURITY-GATE.md`.

## O que NÃO fazer

Não ativar `PasswordAuthentication yes` nem `PermitRootLogin yes` para contornar o bloqueio, não copiar senhas em comandos `ssh` ou `chpasswd`, não alterar firewall/DNS remoto sem VNC/rollback, não desligar root antes dos dois tokens FIDO2, sudo e quatro logins verificados.

Os benchmarks de TCP e TTFB feitos do Windows são **externos** e não medem CPU, RAM, NVMe ou rede interna dos servidores.
