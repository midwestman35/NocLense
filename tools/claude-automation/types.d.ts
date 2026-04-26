declare global {
  namespace WebdriverIO {
    interface Capabilities {
      'tauri:options'?: {
        application: string;
      };
    }
  }
}

export {};
