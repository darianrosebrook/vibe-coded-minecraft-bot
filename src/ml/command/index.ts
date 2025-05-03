/**
 * Command Module
 * 
 * This module contains components for processing and recognizing command patterns,
 * generating responses, and handling errors in the Minecraft bot's command system.
 */

// Export pattern recognition system
export { PatternRecognitionSystem } from './pattern_recognition';

// Export pattern helpers
export {
  createDefaultCommandContext,
  createCommandPattern,
  getPatternConfidence,
  updatePatternConfidence,
  applyConfidenceDecay, 
} from './pattern_helpers';

// Export pattern store
export { PatternStore, patternStore } from './pattern_store';

// Export pattern factory
export { PatternFactory, createPatternSystem } from './pattern_factory';

// Export response generator
export { MLResponseGeneratorImpl } from './response_generator';

// Export error handler
export { MLErrorHandlerImpl } from './error_handler';

// Export parser
export { MLCommandParserImpl } from './parser';

// Export types
export * from './types'; 