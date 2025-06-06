// Simple HTTP test to verify the app is running
const http = require('http');

console.log('🧪 Testing if Document Writer App is accessible...\n');

const options = {
    hostname: 'localhost',
    port: 8000,
    path: '/',
    method: 'GET'
};

const req = http.request(options, (res) => {
    console.log(`✅ Server is responding!`);
    console.log(`   Status Code: ${res.statusCode}`);
    console.log(`   Headers:`, res.headers['content-type']);
    
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        // Check if it's the right app
        if (data.includes('Alicia') && data.includes('Personal Document Assistant')) {
            console.log('\n✅ Document Writer App is running correctly!');
            console.log('   Title found: Alicia - Your Personal Document Assistant');
            
            // Check for key elements
            const checks = [
                { text: 'settings-button', desc: 'Settings button' },
                { text: 'ai-status', desc: 'AI status indicator' },
                { text: 'sd-status', desc: 'Image AI status' },
                { text: 'wizard-container', desc: 'Main wizard interface' }
            ];
            
            console.log('\n📋 Component checks:');
            checks.forEach(check => {
                const found = data.includes(check.text);
                console.log(`   ${found ? '✅' : '❌'} ${check.desc}`);
            });
        } else {
            console.log('\n❌ This doesn\'t appear to be the Document Writer app');
        }
    });
});

req.on('error', (e) => {
    console.error(`❌ Cannot connect to server: ${e.message}`);
    console.log('\n💡 Make sure the web server is running:');
    console.log('   npm run web-server');
    console.log('   or: python -m http.server 8000');
});

req.end();