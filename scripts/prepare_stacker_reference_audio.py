"""Adapt a caller-supplied TETR.IO RSD v1 atlas for VOID's local Stacker.

Requires FFmpeg on PATH. Does not download or execute the reference client.
Source sounds remain OSK's assets; transformation does not change ownership.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import tempfile


# output name, atlas key, maximum duration after pitch adjustment, output gain
CLIPS = [
    ("move", "move", .14, .48),
    ("rotate", "rotate", .16, .52),
    ("soft-drop", "softdrop", .09, .4),
    ("hard-drop", "harddrop", .30, .62),
    ("lock", "floor", .32, .52),
    ("hold", "hold", .35, .56),
    ("line-clear", "clearline", .65, .58),
    ("quad", "clearquad", .95, .56),
    ("t-spin", "clearspin", .95, .56),
    ("all-clear", "allclear", 1.25, .54),
    ("back-to-back", "clearbtb", .90, .52),
    ("combo-1", "combo_1", .45, .38),
    ("combo-2", "combo_2", .45, .38),
    ("combo-3", "combo_3", .45, .38),
    ("combo-4", "combo_4", .45, .38),
    ("countdown-tick", "rsg", .38, .46),
    ("countdown-go", "rsg_go", .85, .50),
    ("pause", "pause_start", .42, .44),
    ("resume", "pause_continue", .42, .44),
    ("game-over", "gameover", 1.20, .46),
    ("sprint-clear", "finish", 1.10, .50),
    ("menu", "menutap", .09, .38),
    ("apply", "menuclick", .35, .44),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-rsd", required=True, type=Path)
    parser.add_argument("--out-dir", required=True, type=Path)
    args = parser.parse_args()
    data = args.input_rsd.read_bytes()
    if data[:12] != b"tRSD" + struct.pack("<II", 1, 0):
        raise ValueError("Expected RSD version 1.0")
    position, clips, previous = 12, {}, None
    while True:
        offset, size = struct.unpack_from("<fI", data, position)
        position += 8
        name = data[position:position + size].decode("utf-8")
        position += size
        if previous is not None:
            clips[previous]["duration"] = offset - clips[previous]["start"]
        if size == 0:
            break
        clips[name] = {"start": offset}
        previous = name
    size, = struct.unpack_from("<I", data, position)
    position += 4
    if position + size != len(data):
        raise ValueError("RSD data size mismatch")
    args.out_dir.mkdir(parents=True, exist_ok=True)
    manifest = {"source": "https://tetr.io/sfx/tetrio.opus.rsd?hv=68d5c11f9.f2133e6cf8b3.20261023T150006",
                "sourceSha256": hashlib.sha256(data).hexdigest(),
                "ownership": "Adapted TETR.IO sound recordings, original audio © OSK. Not relicensed by VOID.",
                "pitchRate": .97, "sampleRate": 48000, "highpassHz": 85,
                "lowpassHz": 7800, "clips": []}
    with tempfile.TemporaryDirectory(prefix="void-stacker-audio-") as temporary:
        atlas = Path(temporary) / "atlas.ogg"
        atlas.write_bytes(data[position:position + size])
        for output, key, duration, gain in CLIPS:
            clip = clips[key]
            duration = min(duration, clip["duration"] / .97)
            fade = min(.12, duration * .3)
            filters = (f"asetrate=46560,aresample=48000,highpass=f=85,lowpass=f=7800,"
                       f"atrim=duration={duration},afade=t=in:d=0.002,"
                       f"afade=t=out:st={duration - fade}:d={fade},volume={gain},"
                       "alimiter=limit=0.85:level=false:latency=true")
            target = args.out_dir / f"{output}.ogg"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(clip["start"]),
                            "-t", str(clip["duration"]), "-i", str(atlas), "-af", filters,
                            "-c:a", "libvorbis", "-q:a", "4", "-ar", "48000",
                            "-metadata", "comment=Adapted for VOID from TETR.IO, original audio OSK",
                            str(target)], check=True)
            manifest["clips"].append({"file": target.name, "atlasKey": key,
                                      "start": clip["start"], "sourceDuration": clip["duration"],
                                      "duration": duration, "gain": gain,
                                      "sha256": hashlib.sha256(target.read_bytes()).hexdigest()})
    (args.out_dir / "provenance.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Adapted {len(CLIPS)} sounds, {sum(p.stat().st_size for p in args.out_dir.glob('*.ogg')):,} bytes")


if __name__ == "__main__":
    main()
