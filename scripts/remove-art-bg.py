"""
Remove uniform (white/black/solid) backgrounds from ship art, producing
transparent cutouts. Uses a flood-fill seeded from the image edges, so only the
CONTIGUOUS background region is removed — colours matching the background that
sit *inside* the ship are preserved.

Usage:
  python scripts/remove-art-bg.py --sample      # process a few into /tmp, print metrics
  python scripts/remove-art-bg.py --all         # overwrite all eligible art in place
  python scripts/remove-art-bg.py --all --dry   # report only, write nothing
"""
import sys, glob, os
from collections import deque
from PIL import Image

TOL = 38            # colour distance from a seed to count as background
FEATHER = True      # soften the 1px boundary
SRC = 'assets/art/*.webp'

def dist2(a, b):
    return (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2

def remove_bg(path):
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    px = im.load()
    # Seed colours from the 4 corners + 4 edge midpoints.
    seeds_xy = [(0,0),(w-1,0),(0,h-1),(w-1,h-1),(w//2,0),(w//2,h-1),(0,h//2),(w-1,h//2)]
    seed_cols = [px[x,y][:3] for x,y in seeds_xy]
    tol2 = TOL*TOL
    def is_bg(c):
        return any(dist2(c, s) <= tol2 for s in seed_cols)
    visited = bytearray(w*h)
    dq = deque()
    for x,y in seeds_xy:
        i = y*w+x
        if not visited[i] and is_bg(px[x,y][:3]):
            visited[i] = 1; dq.append((x,y))
    while dq:
        x,y = dq.popleft()
        for nx,ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0<=nx<w and 0<=ny<h:
                j = ny*w+nx
                if not visited[j] and is_bg(px[nx,ny][:3]):
                    visited[j] = 1; dq.append((nx,ny))
    # Apply transparency.
    cleared = 0
    for y in range(h):
        base = y*w
        for x in range(w):
            if visited[base+x]:
                r,g,b,a = px[x,y]
                px[x,y] = (r,g,b,0)
                cleared += 1
    if FEATHER:
        # Half-alpha any opaque pixel adjacent to a cleared pixel (soft edge).
        edge = []
        for y in range(h):
            for x in range(w):
                if not visited[y*w+x] and px[x,y][3] == 255:
                    for nx,ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                        if 0<=nx<w and 0<=ny<h and visited[ny*w+nx]:
                            edge.append((x,y)); break
        for x,y in edge:
            r,g,b,a = px[x,y]
            px[x,y] = (r,g,b,160)
    pct = 100*cleared/(w*h)
    return im, pct

def main():
    mode = sys.argv[1] if len(sys.argv)>1 else '--sample'
    dry = '--dry' in sys.argv
    files = sorted(glob.glob(SRC))
    if mode == '--sample':
        files = ['assets/art/achilles.webp','assets/art/akuma.webp','assets/art/babylon.webp',
                 'assets/art/amber.webp','assets/art/tokyo.webp','assets/art/agamemnon.webp']
        files = [f for f in files if os.path.exists(f)]
        os.makedirs('/tmp/artbg', exist_ok=True)
    suspicious = []
    for f in files:
        try:
            im, pct = remove_bg(f)
        except Exception as e:
            print('ERR', f, e); continue
        flag = ''
        if pct < 3: flag = ' <-- removed almost nothing (complex bg?)'
        if pct > 92: flag = ' <-- removed almost everything (ATE THE SHIP?)'
        if pct > 92 or pct < 3: suspicious.append(os.path.basename(f))
        if mode == '--sample':
            out = '/tmp/artbg/'+os.path.basename(f)
            im.save(out, 'WEBP', lossless=True)
            print(f'{os.path.basename(f):28s} cleared {pct:5.1f}%{flag} -> {out}')
        elif mode == '--all':
            skip = pct > 92 or pct < 3   # ate the ship, or nothing to remove
            if not dry and not skip:
                im.save(f, 'WEBP', quality=92, method=6)
            print(f'{os.path.basename(f):28s} cleared {pct:5.1f}%{flag}{"  [SKIPPED]" if skip else ""}')
    if suspicious:
        print('\nSUSPICIOUS (review/skip):', len(suspicious))
        for s in suspicious: print('  ', s)

if __name__ == '__main__':
    main()
