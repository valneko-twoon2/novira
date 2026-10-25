# The voice engine's worker: Qwen3-TTS, run by ComfyUI's own Python as a separate process that novira starts.
# Requests arrive as JSON lines on stdin; every answer is one line on the real stdout, prefixed with a marker so that
# anything a library prints is never mistaken for an answer (it goes to stderr, which novira logs).
#
# usage: python worker.py <site-packages folder with qwen-tts>
import json
import os
import sys

PROTOCOL = sys.stdout
sys.stdout = sys.stderr
MARK = "@@NOVIRA@@ "

site = sys.argv[1]
sys.path.insert(0, site)
os.environ.setdefault("HF_HUB_OFFLINE", "1")  # the models are folders on disk; nothing is fetched

import soundfile as sf  # noqa: E402
import torch  # noqa: E402
from qwen_tts import Qwen3TTSModel  # noqa: E402


def say(message):
    PROTOCOL.write(MARK + json.dumps(message, ensure_ascii=False) + "\n")
    PROTOCOL.flush()


loaded = {}


def model_for(path):
    """One model at a time stays on the GPU."""
    if path not in loaded:
        loaded.clear()
        torch.cuda.empty_cache()
        loaded[path] = Qwen3TTSModel.from_pretrained(path, device_map="cuda:0", dtype=torch.bfloat16)
    return loaded[path]


say({"ready": True})
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    request = json.loads(line)
    try:
        model = model_for(request["model"])
        instruct = (request.get("instruct") or "").strip()
        if request["mode"] == "design":
            wavs, rate = model.generate_voice_design(text=request["text"], language=request["language"], instruct=instruct)
        else:
            wavs, rate = model.generate_custom_voice(
                text=request["text"],
                language=request["language"],
                speaker=request["speaker"],
                instruct=instruct or None,
            )
        sf.write(request["out"], wavs[0], rate)
        say({"id": request["id"], "ok": True, "seconds": len(wavs[0]) / rate})
    except Exception as error:  # the worker stays up for the next request
        say({"id": request["id"], "ok": False, "error": str(error)[:600]})
