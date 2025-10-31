// Test file to check if tools.js can be loaded
try {
    // Try to load and parse tools.js
    const fs = require('fs');
    const toolsContent = fs.readFileSync('js/tools.js', 'utf8');
    
    // Try to evaluate the content
    eval(toolsContent);
    
    console.log('✓ tools.js syntax is valid');
    console.log('✓ ToolManager class is defined:', typeof ToolManager !== 'undefined');
    
} catch (error) {
    console.error('✗ Error in tools.js:', error.message);
    console.error('Stack:', error.stack);
}