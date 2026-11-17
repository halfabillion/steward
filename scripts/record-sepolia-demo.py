#!/usr/bin/env python3
"""Headless Playwright capture of the live Base Sepolia guided demo.

Never reads, prints, or logs the deployer key. The demo server reads the key
file itself. Not for posting to X.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import TimeoutError as PwTimeout
from playwright.sync_api import sync_playwright

ROOT = Path("/workspace/money/hackathons/base-stocks/steward")
OUT_DIR = ROOT / "docs" / "video"
STILLS = OUT_DIR / "stills"
WORK = Path("/tmp/steward-demo-record")
PORT = int(os.environ.get("STEWARD_PORT", "5177"))
URL = f"http://127.0.0.1:{PORT}"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
W, H = 1280, 720

# Public hashes only — used to ignore known 32-byte values if they appear in logs.
KNOWN_32 = {
    "a2cffa3bdb2cd12dda441f1da7139e050b733188",  # not 32 bytes; keep filter on 64 hex
}


def say(msg: str) -> None:
    print(msg, flush=True)


def set_caption(page, text: str) -> None:
    page.evaluate(
        """(text) => {
          let el = document.getElementById('steward-caption');
          if (!el) {
            el = document.createElement('div');
            el.id = 'steward-caption';
            el.setAttribute('data-testid', 'video-caption');
            Object.assign(el.style, {
              position: 'fixed', left: '0', right: '0', bottom: '0',
              zIndex: '60', padding: '12px 22px 14px',
              background: 'rgba(8,12,20,0.94)', color: '#e8eef8',
              font: '500 17px/1.35 "IBM Plex Sans", "DejaVu Sans", sans-serif',
              borderTop: '1px solid rgba(47,128,237,0.45)',
              pointerEvents: 'none',
              letterSpacing: '0.01em'
            });
            document.body.appendChild(el);
            document.documentElement.style.scrollPaddingBottom = '64px';
          }
          el.textContent = text;
        }""",
        text,
    )


def fail_page(page, msg: str) -> None:
    try:
        still(page, "FAILURE.png")
        banner = page.locator('[data-testid="error-banner"]')
        if banner.count():
            msg = f"{msg} | UI error: {banner.inner_text()}"
    except Exception:
        pass
    raise RuntimeError(msg)


def still(page, name: str) -> Path:
    STILLS.mkdir(parents=True, exist_ok=True)
    path = STILLS / name
    page.screenshot(path=str(path), full_page=False)
    say(f"still {path}")
    return path


def wait_click(page, selector: str, timeout: int = 15_000) -> None:
    page.locator(selector).first.wait_for(state="visible", timeout=timeout)
    page.locator(selector).first.click()


def start_server() -> subprocess.Popen:
    WORK.mkdir(parents=True, exist_ok=True)
    log = (WORK / "server.log").open("w")
    env = os.environ.copy()
    env["STEWARD_NETWORK"] = "base-sepolia"
    env["STEWARD_PORT"] = str(PORT)
    # Do not copy or set a key value. The server reads the key file itself.
    env.pop("STEWARD_DEPLOYER_PRIVATE_KEY", None)
    env.pop("PRIVATE_KEY", None)
    proc = subprocess.Popen(
        ["node", "scripts/demo.cjs"],
        cwd=str(ROOT),
        env=env,
        stdout=log,
        stderr=subprocess.STDOUT,
    )
    deadline = time.time() + 90
    url_re = re.compile(rf"http://127\\.0\\.0\\.1:{PORT}")
    while time.time() < deadline:
        if proc.poll() is not None:
            text = (WORK / "server.log").read_text(errors="replace")
            raise RuntimeError(f"demo server exited early ({proc.returncode}): {text[-2000:]}")
        text = (WORK / "server.log").read_text(errors="replace")
        if "Steward app" in text or url_re.search(text):
            # give Vite a moment
            time.sleep(1.5)
            return proc
        time.sleep(0.3)
    raise RuntimeError("demo server did not become ready in time")


def scan_server_log_for_keys() -> None:
    """Fail if a 64-hex secret-looking value that isn't a known tx/hash appears next to 'key' or without 0x in a private-key context.

    We only flag lines that mention 'private' or 'key file' contents, not public tx hashes.
    """
    text = (WORK / "server.log").read_text(errors="replace")
    # The key file is 0x + 64 hex. Public tx hashes are also that shape.
    # Flag only if a 64-hex string appears on a line that looks like a leak.
    leak = re.compile(r"(private key|privkey|secret|mnemonic|sepolia-deployer\\.key\\s*[:=])", re.I)
    for i, line in enumerate(text.splitlines(), 1):
        if leak.search(line) and re.search(r"0x[0-9a-fA-F]{64}", line):
            raise RuntimeError(f"possible key leak in server log line {i}")


def make_card(path: Path, title: str, subtitle: str, duration: float) -> None:
    # Escape colons for ffmpeg drawtext
    def esc(s: str) -> str:
        return s.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")

    cmd = [
        "ffmpeg", "-y", "-f", "lavfi",
        "-i", f"color=c=0x0b1020:s={W}x{H}:d={duration}",
        "-vf",
        (
            f"drawtext=fontfile={FONT_B}:text='{esc(title)}':fontcolor=0xe8eef8:"
            f"fontsize=42:x=(w-text_w)/2:y=(h/2)-60,"
            f"drawtext=fontfile={FONT}:text='{esc(subtitle)}':fontcolor=0x9ec5ff:"
            f"fontsize=22:x=(w-text_w)/2:y=(h/2)+10"
        ),
        "-pix_fmt", "yuv420p", "-r", "30", str(path),
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def concat_mp4(parts: list[Path], dest: Path) -> None:
    lst = WORK / "concat.txt"
    lst.write_text("".join(f"file '{p}'\n" for p in parts))
    # Re-encode to a single timeline so title cards and the capture share a codec.
    cmd = [
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-an",
        "-movflags", "+faststart", str(dest),
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def run_browser() -> Path:
    STILLS.mkdir(parents=True, exist_ok=True)
    video_dir = WORK / "pw-video"
    if video_dir.exists():
        shutil.rmtree(video_dir)
    video_dir.mkdir(parents=True)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=True,
            executable_path="/usr/bin/google-chrome",
            args=["--disable-dev-shm-usage", "--no-sandbox"],
        )
        context = browser.new_context(
            viewport={"width": W, "height": H},
            record_video_dir=str(video_dir),
            record_video_size={"width": W, "height": H},
            timezone_id="Europe/London",
            locale="en-GB",
        )
        page = context.new_page()
        page.set_default_timeout(20_000)
        page.goto(URL, wait_until="networkidle")
        page.wait_for_selector('[data-testid="enter-steward"], [data-testid="attest-not_us"]', timeout=30_000)
        set_caption(page, "Steward — guided demo on Base Sepolia (paper + testnet only)")
        time.sleep(2.5)
        still(page, "01-gate.png")

        set_caption(page, "Step 0 — Attest and enter. Steward is not available in the United States.")
        time.sleep(2.0)
        for item in ("not_us", "age", "not_advice", "no_rights", "paper"):
            box = page.locator(f'[data-testid="attest-{item}"]')
            box.scroll_into_view_if_needed()
            time.sleep(0.6)
            box.check()
            time.sleep(0.4)
        time.sleep(1.2)
        still(page, "02-gate-attested.png")
        wait_click(page, '[data-testid="enter-steward"]')
        page.wait_for_selector('[data-testid="demo-guide"]', timeout=30_000)
        # Caption node is on document.body and should survive the SPA swap.
        set_caption(page, "Live Base Sepolia mode. Writes go to StewardProposalLog after you confirm.")
        page.wait_for_selector('[data-testid="live-banner"]', timeout=20_000)
        time.sleep(3.0)
        still(page, "03-mandate.png")

        set_caption(page, "Step 1 — Mandate. Demo defaults: 7-name basket, $90k AAPLc, $10k cash.")
        page.locator('[data-testid="save-mandate"]').scroll_into_view_if_needed()
        time.sleep(3.5)
        wait_click(page, '[data-testid="save-mandate"]')
        page.wait_for_selector('[data-testid="confirm-live"]', timeout=15_000)
        set_caption(page, "Confirm the live write. Chain id 84532 and gas are checked before signing.")
        time.sleep(3.5)
        still(page, "04-confirm-mandate.png")
        wait_click(page, '[data-testid="confirm-live-yes"]')
        set_caption(page, "Sending setMandate to Base Sepolia…")
        try:
            page.wait_for_selector('[data-testid="demo-step-mandate"][data-status="done"]', timeout=90_000)
        except PwTimeout:
            fail_page(page, "setMandate did not complete")
        set_caption(page, "MandateSet is on Base Sepolia. The transaction links to Blockscout.")
        # Jump back to the mandate tab so the Blockscout tx link is on screen.
        if page.locator('[data-testid="mandate-saved"]').count() == 0:
            wait_click(page, '[data-testid="demo-step-mandate"]')
            page.wait_for_selector('[data-testid="mandate-saved"]', timeout=15_000)
        time.sleep(4.0)
        still(page, "05-mandate-saved.png")
        wait_click(page, '[data-testid="demo-step-proposal"]')

        set_caption(page, "Step 2 — Research brief. Run the steward on live official NAVs.")
        # Guided CTA should now be Run steward
        time.sleep(2.0)
        wait_click(page, '[data-testid="demo-primary"]')
        page.wait_for_selector('[data-testid="confirm-live"]', timeout=15_000)
        set_caption(page, "Confirm the proposal write on Base Sepolia.")
        time.sleep(3.0)
        still(page, "06-confirm-propose.png")
        wait_click(page, '[data-testid="confirm-live-yes"]')
        set_caption(page, "Reading prices and writing Proposed to StewardProposalLog…")
        try:
            page.wait_for_selector('[data-testid="proposal-banner"]', timeout=120_000)
            page.wait_for_selector('[data-testid="propose-tx-link"]', timeout=90_000)
        except PwTimeout:
            fail_page(page, "propose did not complete")
        set_caption(page, "Research brief and proposed rebalance. Review the reasons, then approve.")
        time.sleep(2.0)
        why = page.locator(".explain, [data-testid='proposal-banner']").first
        try:
            why.scroll_into_view_if_needed()
        except Exception:
            pass
        time.sleep(8.0)
        still(page, "07-research-brief.png")

        set_caption(page, "Step 3 — Approve on Base Sepolia. The contract never moves funds.")
        time.sleep(2.0)
        wait_click(page, '[data-testid="demo-primary"]')
        page.wait_for_selector('[data-testid="confirm-live"]', timeout=15_000)
        time.sleep(3.0)
        still(page, "08-confirm-approve.png")
        wait_click(page, '[data-testid="confirm-live-yes"]')
        set_caption(page, "Sending approve to Base Sepolia…")
        try:
            page.wait_for_selector('[data-testid="fill-complete"]', timeout=90_000)
        except PwTimeout:
            fail_page(page, "approve did not complete")
        set_caption(page, "Approved. Paper book updated. No funds moved.")
        time.sleep(4.5)
        still(page, "09-approved.png")

        set_caption(page, "Step 4 — History. MandateSet, Proposed, and Approved, each with a Blockscout link.")
        # Prefer the view-log CTA if present, else the tab
        if page.locator('[data-testid="view-log-from-fill"]').count():
            wait_click(page, '[data-testid="view-log-from-fill"]')
        else:
            wait_click(page, '[data-testid="tab-log"]')
        page.wait_for_selector('[data-testid="log-table"]', timeout=30_000)
        page.wait_for_selector('[data-testid="log-tx-link-0"]', timeout=30_000)
        time.sleep(2.0)
        page.locator('[data-testid="log-table"]').scroll_into_view_if_needed()
        time.sleep(6.0)
        # Hover the last tx link so the URL destination is obvious
        links = page.locator('[data-testid^="log-tx-link-"]')
        if links.count() > 0:
            links.nth(links.count() - 1).hover()
        time.sleep(4.0)
        still(page, "10-history-blockscout.png")
        set_caption(page, "Demo complete. Public repo: github.com/halfabillion/steward")
        time.sleep(4.0)

        # Collect tx hrefs for the report
        hrefs = page.eval_on_selector_all(
            '[data-testid^="log-tx-link-"], [data-testid="mandate-tx-link"], [data-testid="propose-tx-link"], [data-testid="decision-tx-link"]',
            "els => els.map(e => e.href)",
        )
        (WORK / "tx-links.txt").write_text("\n".join(hrefs) + "\n")
        say("tx links:\n" + "\n".join(hrefs))

        page.close()
        context.close()
        browser.close()

    videos = list(video_dir.glob("*.webm")) + list(video_dir.glob("*.mp4"))
    if not videos:
        raise RuntimeError("Playwright did not write a video file")
    return videos[0]


def transcode(src: Path, dest: Path) -> None:
    cmd = [
        "ffmpeg", "-y", "-i", str(src),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-an",
        "-vf", f"scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2",
        str(dest),
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def duration_sec(path: Path) -> float:
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=nk=1:nw=1", str(path),
    ], text=True)
    return float(out.strip())


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    STILLS.mkdir(parents=True, exist_ok=True)
    proc = None
    try:
        say("starting live demo server")
        proc = start_server()
        scan_server_log_for_keys()
        raw = run_browser()
        scan_server_log_for_keys()
        body = WORK / "body.mp4"
        transcode(raw, body)
        title = WORK / "title.mp4"
        end = WORK / "end.mp4"
        make_card(
            title,
            "Steward",
            "Guided demo on Base Sepolia  ·  paper + testnet only",
            6,
        )
        make_card(
            end,
            "No funds moved",
            "github.com/halfabillion/steward   ·   not posted on X",
            5,
        )
        dest = OUT_DIR / "steward-base-sepolia-demo.mp4"
        concat_mp4([title, body, end], dest)
        dur = duration_sec(dest)
        say(f"VIDEO {dest} duration={dur:.1f}s size={dest.stat().st_size}")
        if dur < 110 or dur > 260:
            say(f"WARNING: duration {dur:.1f}s is outside the 2–4 minute target window")
        # also copy a raw stills listing
        return 0
    finally:
        if proc and proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=8)
            except subprocess.TimeoutExpired:
                proc.kill()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except PwTimeout as e:
        say(f"TIMEOUT: {e}")
        sys.exit(2)
    except Exception as e:
        say(f"ERROR: {type(e).__name__}: {e}")
        sys.exit(1)
