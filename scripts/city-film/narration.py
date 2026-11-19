"""Adds the Hebrew narration to the city film: python3 -I scripts/city-film/narration.py <film.mp4>
Voice: Google Translate TTS through gTTS (pip install gTTS), lang 'iw', sped up 1.12x.
Lines and start times: scripts/city-film/narration.json, timed to the segments in render.cjs.
When the plan counts change, update the numbers in the text (they are spelled out so the voice reads them well)."""
import json, os, subprocess, sys, tempfile
from gtts import gTTS

film = os.path.abspath(sys.argv[1])
lines = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'narration.json')))['lines']
work = tempfile.mkdtemp(prefix='city-film-vo-')
dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', film]))
inputs, filters = [], []
trim = 'atempo=1.12,silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse'
for i, (start, text) in enumerate(lines):
    mp3 = os.path.join(work, f'l{i}.mp3')
    gTTS(text, lang='iw').save(mp3)
    inputs += ['-i', mp3]
    ms = int(start * 1000)
    filters.append(f'[{i + 1}:a]{trim},aresample=48000,adelay={ms}|{ms}[v{i}]')
mix = ''.join(f'[v{i}]' for i in range(len(lines)))
filters.append(f'{mix}amix=inputs={len(lines)}:normalize=0,volume=1.6,apad=whole_dur={dur},atrim=0:{dur}[a]')
out = os.path.join(work, 'with-voice.mp4')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', film, *inputs, '-filter_complex', ';'.join(filters),
                '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out], check=True)
os.replace(out, film)
print('narration added:', film)
