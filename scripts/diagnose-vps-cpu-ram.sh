#!/usr/bin/env bash
# Read-only collection. Avoid printing process environment, SSH keys or Docker secrets.
set -uo pipefail
export LC_ALL=C
printf '=== Snapshot UTC ===\n'; date -u +'%Y-%m-%dT%H:%M:%SZ'
printf '\n=== CPU topology and scheduler affinity ===\n'
command -v nproc >/dev/null && { nproc; nproc --all; } || true
grep -E '^(processor|model name|cpu MHz)' /proc/cpuinfo | head -n 9 || true
grep '^Cpus_allowed_list' /proc/self/status || true
[ -r /sys/fs/cgroup/cpu.max ] && { printf 'cgroup CPU max: '; cat /sys/fs/cgroup/cpu.max; }
[ -r /sys/fs/cgroup/cpuset.cpus.effective ] && { printf 'cgroup cpuset: '; cat /sys/fs/cgroup/cpuset.cpus.effective; }
printf '\n=== CPU / memory pressure ===\n'
for p in /proc/pressure/cpu /proc/pressure/memory /proc/pressure/io; do
  if [ -r "$p" ]; then printf '\n%s\n' "$p"; cat "$p"; fi
done
printf '\n=== Host RAM and swap ===\n'
free -m || true
printf '\n=== CPU, disk wait and steal samples ===\n'
if command -v vmstat >/dev/null; then vmstat 1 3; fi
printf '\n=== Largest CPU processes ===\n'
ps -eo pid,comm,pcpu,rss --sort=-pcpu | head -n 16 || true
printf '\n=== Largest resident-memory processes ===\n'
ps -eo pid,comm,pcpu,rss --sort=-rss | head -n 16 || true
if command -v docker >/dev/null && docker info >/dev/null 2>&1; then
  printf '\n=== Docker resource use (one sample) ===\n'
  timeout 15s docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.PIDs}}' || true
  printf '\n=== Container memory/CPU caps (0=unlimited) ===\n'
  docker ps -q | head -n 40 | while read -r id; do
    docker inspect --format '{{.Name}} memory_bytes={{.HostConfig.Memory}} nano_cpus={{.HostConfig.NanoCpus}} cpu_quota={{.HostConfig.CpuQuota}} cpuset={{.HostConfig.CpusetCpus}} pids_limit={{.HostConfig.PidsLimit}}' "$id" 2>/dev/null || true
  done
fi
printf '\n=== Uptime and load ===\n'; uptime
printf '\nCompleted: read-only diagnostics; no resource limits or service settings changed.\n'
