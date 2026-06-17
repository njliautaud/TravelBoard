"""
TravelBoard Visual QA — Playwright screenshot suite
Takes screenshots of every key page/flow and verifies API responses.
"""
import asyncio
import json
import os
from pathlib import Path
from datetime import datetime
from playwright.async_api import async_playwright

LIVE_URL = "https://travelboard-9q0.pages.dev"
LOCAL_URL = "http://localhost:3000"
API_URL = "http://localhost:3000"  # Test API through local backend directly
SCREENSHOT_DIR = Path("/home/jupiter/TravelBoard/qa-screenshots")
WAIT_STRATEGY = "load"  # SPA never reaches networkidle

BASE_URL = LIVE_URL


async def take_screenshot(page, name, full_page=False, wait_ms=2000):
    """Take a screenshot with timestamp prefix"""
    await asyncio.sleep(wait_ms / 1000)
    path = SCREENSHOT_DIR / f"{name}.png"
    await page.screenshot(path=str(path), full_page=full_page)
    print(f"  📸 {name}.png")
    return path


async def test_api_endpoints():
    """Verify API backend is responding"""
    import urllib.request

    endpoints = [
        f"{API_URL}/api/auth/me",
        f"{API_URL}/api/deals/countries",
        f"{API_URL}/api/deals/routes?limit=5",
        f"{API_URL}/api/awards?origin=MCO&limit=5",
    ]

    results = {}
    for url in endpoints:
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=10) as resp:
                status = resp.status
                body = json.loads(resp.read())
                # Summarize response
                if isinstance(body, dict):
                    summary = {k: type(v).__name__ + (f"[{len(v)}]" if isinstance(v, (list, dict)) else "") for k, v in body.items()}
                else:
                    summary = str(body)[:100]
                results[url.split("/api/")[-1]] = {"status": status, "data": summary}
                print(f"  ✅ {url.split('/api/')[-1]}: {status} — {summary}")
        except Exception as e:
            results[url.split("/api/")[-1]] = {"status": "ERROR", "error": str(e)}
            print(f"  ❌ {url.split('/api/')[-1]}: {e}")

    return results


async def run_visual_qa():
    SCREENSHOT_DIR.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")

    print(f"\n{'='*60}")
    print(f"TravelBoard Visual QA — {timestamp}")
    print(f"Live URL: {LIVE_URL}")
    print(f"API URL: {API_URL}")
    print(f"{'='*60}\n")

    # 1. API Health Check
    print("🔌 API ENDPOINT CHECKS:")
    api_results = await test_api_endpoints()

    # 2. Browser Visual Tests
    print("\n🖥️  BROWSER VISUAL TESTS:")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # Desktop viewport
        desktop = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=2,
        )
        # Mobile viewport
        mobile = await browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=3,
            is_mobile=True,
            has_touch=True,
        )

        # ======= DESKTOP TESTS =======
        print("\n  --- Desktop (1440x900) ---")

        # Landing Page
        page = await desktop.new_page()
        await page.goto(LIVE_URL, wait_until=WAIT_STRATEGY, timeout=30000)
        await take_screenshot(page, "01_desktop_landing", wait_ms=3000)

        # Check if landing content rendered
        content = await page.content()
        has_hero = "TravelBoard" in content
        print(f"  {'✅' if has_hero else '❌'} Landing page hero text present: {has_hero}")

        # Sign-In Page
        await page.goto(f"{LIVE_URL}/sign-in/", wait_until=WAIT_STRATEGY, timeout=30000)
        await take_screenshot(page, "02_desktop_signin", wait_ms=3000)

        has_clerk = "clerk" in content.lower() or "sign" in (await page.content()).lower()
        print(f"  {'✅' if has_clerk else '❌'} Sign-in page renders: {has_clerk}")

        # Sign-Up Page
        await page.goto(f"{LIVE_URL}/sign-up/", wait_until=WAIT_STRATEGY, timeout=30000)
        await take_screenshot(page, "03_desktop_signup", wait_ms=3000)

        # Journal Page
        await page.goto(f"{LIVE_URL}/journal/", wait_until=WAIT_STRATEGY, timeout=15000)
        await take_screenshot(page, "04_desktop_journal", wait_ms=2000)

        journal_content = await page.content()
        has_journal = "Travel Journal" in journal_content
        print(f"  {'✅' if has_journal else '❌'} Journal page renders: {has_journal}")

        # 404 Page
        await page.goto(f"{LIVE_URL}/nonexistent-page-test/", wait_until=WAIT_STRATEGY, timeout=15000)
        await take_screenshot(page, "05_desktop_404", wait_ms=2000)

        not_found_content = await page.content()
        has_dark_404 = "slate-950" in not_found_content or "amber" in not_found_content
        print(f"  {'✅' if has_dark_404 else '❌'} 404 page uses dark theme: {has_dark_404}")

        await page.close()

        # Now test with local backend (has deals data)
        print("\n  --- Desktop with Backend (localhost:3000) ---")
        page = await desktop.new_page()

        try:
            await page.goto(LOCAL_URL, wait_until=WAIT_STRATEGY, timeout=15000)
            await take_screenshot(page, "06_local_landing", wait_ms=3000)

            # Try to enter the app (click CTA if visible)
            try:
                # Look for "Get Started" or "Try It" or similar CTA button
                cta = page.locator("text=Get Started").first
                if await cta.is_visible():
                    await cta.click()
                    await asyncio.sleep(2)
                else:
                    # Try other common CTAs
                    for text in ["Try It", "Explore", "Enter", "Sign Up"]:
                        btn = page.locator(f"text={text}").first
                        if await btn.is_visible():
                            await btn.click()
                            await asyncio.sleep(2)
                            break
            except:
                pass

            await take_screenshot(page, "07_local_app_entered", wait_ms=3000)

            # Check if map loaded
            map_content = await page.content()
            has_map = "maplibregl" in map_content or "mapboxgl" in map_content or "map-container" in map_content
            print(f"  {'✅' if has_map else '⚠️'} Map component present: {has_map}")

            # Check deals overlay
            # The app starts in deals mode by default
            await take_screenshot(page, "08_local_deals_overlay", wait_ms=2000)

        except Exception as e:
            print(f"  ⚠️ Local backend test failed: {e}")
            await take_screenshot(page, "06_local_error", wait_ms=1000)

        await page.close()

        # ======= MOBILE TESTS =======
        print("\n  --- Mobile (390x844) ---")

        page = await mobile.new_page()
        await page.goto(LIVE_URL, wait_until=WAIT_STRATEGY, timeout=30000)
        await take_screenshot(page, "09_mobile_landing", wait_ms=3000)

        # Sign-in mobile
        await page.goto(f"{LIVE_URL}/sign-in/", wait_until=WAIT_STRATEGY, timeout=30000)
        await take_screenshot(page, "10_mobile_signin", wait_ms=3000)

        # Journal mobile
        await page.goto(f"{LIVE_URL}/journal/", wait_until=WAIT_STRATEGY, timeout=15000)
        await take_screenshot(page, "11_mobile_journal", wait_ms=2000)

        # 404 mobile
        await page.goto(f"{LIVE_URL}/this-page-does-not-exist/", wait_until=WAIT_STRATEGY, timeout=15000)
        await take_screenshot(page, "12_mobile_404", wait_ms=2000)

        # Mobile local with backend
        try:
            await page.goto(LOCAL_URL, wait_until=WAIT_STRATEGY, timeout=15000)
            await take_screenshot(page, "13_mobile_local_app", wait_ms=3000)
        except:
            print("  ⚠️ Mobile local test skipped (backend unreachable)")

        await page.close()

        await desktop.close()
        await mobile.close()
        await browser.close()

    # Summary
    print(f"\n{'='*60}")
    print(f"QA COMPLETE — Screenshots saved to {SCREENSHOT_DIR}/")
    print(f"{'='*60}")

    # Save results JSON
    results = {
        "timestamp": timestamp,
        "live_url": LIVE_URL,
        "api_url": API_URL,
        "api_endpoints": api_results,
        "screenshots": sorted([f.name for f in SCREENSHOT_DIR.glob("*.png")]),
    }
    (SCREENSHOT_DIR / "qa_results.json").write_text(json.dumps(results, indent=2))
    print(f"\nResults: {SCREENSHOT_DIR}/qa_results.json")


if __name__ == "__main__":
    asyncio.run(run_visual_qa())
