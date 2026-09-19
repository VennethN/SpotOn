import json, subprocess, os, wave, contextlib, imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
log = json.load(open('raw/log.json'))
def mark(scene, label):
    return next(m['t'] for m in log[scene]['marks'] if m['label'] == label)
def vdur(path):
    with contextlib.closing(wave.open(path)) as w: return w.getnframes() / w.getframerate()
X = 0.45  # crossfade seconds
segs = [
  dict(name='title',   file='raw/title.webm',   start=0.3,                          dur=4.4,  voice='01-title',   at=0.8),
  dict(name='hero',    file='raw/landing.webm', start=mark('landing','hero')-0.3,   dur=8.2,  voice='02-problem', at=0.2),
  dict(name='data',    file='raw/landing.webm', start=mark('landing','data')-0.2,   dur=4.4,  voice='03-data',    at=0.2),
  dict(name='grid',    file='raw/landing.webm', start=mark('landing','grid')-0.2,   dur=4.4),
  dict(name='ask',     file='raw/app.webm',     start=mark('app','launcher')-0.4,   dur=mark('app','card')-mark('app','launcher')-0.4, voice='04-ask', at=0.3),
  dict(name='why',     file='raw/app.webm',     start=mark('app','card')-0.2,       dur=10.0, voice='05-why',     at=0.3),
  dict(name='views',   file='raw/app.webm',     start=mark('app','3d')-0.3,         dur=mark('app','place')+4.6-(mark('app','3d')-0.3),  voice='06-views',   at=0.2),
  dict(name='closing', file='raw/closing.webm', start=0.2,                          dur=4.4,  voice='07-close',   at=0.6),
]
os.makedirs('parts', exist_ok=True)
for s in segs:
    out = f"parts/{s['name']}.mp4"
    subprocess.run([FF, '-y', '-hide_banner', '-loglevel', 'error', '-ss', f"{s['start']:.3f}", '-i', s['file'], '-t', f"{s['dur']:.3f}", '-an',
                    '-vf', 'scale=1920:1080,fps=25,format=yuv420p', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', out], check=True)
    s['out'] = out
t = 0.0; starts = []
for i, s in enumerate(segs):
    starts.append(t); t += s['dur'] - (X if i < len(segs) - 1 else 0)
total = t
print('segments:', [(s['name'], round(s['dur'], 2)) for s in segs]); print('total video seconds:', round(total, 2))
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
cmd = [FF, '-y', '-hide_banner', '-loglevel', 'error'] + inputs + ['-filter_complex', ';'.join(fc), '-map', '[vout]', '-map', '[aout]',
       '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', '25', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-movflags', '+faststart', '-t', f'{total:.3f}', 'SpotOn_Product_Video.mp4']
subprocess.run(cmd, check=True)
r = subprocess.run([FF, '-hide_banner', '-i', 'SpotOn_Product_Video.mp4'], capture_output=True, text=True).stderr
print([l.strip() for l in r.splitlines() if 'Duration' in l or 'Stream' in l])
print('narration ends at:', [(s['voice'], round(starts[i] + s['at'] + vdur(f"voice/{s['voice']}.wav"), 1)) for i, s in enumerate(segs) if s.get('voice')])
print('segment starts:', [(s['name'], round(starts[i], 1)) for i, s in enumerate(segs)])
