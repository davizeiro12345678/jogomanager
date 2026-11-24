"""Deterministic physically separated surface maps (Khronos KTX 4.4.2)."""
import importlib.util
import math
import pathlib
import random
import subprocess
import sys
import tempfile

spec = importlib.util.spec_from_file_location("detail", pathlib.Path(__file__).with_name("generate-detail-ktx2.py"))
detail = importlib.util.module_from_spec(spec)
spec.loader.exec_module(detail)
output = detail.OUTPUT.parent / "surface-v1"

def clamp(v):
    return max(0, min(255, round(v)))

def field(kind, n):
    # Seeded periodic value noise, correlated in physical space.
    rng = random.Random(721 if kind == "skin" else 910)
    grids = {m: [rng.uniform(-1, 1) for _ in range(m*m)] for m in (8, 32, 128)}
    def noise(x, y, m):
        u, v = x*m/n, y*m/n
        i,j = int(u),int(v)
        a,b = u-i,v-j
        a,b = a*a*(3-2*a),b*b*(3-2*b)
        g=grids[m]
        return ((1-a)*g[(j%m)*m+i%m]+a*g[(j%m)*m+(i+1)%m])*(1-b)+((1-a)*g[((j+1)%m)*m+i%m]+a*g[((j+1)%m)*m+(i+1)%m])*b
    values=[]
    for y in range(n):
        for x in range(n):
            a,b,c = noise(x,y,8),noise(x,y,32),noise(x,y,128)
            if kind == "skin":
                # Small depressions, a broad dermal grain; no pigmentation baked into normals.
                values.append(0.13*a+0.32*b-0.55*max(0,c)**2)
            else:
                values.append(0.28*a+0.28*b+0.44*c)
    return values

def albedo(n):
    rng = random.Random(1937)
    base = field("grass", n)
    out = bytearray(n*n*3)
    for y in range(n):
        v=y/n
        for x in range(n):
            u=x/n
            # Fourteen longitudinal cuts with a softer crossed mower response.
            mow = math.tanh(math.sin(math.tau*(u*7+v*0.5))*4)
            cross=math.tanh(math.sin(math.tau*v*5)*3)
            grain = base[y*n+x]*9+rng.uniform(-2,2)
            wear = sum(math.exp(-((u-cx)/rx)**2-((v-0.5)/ry)**2)*amp for cx,rx,ry,amp in ((0.045,0.07,0.13,0.7),(0.955,0.07,0.13,0.7),(0.5,0.08,0.12,0.25)))
            shade=5*mow+2*cross
            rgb=(49+shade+grain+wear*23,104+shade*1.4+grain-wear*7,49+shade*.65+grain+wear*6)
            i=(y*n+x)*3
            out[i:i+3]=bytes(map(clamp,rgb))
    return out

def main():
    ktx=sys.argv[1]
    output.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        tmp=pathlib.Path(tmp)
        for name,n,kind in (("grass-checker-albedo",1024,"grass"),("skin-pore-normal",512,"skin"),("concrete-normal",512,"concrete"),("concrete-rough",512,"concrete")):
            detail.SIZE=n
            color=kind=="grass"
            normal=name.endswith("normal")
            values=albedo(n) if color else detail.normal(field(kind,n),1.3 if kind=="concrete" else 0.8) if normal else detail.rough(field(kind,n),214,36)
            source=tmp/(name+".png"); dest=output/(name+".ktx2")
            detail.png(source,values)
            options=["--encode","uastc","--uastc-quality","1","--zstd","9","--normalize"] if normal else ["--encode","basis-lz","--qlevel","180"]
            subprocess.run([ktx,"create","--format","R8G8B8_SRGB" if color else "R8G8B8_UNORM","--assign-tf","srgb" if color else "linear","--assign-primaries","bt709" if color else "none","--generate-mipmap","--threads","2",*options,str(source),str(dest)],check=True)
            subprocess.run([ktx,"validate","--gltf-basisu","--warnings-as-errors",str(dest)],check=True)
            print(name,dest.stat().st_size,flush=True)

if __name__=="__main__":
    main()
