//! Makes the processes novira starts (ComfyUI, the voice worker) die with the app, even when the app is killed
//! or crashes and never reaches its exit handler. On Windows they join a job object that kills its members when
//! the last handle to it closes, which happens when novira's process ends. Elsewhere this does nothing.

/// Puts the process with this handle into the app's kill-on-close job. Best effort: a failure leaves the
/// process running as before (it is still stopped by the normal exit path).
#[cfg(windows)]
pub fn bind(process: std::os::windows::io::RawHandle) {
    use std::sync::OnceLock;
    use windows_sys::Win32::Foundation::HANDLE;
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };

    static JOB: OnceLock<isize> = OnceLock::new();
    let job = *JOB.get_or_init(|| unsafe {
        let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if job.is_null() {
            return 0;
        }
        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        let ok = SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            std::ptr::addr_of!(info).cast(),
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        );
        if ok == 0 {
            return 0;
        }
        job as isize
    });
    if job != 0 {
        // The job handle is never closed: it lives as long as the app, which is the point.
        unsafe {
            AssignProcessToJobObject(job as HANDLE, process as HANDLE);
        }
    }
}

#[cfg(not(windows))]
pub fn bind<T>(_process: T) {}
