
/**
 * Chat ML State
 * 
 * This interface defines the structure of the chat state for the chat task.
 * It includes the state of the chat, the message, and the performance metrics.
 */
export interface ChatMLState {
  chatState: {
    messageCount: number;
    uniqueSenders: number;
    efficiency: number;
  };
  message: {
    content: string;
    chatType: string;
    success: boolean;
    timeTaken: number;
  };
} 