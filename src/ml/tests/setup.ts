import { beforeAll, afterAll } from '@jest/globals';
import * as tf from '@tensorflow/tfjs-node';
import '@tensorflow/tfjs-backend-wasm';

// Initialize TensorFlow.js
beforeAll(async () => {
  await tf.setBackend('wasm');
  await tf.ready();
});

// Clean up TensorFlow.js resources after tests
afterAll(async () => {
  await tf.disposeVariables();
}); 