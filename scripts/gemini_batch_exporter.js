/**
 * Gemini My Stuff Exporter (Final Robust V5)
 * Run this in your browser console on https://gemini.google.com/mystuff
 * Improvements: Scrolling, re-click on failure, and verified selectors.
 */
(async () => {
    console.log("🚀 Starting Final Robust Gemini Export (V5)...");

    const MY_STUFF_URL = "https://gemini.google.com/mystuff";
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const waitFor = async (fn, { timeoutMs = 15000, intervalMs = 250 } = {}) => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            try {
                const v = fn();
                if (v) return v;
            } catch {
                // ignore
            }
            await sleep(intervalMs);
        }
        return null;
    };

    const extractPromptText = () => {
        // Prefer the "user query bubble" layout (multi-line).
        const bubble = document.querySelector(".user-query-bubble-with-background");
        if (bubble) {
            const lines = Array.from(bubble.querySelectorAll(".query-text-line"))
                .map((el) => (el.textContent || "").trim())
                .filter(Boolean);
            if (lines.length) return lines.join("\n");
        }

        // Fallbacks
        const q1 = document.querySelector(".query-text");
        if (q1 && q1.textContent && q1.textContent.trim().length > 0) return q1.textContent.trim();

        const q2 = document.querySelector("user-query");
        if (q2 && q2.innerText && q2.innerText.trim().length > 0) return q2.innerText.trim();

        const q3 = document.querySelector(".query-content");
        if (q3 && q3.innerText && q3.innerText.trim().length > 0) return q3.innerText.trim();

        return "";
    };

    const isGoodImgSrc = (src) => {
        if (!src) return false;
        if (src.startsWith("data:image")) return false;
        // blob: is often ephemeral and not shareable; prefer real URLs when possible.
        if (src.startsWith("blob:")) return false;
        return true;
    };

    const extractGeneratedImageUrl = () => {
        // Try known patterns first
        const img1 = document.querySelector("img.image.loaded");
        if (img1 && isGoodImgSrc(img1.src)) return img1.src;

        // Broader search inside the conversation area
        const candidates = Array.from(document.querySelectorAll("img"))
            .map((img) => img?.src || "")
            .filter(Boolean);

        const prefer = candidates.find((s) => isGoodImgSrc(s) && /googleusercontent\.com|gstatic\.com|content-ad-pc\.googleapis\.com/i.test(s));
        if (prefer) return prefer;

        const any = candidates.find((s) => isGoodImgSrc(s));
        return any || "";
    };
    
    // Select all cards in the grid
    const items = Array.from(document.querySelectorAll('.library-item-card, library-item-card'));
    const results = [];
    const total = items.length;

    if (total === 0) {
        console.error("❌ No items found. Make sure you are on 'My Stuff' and items are loaded.");
        return;
    }

    console.log(`📦 Found ${total} items. Starting sequential extraction...`);

    for (let i = 0; i < total; i++) {
        const item = items[i];
        const imageUrl = item.querySelector('img')?.src || "";
        const initialTitle = item.getAttribute('aria-label') || "Gemini Prompt";
        
        console.log(`🔍 [${i+1}/${total}] Processing: ${initialTitle.slice(0, 30)}...`);
        
        // 1. Scroll item into view to ensure it's clickable and loaded
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(800); // Wait for scroll and potential lazy loading
        
        // 2. Click to enter the session detail (try multiple times if navigation doesn't happen)
        let navigated = false;
        let sessionUrl = window.location.href;
        
        for (let attempt = 0; attempt < 3; attempt++) {
            item.click();
            
            // Wait to see if URL changes
            const ok = await waitFor(() => window.location.href.includes('/app/') || document.querySelector(".query-text, user-query, .user-query-bubble-with-background"), { timeoutMs: 5000, intervalMs: 200 });
            if (ok) {
                navigated = true;
                sessionUrl = window.location.href;
            }
            if (navigated) break;
            console.log(`⚠️ Navigation failed on attempt ${attempt + 1}, retrying click...`);
        }

        let promptText = initialTitle;
        let generatedImageUrl = "";
        
        if (navigated) {
            // 3. Wait for the page content to appear
            await waitFor(() => document.querySelector(".query-text, user-query, .user-query-bubble-with-background, .query-content"), { timeoutMs: 12000, intervalMs: 300 });

            promptText = extractPromptText() || initialTitle;

            // Give images a bit of time to resolve
            await sleep(1200);
            generatedImageUrl = extractGeneratedImageUrl();
            
            console.log(`✅ Extracted: ${promptText.slice(0, 40)}...`);
            
            // 4. Return to the list view
            window.history.back();
            await sleep(1500); // Cooler for the SPA
            // Ensure cards are present again before moving on
            await waitFor(() => document.querySelector('.library-item-card, library-item-card'), { timeoutMs: 15000, intervalMs: 250 });
        } else {
            console.warn(`❌ Failed to navigate for item ${i+1}. Falling back to card title.`);
            // If it never navigated, we stay on 'mystuff' but we'll record it anyway
            sessionUrl = window.location.href;
        }

        results.push({
            id: `gemini_${i}_${Date.now()}`,
            title: promptText.slice(0, 60).replace(/\n/g, ' '),
            promptText: promptText,
            imageUrl: generatedImageUrl || imageUrl,
            createdAt: new Date().toISOString(),
            genres: [], styles: [], moods: [],
            source: { name: "Gemini", url: sessionUrl }
        });
    }

    // Final JSON generation
    const data = JSON.stringify({ prompts: results }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gemini_v5_export_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    console.log("------------------- DATA COPY -------------------");
    console.log(data);
    console.log("-------------------------------------------------");
    console.log("🎉 All done! Check your downloads or copy the JSON above.");
})();
