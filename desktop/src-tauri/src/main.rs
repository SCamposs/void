#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod mind_runtime;

use mind_runtime::MindRuntimeManager;
use tauri::Manager;

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(MindRuntimeManager::default())
        .invoke_handler(tauri::generate_handler![
            mind_runtime::mind_validate_runtime,
            mind_runtime::mind_start_runtime,
            mind_runtime::mind_runtime_status,
            mind_runtime::mind_stop_runtime,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if matches!(
            event,
            tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. }
        ) {
            app_handle.state::<MindRuntimeManager>().stop_for_shutdown();
        }
    });
}
