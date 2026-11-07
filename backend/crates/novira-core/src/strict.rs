//! Strict reading of JSON into the wire types.
//!
//! serde's derived `Deserialize` for a struct also accepts a JSON array and reads it as the fields in declaration order,
//! so `[]` is an empty patch and `["pkg", 30, true]` a three-field one. Nothing legitimate sends an array for a struct,
//! and accepting one would let a typo in the caller succeed with a different meaning. [`from_value`], [`from_str`] and
//! [`Strict`] read through [`StrictDe`], a wrapper around any deserializer that refuses a sequence wherever a struct
//! (or struct variant) is expected, at every depth the wrapper reaches. Valid objects read exactly as before.
//!
//! Not reached: a struct that serde reads from buffered content, which is a field under `#[serde(flatten)]`, a variant
//! of an internally tagged enum, or an untagged enum. Those still accept an array.
use serde::de::{
    self, DeserializeOwned, DeserializeSeed, EnumAccess, MapAccess, SeqAccess, VariantAccess,
    Visitor,
};
use serde::{Deserialize, Deserializer};
use serde_json::Value;
use std::fmt;

/// Reads `value` as `T`, refusing an array where a struct is expected.
pub fn from_value<T: DeserializeOwned>(value: Value) -> Result<T, serde_json::Error> {
    T::deserialize(StrictDe(value))
}

/// Reads JSON text as `T`, refusing an array where a struct is expected.
pub fn from_str<T: DeserializeOwned>(text: &str) -> Result<T, serde_json::Error> {
    let mut de = serde_json::Deserializer::from_str(text);
    let value = T::deserialize(StrictDe(&mut de))?;
    de.end()?;
    Ok(value)
}

/// A value read strictly: use it as the type of a Tauri command argument, where the shell deserializes the argument
/// itself and [`from_value`] cannot be called.
#[derive(Debug, Clone, PartialEq)]
pub struct Strict<T>(pub T);

impl<'de, T: Deserialize<'de>> Deserialize<'de> for Strict<T> {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        T::deserialize(StrictDe(d)).map(Strict)
    }
}

/// Wraps a deserializer so that every visitor it hands the data to is strict about structs.
pub struct StrictDe<D>(pub D);

/// Wraps a visitor, a seed or an access so that what is read through it stays strict.
struct Wrap<X>(X);

macro_rules! forward_visits {
    ($($m:ident($t:ty);)*) => {$(
        fn $m<E: de::Error>(self, v: $t) -> Result<V::Value, E> { self.0.$m(v) }
    )*};
}

impl<'de, V: Visitor<'de>> Visitor<'de> for Wrap<V> {
    type Value = V::Value;
    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
        self.0.expecting(f)
    }
    forward_visits! {
        visit_bool(bool); visit_i8(i8); visit_i16(i16); visit_i32(i32); visit_i64(i64); visit_i128(i128);
        visit_u8(u8); visit_u16(u16); visit_u32(u32); visit_u64(u64); visit_u128(u128);
        visit_f32(f32); visit_f64(f64); visit_char(char); visit_str(&str); visit_string(String);
        visit_bytes(&[u8]); visit_byte_buf(Vec<u8>);
    }
    fn visit_borrowed_str<E: de::Error>(self, v: &'de str) -> Result<V::Value, E> {
        self.0.visit_borrowed_str(v)
    }
    fn visit_borrowed_bytes<E: de::Error>(self, v: &'de [u8]) -> Result<V::Value, E> {
        self.0.visit_borrowed_bytes(v)
    }
    fn visit_none<E: de::Error>(self) -> Result<V::Value, E> {
        self.0.visit_none()
    }
    fn visit_unit<E: de::Error>(self) -> Result<V::Value, E> {
        self.0.visit_unit()
    }
    fn visit_some<D: Deserializer<'de>>(self, d: D) -> Result<V::Value, D::Error> {
        self.0.visit_some(StrictDe(d))
    }
    fn visit_newtype_struct<D: Deserializer<'de>>(self, d: D) -> Result<V::Value, D::Error> {
        self.0.visit_newtype_struct(StrictDe(d))
    }
    fn visit_seq<A: SeqAccess<'de>>(self, a: A) -> Result<V::Value, A::Error> {
        self.0.visit_seq(Wrap(a))
    }
    fn visit_map<A: MapAccess<'de>>(self, a: A) -> Result<V::Value, A::Error> {
        self.0.visit_map(Wrap(a))
    }
    fn visit_enum<A: EnumAccess<'de>>(self, a: A) -> Result<V::Value, A::Error> {
        self.0.visit_enum(Wrap(a))
    }
}

/// The visitor of a struct: like [`Wrap`], but a sequence is the wrong type.
struct StructWrap<V>(V);

impl<'de, V: Visitor<'de>> Visitor<'de> for StructWrap<V> {
    type Value = V::Value;
    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
        self.0.expecting(f)
    }
    fn visit_seq<A: SeqAccess<'de>>(self, _: A) -> Result<V::Value, A::Error> {
        Err(de::Error::invalid_type(de::Unexpected::Seq, &self.0))
    }
    fn visit_map<A: MapAccess<'de>>(self, a: A) -> Result<V::Value, A::Error> {
        self.0.visit_map(Wrap(a))
    }
}

impl<'de, S: DeserializeSeed<'de>> DeserializeSeed<'de> for Wrap<S> {
    type Value = S::Value;
    fn deserialize<D: Deserializer<'de>>(self, d: D) -> Result<S::Value, D::Error> {
        self.0.deserialize(StrictDe(d))
    }
}

impl<'de, A: SeqAccess<'de>> SeqAccess<'de> for Wrap<A> {
    type Error = A::Error;
    fn next_element_seed<T: DeserializeSeed<'de>>(
        &mut self,
        seed: T,
    ) -> Result<Option<T::Value>, A::Error> {
        self.0.next_element_seed(Wrap(seed))
    }
    fn size_hint(&self) -> Option<usize> {
        self.0.size_hint()
    }
}

impl<'de, A: MapAccess<'de>> MapAccess<'de> for Wrap<A> {
    type Error = A::Error;
    fn next_key_seed<K: DeserializeSeed<'de>>(
        &mut self,
        seed: K,
    ) -> Result<Option<K::Value>, A::Error> {
        self.0.next_key_seed(seed)
    }
    fn next_value_seed<T: DeserializeSeed<'de>>(&mut self, seed: T) -> Result<T::Value, A::Error> {
        self.0.next_value_seed(Wrap(seed))
    }
    fn size_hint(&self) -> Option<usize> {
        self.0.size_hint()
    }
}

impl<'de, A: EnumAccess<'de>> EnumAccess<'de> for Wrap<A> {
    type Error = A::Error;
    type Variant = Wrap<A::Variant>;
    fn variant_seed<T: DeserializeSeed<'de>>(
        self,
        seed: T,
    ) -> Result<(T::Value, Self::Variant), A::Error> {
        self.0.variant_seed(seed).map(|(v, a)| (v, Wrap(a)))
    }
}

impl<'de, A: VariantAccess<'de>> VariantAccess<'de> for Wrap<A> {
    type Error = A::Error;
    fn unit_variant(self) -> Result<(), A::Error> {
        self.0.unit_variant()
    }
    fn newtype_variant_seed<T: DeserializeSeed<'de>>(self, seed: T) -> Result<T::Value, A::Error> {
        self.0.newtype_variant_seed(Wrap(seed))
    }
    fn tuple_variant<V: Visitor<'de>>(self, len: usize, v: V) -> Result<V::Value, A::Error> {
        self.0.tuple_variant(len, Wrap(v))
    }
    fn struct_variant<V: Visitor<'de>>(
        self,
        fields: &'static [&'static str],
        v: V,
    ) -> Result<V::Value, A::Error> {
        self.0.struct_variant(fields, StructWrap(v))
    }
}

macro_rules! forward_reads {
    ($($m:ident)*) => {$(
        fn $m<V: Visitor<'de>>(self, v: V) -> Result<V::Value, D::Error> { self.0.$m(Wrap(v)) }
    )*};
}

impl<'de, D: Deserializer<'de>> Deserializer<'de> for StrictDe<D> {
    type Error = D::Error;
    forward_reads! {
        deserialize_any deserialize_bool deserialize_i8 deserialize_i16 deserialize_i32 deserialize_i64
        deserialize_i128 deserialize_u8 deserialize_u16 deserialize_u32 deserialize_u64 deserialize_u128
        deserialize_f32 deserialize_f64 deserialize_char deserialize_str deserialize_string deserialize_bytes
        deserialize_byte_buf deserialize_option deserialize_unit deserialize_seq deserialize_map
        deserialize_identifier deserialize_ignored_any
    }
    fn deserialize_unit_struct<V: Visitor<'de>>(
        self,
        name: &'static str,
        v: V,
    ) -> Result<V::Value, D::Error> {
        self.0.deserialize_unit_struct(name, Wrap(v))
    }
    fn deserialize_newtype_struct<V: Visitor<'de>>(
        self,
        name: &'static str,
        v: V,
    ) -> Result<V::Value, D::Error> {
        self.0.deserialize_newtype_struct(name, Wrap(v))
    }
    fn deserialize_tuple<V: Visitor<'de>>(self, len: usize, v: V) -> Result<V::Value, D::Error> {
        self.0.deserialize_tuple(len, Wrap(v))
    }
    fn deserialize_tuple_struct<V: Visitor<'de>>(
        self,
        name: &'static str,
        len: usize,
        v: V,
    ) -> Result<V::Value, D::Error> {
        self.0.deserialize_tuple_struct(name, len, Wrap(v))
    }
    fn deserialize_struct<V: Visitor<'de>>(
        self,
        name: &'static str,
        fields: &'static [&'static str],
        v: V,
    ) -> Result<V::Value, D::Error> {
        self.0.deserialize_struct(name, fields, StructWrap(v))
    }
    fn deserialize_enum<V: Visitor<'de>>(
        self,
        name: &'static str,
        variants: &'static [&'static str],
        v: V,
    ) -> Result<V::Value, D::Error> {
        self.0.deserialize_enum(name, variants, Wrap(v))
    }
    fn is_human_readable(&self) -> bool {
        self.0.is_human_readable()
    }
}

#[cfg(test)]
mod tests;
