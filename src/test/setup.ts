import 'fake-indexeddb/auto';
import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = () => {};

// Ensure React DOM is reset between tests.
afterEach(() => {
  cleanup();
});

