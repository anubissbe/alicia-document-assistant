/**
 * Enhanced progress indicators for Document Writer
 */
class ProgressIndicator {
    constructor() {
        this.activeIndicators = new Map();
    }
    
    /**
     * Show a progress bar for long operations
     */
    showProgress(id, options = {}) {
        const {
            title = 'Processing...',
            message = '',
            showPercentage = true,
            showCancel = false,
            onCancel = null
        } = options;
        
        // Remove existing indicator if present
        this.hideProgress(id);
        
        // Create progress container
        const container = document.createElement('div');
        container.className = 'progress-indicator-container';
        container.id = `progress-${id}`;
        container.innerHTML = `
            <div class="progress-indicator-content">
                <h3>${title}</h3>
                ${message ? `<p>${message}</p>` : ''}
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width: 0%"></div>
                </div>
                ${showPercentage ? '<div class="progress-percentage">0%</div>' : ''}
                ${showCancel ? '<button class="cancel-button">Cancel</button>' : ''}
            </div>
        `;
        
        // Add styles if not already present
        if (!document.getElementById('progress-indicator-styles')) {
            const styles = document.createElement('style');
            styles.id = 'progress-indicator-styles';
            styles.textContent = `
                .progress-indicator-container {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    padding: 24px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 10000;
                    min-width: 300px;
                    max-width: 500px;
                }
                
                .progress-indicator-content h3 {
                    margin: 0 0 12px 0;
                    color: #333;
                }
                
                .progress-indicator-content p {
                    margin: 0 0 16px 0;
                    color: #666;
                    font-size: 14px;
                }
                
                .progress-bar-container {
                    width: 100%;
                    height: 8px;
                    background: #f0f0f0;
                    border-radius: 4px;
                    overflow: hidden;
                    margin-bottom: 8px;
                }
                
                .progress-bar-fill {
                    height: 100%;
                    background: #007acc;
                    transition: width 0.3s ease;
                    border-radius: 4px;
                }
                
                .progress-percentage {
                    text-align: center;
                    font-size: 14px;
                    color: #666;
                    margin-bottom: 12px;
                }
                
                .progress-indicator-container .cancel-button {
                    display: block;
                    margin: 0 auto;
                    padding: 6px 16px;
                    background: #f44336;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                
                .progress-indicator-container .cancel-button:hover {
                    background: #d32f2f;
                }
                
                @keyframes progress-pulse {
                    0% { opacity: 0.6; }
                    50% { opacity: 1; }
                    100% { opacity: 0.6; }
                }
                
                .progress-indeterminate .progress-bar-fill {
                    width: 30% !important;
                    animation: progress-pulse 1.5s ease-in-out infinite;
                }
            `;
            document.head.appendChild(styles);
        }
        
        // Add cancel handler
        if (showCancel && onCancel) {
            const cancelBtn = container.querySelector('.cancel-button');
            cancelBtn.addEventListener('click', () => {
                onCancel();
                this.hideProgress(id);
            });
        }
        
        document.body.appendChild(container);
        this.activeIndicators.set(id, container);
        
        return {
            update: (percentage, message) => this.updateProgress(id, percentage, message),
            setIndeterminate: () => this.setIndeterminate(id),
            hide: () => this.hideProgress(id)
        };
    }
    
    /**
     * Update progress
     */
    updateProgress(id, percentage, message) {
        const container = this.activeIndicators.get(id);
        if (!container) return;
        
        const fill = container.querySelector('.progress-bar-fill');
        const percentageText = container.querySelector('.progress-percentage');
        const messageEl = container.querySelector('p');
        
        if (fill) {
            fill.style.width = `${percentage}%`;
        }
        
        if (percentageText) {
            percentageText.textContent = `${Math.round(percentage)}%`;
        }
        
        if (message && messageEl) {
            messageEl.textContent = message;
        }
    }
    
    /**
     * Set progress to indeterminate (unknown duration)
     */
    setIndeterminate(id) {
        const container = this.activeIndicators.get(id);
        if (!container) return;
        
        container.classList.add('progress-indeterminate');
        const percentageText = container.querySelector('.progress-percentage');
        if (percentageText) {
            percentageText.style.display = 'none';
        }
    }
    
    /**
     * Hide progress indicator
     */
    hideProgress(id) {
        const container = this.activeIndicators.get(id);
        if (container) {
            container.remove();
            this.activeIndicators.delete(id);
        }
    }
    
    /**
     * Show a simple loading spinner
     */
    showSpinner(message = 'Loading...') {
        // Use existing loading overlay
        showLoading(message);
    }
    
    /**
     * Hide loading spinner
     */
    hideSpinner() {
        hideLoading();
    }
}

// Create global progress indicator instance
window.progressIndicator = new ProgressIndicator();