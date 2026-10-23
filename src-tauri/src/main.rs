#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{Manager, PhysicalPosition, State, WebviewWindow, WindowEvent};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct Preferences {
    sound: bool,
    always_on_top: bool,
    position: Option<Position>,
}
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
struct Position { x: i32, y: i32 }
impl Default for Preferences {
    fn default() -> Self { Self { sound: true, always_on_top: true, position: None } }
}
struct Settings { preferences: Mutex<Preferences>, file: PathBuf }

fn write_preferences(settings: &Settings) -> Result<(), String> {
    let preferences = settings.preferences.lock().map_err(|e| e.to_string())?;
    let data = serde_json::to_vec_pretty(&*preferences).map_err(|e| e.to_string())?;
    if let Some(parent) = settings.file.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    let temporary = settings.file.with_extension("tmp");
    fs::write(&temporary, data).map_err(|e| e.to_string())?;
    fs::rename(temporary, &settings.file).map_err(|e| e.to_string())
}
fn read_preferences(file: &std::path::Path) -> Preferences {
    fs::read(file).ok().and_then(|data| serde_json::from_slice(&data).ok()).unwrap_or_default()
}
#[tauri::command]
fn get_preferences(window: WebviewWindow, settings: State<Settings>) -> Result<Preferences, String> {
    let mut value = settings.preferences.lock().map_err(|e| e.to_string())?.clone();
    value.always_on_top = window.is_always_on_top().map_err(|e| e.to_string())?;
    Ok(value)
}
#[tauri::command]
async fn set_preference(window: WebviewWindow, settings: State<'_, Settings>, key: String, value: bool) -> Result<bool, String> {
    let actual = match key.as_str() {
        "sound" => value,
        "alwaysOnTop" => {
            window.set_always_on_top(value).map_err(|e| e.to_string())?;
            std::thread::sleep(std::time::Duration::from_millis(80));
            window.is_always_on_top().map_err(|e| e.to_string())?
        }
        _ => return Err("Unknown preference".into()),
    };
    {
        let mut preferences = settings.preferences.lock().map_err(|e| e.to_string())?;
        if key == "sound" { preferences.sound = actual; } else { preferences.always_on_top = actual; }
    }
    write_preferences(&settings)?;
    Ok(actual)
}
#[tauri::command]
fn minimize_window(window: WebviewWindow) -> Result<(), String> { window.minimize().map_err(|e| e.to_string()) }
#[tauri::command]
fn close_window(window: WebviewWindow) -> Result<(), String> { window.close().map_err(|e| e.to_string()) }
#[tauri::command]
fn drag_window(window: WebviewWindow) -> Result<(), String> { window.start_dragging().map_err(|e| e.to_string()) }
#[tauri::command]
fn show_widget(window: WebviewWindow, app: tauri::AppHandle) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())?;
    // The opt-in probe checks startup on macOS, where WKWebView has no WebDriver.
    if std::env::var("CONCH_STARTUP_PROBE").as_deref() == Ok("1") {
        let clips: Vec<_> = (1..=12).map(|index| {
            let file = format!("assets/audio/answer-{index:02}.mp3");
            let asset = app.asset_resolver().get(file.clone());
            let bytes = asset.as_ref().map(|asset| asset.bytes.len()).unwrap_or(0);
            let mime = asset.as_ref().map(|asset| asset.mime_type.clone()).unwrap_or_default();
            serde_json::json!({ "file": file, "bytes": bytes, "mime": mime })
        }).collect();
        let size = window.inner_size().map_err(|e| e.to_string())?;
        let scale = window.scale_factor().map_err(|e| e.to_string())?;
        let decorated = window.is_decorated().map_err(|e| e.to_string())?;
        let ok = !decorated && clips.iter().all(|clip| clip["bytes"].as_u64().unwrap_or(0) > 1000 && clip["mime"].as_str().unwrap_or("").starts_with("audio/"));
        let report = serde_json::json!({ "ok": ok, "os": std::env::consts::OS, "arch": std::env::consts::ARCH,
            "width": f64::from(size.width) / scale, "height": f64::from(size.height) / scale, "decorated": decorated, "clips": clips });
        let settings = app.state::<Settings>();
        let folder = settings.file.parent().ok_or("Missing settings folder")?;
        fs::create_dir_all(folder).map_err(|e| e.to_string())?;
        fs::write(folder.join("startup-smoke.json"), serde_json::to_vec_pretty(&report).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        app.exit(if ok { 0 } else { 1 });
    }
    Ok(())
}
fn restore_position(window: &WebviewWindow, preferences: &Preferences) -> tauri::Result<()> {
    let size = window.outer_size()?;
    let monitors = window.available_monitors()?;
    let valid = preferences.position.filter(|saved| monitors.iter().any(|monitor| {
        let position = monitor.position(); let screen = monitor.size();
        i64::from(saved.x) >= i64::from(position.x) && i64::from(saved.y) >= i64::from(position.y)
            && i64::from(saved.x) + i64::from(size.width) <= i64::from(position.x) + i64::from(screen.width)
            && i64::from(saved.y) + i64::from(size.height) <= i64::from(position.y) + i64::from(screen.height)
    }));
    if let Some(saved) = valid { window.set_position(PhysicalPosition::new(saved.x, saved.y))?; }
    else if let Some(monitor) = window.primary_monitor()? {
        let origin = monitor.position(); let screen = monitor.size();
        let margin = (20.0 * monitor.scale_factor()) as i32;
        let x = origin.x + (screen.width as i32 - size.width as i32 - margin).max(0);
        let y = origin.y + (screen.height as i32 - size.height as i32 - margin * 4).max(0);
        window.set_position(PhysicalPosition::new(x, y))?;
    }
    Ok(())
}
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize(); let _ = window.show(); let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            let config_dir = std::env::var_os("CONCH_TEST_DATA").map(PathBuf::from).unwrap_or(app.path().app_config_dir()?);
            let file = config_dir.join("preferences.json");
            let mut preferences = read_preferences(&file);
            if !file.exists() && std::env::var_os("CONCH_TEST_DATA").is_none() {
                if let Some(parent) = app.path().config_dir().ok() {
                    for name in ["magic-conch-widget", "Magic Conch"] {
                        let legacy = parent.join(name).join("preferences.json");
                        if legacy.exists() { preferences = read_preferences(&legacy); break; }
                    }
                }
            }
            let window = app.get_webview_window("main").expect("Main window");
            restore_position(&window, &preferences)?;
            window.set_always_on_top(preferences.always_on_top)?;
            app.manage(Settings { preferences: Mutex::new(preferences), file });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let Some(settings) = window.try_state::<Settings>() {
                match event {
                    WindowEvent::Moved(position) => {
                        if let Ok(mut value) = settings.preferences.lock() { value.position = Some(Position { x: position.x, y: position.y }); }
                    }
                    WindowEvent::CloseRequested { .. } => { if let Err(error) = write_preferences(&settings) { eprintln!("Cannot save settings: {error}"); } }
                    _ => {}
                }
            }
        })
        .invoke_handler(tauri::generate_handler![get_preferences, set_preference, minimize_window, close_window, drag_window, show_widget])
        .run(tauri::generate_context!()).expect("Cannot run Magic Conch");
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn defaults_and_legacy_settings_are_compatible() {
        let defaults: Preferences = serde_json::from_str("{}").unwrap();
        assert!(defaults.sound && defaults.always_on_top);
        let saved: Preferences = serde_json::from_str(r#"{"sound":false,"alwaysOnTop":false,"position":{"x":-100,"y":42}}"#).unwrap();
        assert!(!saved.sound && !saved.always_on_top);
        assert_eq!(saved.position.unwrap().x, -100);
        assert!(serde_json::from_str::<Preferences>(r#"{"sound":"yes"}"#).is_err());
    }
}
