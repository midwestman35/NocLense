use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use keyring::Entry;
use tauri::command;

const INDEX_KEY: &str = "__index__";
const KEYRING_AVAILABILITY_SERVICE: &str = "com.axon.noclense";
const LEGACY_SECURE_STORE_FILE: &str = "noclense-secure-store.json";

fn index_entry(service: &str) -> Result<Entry, String> {
    Entry::new(service, INDEX_KEY).map_err(|error| error.to_string())
}

fn parse_index(raw: &str) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut keys = Vec::new();

    for key in raw.split(',') {
        let trimmed = key.trim();
        if trimmed.is_empty() || trimmed == INDEX_KEY {
            continue;
        }

        if seen.insert(trimmed.to_string()) {
            keys.push(trimmed.to_string());
        }
    }

    keys
}

fn load_index(service: &str) -> Result<Vec<String>, String> {
    let entry = index_entry(service)?;
    match entry.get_password() {
        Ok(raw) => Ok(parse_index(&raw)),
        Err(keyring::Error::NoEntry) => Ok(Vec::new()),
        Err(error) => Err(error.to_string()),
    }
}

fn save_index(service: &str, keys: &[String]) -> Result<(), String> {
    let entry = index_entry(service)?;
    if keys.is_empty() {
        return match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(error.to_string()),
        };
    }

    entry
        .set_password(&keys.join(","))
        .map_err(|error| error.to_string())
}

fn update_index(service: &str, key: &str, add: bool) -> Result<(), String> {
    let mut keys = load_index(service)?;

    if add {
        if !keys.iter().any(|existing| existing == key) {
            keys.push(key.to_string());
        }
    } else {
        keys.retain(|existing| existing != key);
    }

    save_index(service, &keys)
}

#[command]
pub fn keyring_get(service: String, key: String) -> Result<Option<String>, String> {
    let entry = Entry::new(&service, &key).map_err(|error| error.to_string())?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[command]
pub fn keyring_set(service: String, key: String, value: String) -> Result<(), String> {
    let entry = Entry::new(&service, &key).map_err(|error| error.to_string())?;
    entry
        .set_password(&value)
        .map_err(|error| error.to_string())?;
    update_index(&service, &key, true)
}

#[command]
pub fn keyring_delete(service: String, key: String) -> Result<(), String> {
    let entry = Entry::new(&service, &key).map_err(|error| error.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => {
            update_index(&service, &key, false)?;
            Ok(())
        }
        Err(error) => Err(error.to_string()),
    }
}

#[command]
pub fn keyring_list(service: String) -> Result<Vec<String>, String> {
    let indexed = load_index(&service)?;
    let mut valid = Vec::new();

    for key in indexed {
        let entry = Entry::new(&service, &key).map_err(|error| error.to_string())?;
        match entry.get_password() {
            Ok(_) => valid.push(key),
            Err(keyring::Error::NoEntry) => {}
            Err(error) => return Err(error.to_string()),
        }
    }

    if valid != load_index(&service)? {
        save_index(&service, &valid)?;
    }

    Ok(valid)
}

#[command]
pub fn keyring_is_available() -> bool {
    let entry = match Entry::new(KEYRING_AVAILABILITY_SERVICE, INDEX_KEY) {
        Ok(entry) => entry,
        Err(_) => return false,
    };

    matches!(entry.get_password(), Ok(_) | Err(keyring::Error::NoEntry))
}

#[cfg(target_os = "windows")]
fn legacy_secure_store_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Some(appdata) = std::env::var_os("APPDATA") {
        let appdata = PathBuf::from(appdata);
        for dir_name in ["logscrub", "NocLense", "noclense"] {
            candidates.push(appdata.join(dir_name).join(LEGACY_SECURE_STORE_FILE));
        }
    }

    candidates
}

#[cfg(not(target_os = "windows"))]
fn legacy_secure_store_candidates() -> Vec<PathBuf> {
    Vec::new()
}

fn read_legacy_secure_store() -> Result<HashMap<String, String>, String> {
    let store_path = legacy_secure_store_candidates()
        .into_iter()
        .find(|candidate| candidate.exists());

    let Some(store_path) = store_path else {
        return Ok(HashMap::new());
    };

    let raw = fs::read_to_string(store_path).map_err(|error| error.to_string())?;
    if raw.trim().is_empty() {
        return Ok(HashMap::new());
    }

    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

#[cfg(target_os = "windows")]
fn decrypt_legacy_value(encrypted: &[u8]) -> Result<Vec<u8>, String> {
    use std::io::Error;
    use std::ptr::null;

    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{CryptUnprotectData, CRYPT_INTEGER_BLOB};

    let input = CRYPT_INTEGER_BLOB {
        cbData: encrypted.len() as u32,
        pbData: encrypted.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };

    let status = unsafe {
        CryptUnprotectData(
            &input,
            std::ptr::null_mut(),
            std::ptr::null(),
            null(),
            std::ptr::null(),
            0,
            &mut output,
        )
    };

    if status == 0 {
        return Err(Error::last_os_error().to_string());
    }

    let decrypted = unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize) }.to_vec();
    unsafe {
        let _ = LocalFree(output.pbData.cast());
    }
    Ok(decrypted)
}

#[cfg(not(target_os = "windows"))]
fn decrypt_legacy_value(_encrypted: &[u8]) -> Result<Vec<u8>, String> {
    Err("Electron safeStorage migration is only implemented on Windows in this slice.".to_string())
}

#[command]
pub fn legacy_secure_storage_read(keys: Vec<String>) -> Result<HashMap<String, String>, String> {
    if keys.is_empty() {
        return Ok(HashMap::new());
    }

    let store = read_legacy_secure_store()?;
    let mut values = HashMap::new();

    for key in keys {
        let Some(encoded) = store.get(&key) else {
            continue;
        };

        let encrypted = BASE64.decode(encoded).map_err(|error| error.to_string())?;
        let decrypted = decrypt_legacy_value(&encrypted)?;
        let value = String::from_utf8(decrypted).map_err(|error| error.to_string())?;
        values.insert(key, value);
    }

    Ok(values)
}

#[cfg(test)]
mod tests {
    use super::parse_index;

    #[test]
    fn parse_index_trims_and_dedupes_keys() {
        assert_eq!(
            parse_index(" gemini,claude,,gemini,__index__,codex "),
            vec!["gemini".to_string(), "claude".to_string(), "codex".to_string()]
        );
    }
}
