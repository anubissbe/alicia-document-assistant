/**
 * Theme Manager for Dark Mode Support
 */
class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'light';
        this.init();
    }
    
    init() {
        // Apply saved theme
        this.applyTheme(this.theme);
        
        // Add theme toggle button
        this.addThemeToggle();
        
        // Listen for system theme changes
        if (window.matchMedia) {
            const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
            darkModeQuery.addListener((e) => {
                if (!localStorage.getItem('theme')) {
                    this.applyTheme(e.matches ? 'dark' : 'light');
                }
            });
            
            // Apply system theme if no preference saved
            if (!localStorage.getItem('theme')) {
                this.theme = darkModeQuery.matches ? 'dark' : 'light';
                this.applyTheme(this.theme);
            }
        }
    }
    
    addThemeToggle() {
        const toggle = document.createElement('button');
        toggle.className = 'theme-toggle';
        toggle.id = 'theme-toggle';
        toggle.title = 'Toggle dark mode';
        toggle.innerHTML = this.theme === 'dark' ? '☀️' : '🌙';
        
        const header = document.querySelector('.app-header');
        if (header) {
            header.appendChild(toggle);
            
            toggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
    }
    
    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.applyTheme(this.theme);
        localStorage.setItem('theme', this.theme);
        
        // Update toggle button
        const toggle = document.getElementById('theme-toggle');
        if (toggle) {
            toggle.innerHTML = this.theme === 'dark' ? '☀️' : '🌙';
        }
        
        // Show toast
        if (window.showToast) {
            showToast(`Switched to ${this.theme} mode`, 'info');
        }
    }
    
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update meta theme-color for mobile browsers
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.content = theme === 'dark' ? '#1a1a1a' : '#007acc';
        } else {
            const meta = document.createElement('meta');
            meta.name = 'theme-color';
            meta.content = theme === 'dark' ? '#1a1a1a' : '#007acc';
            document.head.appendChild(meta);
        }
    }
    
    getTheme() {
        return this.theme;
    }
}

// Initialize theme manager
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
});