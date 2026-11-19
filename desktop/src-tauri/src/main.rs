#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod library;
mod mind_runtime;

use mind_runtime::MindRuntimeManager;
use tauri::Manager;

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(MindRuntimeManager::default())
        .setup(|app| {
            let directory = app.path().app_data_dir()?.join("library");
            std::fs::create_dir_all(&directory)?;
            app.manage(library::LibraryManager::new(
                directory.join("library.sqlite"),
            ));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            library::library_overview,
            library::library_add_paths,
            library::library_refresh,
            library::library_cancel,
            library::library_progress,
            library::library_documents,
            library::library_document,
            library::library_reader,
            library::library_passages,
            library::library_search,
            library::library_snapshots,
            library::library_save_note,
            library::library_delete_note,
            library::library_remove_root,
            library::library_clear,
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
            app_handle.state::<library::LibraryManager>().cancel();
        }
    });
}
