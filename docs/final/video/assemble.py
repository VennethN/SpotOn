"""Cuts the recorded scenes into the video and lays the narration over it.

Reads raw/log.json and raw/*.mp4 from record.mjs and voice/*.wav from narrate.py,
and writes ../SpotOn_Product_Video.mp4. Each segment is a cut from one scene, by the
marks the recorder wrote, and the segments are joined with short crossfades. The
narration for a segment starts `at` seconds into it. Needs `pip install imageio-ffmpeg`,
whose ffmpeg has libx264, aac and xfade; Playwright's bundled one has none of them.
"""
import json, subprocess, os, wave, contextlib, imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
log = json.load(open('raw/log.json'))
def mark(scene, label):
    return next(m['t'] for m in log[scene]['marks'] if m['label'] == label)
def vdur(path):
    with contextlib.closing(wave.open(path)) as w: return w.getnframes() / w.getframerate()
X = 0.45  # crossfade seconds
LIMIT = 60.0  # the organisers' ceiling
# The step segment runs from the card's model standing built, through the click that steps
# into it, to the whole disc: its length is read off the marks rather than fixed.
step_start = mark('app', 'model') - 0.4
step_dur = mark('app', 'step') + 6.8 - step_start
segs = [
  dict(name='title',   file='raw/title.mp4',   start=0.3,                          dur=4.2,  voice='01-title',   at=0.7),
  dict(name='hero',    file='raw/landing.mp4', start=mark('landing','hero')-0.3,   dur=8.1,  voice='02-problem', at=0.15),
  dict(name='data',    file='raw/landing.mp4', start=mark('landing','data')-0.2,   dur=4.4,  voice='03-data',    at=0.2),
  dict(name='model',   file='raw/landing.mp4', start=mark('landing','maket')-0.2,  dur=4.2),
  dict(name='ask',     file='raw/app.mp4',     start=mark('app','launcher')-0.4,   dur=mark('app','card')-mark('app','launcher')-0.4, voice='04-ask', at=0.3),
  dict(name='card',    file='raw/app.mp4',     start=mark('app','card')-0.2,       dur=5.6,  voice='05-area',    at=0.3),
  dict(name='step',    file='raw/app.mp4',     start=step_start,                   dur=step_dur, voice='06-step', at=mark('app','step')-step_start+0.5),
  dict(name='why',     file='raw/app.mp4',     start=mark('app','why')-0.3,        dur=4.0,  voice='07-real',    at=0.4),
  dict(name='views',   file='raw/app.mp4',     start=mark('app','3d')-0.3,         dur=mark('app','place')+4.6-(mark('app','3d')-0.3),  voice='08-views', at=mark('app','place')-mark('app','3d')),
  dict(name='closing', file='raw/closing.mp4', start=0.2,                          dur=4.4,  voice='09-close',   at=0.6),
]
os.makedirs('parts', exist_ok=True)
for s in segs:
    s['start'] = max(0.0, s['start'])  # a beat that opens a take has no lead-in to borrow
    out = f"parts/{s['name']}.mp4"
    subprocess.run([FF, '-y', '-hide_banner', '-loglevel', 'error', '-ss', f"{s['start']:.3f}", '-i', s['file'], '-t', f"{s['dur']:.3f}", '-an',
                    '-vf', 'scale=1920:1080,fps=25,format=yuv420p', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', out], check=True)
    s['out'] = out
t = 0.0; starts = []
for i, s in enumerate(segs):
    starts.append(t); t += s['dur'] - (X if i < len(segs) - 1 else 0)
total = t
print('segments:', [(s['name'], round(s['dur'], 2)) for s in segs]); print('total video seconds:', round(total, 2))
assert total <= LIMIT, f'{total:.2f}s is over the {LIMIT:.0f}s limit'
inputs = []; fc = []
for i, s in enumerate(segs): inputs += ['-i', s['out']]
prev = '[0:v]'; off = 0.0
for i in range(1, len(segs)):
    off += segs[i-1]['dur'] - X
    lbl = f'[v{i}]' if i < len(segs) - 1 else '[vx]'
    fc.append(f"{prev}[{i}:v]xfade=transition=fade:duration={X}:offset={off:.3f}{lbl}")
    prev = lbl
fc.append(f"[vx]fade=t=in:st=0:d=0.6,fade=t=out:st={total-0.8:.3f}:d=0.8[vout]")
alabels = []
for i, s in enumerate(segs):
    if not s.get('voice'): continue
    inputs += ['-i', f"voice/{s['voice']}.wav"]
    idx = len(inputs) // 2 - 1
    delay = int((starts[i] + s['at']) * 1000)
    fc.append(f"[{idx}:a]aresample=48000,adelay={delay}|{delay}[a{i}]"); alabels.append(f'[a{i}]')
fc.append(f"{''.join(alabels)}amix=inputs={len(alabels)}:normalize=0:dropout_transition=0,apad,atrim=0:{total:.3f},loudnorm=I=-16:TP=-1.5:LRA=11[aout]")
OUT = '../SpotOn_Product_Video.mp4'
cmd = [FF, '-y', '-hide_banner', '-loglevel', 'error'] + inputs + ['-filter_complex', ';'.join(fc), '-map', '[vout]', '-map', '[aout]',
       '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', '25', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-movflags', '+faststart', '-t', f'{total:.3f}', OUT]
subprocess.run(cmd, check=True)
r = subprocess.run([FF, '-hide_banner', '-i', OUT], capture_output=True, text=True).stderr
print([l.strip() for l in r.splitlines() if 'Duration' in l or 'Stream' in l])
# One frame every two seconds, for checking the cut without watching it.
subprocess.run([FF, '-y', '-hide_banner', '-loglevel', 'error', '-i', OUT, '-vf', 'fps=1/2,scale=384:-1,tile=6x5', '-frames:v', '1', 'parts/contact.png'], check=True)
ends = [(s['voice'], round(starts[i] + s['at'] + vdur(f"voice/{s['voice']}.wav"), 1), round(starts[i] + s['dur'], 1)) for i, s in enumerate(segs) if s.get('voice')]
print('narration (id, ends at, its segment ends at):', ends)
for v, end, seg_end in ends:
    if end > seg_end + X: print(f'  note: {v} runs {end - seg_end:.1f}s past its segment')
print('segment starts:', [(s['name'], round(starts[i], 1)) for i, s in enumerate(segs)])
