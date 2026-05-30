import glob, os
from PIL import Image
from collections import Counter

files = sorted(glob.glob('assets/art/*.webp'))
kind = Counter()
samples = {}

def near_white(c): return all(v >= 245 for v in c)
def uniform(cs):
    rng = [max(c[i] for c in cs) - min(c[i] for c in cs) for i in range(3)]
    return max(rng) <= 12

for f in files:
    im = Image.open(f).convert('RGB')
    w, h = im.size
    cs = [im.getpixel((1, 1)), im.getpixel((w-2, 1)), im.getpixel((1, h-2)), im.getpixel((w-2, h-2))]
    if all(near_white(c) for c in cs):
        k = 'white-uniform'
    elif uniform(cs):
        k = 'uniform-nonwhite'
    else:
        k = 'varied/complex'
    kind[k] += 1
    samples.setdefault(k, []).append((os.path.basename(f), cs[0]))

print('corner classification across all', len(files), 'images:')
for k, v in kind.most_common():
    print('  ', k, v)
print()
for k in samples:
    print('---', k, 'examples ---')
    for n, c in samples[k][:8]:
        print('  ', n, c)
    print()
