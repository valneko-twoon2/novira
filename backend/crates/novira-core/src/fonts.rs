//! The font families installed on this computer, for the font lists of the comic's balloons and the text editor.
//!
//! Windows lists each installed font file in the registry, under `SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts`:
//! the machine's key holds the fonts every user has, the user's key the ones installed only for them. A value's name is
//! the font's full name, or several joined by " & ", with its kind in brackets ("Yu Gothic Bold & Yu Gothic UI Bold
//! (TrueType)"). The family is that name without its style words ("Yu Gothic"). Only TrueType and OpenType fonts are taken
//! (the old bitmap fonts cannot be drawn at any size), and vertical variants ("@...") are left out.
//!
//! The names are read with the registry's wide-character API, so names in any script come through as they are. Elsewhere
//! than Windows, and when the registry cannot be read, the list is empty: the screens then offer only the app's own fonts.

/// The most families returned (a computer with very many fonts still gets a list the screens can show).
pub const MAX_FAMILIES: usize = 3000;
/// The longest family name kept, in characters.
pub const MAX_NAME_CHARS: usize = 128;

/// Words that name a style rather than a family, dropped from the end of a full name.
const STYLE_WORDS: &[&str] = &[
    "regular",
    "normal",
    "book",
    "roman",
    "italic",
    "oblique",
    "bold",
    "semibold",
    "demibold",
    "demi",
    "extrabold",
    "ultrabold",
    "heavy",
    "black",
    "medium",
    "light",
    "semilight",
    "extralight",
    "ultralight",
    "thin",
    "hairline",
];

/// The families installed on this computer, sorted, each once.
pub fn installed_families() -> Vec<String> {
    families_from_names(registry_names())
}

/// The families named by the registry's value names (see the module comment), sorted without regard to case, each once.
pub fn families_from_names<I: IntoIterator<Item = String>>(names: I) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for name in names {
        let Some(list) = strip_kind(&name) else {
            continue;
        };
        for full in list.split(" & ") {
            let Some(family) = family_of(full) else {
                continue;
            };
            if seen.insert(family.to_lowercase()) {
                out.push(family);
            }
        }
    }
    out.sort_by_key(|f| f.to_lowercase());
    out.truncate(MAX_FAMILIES);
    out
}

/// The name without its kind in brackets, or None for a font that is neither TrueType nor OpenType.
fn strip_kind(name: &str) -> Option<&str> {
    let name = name.trim();
    let open = name.rfind('(')?;
    let kind = name[open..].to_ascii_lowercase();
    if kind != "(truetype)" && kind != "(opentype)" {
        return None;
    }
    Some(name[..open].trim_end())
}

/// A full name as its family: the style words at its end dropped (one word always stays), or None when nothing usable is left.
fn family_of(full: &str) -> Option<String> {
    let mut words: Vec<&str> = full.split_whitespace().collect();
    while words.len() > 1
        && STYLE_WORDS.contains(&words[words.len() - 1].to_ascii_lowercase().as_str())
    {
        words.pop();
    }
    let family = words.join(" ");
    let usable = !family.is_empty()
        && !family.starts_with('@')
        && family.chars().count() <= MAX_NAME_CHARS
        && !family
            .chars()
            .any(|c| c.is_control() || matches!(c, '"' | '\\' | ';' | '{' | '}'));
    usable.then_some(family)
}

#[cfg(windows)]
fn registry_names() -> Vec<String> {
    use windows_sys::Win32::Foundation::ERROR_SUCCESS;
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegEnumValueW, RegOpenKeyExW, HKEY, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE,
        KEY_READ,
    };

    const KEY: &str = "SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts";
    /// A value name is at most 16383 characters (the registry's own limit).
    const NAME_CHARS: usize = 16384;
    /// The most values read from one key.
    const MAX_VALUES: u32 = 20_000;

    let key: Vec<u16> = KEY.encode_utf16().chain(std::iter::once(0)).collect();
    let mut names = Vec::new();
    for root in [HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER] {
        let mut handle: HKEY = std::ptr::null_mut();
        // SAFETY: `key` is a NUL-terminated wide string that outlives the call, and `handle` is a valid place for the result.
        if unsafe { RegOpenKeyExW(root, key.as_ptr(), 0, KEY_READ, &mut handle) } != ERROR_SUCCESS {
            continue;
        }
        let mut buffer = vec![0u16; NAME_CHARS];
        for index in 0..MAX_VALUES {
            let mut length = NAME_CHARS as u32;
            // SAFETY: `handle` is open, `buffer` holds `length` characters, and the null pointers are the optional outputs
            // (type and data) this call may leave out.
            let status = unsafe {
                RegEnumValueW(
                    handle,
                    index,
                    buffer.as_mut_ptr(),
                    &mut length,
                    std::ptr::null(),
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                )
            };
            if status != ERROR_SUCCESS {
                // ERROR_NO_MORE_ITEMS ends the list; any other error ends this key too.
                break;
            }
            let length = (length as usize).min(NAME_CHARS);
            names.push(String::from_utf16_lossy(&buffer[..length]));
        }
        // SAFETY: `handle` was opened above and is closed once.
        unsafe { RegCloseKey(handle) };
    }
    names
}

#[cfg(not(windows))]
fn registry_names() -> Vec<String> {
    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn families(names: &[&str]) -> Vec<String> {
        families_from_names(names.iter().map(|n| n.to_string()))
    }

    #[test]
    fn a_full_name_becomes_its_family_and_each_family_comes_once() {
        assert_eq!(
            families(&[
                "Yu Gothic Bold & Yu Gothic UI Bold & Yu Gothic UI Semibold (TrueType)",
                "Yu Gothic Regular & Yu Gothic UI Regular (TrueType)",
                "Meiryo & Meiryo Italic & Meiryo UI & Meiryo UI Italic (TrueType)",
                "Arial (TrueType)",
                "Arial Bold Italic (TrueType)",
                "游明朝 Demibold (OpenType)",
                "源ノ角ゴシック JP Heavy (OpenType)",
            ]),
            vec![
                "Arial",
                "Meiryo",
                "Meiryo UI",
                "Yu Gothic",
                "Yu Gothic UI",
                "游明朝",
                "源ノ角ゴシック JP"
            ],
        );
    }

    #[test]
    fn bitmap_fonts_vertical_variants_and_unusable_names_are_left_out() {
        assert_eq!(
            families(&[
                "Courier 10,12,15",
                "Small Fonts (VGA res)",
                "Modern (All res)",
                "@MS Gothic (TrueType)",
                "Bold (TrueType)",
                " (TrueType)",
                "Evil\"Font (TrueType)",
                "Semi;colon (TrueType)",
                "Segoe UI Black (TrueType)",
            ]),
            vec!["Bold", "Segoe UI"],
        );
    }

    #[test]
    fn a_very_long_name_and_a_very_long_list_are_cut() {
        let long = format!("{} (TrueType)", "x".repeat(MAX_NAME_CHARS + 1));
        assert!(families(&[&long]).is_empty());
        let many: Vec<String> = (0..MAX_FAMILIES + 10)
            .map(|i| format!("Font {i:05} (TrueType)"))
            .collect();
        assert_eq!(families_from_names(many).len(), MAX_FAMILIES);
    }

    #[test]
    fn the_computer_lists_its_fonts_without_failing() {
        // The list depends on the machine; reading it must not fail, and what comes back must already be clean.
        let found = installed_families();
        assert!(found.len() <= MAX_FAMILIES);
        assert!(found.iter().all(|f| !f.is_empty() && !f.starts_with('@')));
    }
}
