// Image Generation Module for Document Writer
// Provides AI-powered image generation capabilities

class ImageGenerator {
    constructor() {
        // Configuration - set USE_STABLE_DIFFUSION to false to disable SD completely
        this.USE_STABLE_DIFFUSION = true; // Set to false to only use fallback images
        
        // Local Stable Diffusion API
        this.stableDiffusionAPI = {
            baseUrl: 'http://192.168.1.25:8000',
            enabled: this.USE_STABLE_DIFFUSION,
            // Different possible endpoints for various Stable Diffusion implementations
            endpoints: {
                generate: '/generate',
                txt2img: '/sdapi/v1/txt2img',
                api_generate: '/api/generate',
                api_txt2img: '/api/txt2img'
            },
            currentEndpoint: '/generate'
        };
        
        // Fallback APIs
        this.apis = {
            unsplash: {
                baseUrl: 'https://api.unsplash.com',
                // Using demo client ID - in production, use your own
                clientId: 'b1ebba2f6e5b7e2c7a9a8b4f0d5e8c7f9a2b5c8d3e6f9a1b'
            },
            picsum: {
                baseUrl: 'https://picsum.photos'
            },
            placeholder: {
                baseUrl: 'https://via.placeholder.com'
            }
        };
        
        // Chart.js for data visualizations
        this.chartTypes = ['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea'];
        
        // Check if Stable Diffusion is available (only if enabled)
        if (this.USE_STABLE_DIFFUSION) {
            this.checkStableDiffusionAPI();
        } else {
            console.log('[STABLE DIFFUSION] Disabled by configuration');
            this.updateSDStatus('disconnected', 'Image AI: Disabled');
        }
        
        // Don't check again automatically - only on demand
        this.lastHealthCheck = Date.now();
        
        // Add click handler for toggling SD
        this.setupToggleHandler();
    }
    
    // Setup click handler for toggling Stable Diffusion
    setupToggleHandler() {
        const sdStatus = document.getElementById('sd-status');
        if (sdStatus) {
            sdStatus.addEventListener('click', () => {
                this.toggleStableDiffusion();
            });
        }
    }
    
    // Toggle Stable Diffusion on/off
    toggleStableDiffusion() {
        this.stableDiffusionAPI.enabled = !this.stableDiffusionAPI.enabled;
        
        if (this.stableDiffusionAPI.enabled) {
            console.log('[STABLE DIFFUSION] Manually enabled, checking connection...');
            this.checkStableDiffusionAPI();
        } else {
            console.log('[STABLE DIFFUSION] Manually disabled');
            this.updateSDStatus('disconnected', 'Image AI: Disabled (click to enable)');
        }
    }
    
    // Check if Stable Diffusion API is available
    async checkStableDiffusionAPI() {
        try {
            console.log(`[STABLE DIFFUSION] Checking API health at ${this.stableDiffusionAPI.baseUrl}/health`);
            const response = await fetch(`${this.stableDiffusionAPI.baseUrl}/health`, {
                method: 'GET',
                mode: 'cors',
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });
            
            if (response.ok) {
                const healthData = await response.text();
                console.log('[STABLE DIFFUSION] API is available. Health response:', healthData);
                this.stableDiffusionAPI.enabled = true;
                this.updateSDStatus('connected', 'Image AI: Ready');
            } else {
                console.warn('[STABLE DIFFUSION] API not responding properly. Status:', response.status);
                this.stableDiffusionAPI.enabled = false;
                this.updateSDStatus('disconnected', 'Image AI: Offline (using fallback)');
            }
        } catch (error) {
            console.warn('[STABLE DIFFUSION] Cannot connect to API:', error.message);
            this.stableDiffusionAPI.enabled = false;
            this.updateSDStatus('disconnected', 'Image AI: Offline (using fallback)');
        }
    }
    
    // Update Stable Diffusion status in UI
    updateSDStatus(status, message) {
        const indicator = document.getElementById('sd-indicator');
        const text = document.getElementById('sd-text');
        
        if (indicator && text) {
            indicator.className = `status-indicator ${status}`;
            text.textContent = message;
        }
    }

    // Main method to generate images based on description
    async generateImage(description, type = 'photo') {
        try {
            console.log(`[IMAGE GENERATOR] Generating ${type} for: "${description}"`);
            
            switch (type) {
                case 'chart':
                case 'graph':
                case 'visualization':
                case 'data':
                case 'statistics':
                case 'metrics':
                    // ALWAYS use Chart.js for data visualizations - NEVER use SD for charts
                    console.log('[IMAGE GENERATOR] Using Chart.js for data visualization');
                    return await this.generateChart(description);
                    
                case 'diagram':
                case 'flowchart':
                case 'process':
                case 'workflow':
                    // Use canvas-based diagram generator - SD often fails at technical diagrams
                    console.log('[IMAGE GENERATOR] Using canvas for diagram generation');
                    return await this.generateDiagram(description);
                    
                case 'infographic':
                case 'summary':
                    // Use canvas-based infographic generator for better control
                    console.log('[IMAGE GENERATOR] Using canvas for infographic generation');
                    return await this.generateInfographic(description);
                    
                case 'photo':
                case 'illustration':
                case 'image':
                default:
                    // Only use SD/stock photos for actual photographic content
                    console.log('[IMAGE GENERATOR] Using photo generation (SD or stock)');
                    return await this.searchStockPhoto(description);
            }
        } catch (error) {
            console.error('[IMAGE GENERATOR] Generation error:', error);
            return this.generatePlaceholder(description);
        }
    }

    // Generate image using Stable Diffusion API
    async generateWithStableDiffusion(prompt, type = 'photo') {
        const startTime = Date.now();
        
        if (window.DEBUG_MODE || typeof debugLog !== 'undefined') {
            console.log(`\n[STABLE DIFFUSION] Starting ${type} generation`);
            console.log(`[STABLE DIFFUSION] Original prompt: "${prompt}"`);
        }
        
        // Try different endpoints if we haven't found a working one
        const endpointsToTry = this.stableDiffusionAPI.currentEndpoint ? 
            [this.stableDiffusionAPI.currentEndpoint] : 
            Object.values(this.stableDiffusionAPI.endpoints);
        
        let lastError;
        for (const endpoint of endpointsToTry) {
            try {
                this.stableDiffusionAPI.currentEndpoint = endpoint;
                return await this.generateWithStableDiffusionEndpoint(prompt, type, endpoint);
            } catch (error) {
                lastError = error;
                console.warn(`[STABLE DIFFUSION] Endpoint ${endpoint} failed:`, error.message);
            }
        }
        
        throw lastError || new Error('All Stable Diffusion endpoints failed');
    }

    // Generate image using specific Stable Diffusion endpoint
    async generateWithStableDiffusionEndpoint(prompt, type = 'photo', endpoint) {
        const startTime = Date.now();
        
        try {
            // Enhance prompt based on type
            let enhancedPrompt = prompt;
            let negativePrompt = 'blurry, bad quality, distorted, ugly';
            
            switch (type) {
                case 'photo':
                    enhancedPrompt = `professional photograph of ${prompt}, high quality, detailed, sharp focus`;
                    break;
                case 'diagram':
                    enhancedPrompt = `clean technical diagram of ${prompt}, white background, simple lines, professional`;
                    negativePrompt += ', complex, cluttered, photorealistic';
                    break;
                case 'infographic':
                    enhancedPrompt = `modern infographic design showing ${prompt}, clean layout, professional colors`;
                    negativePrompt += ', photorealistic, complex background';
                    break;
                default:
                    enhancedPrompt = `professional illustration of ${prompt}, high quality`;
            }
            
            // Try different request formats based on the endpoint
            let requestBody;
            const endpoint = this.stableDiffusionAPI.currentEndpoint;
            
            if (endpoint.includes('txt2img')) {
                // Automatic1111 WebUI API format
                requestBody = {
                    prompt: enhancedPrompt,
                    negative_prompt: negativePrompt,
                    steps: 25,
                    cfg_scale: 7.5,
                    width: 512,
                    height: 512,
                    seed: -1,
                    sampler_name: "Euler a"
                };
            } else {
                // Generic format
                requestBody = {
                    prompt: enhancedPrompt,
                    negative_prompt: negativePrompt,
                    num_inference_steps: 25,
                    guidance_scale: 7.5,
                    width: 512,
                    height: 512,
                    seed: -1
                };
            }
            
            if (window.DEBUG_MODE || typeof debugLog !== 'undefined') {
                console.log(`[STABLE DIFFUSION] Enhanced prompt: "${enhancedPrompt}"`);
                console.log(`[STABLE DIFFUSION] Negative prompt: "${negativePrompt}"`);
                console.log(`[STABLE DIFFUSION] Sending request to ${this.stableDiffusionAPI.baseUrl}${endpoint}`);
                console.log(`[STABLE DIFFUSION] Request body:`, requestBody);
            }
            
            const response = await fetch(`${this.stableDiffusionAPI.baseUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                mode: 'cors'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            let data;
            let responseText;
            try {
                responseText = await response.text();
                if (window.DEBUG_MODE || typeof debugLog !== 'undefined') {
                    console.log('[STABLE DIFFUSION] Raw response:', responseText.substring(0, 200) + '...');
                }
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('[STABLE DIFFUSION] Parse error:', parseError);
                console.error('[STABLE DIFFUSION] Response text:', responseText);
                throw new Error('Invalid JSON response from Stable Diffusion API');
            }
            
            const duration = Date.now() - startTime;
            
            // Handle different response formats
            let imageData;
            
            // Check for Automatic1111 WebUI format
            if (data.images && Array.isArray(data.images) && data.images.length > 0) {
                imageData = data.images[0];
            }
            // Check for simple image field
            else if (data.image && typeof data.image === 'string') {
                imageData = data.image;
            }
            // Check for base64 field
            else if (data.base64 && typeof data.base64 === 'string') {
                imageData = data.base64;
            }
            // Check for data field
            else if (data.data && typeof data.data === 'string') {
                imageData = data.data;
            }
            // Check if the response itself is just a string (base64)
            else if (typeof data === 'string') {
                imageData = data;
            }
            else {
                console.error('[STABLE DIFFUSION] Unexpected response format:', data);
                throw new Error('Invalid image data format from Stable Diffusion API');
            }
            
            // Validate it's valid base64
            try {
                // Remove data URL prefix if present
                const base64Only = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
                atob(base64Only);
                imageData = base64Only;
            } catch (e) {
                throw new Error('Malformed base64 image data from Stable Diffusion API');
            }
            
            if (window.DEBUG_MODE || typeof debugLog !== 'undefined') {
                console.log(`[STABLE DIFFUSION] ✓ Image generated successfully in ${duration}ms`);
            }
            
            // The API returns base64 encoded image
            const imageUrl = `data:image/png;base64,${imageData}`;
            
            return {
                url: imageUrl,
                alt: prompt,
                caption: `AI Generated: ${prompt}`,
                type: type,
                isDataUrl: true
            };
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            if (window.DEBUG_MODE || typeof debugLog !== 'undefined') {
                console.error(`[STABLE DIFFUSION] ✗ Failed after ${duration}ms:`, error.message);
                console.log('[STABLE DIFFUSION] Falling back to placeholder image');
            }
            
            // Fallback to stock photo (with isRetry=true to prevent infinite loop)
            return this.searchStockPhoto(prompt, true);
        }
    }

    // Search for stock photos using Unsplash API (fallback)
    async searchStockPhoto(query, isRetry = false) {
        try {
            // Check if Stable Diffusion is available first (but prevent infinite loop)
            if (this.stableDiffusionAPI.enabled && !isRetry) {
                return await this.generateWithStableDiffusion(query, 'photo');
            }
            
            // Fallback: using Lorem Picsum with search-like functionality
            const width = 800;
            const height = 600;
            const seed = query.split(' ').join('').toLowerCase();
            
            return {
                url: `https://picsum.photos/seed/${seed}/${width}/${height}`,
                alt: `Stock photo for: ${query}`,
                caption: `Image: ${query}`,
                type: 'photo'
            };
        } catch (error) {
            return this.generatePlaceholder(query);
        }
    }

    // Generate charts using Chart.js (DO NOT use Stable Diffusion for charts)
    async generateChart(description) {
        try {
            // Parse the description to extract chart data
            const chartData = this.parseChartDescription(description);
            
            // Create a canvas element
            const canvas = document.createElement('canvas');
            canvas.width = 800;
            canvas.height = 600;
            
            // Generate the chart
            const ctx = canvas.getContext('2d');
            new Chart(ctx, {
                type: chartData.type,
                data: chartData.data,
                options: {
                    responsive: false,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: chartData.title,
                            font: {
                                size: 16
                            }
                        },
                        legend: {
                            display: true,
                            position: 'bottom'
                        }
                    },
                    scales: chartData.type !== 'pie' && chartData.type !== 'doughnut' ? {
                        y: {
                            beginAtZero: true
                        }
                    } : undefined
                }
            });

            // Convert to image
            return new Promise((resolve) => {
                setTimeout(() => {
                    const imageUrl = canvas.toDataURL('image/png');
                    resolve({
                        url: imageUrl,
                        alt: chartData.title,
                        caption: `Chart: ${chartData.title}`,
                        type: 'chart',
                        isDataUrl: true
                    });
                }, 1000); // Wait for chart to render
            });
        } catch (error) {
            console.error('Chart generation error:', error);
            return this.generateSampleChart();
        }
    }

    // Parse description to extract chart data
    parseChartDescription(description) {
        const desc = description.toLowerCase();
        
        // Determine chart type
        let type = 'bar';
        for (const chartType of this.chartTypes) {
            if (desc.includes(chartType)) {
                type = chartType;
                break;
            }
        }

        // Extract or generate sample data
        const numbers = description.match(/\d+/g) || [];
        const hasData = numbers.length >= 3;

        if (hasData) {
            return {
                type,
                title: this.extractTitle(description),
                data: {
                    labels: this.generateLabels(numbers.length),
                    datasets: [{
                        label: 'Data',
                        data: numbers.map(n => parseInt(n)),
                        backgroundColor: this.generateColors(numbers.length),
                        borderColor: this.generateColors(numbers.length, 1),
                        borderWidth: 1
                    }]
                }
            };
        }

        // Return sample data if no data found
        return this.getSampleChartData(type, description);
    }

    // Generate a simple diagram
    async generateDiagram(description) {
        // Always use canvas-based diagram - SD is not good at technical diagrams
        console.log('[DIAGRAM] Using canvas-based diagram generator');
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');

        // Simple flowchart/diagram generator
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Extract components from description
        const components = this.extractDiagramComponents(description);
        
        // Draw diagram
        this.drawSimpleDiagram(ctx, components);

        const imageUrl = canvas.toDataURL('image/png');
        return {
            url: imageUrl,
            alt: `Diagram: ${description}`,
            caption: `Diagram illustrating: ${description}`,
            type: 'diagram',
            isDataUrl: true
        };
    }

    // Generate infographic
    async generateInfographic(description) {
        // Always use canvas-based infographic - provides better control over layout
        console.log('[INFOGRAPHIC] Using canvas-based infographic generator');
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 1200;
        const ctx = canvas.getContext('2d');

        // Background
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#f0f9ff');
        gradient.addColorStop(1, '#e0f2fe');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Extract key points
        const points = this.extractKeyPoints(description);
        
        // Draw infographic elements
        this.drawInfographic(ctx, points, description);

        const imageUrl = canvas.toDataURL('image/png');
        return {
            url: imageUrl,
            alt: `Infographic: ${description}`,
            caption: `Infographic: ${this.extractTitle(description)}`,
            type: 'infographic',
            isDataUrl: true
        };
    }

    // Helper methods
    extractTitle(description) {
        const words = description.split(' ');
        return words.slice(0, Math.min(5, words.length)).join(' ');
    }

    generateLabels(count) {
        const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return labels.slice(0, count);
    }

    generateColors(count, alpha = 0.6) {
        const colors = [
            `rgba(255, 99, 132, ${alpha})`,
            `rgba(54, 162, 235, ${alpha})`,
            `rgba(255, 206, 86, ${alpha})`,
            `rgba(75, 192, 192, ${alpha})`,
            `rgba(153, 102, 255, ${alpha})`,
            `rgba(255, 159, 64, ${alpha})`
        ];
        
        const result = [];
        for (let i = 0; i < count; i++) {
            result.push(colors[i % colors.length]);
        }
        return result;
    }

    getSampleChartData(type, description) {
        const sampleData = {
            bar: {
                labels: ['Q1', 'Q2', 'Q3', 'Q4'],
                datasets: [{
                    label: 'Quarterly Results',
                    data: [65, 75, 70, 85],
                    backgroundColor: this.generateColors(4)
                }]
            },
            line: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Monthly Trend',
                    data: [30, 45, 35, 50, 55, 60],
                    borderColor: 'rgba(54, 162, 235, 1)',
                    tension: 0.1
                }]
            },
            pie: {
                labels: ['Category A', 'Category B', 'Category C', 'Category D'],
                datasets: [{
                    data: [30, 25, 20, 25],
                    backgroundColor: this.generateColors(4)
                }]
            }
        };

        return {
            type,
            title: this.extractTitle(description),
            data: sampleData[type] || sampleData.bar
        };
    }

    generateSampleChart() {
        // Fallback sample chart
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Item 1', 'Item 2', 'Item 3', 'Item 4'],
                datasets: [{
                    label: 'Sample Data',
                    data: [12, 19, 8, 15],
                    backgroundColor: this.generateColors(4)
                }]
            }
        });

        return {
            url: canvas.toDataURL('image/png'),
            alt: 'Sample chart',
            caption: 'Sample chart visualization',
            type: 'chart',
            isDataUrl: true
        };
    }

    extractDiagramComponents(description) {
        // Simple extraction of components for diagram
        const words = description.split(' ');
        const components = [];
        
        // Look for key terms
        const keyTerms = words.filter(word => 
            word.length > 4 && 
            !['this', 'that', 'with', 'from', 'into'].includes(word.toLowerCase())
        );

        return keyTerms.slice(0, 4).map(term => ({
            text: term,
            type: 'box'
        }));
    }

    drawSimpleDiagram(ctx, components) {
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        
        const boxWidth = 150;
        const boxHeight = 60;
        const spacing = 50;
        const startY = 100;

        components.forEach((comp, index) => {
            const x = 400;
            const y = startY + (boxHeight + spacing) * index;

            // Draw box
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - boxWidth/2, y - boxHeight/2, boxWidth, boxHeight);

            // Draw text
            ctx.fillStyle = '#1f2937';
            ctx.fillText(comp.text, x, y + 5);

            // Draw arrow (except for last)
            if (index < components.length - 1) {
                ctx.beginPath();
                ctx.moveTo(x, y + boxHeight/2);
                ctx.lineTo(x, y + boxHeight/2 + spacing/2);
                ctx.stroke();
                
                // Arrow head
                ctx.beginPath();
                ctx.moveTo(x - 5, y + boxHeight/2 + spacing/2 - 10);
                ctx.lineTo(x, y + boxHeight/2 + spacing/2);
                ctx.lineTo(x + 5, y + boxHeight/2 + spacing/2 - 10);
                ctx.stroke();
            }
        });
    }

    extractKeyPoints(description) {
        // Extract key points for infographic
        const sentences = description.split(/[.!?]+/);
        return sentences
            .filter(s => s.trim().length > 10)
            .slice(0, 5)
            .map(s => s.trim());
    }

    drawInfographic(ctx, points, title) {
        // Title
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1f2937';
        ctx.fillText(this.extractTitle(title), 400, 80);

        // Draw key points with icons
        const startY = 150;
        const spacing = 200;

        points.forEach((point, index) => {
            const y = startY + spacing * index;

            // Icon circle
            ctx.beginPath();
            ctx.arc(100, y, 30, 0, Math.PI * 2);
            ctx.fillStyle = this.generateColors(1)[0];
            ctx.fill();

            // Number
            ctx.font = 'bold 24px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(index + 1, 100, y + 8);

            // Text
            ctx.font = '18px Arial';
            ctx.fillStyle = '#374151';
            ctx.textAlign = 'left';
            
            // Word wrap
            const words = point.split(' ');
            let line = '';
            let lineY = y - 10;
            
            words.forEach(word => {
                const testLine = line + word + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > 500 && line !== '') {
                    ctx.fillText(line, 160, lineY);
                    line = word + ' ';
                    lineY += 25;
                } else {
                    line = testLine;
                }
            });
            ctx.fillText(line, 160, lineY);
        });
    }

    generatePlaceholder(description) {
        // Fallback placeholder image
        return {
            url: `https://via.placeholder.com/800x600/3b82f6/ffffff?text=${encodeURIComponent(description.slice(0, 20))}`,
            alt: description,
            caption: `Placeholder for: ${description}`,
            type: 'placeholder'
        };
    }

    // Integration with document editor
    async insertImageIntoDocument(description, type = 'auto') {
        const imageData = await this.generateImage(description, type);
        
        // Create image HTML
        const imageHtml = `
            <figure class="document-image">
                <img src="${imageData.url}" alt="${imageData.alt}" style="max-width: 100%; height: auto;">
                <figcaption>${imageData.caption}</figcaption>
            </figure>
        `;

        return {
            html: imageHtml,
            data: imageData
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageGenerator;
}