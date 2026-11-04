# JogoManager | Testes ativos autorizados apenas em staging

**Não executar este documento na produção.** A autorização para investigar o
próprio aplicativo não equivale a autorização para modificar transações reais,
jogadores reais ou contas de terceiros. Usar exclusivamente duas contas de teste
criadas para a auditoria (usuário A e B), Stripe CLI/Test Mode, banco clonado e
rotas de staging.

## Cenário 1 - idempotência de pagamentos (Stripe TEST)
- Criar uma sessão de checkout TEST e evento TEST assinado corretamente.
- Entregar o mesmo `event.id` duas vezes ao webhook de staging.
- As duas respostas devem ser 2xx ou sem efeito duplicado, segundo o contrato.
- Confirmar **uma** linha em ledger por evento e **um** incremento de direito;
  jamais conceder moedas duas vezes.
- Repetir com mesmo `checkout.session.id` e outro id de evento para comprovar
  idempotência de negócio, não apenas deduplicação de transporte.
- Eventos não assinados devem retornar 4xx sem mutação.

## Cenário 2 - carreira adulterada (staging)
- Criar carreira de teste autenticada de A.
- Tentar versão/salvamento retroativo e `user_id` de B, com valores econômicos
  absurdamente inflados.
- Esperado: rejeição server-side, log sem payload sensível e nenhuma alteração
  no saldo, na temporada ou na carreira de B.
- Verificar concorrência CAS/revision, limites Zod e tamanho máximo do body.

## Cenário 3 - RLS/IDOR (duas identidades de teste)
- Na base de teste, inserir `careers`, `player_careers` e `user_wallet`
  pertencentes a A e B. Nunca usar as identidades reais da produção.
- Autenticar como A com JWT de teste válido e tentar SELECT/UPDATE de linha B.
- As leituras de B devem retornar zero; os UPDATEs devem alterar zero registros
  ou ser negados. Confirmar preservação da linha B.
- Repetir com B; validar as políticas RESTRICTIVE de MFA.
- Não usar `service_role` na requisição que finge ser um usuário; ela ignora RLS.
- Conferir a função `SECURITY DEFINER` apontada pelos advisories antes da liberação.
- Não assumir que `career_saves` existe: no projeto inspecionado as tabelas
  atuais incluem `careers` e `player_careers`.

## Segurança de execução
- Restringir tráfego e janela, usar IPs autorizados e backups de teste.
- Evitar fuzzing massivo, exfiltração, bypass real de controles e payloads
  destrutivos. Sem ataques volumétricos contra Supabase, Cloudflare ou Stripe.
- Incluir relatório por caso: ambiente, versão, identidade fictícia,
  resultado esperado/observado, evidência redigida e rollback.
- Bloquear promoção caso haja leitura cruzada ou concessão de moedas duplicada.
