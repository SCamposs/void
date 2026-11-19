pub mod extract;
pub mod index;
pub mod models;
pub mod process;
pub mod storage;

pub type Result<T> = std::result::Result<T, String>;
