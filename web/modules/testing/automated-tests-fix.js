/**
 * Automated Tests Tab Fix
 * Ensures the automated tests tab in the testing modal works properly.
 * Fixes class issues, missing emojis, and structural problems.
 *
 * @module testing/automated-tests-fix
 * @description DOM fix script that runs on DOMContentLoaded
 */

document.addEventListener('DOMContentLoaded', function() {
    // Wait for everything to load
    setTimeout(function() {
        // Fix the automated tests tab if it has issues
        const automatedTestsTab = document.getElementById('automated-tests-tab');
        if (automatedTestsTab) {
            console.log('🔧 Checking automated tests tab...');
            
            // Ensure it has the correct class
            if (!automatedTestsTab.classList.contains('testing-tab-content')) {
                automatedTestsTab.classList.add('testing-tab-content');
            }
            
            // Check if it's properly structured
            const sections = automatedTestsTab.querySelectorAll('.testing-section');
            console.log(`Found ${sections.length} testing sections in automated tests tab`);
            
            // Fix any missing emojis in headers
            const headers = automatedTestsTab.querySelectorAll('h3');
            headers.forEach(header => {
                const text = header.textContent.trim();
                
                // Fix known emoji issues
                if (text.includes('Analytics & Stats') && !text.includes('📊')) {
                    header.textContent = '📊 Analytics & Stats';
                }
                if (text.includes('Recurring Features') && !text.includes('🔁')) {
                    header.textContent = '🔁 Recurring Features';
                }
            });
            
            // Fix any missing emojis in buttons
            const buttons = automatedTestsTab.querySelectorAll('button');
            buttons.forEach(button => {
                const text = button.textContent.trim();
                
                // Fix Console Capture button
                if (text.includes('Console Capture') && !text.includes('🔍')) {
                    button.innerHTML = button.innerHTML.replace(/.*Console Capture/, '🔍 Console Capture');
                }
                // Fix Recurring Integration button
                if (text.includes('Recurring Integration') && !text.includes('🔗')) {
                    button.innerHTML = button.innerHTML.replace(/.*Recurring Integration/, '🔗 Recurring Integration');
                }
                // Fix Stats Panel button
                if (text.includes('Stats Panel') && !text.includes('📊')) {
                    button.innerHTML = button.innerHTML.replace(/.*Stats Panel/, '📊 Stats Panel');
                }
            });
            
            console.log('✅ Automated tests tab structure verified');
        }
        
        // Ensure tab switching works properly
        const automatedTestsTabButton = document.querySelector('[data-tab="automated-tests"]');
        if (automatedTestsTabButton) {
            console.log('🔧 Setting up automated tests tab button...');
            
            // Remove any existing listeners and add a fresh one
            const newButton = automatedTestsTabButton.cloneNode(true);
            automatedTestsTabButton.parentNode.replaceChild(newButton, automatedTestsTabButton);
            
            newButton.addEventListener('click', function() {
                console.log('🧪 Automated tests tab clicked');
                
                // Remove active from all tabs
                document.querySelectorAll('.testing-tab').forEach(tab => {
                    tab.classList.remove('active');
                });
                document.querySelectorAll('.testing-tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                // Add active to this tab
                newButton.classList.add('active');
                const automatedContent = document.getElementById('automated-tests-tab');
                if (automatedContent) {
                    automatedContent.classList.add('active');
                    console.log('✅ Automated tests tab activated');
                } else {
                    console.error('❌ Automated tests tab content not found');
                }
            });
            
            console.log('✅ Automated tests tab button fixed');
        } else {
            console.error('❌ Automated tests tab button not found');
        }
    }, 2000);
});

console.log('🔧 Automated tests tab fix script loaded');