# Segurança operacional do VPS — ClamAV, Elastic Defend, Wazuh e AetherAV

> **Revisão operacional:** 22/11/2026. Estes arquivos são código e testes; **não** são uma certificação de segurança, nem ativam serviços por um simples merge. A configuração foi auditada e instalada separadamente no VPS autorizado.

## Objetivos e limites de segurança

- Preservar **ClamAV em tempo real** na área de ingestão e as proteções atuais **Elastic Defend Malware Prevent** (com **on-write scanning** e **blocklist** habilitados).
- Encaminhar ao Wazuh alterações de estado dessas proteções e falhas operacionais, **sem** duplicar eventos brutos do Elasticsearch ou expor credenciais do Fleet.
- Economizar memória e CPU nos scans agendados sem excluir os grandes arquivos, sem apagar arquivos automaticamente e mantendo detecções duvidosas em revisão.
- Registrar tudo em logs e backups fora do Git; nenhum token, senha, certificado ou dado pessoal é publicado no repositório.

## Artefatos versionados

| Arquivo | Finalidade |
| --- | --- |
| `jm-security-large-split.py` | Preserva a lista integral de arquivos grandes no scanner profundo. A rota rápida está desabilitada por segurança enquanto não houver vínculo estável entre o arquivo inspecionado e o scanner |
| `jm-av-policy-probe.py` | Produz somente estados sanitizados, sem segredos: `jm_clamav_posture` e `jm_elastic_defend`. O código não altera a política dos motores |
| `jm-antivirus-policy-rules.xml` | Seis regras para o gerenciador Wazuh, IDs 100790–100795: alerta de perda de prevenção, impossibilidade de verificação e confirmação de recuperação |
| `tests/` | Oito testes Python com biblioteca padrão cobrindo classificação exata, fallback, falha fechada e mudanças de proteção |

### Evidência histórica da mudança no VPS

**Revisão de segurança posterior:** os testes anteriores não demonstravam que os formatos eram íntegros ou que o caminho continuava apontando para o mesmo arquivo no momento do scan. Esta revisão elimina a rota rápida baseada em prefixo e mantém todas as entradas no scanner profundo. A economia histórica de recursos não se aplica à nova revisão. O código revisado ainda não foi instalado no VPS; a instalação requer validação separada do consumidor das listas.

Em 22/11/2026, 229 arquivos grandes foram classificados **sem perder entradas**: **132** com formatos verificados e **97** conservados para o scanner profundo. Um arquivo ELF de aproximadamente 35 MB passou em um scan `clamdscan --fdpass --file-list` real, no serviço systemd isolado, com retorno zero.

A rotina instalada em `/usr/local/sbin/jm-security-fullscan-10h` usa essa partição no **próximo** ciclo. O scan que já estava em execução permanece intocado, sob `CPUQuota=100%` e `CPUWeight=10`; a configuração Maldet para os próximos ciclos foi reduzida de quatro para três workers. Há cópias locais antes das mudanças, preservadas sob nomes `backup-before-...`. O script de serviço contém exclusões e caminhos de infraestrutura específicos e, por isso, não foi copiado integralmente para este repositório público.

**Importante:** o ganho de RAM só ocorre quando o processo independente termina, não no instante da alteração do script. A revisão atual mantém todos os arquivos no fallback profundo; nenhum ganho de RAM ou CPU é reivindicado.

### Integração Wazuh verificada

O monitor local já acompanhava os serviços essenciais, incluindo Elastic Endpoint, Elastic Agent, ClamAV, Clamonacc e AetherAV. A extensão adicionou dois estados de política:
- `jm_elastic_defend`: exige Malware `prevent`, scan ao escrever e blocklist; informa que memória e proteção comportamental estão **não suportadas** pela política Linux observada, sem tratá-las como falhas de serviço.
- `jm_clamav_posture`: checa archive, bytecode, assinaturas de phishing, heurísticas e `OnAccessPrevention` da área limitada de ingestão. `DetectPUA` desligado é **declarado**, mas não acionado automaticamente por causa do risco de falsos positivos.

O arquivo de eventos sanitizados já era coletado pelo Wazuh. O gerenciador v4.14.10 teve regras validadas com `wazuh-analysisd -t`, foi reiniciado sem falha, e um teste sintético de regressão atingiu a regra de severidade **12**. Um evento real de configuração saudável foi recebido e indexado com IDs **100792** e **100795**.

**Limitação expressa:** ainda não existe uma ponte contínua, comprovada e autorizada que copie os **alertas de detecção reais** do índice Elasticsearch para o Wazuh. A criação de uma credencial específica de leitura foi bloqueada por controle de segurança e **não foi contornada**. Não usar a senha de administrador do Elasticsearch em scripts ou publicar segredos para contornar esse bloqueio.

## Testes

```bash
python3 -m unittest discover -s ops/vps-security/tests -p 'test_*.py' -v
python3 -c "import xml.etree.ElementTree as ET; ET.parse('ops/vps-security/jm-antivirus-policy-rules.xml')"
```

Antes de qualquer instalação em um VPS, verificar **hash e revisão**, realizar backup dos scripts e rulesets existentes, validar a política em uma VM, conferir que o scan anterior terminou, testar os processos Wazuh e validar rollback. O merge do PR **não implica execução automática de comandos root**.

## Pendências e aceitação

1. Inspecionar a próxima execução completa do scan, recibos `LARGE_FDPASS_EXIT`, `LARGE_FALLBACK_EXIT`, detecções e hash do relatório; o resultado **não** está concluído enquanto o scan antigo permanecer em execução.
2. Validar repetição sob o mesmo VPS e CPU steal observada. Meta de load average 1,1 **não foi atingida** e não é equivalente a 1,1% de CPU.
3. Classificar falso positivo de PUA e risco de quarentena antes de mudar flags do ClamAV; funções limitadas por licença **não** devem ser forçadas no Elastic Basic.
4. Homologar separadamente o encaminhamento autenticado de alertas reais do Elastic para Wazuh, respeitando acesso mínimo e autorização.
5. Auditar Docker, SSH, Cloudflare/CSP, grants Supabase, OAuth, Stripe e multiplayer do PR #132; **este PR não encerra essas tarefas**.

Referências oficiais: [ClamAV clamdscan](https://docs.clamav.net/manual/Usage/Scanning.html) · [ClamAV PUA](https://docs.clamav.net/faq/faq-pua.html) · [Elastic Defend policy](https://www.elastic.co/docs/solutions/security/configure-elastic-defend/configure-an-integration-policy-for-elastic-defend) · [Elastic otimização](https://www.elastic.co/docs/solutions/security/manage-elastic-defend/optimize-elastic-defend).
