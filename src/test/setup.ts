import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Ensure React DOM is reset between tests.
afterEach(() => {
  cleanup();
});

