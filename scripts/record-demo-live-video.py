#!/usr/bin/env python3
"""Compose the ≤2 min Steward live-demo video.

Replays the authentic 19 Nov 2026 11:37:26–11:37:31 UK terminal session
(paced so the log is readable), plus headless Playwright captures of the
Base Sepolia Blockscout transaction pages. Captions and title/end cards
only — no voice. Never reads or prints the deployer key.
"""
from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "submit" / "video"
STILLS = OUT / "stills"
RAW = OUT / "raw"
W, H, FPS = 1280, 720, 30
CAPTION_H = 72

FONT_SANS = "/usr/share/fonts/truetype/sand-box/google/Fira Sans/FiraSans-Regular.ttf"
FONT_SANS_B = "/usr/share/fonts/truetype/sand-box/google/Fira Sans/FiraSans-SemiBold.ttf"
FONT_MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
FONT_MONO_B = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"

BG = (11, 16, 28)
CARD_BG = (10, 14, 24)
FG = (230, 236, 245)
MUTED = (150, 166, 190)
ACCENT = (110, 180, 255)
GREEN = (90, 210, 140)
AMBER = (240, 190, 90)
CYAN = (120, 220, 230)
BAR = (16, 24, 40)
CAPTION_BG = (8, 12, 20)

TXS = [
    {
        "name": "setMandate",
        "hash": "0x6034405cbfd46d31f8d88d7b7a6f89e4b7fef3615c52ea60fa19aa6b824abd1d",
        "block": "60831895",
        "time": "11:37:27 UK",
        "caption": "Base Sepolia Blockscout — setMandate mined at 11:37:27 UK, block 60831895.",
    },
    {
        "name": "propose",
        "hash": "0x4c4981192e41b1b4e1c828d39cc5e57b6d2a49308aff7d186a610ab57581ca5c",
        "block": "60831901",
        "time": "11:37:29 UK",
        "caption": "Base Sepolia Blockscout — propose mined at 11:37:29 UK, block 60831901.",
    },
    {
        "name": "approve",
        "hash": "0x0d6215537da01c3507400ae36876c5ebe950fd6dd296299dfb7c737966263a8c",
        "block": "60831908",
        "time": "11:37:30 UK",
        "caption": "Base Sepolia Blockscout — approve mined at 11:37:30 UK, block 60831908. No funds moved.",
    },
]
CONTRACT = "0xA2cFFa3bdb2CD12dda441f1DA7139E050b733188"
BLOCKSCOUT = "https://base-sepolia.blockscout.com"

# Authentic session output (script headers stripped). Paced, not fabricated.
LOG_PATH = OUT / "demo-live.log"

COOKIE_SELECTORS = [
    "button:has-text('Accept')",
    "button:has-text('Agree')",
    "button:has-text('Got it')",
    "button:has-text('Allow all')",
    "button:has-text('I agree')",
    "button:has-text('OK')",
    "#onetrust-accept-btn-handler",
    ".cf-btn-accept",
    "button[aria-label='Accept cookies']",
    "button[title='Accept']",
]


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def save(img: Image.Image, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")
    return path


def add_caption(base: Image.Image, text: str) -> Image.Image:
    img = base.copy().convert("RGB")
    if img.size != (W, H):
        canvas = Image.new("RGB", (W, H), CARD_BG)
        body = img.resize((W, H - CAPTION_H), Image.Resampling.LANCZOS)
        canvas.paste(body, (0, 0))
        img = canvas
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, H - CAPTION_H, W, H], fill=CAPTION_BG)
    draw.line([0, H - CAPTION_H, W, H - CAPTION_H], fill=(40, 60, 90), width=2)
    f = font(FONT_SANS, 22)
    # wrap
    words = text.split()
    lines, cur = [], ""
    for word in words:
        trial = f"{cur} {word}".strip()
        if f.getlength(trial) <= W - 48:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    y = H - CAPTION_H + 12
    for line in lines[:2]:
        draw.text((24, y), line, fill=FG, font=f)
        y += 28
    return img


def card(title: str, lines: list[str], caption: str) -> Image.Image:
    img = Image.new("RGB", (W, H), CARD_BG)
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, W, 8], fill=ACCENT)
    title_f = font(FONT_SANS_B, 44)
    body_f = font(FONT_SANS, 26)
    tw = title_f.getlength(title)
    y = 200
    draw.text(((W - tw) / 2, y), title, fill=FG, font=title_f)
    y += 70
    for line in lines:
        lw = body_f.getlength(line)
        draw.text(((W - lw) / 2, y), line, fill=MUTED, font=body_f)
        y += 40
    return add_caption(img, caption)


def line_color(text: str):
    s = text.strip()
    if s.startswith("Step ") or s.startswith("Steward"):
        return (255, 230, 150)
    if s.startswith("OK") or s.startswith("Mined") or s.startswith("Done") or "status 1" in s or "Paper book updated" in s:
        return GREEN
    if s.startswith("Sending") or s.startswith("Sepolia tx sent"):
        return AMBER
    if "Blockscout" in s or s.startswith("https://") or s.startswith("Evidence"):
        return CYAN
    if s.startswith("Error"):
        return (240, 110, 110)
    return FG


def wrap_mono(text: str, fnt, max_w: int) -> list[str]:
    if fnt.getlength(text) <= max_w:
        return [text]
    # break at spaces first, else hard-wrap
    out, cur = [], ""
    for ch in text:
        if fnt.getlength(cur + ch) <= max_w:
            cur += ch
        else:
            out.append(cur)
            cur = ch
    if cur:
        out.append(cur)
    return out


def terminal_frame(visible_lines: list[str], caption: str, prompt: str | None = None) -> Image.Image:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    # title bar
    draw.rectangle([0, 0, W, 36], fill=BAR)
    draw.ellipse([14, 12, 26, 24], fill=(240, 90, 90))
    draw.ellipse([32, 12, 44, 24], fill=(240, 190, 80))
    draw.ellipse([50, 12, 62, 24], fill=(80, 200, 110))
    bar_f = font(FONT_SANS, 16)
    draw.text((80, 8), "box  ~/steward   npm run demo:live", fill=MUTED, font=bar_f)
    mono = font(FONT_MONO, 16)
    mono_b = font(FONT_MONO_B, 16)
    x, y = 20, 50
    max_w = W - 40
    max_y = H - CAPTION_H - 8
    rendered: list[tuple[str, tuple]] = []
    for raw in visible_lines:
        use = mono_b if raw.strip().startswith("Step ") or raw.strip().startswith("Steward") else mono
        for part in wrap_mono(raw if raw != "" else " ", use, max_w):
            rendered.append((part, line_color(raw)))
    # window the last lines that fit
    line_h = 20
    fit = (max_y - y) // line_h
    for text, color in rendered[-fit:]:
        draw.text((x, y), text, fill=color, font=mono)
        y += line_h
    if prompt is not None:
        draw.text((x, min(y, max_y - line_h)), prompt, fill=GREEN, font=mono)
    return add_caption(img, caption)


def hold_to_mp4(image: Path, dest: Path, seconds: float) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    frames = max(1, int(round(seconds * FPS)))
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-loop", "1", "-i", str(image),
            "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-c:v", "libx264", "-t", f"{seconds:.3f}", "-r", str(FPS),
            "-pix_fmt", "yuv420p", "-vf", f"scale={W}:{H}",
            "-c:a", "aac", "-shortest", "-movflags", "+faststart",
            str(dest),
        ],
        check=True,
    )
    _ = frames


def concat_mp4(parts: list[Path], dest: Path) -> None:
    lst = RAW / "concat.txt"
    RAW.mkdir(parents=True, exist_ok=True)
    lst.write_text("".join(f"file '{p.resolve()}'\n" for p in parts))
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "concat", "-safe", "0", "-i", str(lst),
            "-c:v", "libx264", "-preset", "medium", "-crf", "23",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k",
            "-movflags", "+faststart", str(dest),
        ],
        check=True,
    )


def dismiss_cookies(page) -> None:
    # Try a few times; Blockscout cookie UI varies.
    for _ in range(4):
        for sel in COOKIE_SELECTORS:
            try:
                loc = page.locator(sel).first
                if loc.count() and loc.is_visible():
                    loc.click(timeout=1500)
                    page.wait_for_timeout(400)
                    return
            except Exception:
                continue
        # some banners are in iframes
        for frame in page.frames:
            for sel in COOKIE_SELECTORS:
                try:
                    loc = frame.locator(sel).first
                    if loc.count() and loc.is_visible():
                        loc.click(timeout=1500)
                        page.wait_for_timeout(400)
                        return
                except Exception:
                    continue
        page.wait_for_timeout(500)


def capture_blockscout() -> list[tuple[Path, str, float]]:
    """Wait for Details / Logs / tx-list content. Do not screenshot the first paint
    (Blockscout can briefly show the empty Token transfers pane)."""
    STILLS.mkdir(parents=True, exist_ok=True)
    pages = [
        (
            f"{BLOCKSCOUT}/tx/{tx['hash']}?tab=index",
            STILLS / f"{i:02d}-{tx['name']}.png",
            tx["caption"],
            8.0,
            ["Transaction hash", "Success", "This is a testnet transaction only"],
        )
        for i, tx in enumerate(TXS, start=1)
    ]
    pages.append(
        (
            f"{BLOCKSCOUT}/tx/{TXS[1]['hash']}?tab=logs",
            STILLS / "04-propose-logs.png",
            "Blockscout Logs — Proposed event on Base Sepolia. The contract is a log only.",
            7.0,
            ["Proposed"],
        )
    )
    pages.append(
        (
            f"{BLOCKSCOUT}/address/{CONTRACT}?tab=txs",
            STILLS / "05-contract-txs.png",
            "StewardProposalLog — approve, propose and setMandate, each with value 0 ETH.",
            8.0,
            ["60831908"],
        )
    )
    shots: list[tuple[Path, str, float]] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        for url, path, caption, dur, needles in pages:
            last_err = None
            for _attempt in range(3):
                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=60_000)
                    for needle in needles:
                        page.get_by_text(needle, exact=False).first.wait_for(timeout=25_000)
                    page.wait_for_timeout(800)
                    body = page.inner_text("body")
                    if "There are no token transfers." in body:
                        raise RuntimeError("Blockscout still showing the empty token-transfers pane.")
                    page.screenshot(path=str(path), full_page=False)
                    last_err = None
                    break
                except Exception as exc:
                    last_err = exc
                    time.sleep(1.5)
            if last_err:
                raise last_err
            shots.append((path, caption, dur))
        browser.close()
    return shots


def load_log_lines() -> list[str]:
    raw = LOG_PATH.read_text()
    lines = []
    for line in raw.splitlines():
        if line.startswith("Script started") or line.startswith("Script done"):
            continue
        # keep the rest, including blanks
        lines.append(line.rstrip("\r"))
    # drop a leading blank
    while lines and lines[0] == "":
        lines.pop(0)
    return lines


def build_terminal_segments(lines: list[str]) -> list[tuple[Path, float, str]]:
    """Group authentic log lines into readable holds."""
    # Predefined captions keyed to first-line prefixes of each group.
    groups: list[tuple[int, float, str]] = []
    # (end_index exclusive will be computed by scanning)

    def caption_for(chunk: list[str], idx: int) -> tuple[float, str]:
        text = "\n".join(chunk)
        if idx == 0:
            return 3.0, "npm run demo:live — guided flow against StewardProposalLog on Base Sepolia."
        if "Balance" in text and "Reading live" in text:
            return 4.0, "Balance check first: 0.0000936011 testnet ETH on the existing deployer."
        if "[preflight]" in text:
            return 5.5, "Gas preflight: all three writes need 0.0000036873 ETH. Balance is enough. No faucet."
        if "Step 1" in text and "Sending setMandate" in text and "Mined" not in text:
            return 3.5, "Step 1 — save the demo mandate (7-name basket, $90k AAPLc, $10k cash)."
        if "setMandate" in text and "Mined" in text and "Step 2" not in text:
            return 5.0, "setMandate confirmed on chain id 84532, block 60831895."
        if "Step 2" in text and "Sending propose" in text and "Mined" not in text:
            return 6.0, "Step 2 — live Mainnet NAVs (read-only) produce a rebalance: sell some AAPLc, buy the rest."
        if "propose" in text and "proposalId" in text:
            return 5.0, "propose confirmed, block 60831901. The contract still has not moved any funds."
        if "Step 3" in text and "Paper book updated" in text:
            return 5.5, "Step 3 — approve (paper fill) confirmed, block 60831908. No funds moved."
        if "Step 4" in text:
            return 7.0, "Step 4 — proposal log: MandateSet, Proposed, Approved, each with a Blockscout link."
        return 3.0, "npm run demo:live on Base Sepolia. Paper and testnet only."

    # Split into logical chunks by blank-line groups, but keep some groups together.
    chunks: list[list[str]] = []
    current: list[str] = []
    markers = (
        "Steward — live",
        "Reading live Mainnet",
        "[preflight]",
        "Step 1 — Mandate",
        "Sepolia tx sent    0x6034",
        "Step 2 — Proposal",
        "Sepolia tx sent    0x4c49",
        "Step 3 — Paper fill",
        "Sepolia tx sent    0x0d62",
        "Step 4 — Proposal log",
    )
    # Walk once; start a new chunk when a marker line appears (except at start).
    for line in lines:
        if any(line.startswith(m) or line.strip().startswith(m) for m in markers) and current:
            # For "Sepolia tx sent", attach to previous step if the previous chunk is a Step
            if line.startswith("Sepolia tx sent") and current and any(c.startswith("Step ") or c.startswith("  Sending") or c.startswith("  Estimating") for c in current[-4:]):
                current.append(line)
                continue
            chunks.append(current)
            current = [line]
        else:
            current.append(line)
    if current:
        chunks.append(current)

    # Merge "Sepolia tx sent/mined" leftovers into the previous step chunk already handled.
    # Merge mined+blockscout lines that got split after a sent line starting a new chunk.
    merged: list[list[str]] = []
    for ch in chunks:
        if merged and (
            ch and (ch[0].startswith("Sepolia tx") or ch[0].startswith("  Mined") or ch[0].startswith("  Blockscout") or ch[0].startswith("  proposalId"))
        ):
            merged[-1].extend([""] if merged[-1] and merged[-1][-1] != "" else [])
            merged[-1].extend(ch)
        else:
            merged.append(ch)
    chunks = merged

    segs = []
    visible: list[str] = []
    RAW.mkdir(parents=True, exist_ok=True)
    for i, chunk in enumerate(chunks):
        visible.extend(chunk if not visible or visible[-1] == "" or chunk[0] == "" else ([""] if False else chunk))
        # avoid double blanks at join
        dur, cap = caption_for(chunk, i)
        frame = terminal_frame(visible, cap)
        path = STILLS / f"term-{i:02d}.png"
        save(frame, path)
        segs.append((path, dur, cap))
    return segs


def type_command_clip() -> Path:
    """Short intro: type the npm command, then the first output arrives."""
    frames_dir = RAW / "typeframes"
    frames_dir.mkdir(parents=True, exist_ok=True)
    cmd = "npm run demo:live"
    # 2.2s typing + 0.6s hold
    typ_t, hold_t = 2.2, 0.6
    n_typ = int(typ_t * FPS)
    n_hold = int(hold_t * FPS)
    idx = 0
    for i in range(n_typ):
        nchars = max(1, int(round((i + 1) / n_typ * len(cmd))))
        prompt = f"$ {cmd[:nchars]}█"
        frame = terminal_frame([], "A paced replay of the recorded 19 Nov 2026, 11:37:26 UK session. Logs are authentic.", prompt)
        frame.save(frames_dir / f"{idx:05d}.png")
        idx += 1
    last = terminal_frame([], "A paced replay of the recorded 19 Nov 2026, 11:37:26 UK session. Logs are authentic.", f"$ {cmd}")
    for _ in range(n_hold):
        last.save(frames_dir / f"{idx:05d}.png")
        idx += 1
    dest = RAW / "type.mp4"
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-framerate", str(FPS), "-i", str(frames_dir / "%05d.png"),
            "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-shortest", "-movflags", "+faststart",
            str(dest),
        ],
        check=True,
    )
    return dest


def duration_of(path: Path) -> float:
    out = subprocess.check_output(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=nw=1:nk=1", str(path),
        ],
        text=True,
    ).strip()
    return float(out)


def main() -> int:
    STILLS.mkdir(parents=True, exist_ok=True)
    RAW.mkdir(parents=True, exist_ok=True)
    if not LOG_PATH.exists():
        print(f"missing {LOG_PATH}", file=sys.stderr)
        return 1

    title = card(
        "Steward",
        [
            "Live guided demo on Base Sepolia",
            "Paper + testnet only  ·  the contract never moves funds",
            "19 November 2026, 11:37 UK (Europe/London)",
        ],
        "Steward — npm run demo:live against StewardProposalLog on Base Sepolia.",
    )
    title_png = save(title, STILLS / "00-title.png")
    end = card(
        "No funds moved.",
        [
            "github.com/halfabillion/steward",
            "Next: Ali posts the demo on X, tagging @buildonbase,",
            "then the final submission form, by 5 December 2026.",
            "This video has not been posted. The form has not been submitted.",
        ],
        "Not posted on X. Final form still needs Ali's go.",
    )
    end_png = save(end, STILLS / "99-end.png")

    print("Capturing Blockscout pages…")
    shots = capture_blockscout()
    print(f"  captured {len(shots)} pages")

    print("Rendering terminal replay…")
    lines = load_log_lines()
    type_mp4 = type_command_clip()
    term_segs = build_terminal_segments(lines)

    parts: list[Path] = []
    title_mp4 = RAW / "title.mp4"
    hold_to_mp4(title_png, title_mp4, 7.0)
    parts.append(title_mp4)
    parts.append(type_mp4)
    for i, (png, dur, _cap) in enumerate(term_segs):
        dest = RAW / f"term-{i:02d}.mp4"
        hold_to_mp4(png, dest, dur)
        parts.append(dest)

    for i, (png, caption, dur) in enumerate(shots):
        framed = add_caption(Image.open(png).convert("RGB"), caption)
        still = STILLS / f"bs-framed-{i:02d}.png"
        save(framed, still)
        dest = RAW / f"bs-{i:02d}.mp4"
        hold_to_mp4(still, dest, dur)
        parts.append(dest)

    end_mp4 = RAW / "end.mp4"
    hold_to_mp4(end_png, end_mp4, 8.0)
    parts.append(end_mp4)

    dest = OUT / "steward-demo-live.mp4"
    print("Concatenating…")
    concat_mp4(parts, dest)
    dur = duration_of(dest)
    print(f"Wrote {dest} ({dur:.2f}s, {dest.stat().st_size} bytes)")
    if dur > 120.5:
        print("WARNING: video is over 2 minutes", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
