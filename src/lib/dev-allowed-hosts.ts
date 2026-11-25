/** Vite already permits localhost and IP addresses; extra public hosts must be exact DNS names. */
export function resolveDevAllowedHosts(value: string | undefined): string[] {
  const hosts = (value ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  for (const host of hosts) {
    if (
      host.length > 253 ||
      !host.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
    ) {
      throw new Error(
        "PFM_DEV_ALLOWED_HOSTS must contain exact DNS hostnames without ports or wildcards.",
      );
    }
  }

  return [...new Set(hosts)];
}
