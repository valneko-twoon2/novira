//! One pass over a safetensors header that keeps the tensor names, `__metadata__` and the entries of a few chosen
//! tensors, without building a JSON tree for each of the thousands of tensors a checkpoint has. That tree was most of
//! the 3 ms a checkpoint's header took to read, and every start reads the header of each checkpoint in the models
//! folder (`layout::move_misfiled`). `classify::parse_header` turns the result into a `Header`.
use serde::de::{DeserializeSeed, Deserializer, MapAccess, SeqAccess, Visitor};
use serde_json::Value;
use std::collections::HashSet;
use std::fmt;

/// The key of a safetensors header that holds the file's metadata, not a tensor.
pub(super) const METADATA: &str = "__metadata__";

/// The top-level entries of a header, in file order.
#[derive(Debug, Default)]
pub(super) struct Entries {
    /// Every top-level name, `__metadata__` included.
    pub names: Vec<String>,
    /// The index in `names` and the value of `__metadata__`.
    pub metadata: Option<(usize, Value)>,
    /// The index in `names` and the value of each tensor `keep` picked.
    pub kept: Vec<(usize, Value)>,
}

impl Entries {
    /// A name that appears twice. A JSON map keeps the last value at the first place, which this pass does not
    /// model, so the caller reads such a header the slow way.
    pub fn has_duplicates(&self) -> bool {
        let mut seen = HashSet::with_capacity(self.names.len());
        !self.names.iter().all(|n| seen.insert(n.as_str()))
    }
}

/// Reads the header `bytes`, or None when they are not one JSON object (exactly when parsing them into a
/// `serde_json::Map` fails: every value is checked as JSON, strings included, it is only not kept).
pub(super) fn scan(bytes: &[u8], keep: fn(&str) -> bool) -> Option<Entries> {
    let mut de = serde_json::Deserializer::from_slice(bytes);
    let entries = Top { keep }.deserialize(&mut de).ok()?;
    de.end().ok()?;
    Some(entries)
}

struct Top {
    keep: fn(&str) -> bool,
}

impl<'de> DeserializeSeed<'de> for Top {
    type Value = Entries;

    fn deserialize<D: Deserializer<'de>>(self, d: D) -> Result<Entries, D::Error> {
        d.deserialize_map(self)
    }
}

impl<'de> Visitor<'de> for Top {
    type Value = Entries;

    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str("a safetensors header object")
    }

    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Entries, A::Error> {
        let mut out = Entries::default();
        while let Some(name) = map.next_key::<String>()? {
            let at = out.names.len();
            if name == METADATA {
                out.metadata = Some((at, map.next_value::<Value>()?));
            } else if (self.keep)(&name) {
                out.kept.push((at, map.next_value::<Value>()?));
            } else {
                map.next_value::<Checked>()?;
            }
            out.names.push(name);
        }
        Ok(out)
    }
}

/// Any JSON value, checked as `Value` would check it (strings through the same validating reads) but not stored.
struct Checked;

impl<'de> serde::Deserialize<'de> for Checked {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        d.deserialize_any(CheckedVisitor)
    }
}

struct CheckedVisitor;

impl<'de> Visitor<'de> for CheckedVisitor {
    type Value = Checked;

    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str("any JSON value")
    }

    fn visit_bool<E>(self, _: bool) -> Result<Checked, E> {
        Ok(Checked)
    }

    fn visit_i64<E>(self, _: i64) -> Result<Checked, E> {
        Ok(Checked)
    }

    fn visit_u64<E>(self, _: u64) -> Result<Checked, E> {
        Ok(Checked)
    }

    fn visit_f64<E>(self, _: f64) -> Result<Checked, E> {
        Ok(Checked)
    }

    fn visit_str<E>(self, _: &str) -> Result<Checked, E> {
        Ok(Checked)
    }

    fn visit_unit<E>(self) -> Result<Checked, E> {
        Ok(Checked)
    }

    fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Checked, A::Error> {
        while seq.next_element::<Checked>()?.is_some() {}
        Ok(Checked)
    }

    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Checked, A::Error> {
        while map.next_key::<Checked>()?.is_some() {
            map.next_value::<Checked>()?;
        }
        Ok(Checked)
    }
}
