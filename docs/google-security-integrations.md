# Google security integrations and Cloudflare contingency

## Estado operacional verificado em 19/10/2026

Após autorização explícita, foi criada no projeto `sscxz-2ee8d` a chave de servidor **JogoManager Worker - Fraud Defense**, restrita somente à API reCAPTCHA Enterprise. O Worker `jogomanager-web` agora contém `GOOGLE_RECAPTCHA_API_KEY` como `secret_text`; o painel mostra valor criptografado e a consulta autenticada de nomes/tipos confirmou sua presença. Os sete segredos anteriores foram preservados. Foi usada a opção **Mais opções → Salvar**, e a lista de implantações manteve os mesmos dez registros e a mesma versão ativa. Não foram publicadas as alterações locais do site, configurados os demais bindings Google ou ativados `observe`/`enforce`. O recibo e as duas fotos sem valores privados estão em `verification/visual-security-20261019/google-credentials-receipt.json` e `output/playwright/visual-security-20261019/google-credentials/`. Credencial armazenada não comprova avaliação antifraude ativa.

A implementação local agora projeta eventos por allowlist (`security-event.ts`) e emite apenas categoria, resultado, horário, status e buckets de score. O ponto externo de respostas do Worker encaminha 401/403, 429 e 5xx para o coletor. Cada categoria tem orçamento de 60 eventos por minuto por isolate e um contador posterior de eventos suprimidos. Não são enviados caminhos, IPs, IDs de conta, tokens, e-mails, saves ou conteúdo de compra nesse fluxo. Isto limita o volume de logs; não é um rate limiter de requisições.

`scripts/google-secops-import.mjs` transforma um arquivo JSONL previamente autorizado no envelope moderno `ImportEvents`, com no máximo 100 eventos por lote e entrada de 1 MiB. Por padrão apenas valida offline. `--output` cria um arquivo novo sem sobrescrever outro. A opção explícita `--send` exige `GOOGLE_SECOPS_PARENT` e `GOOGLE_SECOPS_ACCESS_TOKEN` de curta duração no ambiente do servidor. Nenhum token deve ser colocado no comando, no repositório ou no bundle do navegador. A integração usa o endpoint regional Chronicle e timeout de 10 segundos; falhas não imprimem credenciais nem a resposta bruta do provedor.

Este exportador local não cria uma instância SecOps, não configura Logpush e não comprova ingestão remota. A ativação continua dependente da instância/região/IAM e de um evento de teste aceito pelo serviço. Na inspeção posterior pelo navegador em 19/10, o painel Google mostrou **Instalar o Google Security Operations** e contato comercial; não apresentou uma instância vinculada. A autorização da credencial reCAPTCHA excluiu faturamento, contratação SecOps e publicação da aplicação.

Fontes oficiais: [ImportEvents](https://docs.cloud.google.com/chronicle/docs/reference/ingestion-methods), [autenticação Chronicle](https://docs.cloud.google.com/chronicle/docs/reference/authentication), [coleta de logs Cloudflare](https://docs.cloud.google.com/chronicle/docs/ingestion/default-parsers/cloudflare).

This repository contains server-side reCAPTCHA Enterprise assessments for guest and signed-in checkout, a Cloud Armor policy template, and setup steps for Google SecOps and Security Command Center. Code and templates do not activate cloud products: the Google project, billing/tiers, service permissions, keys, Cloudflare Logpush, and any alternate origin still need to be configured by an account owner.

## Google reCAPTCHA Enterprise for automated checkout abuse

The guest checkout dialog obtains a score-based token with the `guest_checkout` action. Signed-in purchases use a separate `account_checkout` action. The Worker selects the expected action itself and checks token validity, action, hostname, and score before it opens a Stripe checkout session. A guest token cannot authorize an account purchase. The token and the user's email/card data are not logged or sent as assessment fields by this integration. The reCAPTCHA script itself sends browser and interaction signals directly to Google.

This is a token and automated-activity risk check. It is not Google reCAPTCHA Transaction Defense: the current request has no `transactionData` and does not return a transaction fraud verdict. Google Transaction Defense requires transaction-specific integration and may require payment method and user or card signals. Before adding those fields, document the data sent, update the privacy notice, and decide how payment methods selected inside Stripe Checkout will be represented. Do not describe Transaction Defense as active until the project feature is enabled, a transaction assessment is received, and its result is handled in checkout.

Create a score-based reCAPTCHA key restricted to the production hostnames (and separate test hostnames when needed). Enable the reCAPTCHA Enterprise API, create an API key restricted to that API, and set the public enable flag and site key only when the server mode is `observe` or `enforce`:

| Variable                            | Where                      | Purpose                                                                                                                 |
| ----------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `VITE_GOOGLE_FRAUD_DEFENSE_ENABLED` | build-time public variable | Set `true` only when score-based reCAPTCHA assessment is configured; prevents loading the Google script while disabled. |
| `VITE_GOOGLE_RECAPTCHA_SITE_KEY`    | build-time public variable | Browser site key; it is not a secret.                                                                                   |
| `GOOGLE_CLOUD_PROJECT_ID`           | Worker secret/variable     | Google Cloud project ID.                                                                                                |
| `GOOGLE_RECAPTCHA_SITE_KEY`         | Worker secret              | Site key used by backend assessment.                                                                                    |
| `GOOGLE_RECAPTCHA_API_KEY`          | Worker secret              | API key restricted to reCAPTCHA Enterprise.                                                                             |
| `GOOGLE_FRAUD_DEFENSE_MODE`         | Worker variable            | `off`, `observe`, or `enforce`.                                                                                         |
| `GOOGLE_FRAUD_DEFENSE_MIN_SCORE`    | Worker variable            | Legitimate-risk score minimum from `0` to `1`; default `0.5`.                                                           |

Keep mode `off` until keys and hostname restrictions are configured. Then use `observe` while reviewing score buckets and checkout errors for both actions. `observe` does not block on a low score or Google outage. Move to `enforce` only after choosing a threshold from real traffic; enforcement rejects missing/invalid tokens, low scores, and Google API failures, so a Google outage will also stop guest and account checkout. Do not use a Google API key in `VITE_*`, `vars`, committed Wrangler JSON, or browser code.

Guest and signed-in purchase actions are wired to separate assessments in the local source. Login, registration and password reset still use the existing Supabase flows and require their own action-specific integration before claiming account-defense coverage. This is not Google's Account Defender or Transaction Defense.

Before activation, publish the reviewed code and browser configuration together, verify both actions in `observe`, and test missing tokens, a wrong action/hostname, a legitimate purchase and a provider timeout using Stripe test mode. Confirm an assessment in the Google console and a redacted event in the collector. Configure alert ownership and an explicit rollback to `observe` before enabling `enforce`. The presence of a stored API secret alone does not establish any of these results.

## Google Security Operations (SecOps)

Google SecOps has a Cloudflare parser and supports Cloudflare Logpush over an HTTP webhook or Google Cloud Storage. The integration requires a Google SecOps instance, a Cloudflare account with access to the required Logpush datasets and destination, a Chronicle-restricted Google API key, and a per-feed webhook secret. Cloudflare announced general Logpush availability on Free, Pro, Business, and Enterprise plans with usage-based pricing in September 2026; dataset access still depends on the products enabled on the account. The current Google SecOps Cloudflare parser guide still lists Enterprise in its prerequisites, so verify that the intended destination and datasets can be created in the connected account before treating the feed as available. A GCS feed is the alternative when using object storage as a buffer.

References: [Google SecOps Cloudflare ingestion](https://docs.cloud.google.com/chronicle/docs/ingestion/default-parsers/cloudflare), [Cloudflare Logpush availability and limits](https://developers.cloudflare.com/logs/logpush/), and [Cloudflare Logpush usage-based pricing announcement](https://developers.cloudflare.com/changelog/post/2026-09-30-logpush-usage-based-pricing/).

Recommended setup:

1. Create a Google SecOps feed with source type `Webhook` and log type `Cloudflare`, or use `Google Cloud Storage V2` and log type `Cloudflare`.
2. Create a Cloudflare Logpush job for the security datasets needed for detection, starting with firewall events. Add HTTP request, DNS, and audit datasets only where they support a specific alert or investigation.
3. Choose a minimal field set and RFC 3339 timestamps. Restrict who can read the feed secrets and log bucket; set retention to the incident-response requirement.
4. Verify parsed records in SecOps SIEM Search, then build detections and alert ownership. SOAR playbooks need a separate response workflow and scoped service permissions.

Cloudflare records can include client IPs, user agents, request URLs, and account identifiers. Limit fields, retention, and access before ingestion, and keep privacy disclosures aligned with the selected datasets. Do not place the webhook API key or feed secret in source code or Worker variables.

## Security Command Center Web Security Scanner

Web Security Scanner does not scan the current Cloudflare Workers deployment as a supported Google Cloud resource. It supports public App Engine, GKE, and Compute Engine web applications; Compute Engine/GKE custom scans also have resource/IP ownership restrictions. A compatible GCP-hosted target and Security Command Center configuration must exist before setting up the scan.

Use a non-production target first. Custom scans can click links, submit forms, and change application state; use a low-privilege test account and exclude state-changing endpoints. Keep a safer baseline scan on a staging hostname if no GCP mirror is planned.

## Cloud Armor as the emergency secondary edge

`infra/google/cloud-armor/` contains a Terraform policy with SQLi and XSS rules based on OWASP CRS 4.22. Both rules default to preview. The template must be attached to a Google external Application Load Balancer backend that serves a separately deployed copy of the app. It does not protect the existing Worker by itself and does not create DNS failover.

Before relying on it for an emergency:

1. Deploy and continuously update an alternate app origin in Google Cloud.
2. Put it behind an external Application Load Balancer, attach the policy, and close direct-origin paths. For Cloud Run, disable its default URL or allow only `internal-and-gclb` ingress so requests cannot bypass Cloud Armor.
3. Review preview logs, tune false positives, and exercise login, saves, store, and multiplayer on the alternate host.
4. Document a human-approved DNS/traffic cutover and rollback. Cloud Armor is a different provider from Cloudflare, but traffic will not fail over automatically until DNS and origin operations are prepared.

## Other Google controls

- Store Google API keys and any feed credentials in Cloudflare encrypted secrets or Google Secret Manager; keep least-privilege IAM and rotate credentials through the owning consoles.
- Enable Security Command Center for the GCP project used for the alternate origin, review exposed resources and IAM findings, and route high-severity alerts to a named responder.
- Treat Google SecOps ingestion, Security Command Center findings, and Cloud Armor preview logs as unconfigured until the corresponding account-side setup is completed and a test event/blocked request is observed.
