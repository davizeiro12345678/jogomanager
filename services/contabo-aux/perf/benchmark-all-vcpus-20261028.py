"""Run repeatable Sysbench CPU on every *actually available* vCPU.
No kernel changes, no quota manipulation and no service restarts.
"""
import os, re, statistics, subprocess
from pathlib import Path
cores=sorted(os.sched_getaffinity(0))
if not cores: raise SystemExit("No allowed CPU found")
affinity=",".join(str(x) for x in cores)
print("ONLINE_LOGICAL_CPU_COUNT=",os.cpu_count(),flush=True)
print("SCHEDULER_ALLOWED_CPUS=",affinity,flush=True)
print("SYSBENCH_THREADS=",len(cores),flush=True)
results=[]
for run in range(1,4):
    cmd=["taskset","-c",affinity,"sysbench","cpu",
         "--threads="+str(len(cores)),"--time=6",
         "--cpu-max-prime=20000","run"]
    r=subprocess.run(cmd,text=True,capture_output=True,timeout=40)
    if r.returncode: raise RuntimeError("Sysbench failed: "+r.stderr[-500:])
    match=re.search(r"events per second:\s*([0-9.]+)",r.stdout)
    p95=re.search(r"95th percentile:\s*([0-9.]+)",r.stdout)
    if not match or not p95: raise ValueError("Unexpected benchmark output")
    eps=float(match.group(1))
    results.append(eps)
    print(f"RUN_{run}: {eps:.2f} events/s; p95={float(p95.group(1)):.2f} ms",flush=True)
print(f"MEDIAN={statistics.median(results):.2f} events/s",flush=True)
print(f"MIN={min(results):.2f}; MAX={max(results):.2f}",flush=True)
