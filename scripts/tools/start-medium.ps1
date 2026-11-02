# Starts `cmd.exe /d /c "$env:SMOKE_SCRIPT"` with this process's token lowered to a normal user's: the administrators'
# group made deny-only (SAFER, the level runas /trustlevel:0x20000 uses) and the integrity level set to Medium, which
# runas leaves at High. Used by scripts/tools/release-smoke.mjs on the GitHub runner only, where the job is elevated and
# WebView2 opens no debugging port for an elevated app. The child inherits this process's environment. Prints the pid.
$ErrorActionPreference = 'Stop'
if (-not $env:SMOKE_SCRIPT) { throw 'SMOKE_SCRIPT is not set' }

Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class MediumStart {
  [StructLayout(LayoutKind.Sequential)] struct SID_AND_ATTRIBUTES { public IntPtr Sid; public uint Attributes; }
  [StructLayout(LayoutKind.Sequential)] struct TOKEN_MANDATORY_LABEL { public SID_AND_ATTRIBUTES Label; }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct STARTUPINFO {
    public int cb; public string lpReserved; public string lpDesktop; public string lpTitle;
    public int dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
    public short wShowWindow, cbReserved2; public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
  }
  [StructLayout(LayoutKind.Sequential)] struct PROCESS_INFORMATION { public IntPtr hProcess, hThread; public int dwProcessId, dwThreadId; }

  [DllImport("advapi32.dll", SetLastError = true)] static extern bool SaferCreateLevel(uint scope, uint level, uint flags, out IntPtr handle, IntPtr reserved);
  [DllImport("advapi32.dll", SetLastError = true)] static extern bool SaferComputeTokenFromLevel(IntPtr level, IntPtr inToken, out IntPtr outToken, uint flags, IntPtr reserved);
  [DllImport("advapi32.dll", SetLastError = true)] static extern bool SaferCloseLevel(IntPtr level);
  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool ConvertStringSidToSid(string sid, out IntPtr psid);
  [DllImport("advapi32.dll", SetLastError = true)] static extern bool SetTokenInformation(IntPtr token, int cls, ref TOKEN_MANDATORY_LABEL info, int length);
  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool CreateProcessAsUser(IntPtr token, string app, string cmd, IntPtr pa, IntPtr ta, bool inherit, uint flags, IntPtr env, string dir, ref STARTUPINFO si, out PROCESS_INFORMATION pi);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr h);

  static void Check(bool ok, string what) { if (!ok) throw new Win32Exception(Marshal.GetLastWin32Error(), what); }

  public static int Start(string app, string cmd, string dir) {
    IntPtr level, token, sid;
    Check(SaferCreateLevel(2 /* SAFER_SCOPEID_USER */, 0x20000 /* SAFER_LEVELID_NORMALUSER */, 1 /* SAFER_LEVEL_OPEN */, out level, IntPtr.Zero), "SaferCreateLevel");
    try {
      Check(SaferComputeTokenFromLevel(level, IntPtr.Zero, out token, 0, IntPtr.Zero), "SaferComputeTokenFromLevel");
    } finally { SaferCloseLevel(level); }
    try {
      Check(ConvertStringSidToSid("S-1-16-8192" /* Medium */, out sid), "ConvertStringSidToSid");
      try {
        var label = new TOKEN_MANDATORY_LABEL { Label = new SID_AND_ATTRIBUTES { Sid = sid, Attributes = 0x20 /* SE_GROUP_INTEGRITY */ } };
        Check(SetTokenInformation(token, 25 /* TokenIntegrityLevel */, ref label, Marshal.SizeOf(label)), "SetTokenInformation");
      } finally { LocalFree(sid); }
      var si = new STARTUPINFO(); si.cb = Marshal.SizeOf(si);
      PROCESS_INFORMATION pi;
      Check(CreateProcessAsUser(token, app, cmd, IntPtr.Zero, IntPtr.Zero, false, 0x08000000 /* CREATE_NO_WINDOW */, IntPtr.Zero, dir, ref si, out pi), "CreateProcessAsUser");
      CloseHandle(pi.hThread); CloseHandle(pi.hProcess);
      return pi.dwProcessId;
    } finally { CloseHandle(token); }
  }
}
'@

$cmd = Join-Path $env:SystemRoot 'System32\cmd.exe'
[MediumStart]::Start($cmd, "`"$cmd`" /d /c `"$env:SMOKE_SCRIPT`"", (Split-Path $env:SMOKE_SCRIPT))
