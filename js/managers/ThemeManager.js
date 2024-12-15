export class ThemeManager {
    constructor() {
        this.themeToggle = document.getElementById('themeToggle');
        this.themeIcon = this.themeToggle.querySelector('i');
        this.currentTheme = localStorage.getItem('theme') || 'light';
        
        this.init();
    }

    init() {
        // Set initial theme
        this.setTheme(this.currentTheme);
        
        // Add click event listener
        this.themeToggle.addEventListener('click', () => {
            this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
            this.setTheme(this.currentTheme);
        });
    }

    setTheme(theme) {
        // Update HTML data attribute
        document.documentElement.setAttribute('data-bs-theme', theme);
        
        // Update icon
        this.themeIcon.className = theme === 'light' 
            ? 'bi bi-moon-fill'
            : 'bi bi-sun-fill';
        
        // Store preference
        localStorage.setItem('theme', theme);
        this.currentTheme = theme;
    }
}
