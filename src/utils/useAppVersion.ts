import { useEffect, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import packageJson from '../../package.json';

const FALLBACK_APP_VERSION = packageJson.version;

export function useAppVersion(): string {
  const [appVersion, setAppVersion] = useState(FALLBACK_APP_VERSION);

  useEffect(() => {
    let cancelled = false;

    const loadVersion = async (): Promise<void> => {
      try {
        const runtimeVersion = await getVersion();
        if (!cancelled && runtimeVersion) {
          setAppVersion(runtimeVersion);
        }
      } catch {
        if (!cancelled) {
          setAppVersion(FALLBACK_APP_VERSION);
        }
      }
    };

    void loadVersion();

    return () => {
      cancelled = true;
    };
  }, []);

  return appVersion;
}
