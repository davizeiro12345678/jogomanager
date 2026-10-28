# On-demand container image vulnerability scans

This optional service scans a public image by digest in its registry for HIGH
and CRITICAL vulnerabilities. It does not mount the Docker socket, host
directories other than its writable database cache, or application secrets.
It runs as a non-root user, has no published ports, and terminates after the
scan. It is not a runtime intrusion detector and does not send alerts.

On the VPS, create `/srv/jogomanager/security/trivy-cache` owned by UID and GID
65532 with mode 0700, and put this Compose file in
`/srv/jogomanager/security`. The database and downloaded layers use disk space
in that directory. Check available space periodically; the cache is not a disk
quota. The cache is updated from the scanner's configured database registry.

```sh
docker compose config --quiet
docker compose run --rm trivy
SCAN_IMAGE='prom/prometheus:v3.15.1@sha256:fa3302279710be2f21a8301ec17a8b4f2301fd829bd113839b3b6b02b6f191a2' \
  docker compose run --rm trivy
```

The default target is the pinned node-exporter image in the monitoring stack.
Compare the scanned digest with the digest of the image actually in use before
acting on a report. A zero exit status means the scan completed without HIGH or
CRITICAL findings; a nonzero status can mean findings or an operational error,
so inspect the output. Registry, database, or network failures are not clean
results. Scans run only when explicitly requested and may take a few minutes.
Run one scan at a time because they share the database cache.
