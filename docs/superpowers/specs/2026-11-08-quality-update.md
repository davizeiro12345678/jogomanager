# Atualização de qualidade, desempenho e resiliência

Pedido original: melhorar benchmarks, Match 3D em qualidade alta com média de pelo menos 60 FPS, estabilidade, cutscenes, gráficos, experiência online, chat, segurança, carreira, finanças, táticas, autenticação independente, cache, suporte e mensagens transacionais; entregar evidências comparáveis e commits revisáveis.

## Base e autorização

- Base verificada: `c20036f33a8f7d8eff15012d276606a3964e4a54`, merge do PR #125, que já está fechado.
- Implementação: branch isolada `codex/massive-quality-20261108`. Preservar outras cópias e alterações locais.
- O usuário pediu implementação com subagentes; executar o plano sem aguardar uma aprovação intermediária do plano. O destino remoto foi consultado porque um PR mesclado não pode receber novas alterações como parte daquele PR.
- Nenhum merge nem publicação de produção faz parte da validação local. Os gates atuais continuam obrigatórios.

## Requisitos verificáveis

1. Comparações CPU usam mesmos fixtures, sementes, runtime fixado, dependências e casos. A meta de +89% de throughput equivale a 1,89x; reportar separadamente redução de duração e aumento de throughput. Não remover casos, resultados ou testes para alcançar a meta.
2. Match 3D deve ser medido em **alta**, resolução/DPR/câmera/seed fixos. Registrar hardware, renderer real, duração, média, 1% low, p50/p95/p99, máximo, stalls, draw calls, triângulos e erros. Meta solicitada: média >=60 FPS; certificação física exige GPU identificada e protocolo suficiente.
3. Capturar imagens e vídeo de execução antes/depois. Vídeo e imagens não substituem medição de tempo real; gravação pode perturbar FPS e deve ser identificada.
4. Preservar autoridade determinística do Worker/replay e qualidade visual. Novos cálculos não devem mudar resultados válidos apenas para acelerar um benchmark.
5. Chat deve normalizar evasões Unicode sem bloquear palavras legítimas por substring. Autorização, limites e decisões de recompensa permanecem no servidor/banco.
6. Dados locais e solicitações financeiras são não confiáveis: rejeitar valores não finitos, limites impossíveis e identificadores inválidos antes de mutações; preservar recuperação de saves e idempotência.
7. Login alternativo usa o mesmo projeto Supabase e a mesma identidade. Nunca alternar silenciosamente para outro projeto, criar contas substitutas ou relaxar MFA/RLS. OAuth direto só pode ser usado para provedores explicitamente configurados com credenciais próprias.
8. Cache compartilhado contém apenas projeções públicas, tem capacidade e tempo de espera limitados e não retém falhas. Sessões, saldos, saves, permissões e segredos permanecem fora dele.
9. Suporte automático precisa autenticação, limites duráveis, validação de payload, entrega autenticada e idempotência. Sem configuração externa verificada, a UI deve informar a indisponibilidade e oferecer os canais atuais, sem fingir um ticket entregue.
10. Inventário Resend observado nesta sessão: 41 templates publicados. A conexão de eventos deve ser distinguida de publicação de templates. Não enviar emails reais como teste.
11. Testes ativos ficam no ambiente local isolado, com payloads sintéticos, limite explícito de requisições/concorrência, timeout e interrupção por degradação. Não executar carga média em produção sem alvo e critérios de saúde estabelecidos.
12. Publicar apenas dados do criador expressamente fornecidos no pedido; identificá-los como informações do responsável, sem inventar certificação, titularidade verificada ou estabelecimento aberto ao público.

## Restrições globais

- Lint com zero erros e zero avisos; TypeScript sem erros.
- Nenhum relaxamento de gates, budgets, cenários ou severidades existentes.
- Migrações de aplicação novas são forward-only em Drizzle. Policies Realtime têm a exceção delimitada no AGENTS.md.
- Separar evidência local, microbenchmark, teste sintético, GPU física e estado remoto.
- Não expor credenciais nos relatórios, vídeos, logs, código ou PR.
- Alterações reversíveis e delimitadas; importações existentes continuam válidas ao modularizar.

## Limites externos a verificar

- O conector Lovable retornou `Unknown tool` ao consultar o projeto; inspeção visual continua disponível.
- SentinelX não tem integrações Cloudflare cadastradas nesta sessão; não atribuir mudanças remotas ao conector.
- Supabase saudável e advisors disponíveis; avisos não são prova automática de vazamento.
- Uma segunda implantação independente de Auth exige migração de usuários/identidades, chaves e confiança explícita de JWT. A documentação de recuperação deve explicar isso, sem prometer failover inexistente.
