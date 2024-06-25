const fs = require('fs-extra');
const path = require('path');
const playwright = require('playwright');

const inputDir = path.join(__dirname, 'input');
const outputDir = path.join(__dirname, 'output');
const MAX_RETRY_ATTEMPTS = 3; // Maximum number of retry attempts

async function getEmbedLink(page, lat, long, retryCount = 0) {
    if (retryCount > MAX_RETRY_ATTEMPTS) {
        console.log(`Exceeded maximum retry attempts (${MAX_RETRY_ATTEMPTS}). Skipping coordinates: [${lat}, ${long}]`);
        return null; // Return null to indicate failure to get embed link after retries
    }

    const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${long}&hl=en`;
    await page.goto(url);

    // Check if consent button is present and click if needed
    const consentButton = await page.$('button[jsname="b3VHJd"]');
    if (consentButton) {
        await consentButton.click();
        console.log('Clicked privacy/consent button - Success');
    }

    // Wait for the menu button using a different approach
    const menuButton = await page.waitForSelector('button.efms9b.Hk4XGb', { timeout: 5000 }).catch(() => null);
    if (!menuButton) {
        console.log('Menu button not found. Skipping coordinates:', [lat, long]);
        return null; // Return null to indicate failure to get embed link
    }

    await menuButton.click();

    // Click on "Share or embed image" option
    await page.waitForSelector('div.goog-menuitem-content:has-text("Share or embed image")');
    await page.click('div.goog-menuitem-content:has-text("Share or embed image")');

    // Wait for the embed tab button and click it
    await page.waitForSelector('button[aria-label="Embed a map"]');
    await page.click('button[aria-label="Embed a map"]');

    // Wait for the copy HTML button and click it
    await page.waitForSelector('button[jsaction="pane.embedMap.copy"]');
    await page.click('button[jsaction="pane.embedMap.copy"]');

    // Attempt to extract the embed link from the copied HTML
    const embedLink = await page.evaluate(async () => {
        return await navigator.clipboard.readText().then(text => {
            const iframeSrcMatch = text.match(/src="([^"]+)"/);
            return iframeSrcMatch ? iframeSrcMatch[1] : null;
        });
    });

    if (!embedLink || !isValidEmbedLink(embedLink)) {
        console.log(`Attempt ${retryCount} failed to extract valid embed link`);
        return getEmbedLink(page, lat, long, retryCount + 1); // Retry entire process if embed link is invalid
    }

    console.log("Link copied successfully. Attempt: ", retryCount)

    return embedLink;
}

function isValidEmbedLink(embedLink) {
    // Check if embed link ends with this which means it is invalid
    return !embedLink.endsWith("0.4000000000000002");
}

let browser;

async function processFile(filePath) {
    if (browser) {
        browser.close();
    }

    browser = await playwright.firefox.launch({
        headless: false, // Launching Firefox with headless mode should be disabled for debugging
    });
    
    const context = await browser.newContext({
        locale: 'en-US',
        extraHTTPHeaders: {
            'Accept-Language': 'en-US,en;q=0.9'
        } 
    });
    const page = await context.newPage();
    const coordinates = await fs.readJson(filePath);
    const output = { locations: [] };

    for (const [lat, long] of coordinates) {
        try {
            const embedLink = await getEmbedLink(page, lat, long);
            if (embedLink) {
                output.locations.push({ link: embedLink });
            }
        } catch (error) {
            console.error(`Error processing coordinates [${lat}, ${long}]:`, error);
        }
    }

    const outputFilePath = path.join(outputDir, path.basename(filePath));
    await fs.writeJson(outputFilePath, output, { spaces: 2 });
}

async function main() {
    try {
        // Clear the output directory before processing files
        await fs.emptyDir(outputDir);

        const files = await fs.readdir(inputDir);
        const jsonFiles = files.filter(file => file.endsWith('.json'));

        for (const file of jsonFiles) {
            const filePath = path.join(inputDir, file);

            try {
                await processFile(filePath);
            } catch (error) {
                console.error(`Error processing file ${file}:`, error);
            }
        }

        console.log('Processing complete.');
    } catch (error) {
        console.error('Error processing files:', error);
    }
}

main();
