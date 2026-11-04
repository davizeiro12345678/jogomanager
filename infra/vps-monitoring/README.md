# Isolated VPS monitoring

Prometheus scrapes its own metrics and a restricted node exporter for host CPU,
memory, load, disk I/O and network counters. It does not measure GPU rendering,
application latency, Redis queue throughput or player capacity. Neither service
publishes a host port, mounts the Docker socket, or receives app credentials.

The images are pinned to their pulled digests; both containers run without
Linux capabilities and have resource limits. The exporter has read-only access
to host `/proc` and `/sys`. Prometheus keeps a named data volume and requests
seven days or 512 MB of retained blocks, whichever is reached first. Its WAL
and head data may temporarily add to that size, so this is not a disk quota.

From this directory, validate before starting:

```sh
docker compose config --quiet
docker compose run --rm --no-deps --entrypoint=/bin/promtool prometheus \
  check config /etc/prometheus/prometheus.yml
docker compose up -d
docker compose exec prometheus /bin/promtool query instant http://127.0.0.1:9090 up
```

The monitoring HTTP services have no login; keep them on the internal network.
To stop only this stack, run `docker compose down` from this directory. The
named data volume is retained by that command.
