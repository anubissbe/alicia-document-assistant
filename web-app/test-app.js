const puppeteer = require('puppeteer');

async function testDocumentWriter() {
    console.log('🧪 Starting Document Writer App Test...\n');
    
    const browser = await puppeteer.launch({
        headless: false, // Set to true for headless mode
        devtools: true
    });
    
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
        if (msg.type() === 'log') {
            console.log('📋 Console:', msg.text());
        }
    });
    
    page.on('error', err => {
        console.error('❌ Page error:', err);
    });
    
    try {
        // 1. Navigate to the app
        console.log('1️⃣ Navigating to app...');
        await page.goto('http://localhost:8000', { waitUntil: 'networkidle2' });
        
        // 2. Wait for initial load
        await page.waitForTimeout(2000);
        
        // 3. Check status indicators
        console.log('\n2️⃣ Checking status indicators...');
        const aiStatus = await page.$eval('#status-text', el => el.textContent);
        const sdStatus = await page.$eval('#sd-text', el => el.textContent);
        console.log('   AI Status:', aiStatus);
        console.log('   SD Status:', sdStatus);
        
        // 4. Open settings
        console.log('\n3️⃣ Opening settings...');
        await page.click('#settings-button');
        await page.waitForTimeout(500);
        
        // 5. Configure settings
        console.log('4️⃣ Configuring settings...');
        await page.evaluate(() => {
            document.getElementById('min-pages').value = '10';
            document.getElementById('doc-detail-level').value = 'detailed';
        });
        
        // Click save settings
        await page.evaluate(() => {
            const saveBtn = Array.from(document.querySelectorAll('button')).find(
                btn => btn.textContent.includes('Save Settings')
            );
            if (saveBtn) saveBtn.click();
        });
        await page.waitForTimeout(500);
        
        // 6. Select document type
        console.log('\n5️⃣ Selecting document type...');
        await page.click('[data-type="business"]');
        await page.waitForTimeout(500);
        
        // 7. Click next
        await page.click('#next-btn');
        await page.waitForTimeout(500);
        
        // 8. Fill document details
        console.log('6️⃣ Filling document details...');
        await page.type('#documentTitle', 'Test Document for 10 Pages');
        await page.type('#documentDescription', 'This is a test document to verify that the AI generates exactly 10 pages with appropriate images.');
        
        // Click next
        await page.click('#next-btn');
        await page.waitForTimeout(500);
        
        // 9. Add sections
        console.log('7️⃣ Adding sections...');
        for (let i = 0; i < 3; i++) {
            await page.click('[data-action="addSection"]');
            await page.waitForTimeout(200);
        }
        
        // Click next
        await page.click('#next-btn');
        await page.waitForTimeout(500);
        
        // 10. Generate document
        console.log('\n8️⃣ Generating document with AI...');
        console.log('   This may take 30-60 seconds...');
        
        // Get initial console output
        const imageCountInfo = await page.$eval('.info-message p', el => el.textContent);
        console.log('   Expected:', imageCountInfo);
        
        await page.click('[data-action="generateDocument"]');
        
        // Wait for generation to complete (max 2 minutes)
        await page.waitForFunction(
            () => {
                const content = document.querySelector('.generated-content');
                return content && content.textContent.length > 100;
            },
            { timeout: 120000 }
        );
        
        console.log('\n✅ Document generated successfully!');
        
        // 11. Click next to go to review
        await page.click('#next-btn');
        await page.waitForTimeout(1000);
        
        // 12. Analyze results
        console.log('\n9️⃣ Analyzing generated document...');
        const results = await page.evaluate(() => {
            const content = window.app.wizardData.generatedContent;
            const imageMatches = content.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || [];
            const wordCount = content.split(' ').length;
            const headers = content.match(/^#{1,3}\s+.+$/gm) || [];
            
            // Check preview
            const previewElement = document.getElementById('final-content-preview');
            const previewImages = previewElement ? previewElement.querySelectorAll('img').length : 0;
            
            return {
                wordCount,
                estimatedPages: Math.ceil(wordCount / 300),
                imageCount: imageMatches.length,
                sectionCount: headers.length,
                previewImages,
                firstImage: imageMatches[0] || 'No images found',
                contentLength: content.length
            };
        });
        
        console.log('\n📊 Document Analysis:');
        console.log(`   Word count: ${results.wordCount}`);
        console.log(`   Estimated pages: ${results.estimatedPages}`);
        console.log(`   Images found: ${results.imageCount}`);
        console.log(`   Images in preview: ${results.previewImages}`);
        console.log(`   Sections: ${results.sectionCount}`);
        console.log(`   Total characters: ${results.contentLength}`);
        
        // 13. Check if requirements are met
        console.log('\n🎯 Requirement Checks:');
        console.log(`   ✓ 10+ pages: ${results.estimatedPages >= 10 ? '✅ PASS' : '❌ FAIL'} (${results.estimatedPages} pages)`);
        console.log(`   ✓ 6 images: ${results.imageCount === 6 ? '✅ PASS' : '❌ FAIL'} (${results.imageCount} images)`);
        console.log(`   ✓ Images display: ${results.previewImages > 0 ? '✅ PASS' : '❌ FAIL'}`);
        
        // Take a screenshot
        await page.screenshot({ path: 'test-result.png', fullPage: true });
        console.log('\n📸 Screenshot saved as test-result.png');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        await page.screenshot({ path: 'test-error.png' });
        console.log('📸 Error screenshot saved as test-error.png');
    }
    
    console.log('\n🏁 Test completed. Browser will close in 10 seconds...');
    await page.waitForTimeout(10000);
    await browser.close();
}

// Run the test
testDocumentWriter().catch(console.error);