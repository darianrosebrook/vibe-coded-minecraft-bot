// Script to fix override modifiers in task files
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Properties and methods that should have override modifiers if they exist in BaseTask
const baseTaskMembers = [
  'bot',
  'commandHandler', 
  'options',
  'taskId',
  'totalProgress',
  'currentProgress',
  'progressSteps',
  'currentStep',
  'startTime',
  'endTime',
  'status',
  'estimatedTimeRemaining',
  'lastProgressUpdate',
  'progressHistory',
  'currentLocation',
  'errorCount',
  'retryCount',
  'maxRetries',
  'storage',
  'errorHandler',
  'error',
  'stopRequested',
  'stateManager',
  'worldTracker',
  'dataCollector',
  'trainingStorage',
  'useML',
  'radius',
  'isStopped',
  'progress',
  'mineflayerBot',
  'execute',
  'validateTask',
  'initializeProgress',
  'performTask',
  'updateProgress',
  'shouldRetry',
  'retry',
  'handleError',
  'completeTask',
  'incrementProgress',
  'setProgressSteps',
  'checkTimeout',
  'getCurrentPosition',
  'stop',
  'navigateTo',
  'ensureTool',
  'getTaskSpecificState',
  'updateMLState',
  'initializeMLState',
  'calculateEfficiency',
  'collectTrainingData'
];

// Functions that require null safety checks for waypoints
const waypointFunctions = [
  'calculatePathDistance'
];

function addOverrideModifiers(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Add override modifiers to class members
    for (const member of baseTaskMembers) {
      // Match member declaration without override keyword
      const regex = new RegExp(`(protected|public|private)\\s+(readonly\\s+)?(${member})\\s*:`, 'g');
      if (content.match(regex)) {
        content = content.replace(regex, (match, visibility, readonly, name) => {
          return `${visibility} override ${readonly || ''}${name}:`;
        });
        modified = true;
      }
    }
    
    // Fix path distance calculations to handle null/undefined
    for (const funcName of waypointFunctions) {
      const pathDistanceRegex = new RegExp(`(${funcName}\\s*\\(.*?\\)\\s*{[\\s\\S]*?)(for\\s*\\([^{]*?\\{[\\s\\S]*?distanceTo\\([^)]*?\\)[\\s\\S]*?\\})`, 'g');
      const match = pathDistanceRegex.exec(content);
      
      if (match) {
        const origForLoop = match[2];
        if (!origForLoop.includes('if (prev && current)')) {
          // Extract waypoints variable if it exists
          const waypointsVarMatch = /const\s+(\w+)\s*=\s*[^;]+;/.exec(match[1]);
          let waypointsVar;
          
          if (waypointsVarMatch) {
            waypointsVar = waypointsVarMatch[1];
          } else {
            // If no waypoints variable exists, we need to add one
            const arrayMatch = /for\s*\(\s*let\s+\w+\s*=\s*\d+\s*;\s*\w+\s*<\s*([^;]+)\.length/.exec(origForLoop);
            if (arrayMatch) {
              waypointsVar = 'waypoints';
              content = content.replace(
                pathDistanceRegex, 
                (match, start, forLoop) => `${start}\n    const ${waypointsVar} = ${arrayMatch[1]};\n    ${forLoop.replace(arrayMatch[1], waypointsVar)}`
              );
              modified = true;
            }
          }
          
          // Add null check for waypoints
          if (waypointsVar) {
            content = content.replace(
              /const\s+prev\s*=\s*([^;]+);\s*const\s+current\s*=\s*([^;]+);(\s*)distance\s*\+=\s*prev\.distanceTo\(current\);/g,
              `const prev = $1;\n      const current = $2;\n      \n      if (prev && current) {$3  distance += prev.distanceTo(current);\n      }`
            );
            modified = true;
          }
        }
      }
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

// Find all task files
const taskFiles = glob.sync('src/tasks/*.ts');
let updatedFiles = 0;

for (const file of taskFiles) {
  if (addOverrideModifiers(file)) {
    updatedFiles++;
  }
}

console.log(`\nDone! Updated ${updatedFiles} files.`); 