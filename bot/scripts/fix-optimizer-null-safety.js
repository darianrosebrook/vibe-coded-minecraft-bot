// Script to fix null safety issues in optimizer files
const fs = require('fs');
const path = require('path');
const glob = require('glob');

function fixOptimizerFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Fix non-null assertions
    // Replace pattern!.property with pattern?.property ?? fallback
    const nonNullAssertionRegex = /(\w+)!\.(\w+)/g;
    if (content.match(nonNullAssertionRegex)) {
      content = content.replace(nonNullAssertionRegex, (match, obj, prop) => {
        // Determine appropriate fallback based on property name
        let fallback = '0';
        if (prop.includes('positions') || prop.includes('waypoints')) {
          fallback = '[]';
        } else if (prop.includes('type') || prop.includes('name')) {
          fallback = '""';
        }
        return `${obj}?.${prop} ?? ${fallback}`;
      });
      modified = true;
    }
    
    // Fix array access without null checks
    // Replace array[index] with array[index] ?? fallback where array might be undefined
    const arrayAccessRegex = /(\w+)\.(\w+)\.(\w+)\[(\w+)\]/g;
    if (content.match(arrayAccessRegex)) {
      content = content.replace(arrayAccessRegex, (match, obj, prop1, prop2, index) => {
        if (prop2.includes('positions') || prop2.includes('waypoints') || 
            prop2.includes('growth') || prop2.includes('quantities')) {
          return `${obj}.${prop1}.${prop2}[${index}] ?? 0`;
        }
        return match;
      });
      modified = true;
    }
    
    // Fix path distance calculations
    const pathDistanceRegex = /private\s+calculatePathDistance\s*\(.*?\)\s*{[\s\S]*?return\s+distance;[\s\S]*?}/g;
    if (content.match(pathDistanceRegex)) {
      content = content.replace(pathDistanceRegex, (match) => {
        if (!match.includes('if (path[i] && path[i-1])')) {
          return match.replace(
            /for\s*\(\s*let\s+i\s*=\s*1\s*;\s*i\s*<\s*path\.length\s*;\s*i\+\+\s*\)\s*{[\s\S]*?distance\s*\+=\s*path\[i\]\.distanceTo\(path\[i-1\]\);[\s\S]*?}/,
            `for (let i = 1; i < path.length; i++) {
      if (path[i] && path[i-1]) {
        distance += path[i].distanceTo(path[i-1]);
      }
    }`
          );
        }
        return match;
      });
      modified = true;
    }
    
    // Fix sort functions
    const sortFunctionRegex = /\.sort\(\(([a-z]),\s*([a-z])\)\s*=>\s*\{[\s\S]*?return[\s\S]*?\}\)/g;
    if (content.match(sortFunctionRegex)) {
      content = content.replace(sortFunctionRegex, (match, paramA, paramB) => {
        if (!match.includes(`if (!${paramA} || !${paramB})`)) {
          return match.replace(
            /return\s+([^;]+);/,
            `if (!${paramA} || !${paramB}) return 0;
      return $1;`
          );
        }
        return match;
      });
      modified = true;
    }
    
    // Save modified file
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${path.basename(filePath)}`);
    }
    
    return modified;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return false;
  }
}

// Find all optimizer files
const optimizerFiles = [
  ...glob.sync('src/ml/**/farming_optimizer.ts'),
  ...glob.sync('src/ml/**/miningOptimizer.ts'),
  ...glob.sync('src/ml/**/explorationOptimizer.ts'),
  ...glob.sync('src/ml/**/redstoneOptimizer.ts')
];

let updatedFiles = 0;

for (const file of optimizerFiles) {
  if (fixOptimizerFile(file)) {
    updatedFiles++;
  }
}

console.log(`\nDone! Updated ${updatedFiles} optimizer files.`); 