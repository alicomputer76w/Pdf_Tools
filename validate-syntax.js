const fs = require('fs');
const path = require('path');

// List of JavaScript files to validate
const jsFiles = [
    'js/utils.js',
    'js/error-handler.js',
    'js/accessibility.js',
    'js/drag-drop.js',
    'js/performance.js',
    'js/components.js',
    'js/tools.js',
    'js/tools-rebuild.js',
    'js/app.js'
];

function validateJavaScript(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Try to parse the JavaScript using Function constructor
        // This will catch most syntax errors
        new Function(content);
        
        console.log(`✅ ${filePath}: Syntax is valid`);
        return true;
    } catch (error) {
        console.log(`❌ ${filePath}: Syntax error found`);
        console.log(`   Error: ${error.message}`);
        
        // Try to extract line number from error message
        const lineMatch = error.message.match(/line (\d+)/i);
        if (lineMatch) {
            const lineNum = parseInt(lineMatch[1]);
            console.log(`   Line ${lineNum}: Check this line for syntax issues`);
        }
        
        return false;
    }
}

function main() {
    console.log('🔍 Validating JavaScript syntax...\n');
    
    let hasErrors = false;
    
    for (const file of jsFiles) {
        const fullPath = path.join(__dirname, file);
        
        if (!fs.existsSync(fullPath)) {
            console.log(`⚠️  ${file}: File not found`);
            continue;
        }
        
        const isValid = validateJavaScript(fullPath);
        if (!isValid) {
            hasErrors = true;
        }
    }
    
    console.log('\n' + '='.repeat(50));
    
    if (hasErrors) {
        console.log('❌ Syntax errors found in one or more files');
        process.exit(1);
    } else {
        console.log('✅ All JavaScript files have valid syntax');
        process.exit(0);
    }
}

main();