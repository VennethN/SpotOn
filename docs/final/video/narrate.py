"""Speaks every line of narration.json into voice/<id>.wav.

The voice is Piper's en_US lessac (medium), from the rhasspy/piper v0.0.2 release
asset voice-en-us-lessac-medium.tar.gz. Pass the .onnx path, or set PIPER_VOICE.
Needs `pip install piper-tts`. The WAVs are not committed: they are a function of
this file and the voice, and assemble.py reads them from voice/.
"""
import json, os, sys, wave
from piper import PiperVoice

here = os.path.dirname(os.path.abspath(__file__))
model = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('PIPER_VOICE')
if not model:
    sys.exit('usage: python3 narrate.py <path to en-us-lessac-medium.onnx>  (or set PIPER_VOICE)')
voice = PiperVoice.load(model)
os.makedirs(os.path.join(here, 'voice'), exist_ok=True)
for line in json.load(open(os.path.join(here, 'narration.json'))):
    out = os.path.join(here, 'voice', f"{line['id']}.wav")
    with wave.open(out, 'wb') as w:
        voice.synthesize_wav(line['text'], w)
    with wave.open(out) as w:
        print(f"{line['id']:12s} {w.getnframes() / w.getframerate():5.2f}s  {line['text']}")
