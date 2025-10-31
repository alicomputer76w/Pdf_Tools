const fs = require('fs');
const path = require('path');

function checkSyntax(filePath) {
    console.log(`\n=== Checking ${filePath} ===`);
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        console.log(`File has ${lines.length} lines`);
        
        // Try to parse the entire file
        try {
            new Function(content);
            console.log('✅ Overall syntax is valid');
        } catch (error) {
            console.log('❌ Syntax error found:', error.message);
            
            // Try to find the problematic line
            if (error.message.includes('line')) {
                const lineMatch = error.message.match(/line (\d+)/);
                if (lineMatch) {
                    const lineNum = parseInt(lineMatch[1]);
                    console.log(`Problem around line ${lineNum}:`);
                    console.log(`${lineNum - 1}: ${lines[lineNum - 2] || ''}`);
                    console.log(`${lineNum}: ${lines[lineNum - 1] || ''}`);
                    console.log(`${lineNum + 1}: ${lines[lineNum] || ''}`);
                }
            }
            
            // Check for common issues
            console.log('\n--- Checking for common issues ---');
            
            // Check for unmatched parentheses
            let parenCount = 0;
            let braceCount = 0;
            let bracketCount = 0;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                // Count parentheses
                for (const char of line) {
                    if (char === '(') parenCount++;
                    if (char === ')') parenCount--;
                    if (char === '{') braceCount++;
                    if (char === '}') braceCount--;
                    if (char === '[') bracketCount++;
                    if (char === ']') bracketCount--;
                }
                
                // Check for problematic patterns
                if (line.includes('PDFLib.') && !line.includes('window.PDFLib.')) {
                    console.log(`⚠️  Line ${i + 1}: Possible PDFLib reference issue: ${line.trim()}`);
                }
                
                // Check for incomplete function calls
                if (line.includes('(') && !line.includes(')') && line.trim().endsWith(',')) {
                    console.log(`⚠️  Line ${i + 1}: Possible incomplete function call: ${line.trim()}`);
                }
            }
            
            console.log(`Final counts - Parentheses: ${parenCount}, Braces: ${braceCount}, Brackets: ${bracketCount}`);
            
            if (parenCount !== 0) console.log(`❌ Unmatched parentheses: ${parenCount}`);
            if (braceCount !== 0) console.log(`❌ Unmatched braces: ${braceCount}`);
            if (bracketCount !== 0) console.log(`❌ Unmatched brackets: ${bracketCount}`);
        }
        
    } catch (error) {
        console.log('❌ Failed to read file:', error.message);
    }
}

// Check the main files
const filesToCheck = [
    'js/utils.js',
    'js/tools.js'
];

filesToCheck.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
        checkSyntax(fullPath);
    } else {
        console.log(`❌ File not found: ${fullPath}`);
    }
});