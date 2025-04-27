import { LLMError } from './llmClient';

/**
 * Extracts a JSON object from a string using multiple methods.
 * Tries in order:
 * 1. Direct JSON.parse
 * 2. Simple regex for basic JSON objects
 * 3. Bracket counting for complex cases
 */
export function extractJsonObject(str: string): string {
  // Try direct parse first
  try {
    JSON.parse(str);
    return str;
  } catch {
    // Continue to other methods
  }

  // Try simple regex for basic JSON objects
  const simpleMatch = str.match(/{[\s\S]*}/);
  if (simpleMatch) {
    try {
      JSON.parse(simpleMatch[0]);
      return simpleMatch[0];
    } catch {
      // Continue to bracket counting
    }
  }

  // Use bracket counting for complex cases
  return extractJsonWithBracketCounting(str);
}

/**
 * Extracts a JSON object using bracket counting, which can handle:
 * - JSON wrapped in code fences
 * - JSON with comments
 * - JSON with escaped characters
 * - JSON in the middle of other text
 */
function extractJsonWithBracketCounting(str: string): string {
  let inString = false;
  let escapeNext = false;
  let braceCount = 0;
  let start = -1;
  let end = -1;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    // Handle string literals
    if (char === '"' && !escapeNext) {
      inString = !inString;
    }

    // Handle escape sequences
    if (char === '\\' && !escapeNext) {
      escapeNext = true;
      continue;
    }
    escapeNext = false;

    // Count braces when not in a string
    if (!inString) {
      if (char === '{') {
        if (braceCount === 0) {
          start = i;
        }
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          end = i;
          break;
        }
      }
    }
  }

  if (start === -1) {
    throw new LLMError(`No JSON object start found in response: ${str}`, 'INVALID_JSON');
  }

  if (end === -1) {
    throw new LLMError(`No matching closing brace found in response: ${str}`, 'INVALID_JSON');
  }

  const extracted = str.slice(start, end + 1);
  
  // Validate the extracted JSON
  try {
    JSON.parse(extracted);
    return extracted;
  } catch (error) {
    throw new LLMError(
      `Extracted text is not valid JSON: ${extracted}`,
      'INVALID_JSON'
    );
  }
} 