# Node exporter security rebuild

The official v1.12.1 image scanned on 2026-10-27 had 14 high-severity findings in its Go binary. This recipe rebuilds the same upstream release with Go 1.27.3 and updates x/crypto and x/net. The build runs the upstream test suite. A scan of the deployed rebuilt binary reported no high or critical findings at that time; this does not establish absence of vulnerabilities.

On the VPS, the deployed local image ID is `sha256:3cc8d79b4fbdbd3e98b644950ebefe7f769dc85ca2a0487ffc82449f4a642cad`. The production Compose file references that local image ID; it is not a registry digest and cannot be pulled on a new host. The previous configuration remains at `/srv/jogomanager/monitoring/compose.pre-node-exporter-security-20261027.yaml`.

To rebuild on another host, build this Dockerfile with Docker, scan the resulting image, validate its metrics in an isolated canary and update the local Compose image reference to that host's tested image ID. Pin or record the complete resolved dependency set before relying on a future rebuild: the base image and two explicitly upgraded modules are pinned, but the build fetches packages and can resolve different transitive dependencies over time. Do not assume a rebuild reproduces the image ID above.

After deployment, query Prometheus `up` and confirm the node exporter target is healthy. Rollback uses the saved Compose configuration and recreates only node-exporter.
