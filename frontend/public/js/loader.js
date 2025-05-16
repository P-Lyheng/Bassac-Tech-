// loader.js - Add this to your main JS file or create a separate file

/**
 * Global loading system for Bassac Academy
 * Provides consistent loading experience across all pages
 */
const BassacLoader = {
    /**
     * Initialize the loader
     * Call this once when the document is ready
     */
    init: function() {
        // Create loader element if it doesn't exist
        if (!document.querySelector('.page-loader')) {
            const loaderHTML = `
                <div class="page-loader" style="display: none; opacity: 0;">
                    <div class="loader-content">
                        <div class="loader-spinner">
                            <div></div>
                            <div></div>
                            <div></div>
                            <div></div>
                        </div>
                        <div class="loader-text">Loading</div>
                        <div class="loader-subtext">Please wait...</div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('afterbegin', loaderHTML);
        }

        // Hide loader when page is fully loaded
        window.addEventListener('load', function() {
            BassacLoader.hide();
        });

        // Add fade-in-up class to main content containers for smooth animations
        document.querySelectorAll('.main-container, .card, .auth-container').forEach(element => {
            element.classList.add('fade-in-up');
        });

        // Intercept all form submissions to show loader
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', function(e) {
                // Only show loader for forms without 'no-loader' class
                if (!this.classList.contains('no-loader')) {
                    const submitBtn = this.querySelector('button[type="submit"]');
                    const loadingText = submitBtn?.getAttribute('data-loading-text') || 'Processing...';
                    BassacLoader.show(loadingText);
                }
            });
        });

        // Add loading for page navigation
        document.querySelectorAll('a:not([target="_blank"]):not(.no-loader)').forEach(link => {
            link.addEventListener('click', function(e) {
                // Check if it's an internal link (not external, not anchor, not javascript)
                const href = this.getAttribute('href');
                if (href && 
                    href.indexOf('#') !== 0 && 
                    href.indexOf('javascript:') !== 0 && 
                    href.indexOf('tel:') !== 0 && 
                    href.indexOf('mailto:') !== 0) {
                    const loadingText = this.getAttribute('data-loading-text') || 'Loading page...';
                    BassacLoader.show(loadingText);
                }
            });
        });
    },

    /**
     * Show the loader with custom text
     * @param {string} text - Main loading text
     * @param {string} subtext - Optional subtext
     */
    show: function(text = 'Loading...', subtext = 'Please wait...') {
        const pageLoader = document.querySelector('.page-loader');
        if (pageLoader) {
            // Update loader text
            pageLoader.querySelector('.loader-text').textContent = text;
            pageLoader.querySelector('.loader-subtext').textContent = subtext;
            
            // Show loader
            pageLoader.style.display = 'flex';
            // Use setTimeout to ensure the display: flex is applied before changing opacity
            setTimeout(() => {
                pageLoader.style.opacity = '1';
            }, 10);
        }
    },

    /**
     * Hide the loader with a smooth fade effect
     */
    hide: function() {
        const pageLoader = document.querySelector('.page-loader');
        if (pageLoader) {
            pageLoader.style.opacity = '0';
            setTimeout(() => {
                pageLoader.style.display = 'none';
            }, 500); // Match the transition time in CSS
        }
    },

    /**
     * Show a success message within the loader and then redirect
     * @param {string} text - Success message
     * @param {string} url - URL to redirect to
     * @param {number} delay - Delay before redirect in milliseconds
     */
    showSuccessThenRedirect: function(text = 'Success!', url, delay = 1500) {
        // First show the loader with the success message
        this.show(text, 'Redirecting...');
        
        // Change the loader color to indicate success
        const loaderSpinner = document.querySelectorAll('.loader-spinner div');
        loaderSpinner.forEach(div => {
            div.style.backgroundColor = '#28a745'; // Success green color
        });
        
        // Redirect after delay
        setTimeout(() => {
            window.location.href = url;
        }, delay);
    },

    /**
     * Show an error briefly and then hide
     * @param {string} text - Error message
     * @param {number} duration - How long to show the error in milliseconds
     */
    showError: function(text = 'An error occurred', duration = 2000) {
        // Show the error in the loader
        this.show(text, 'Please try again');
        
        // Change the loader color to indicate error
        const loaderSpinner = document.querySelectorAll('.loader-spinner div');
        loaderSpinner.forEach(div => {
            div.style.backgroundColor = '#dc3545'; // Error red color
        });
        
        // Hide after duration
        setTimeout(() => {
            this.hide();
            
            // Reset the color after hiding
            setTimeout(() => {
                loaderSpinner.forEach(div => {
                    div.style.backgroundColor = '';
                });
            }, 500);
        }, duration);
    }
};

// Initialize loader when document is ready
document.addEventListener('DOMContentLoaded', function() {
    BassacLoader.init();
});