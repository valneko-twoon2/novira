//! What a novira watermark carries: TrustMark's BCH_5 schema holds 61 data bits (it corrects up to 5 flipped bits),
//! which novira splits into a fixed 16-bit marker and a random 45-bit id.
//!
//! ```text
//! bit  0 ............ 15 | 16 ............................ 60
//!      marker 0x4E56 "NV" | id: random, 45 bits, most significant bit first
//! ```
//!
//! The marker tells a novira watermark from another TrustMark BCH_5 payload (a random one matches with odds of 1 in
//! 65 536). The id is random, never derived from the user or the PC; this app's database maps it to the gallery picture
//! the copy was exported from. The scheme is public, so anyone can write the same bits: the marker is a label, not a
//! proof.

/// The 16-bit marker of a novira watermark ("NV" in ASCII).
pub const MARKER: u16 = 0x4E56;
/// Data bits of TrustMark's BCH_5 schema.
pub const DATA_BITS: usize = 61;
/// Bits of the random id.
pub const ID_BITS: u32 = 45;
/// The largest id (45 bits set).
pub const MAX_ID: u64 = (1 << ID_BITS) - 1;
/// TrustMark's number for the BCH_5 schema, as the C2PA soft-binding value writes it (`1*<bits>`).
pub const SCHEMA_CODE: u8 = 1;

/// A new random id. Drawn from a v4 UUID's random bytes (the operating system's generator).
pub fn random_id() -> u64 {
    let bytes = uuid::Uuid::new_v4().into_bytes();
    u64::from_le_bytes(bytes[..8].try_into().expect("8 bytes")) & MAX_ID
}

/// The 61 data bits, as the `0`/`1` string TrustMark takes. Ids above 45 bits are cut to 45.
pub fn bits(id: u64) -> String {
    format!("{MARKER:016b}{:045b}", id & MAX_ID)
}

/// What 61 decoded data bits say.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Decoded {
    /// A novira watermark with this id.
    Novira(u64),
    /// A TrustMark watermark of someone else (or a different schema).
    Other,
}

/// Reads decoded data bits. Anything that is not 61 binary digits is someone else's payload.
pub fn parse(bits: &str) -> Decoded {
    if bits.len() != DATA_BITS || !bits.bytes().all(|b| b == b'0' || b == b'1') {
        return Decoded::Other;
    }
    let (marker, id) = bits.split_at(16);
    match (u16::from_str_radix(marker, 2), u64::from_str_radix(id, 2)) {
        (Ok(MARKER), Ok(id)) => Decoded::Novira(id),
        _ => Decoded::Other,
    }
}

/// An id as the 12 hexadecimal digits the database and the screens use.
pub fn id_hex(id: u64) -> String {
    format!("{:012x}", id & MAX_ID)
}

/// The value of the C2PA soft-binding block: TrustMark's schema number, `*`, then the data bits (as in Adobe's
/// TrustMark C2PA example).
pub fn soft_binding_value(id: u64) -> String {
    format!("{SCHEMA_CODE}*{}", bits(id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bits_are_the_marker_then_the_id_most_significant_first() {
        let b = bits(1);
        assert_eq!(b.len(), DATA_BITS);
        assert_eq!(&b[..16], "0100111001010110");
        assert_eq!(&b[16..], format!("{}1", "0".repeat(44)));
        assert_eq!(&bits(MAX_ID)[16..], "1".repeat(45));
        assert_eq!(bits(0), format!("0100111001010110{}", "0".repeat(45)));
    }

    #[test]
    fn ids_round_trip_through_the_bits() {
        for id in [0, 1, 0x0123_4567_89ab, MAX_ID, random_id(), random_id()] {
            assert_eq!(parse(&bits(id)), Decoded::Novira(id), "{id}");
        }
    }

    #[test]
    fn an_id_wider_than_45_bits_is_cut() {
        assert_eq!(parse(&bits(MAX_ID + 2)), Decoded::Novira(1));
        assert_eq!(id_hex(u64::MAX), "1fffffffffff");
    }

    #[test]
    fn random_ids_fit_in_45_bits_and_differ() {
        let a: Vec<u64> = (0..64).map(|_| random_id()).collect();
        assert!(a.iter().all(|&id| id <= MAX_ID));
        let mut sorted = a.clone();
        sorted.sort_unstable();
        sorted.dedup();
        assert_eq!(sorted.len(), a.len());
    }

    #[test]
    fn another_marker_or_a_malformed_payload_is_not_novira() {
        let mut other = bits(7);
        other.replace_range(0..1, "1");
        assert_eq!(parse(&other), Decoded::Other);
        for bad in [
            "",
            "0101",
            &"0".repeat(60),
            &"0".repeat(62),
            &format!("0100111001010110{}x", "0".repeat(44)),
            &format!("0100111001010110{}\u{ff12}", "0".repeat(43)),
        ] {
            assert_eq!(parse(bad), Decoded::Other, "{bad}");
        }
    }

    #[test]
    fn hex_ids_and_soft_binding_values_have_a_fixed_shape() {
        assert_eq!(id_hex(0), "000000000000");
        assert_eq!(id_hex(0xabc), "000000000abc");
        let v = soft_binding_value(5);
        assert_eq!(v, format!("1*{}", bits(5)));
        assert_eq!(v.len(), 2 + DATA_BITS);
    }
}
