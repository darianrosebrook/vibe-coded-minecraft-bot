import { ErrorMessageFormatter } from '../message_templates';
import { ParsingErrorType } from '../parsingErrorHandler';
import { Task } from '../../../types/task';

describe('ErrorMessageFormatter', () => {
  describe('formatMessage', () => {
    it('should format invalid command error with suggestions', () => {
      const message = ErrorMessageFormatter.formatMessage('INVALID_COMMAND', {
        command: '.bot mine diamond'
      });

      expect(message).toContain('[Command Not Recognized]');
      expect(message).toContain('I couldn\'t understand your command');
      expect(message).toContain('Suggestions:');
      expect(message).toContain('Check for typos or missing words');
    });

    it('should include validation errors when present', () => {
      const message = ErrorMessageFormatter.formatMessage('SCHEMA_VALIDATION_ERROR', {
        command: '.bot craft',
        validationErrors: ['Missing required parameter: itemType']
      });

      expect(message).toContain('[Validation Error]');
      expect(message).toContain('Validation Errors:');
      expect(message).toContain('Missing required parameter: itemType');
    });

    it('should include command in the message', () => {
      const message = ErrorMessageFormatter.formatMessage('INVALID_COMMAND', {
        command: '.bot mine diamond'
      });

      expect(message).toContain('Command: .bot mine diamond');
    });
  });

  describe('getRecoverySteps', () => {
    it('should return recovery steps for invalid command', () => {
      const steps = ErrorMessageFormatter.getRecoverySteps('INVALID_COMMAND');
      expect(steps).toContain('Check for typos or missing words');
      expect(steps).toContain('Use simpler language');
    });

    it('should return empty array for unknown error type', () => {
      const steps = ErrorMessageFormatter.getRecoverySteps('UNKNOWN_ERROR' as ParsingErrorType);
      expect(steps).toEqual([]);
    });
  });

  describe('getDetailedExplanation', () => {
    it('should include task details when present', () => {
      const task: Partial<Task> = {
        type: 'mining',
        parameters: {
          blockType: 'diamond_ore',
          count: 5
        }
      };

      const explanation = ErrorMessageFormatter.getDetailedExplanation('CONTEXT_MISMATCH', {
        task
      });

      expect(explanation).toContain('Task Details:');
      expect(explanation).toContain('Type: mining');
      expect(explanation).toContain('"blockType": "diamond_ore"');
    });

    it('should include validation errors when present', () => {
      const explanation = ErrorMessageFormatter.getDetailedExplanation('SCHEMA_VALIDATION_ERROR', {
        validationErrors: ['Invalid parameter: count must be positive']
      });

      expect(explanation).toContain('Validation Errors:');
      expect(explanation).toContain('Invalid parameter: count must be positive');
    });
  });
}); 