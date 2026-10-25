//! Locks that survive a panic. A `Mutex` or `RwLock` whose holder panicked is "poisoned", and unwrapping its `lock()`
//! then panics in every later caller, turning one failure into a dead app. The data behind these locks stays
//! consistent between statements, so the guard is taken back instead.
use std::sync::{Mutex, MutexGuard, RwLock, RwLockReadGuard, RwLockWriteGuard};

pub trait LockExt<T: ?Sized> {
    fn lock_safe(&self) -> MutexGuard<'_, T>;
}

impl<T: ?Sized> LockExt<T> for Mutex<T> {
    fn lock_safe(&self) -> MutexGuard<'_, T> {
        self.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

pub trait RwLockExt<T: ?Sized> {
    fn read_safe(&self) -> RwLockReadGuard<'_, T>;
    fn write_safe(&self) -> RwLockWriteGuard<'_, T>;
}

impl<T: ?Sized> RwLockExt<T> for RwLock<T> {
    fn read_safe(&self) -> RwLockReadGuard<'_, T> {
        self.read().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn write_safe(&self) -> RwLockWriteGuard<'_, T> {
        self.write()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    #[test]
    fn a_poisoned_mutex_is_still_usable() {
        let m = Arc::new(Mutex::new(1));
        let held = m.clone();
        let _ = std::thread::spawn(move || {
            let _guard = held.lock().unwrap();
            panic!("boom");
        })
        .join();
        assert!(m.is_poisoned());
        *m.lock_safe() += 1;
        assert_eq!(*m.lock_safe(), 2);
    }

    #[test]
    fn a_poisoned_rwlock_is_still_usable() {
        let l = Arc::new(RwLock::new(String::from("a")));
        let held = l.clone();
        let _ = std::thread::spawn(move || {
            let _guard = held.write().unwrap();
            panic!("boom");
        })
        .join();
        l.write_safe().push('b');
        assert_eq!(*l.read_safe(), "ab");
    }
}
