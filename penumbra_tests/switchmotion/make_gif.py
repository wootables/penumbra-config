# Side-by-side before/after animation from the real screencast frames.
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

SP = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
builds = [('Before (live today)', 'cdp_orig_g'), ('After (this change)', 'cdp_stage_g')]
CROP = (0, 0, 1376, 520)
SCALE = 0.5
STEP = 20            # ms of real time per output frame
SLOW = 3             # slow motion factor
T0, T1 = -80, 760

def font(sz, bold=False):
    for f in (('segoeuib.ttf' if bold else 'segoeui.ttf'), 'arial.ttf'):
        try:
            return ImageFont.truetype(os.path.join(r'C:\Windows\Fonts', f), sz)
        except Exception:
            pass
    return ImageFont.load_default()

F_LABEL, F_T, F_NOTE = font(20, True), font(18, True), font(15)
frames = {}
for label, d in builds:
    lst = []
    for name in os.listdir(os.path.join(SP, d)):
        if name.startswith('f_') and name.endswith('.jpg'):
            lst.append((int(name[2:-4]), os.path.join(SP, d, name)))
    frames[d] = sorted(lst)

def frame_at(d, t):
    best = frames[d][0]
    for ms, p in frames[d]:
        if ms <= t:
            best = (ms, p)
    return best[1]

cache = {}
def panel(path):
    if path not in cache:
        im = Image.open(path).convert('RGB').crop(CROP)
        cache[path] = im.resize((int(im.width * SCALE), int(im.height * SCALE)), Image.LANCZOS)
    return cache[path]

pw, ph = int((CROP[2] - CROP[0]) * SCALE), int((CROP[3] - CROP[1]) * SCALE)
GAP, HEAD, FOOT = 16, 40, 34
W, H = pw * 2 + GAP * 3, ph + HEAD + FOOT
out = []
durations = []
ts = list(range(T0, T1 + 1, STEP))
for t in ts:
    canvas = Image.new('RGB', (W, H), (246, 247, 249))
    dr = ImageDraw.Draw(canvas)
    for i, (label, d) in enumerate(builds):
        x = GAP + i * (pw + GAP)
        dr.text((x, 9), label, fill=(30, 41, 59), font=F_LABEL)
        canvas.paste(panel(frame_at(d, t)), (x, HEAD))
        dr.rectangle([x - 1, HEAD - 1, x + pw, HEAD + ph], outline=(203, 213, 225))
    msg = 'click' if abs(t) < STEP / 2 else ('t = %+d ms after the click' % t)
    dr.text((GAP, HEAD + ph + 7), msg, fill=(15, 23, 42), font=F_T)
    dr.text((W - GAP - 420, HEAD + ph + 9), 'real frames, headless Edge, 6,000 rows, shown %dx slower' % SLOW, fill=(100, 116, 139), font=F_NOTE)
    out.append(canvas)
    durations.append(STEP * SLOW)
durations[0] = 900
durations[-1] = 2200
p = os.path.join(SP, 'switch_motion_before_after.gif')
out[0].save(p, save_all=True, append_images=out[1:], duration=durations, loop=0, optimize=True)
print(p, len(out), 'frames', os.path.getsize(p), 'bytes')
