"""One-time asset generation; neither Python nor an online service ships with the app.
Requires: pip install edge-tts==7.3.1
"""
import asyncio
import hashlib
import json
from pathlib import Path
import subprocess
import wave
import edge_tts

ROOT = Path(__file__).resolve().parent.parent
VOICE = "ru-RU-SvetlanaNeural"
RATE = "-8%"

async def main():
    answers = json.loads(subprocess.check_output(
        ["node", "-p", "JSON.stringify(require('./src/answers.js').answers)"],
        cwd=ROOT, encoding="utf-8"))
    directory = ROOT / "assets" / "audio"
    directory.mkdir(parents=True, exist_ok=True)
    clips = []
    for index, text in enumerate(answers, start=1):
        filename = directory / f"answer-{index:02d}.mp3"
        await edge_tts.Communicate(text, VOICE, rate=RATE).save(str(filename))
        clips.append({"text": text, "file": filename.name,
                      "sha256": hashlib.sha256(filename.read_bytes()).hexdigest()})
        print(f"Generated {filename.name}", flush=True)
    with wave.open(str(directory / "silence.wav"), "wb") as audio:
        audio.setparams((1, 2, 24000, 0, "NONE", "not compressed"))
        audio.writeframes(bytes(2400))
    metadata = {"voice": VOICE, "rate": RATE, "generator": "edge-tts 7.3.1",
                "note": "Pre-generated speech; no network synthesis at runtime", "clips": clips}
    (directory / "manifest.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

if __name__ == "__main__":
    asyncio.run(main())
