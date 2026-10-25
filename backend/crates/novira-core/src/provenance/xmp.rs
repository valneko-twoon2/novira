//! The IPTC "digital source type" of a copy, written as XMP: `trainedAlgorithmicMedia` says the picture was made by
//! a generative model. PNG keeps the packet in an `iTXt` chunk, JPEG in an APP1 segment and WebP in an `XMP ` chunk of
//! the extended format. Reading looks only inside XMP packets, so the same address in a C2PA manifest does
//! not count.
use crate::media::images;

/// IPTC's code for media made by a model trained on sampled content.
pub const TRAINED_ALGORITHMIC_MEDIA: &str =
    "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia";
/// The PNG keyword of an XMP packet.
const PNG_KEY: &str = "XML:com.adobe.xmp";
/// The name that opens an XMP APP1 segment in JPEG.
const JPEG_XMP_NS: &[u8] = b"http://ns.adobe.com/xap/1.0/\0";
/// The largest XMP packet read back (outside data).
const MAX_PACKET: usize = 1 << 20;

/// The XMP packet novira writes.
pub fn packet() -> String {
    format!(
        "<?xpacket begin=\"\u{feff}\" id=\"W5M0MpCehiHzreSzNTczkc9d\"?>\n\
<x:xmpmeta xmlns:x=\"adobe:ns:meta/\">\n\
 <rdf:RDF xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">\n\
  <rdf:Description rdf:about=\"\"\n\
    xmlns:Iptc4xmpExt=\"http://iptc.org/std/Iptc4xmpExt/2008-02-29/\"\n\
    xmlns:xmp=\"http://ns.adobe.com/xap/1.0/\"\n\
    Iptc4xmpExt:DigitalSourceType=\"{TRAINED_ALGORITHMIC_MEDIA}\"\n\
    xmp:CreatorTool=\"novira\"/>\n\
 </rdf:RDF>\n\
</x:xmpmeta>\n\
<?xpacket end=\"w\"?>"
    )
}

/// The encoded copy with the packet added, or an error when the bytes are not the format they claim to be.
pub fn add(bytes: &[u8], format: image::ImageFormat) -> Result<Vec<u8>, String> {
    let xmp = packet();
    match format {
        image::ImageFormat::Png => images::with_text(bytes, PNG_KEY, &xmp),
        image::ImageFormat::Jpeg => add_to_jpeg(bytes, xmp.as_bytes()),
        image::ImageFormat::WebP => add_to_webp(bytes, xmp.as_bytes()),
        _ => None,
    }
    .ok_or_else(|| "cannot add the AI label (XMP) to this file".to_string())
}

/// Inserts an APP1 XMP segment after the JFIF header (or right after the start marker).
fn add_to_jpeg(jpeg: &[u8], xmp: &[u8]) -> Option<Vec<u8>> {
    if !jpeg.starts_with(&[0xFF, 0xD8]) {
        return None;
    }
    let mut at = 2;
    if jpeg.get(2..4) == Some(&[0xFF, 0xE0]) {
        let len = u16::from_be_bytes(jpeg.get(4..6)?.try_into().ok()?) as usize;
        at = 4 + len;
        jpeg.get(..at)?;
    }
    let len = 2 + JPEG_XMP_NS.len() + xmp.len();
    let len = u16::try_from(len).ok()?;
    let mut out = Vec::with_capacity(jpeg.len() + usize::from(len) + 2);
    out.extend_from_slice(&jpeg[..at]);
    out.extend_from_slice(&[0xFF, 0xE1]);
    out.extend_from_slice(&len.to_be_bytes());
    out.extend_from_slice(JPEG_XMP_NS);
    out.extend_from_slice(xmp);
    out.extend_from_slice(&jpeg[at..]);
    Some(out)
}

/// The chunks of a RIFF WebP file: (fourcc, payload).
fn webp_chunks(webp: &[u8]) -> Option<Vec<([u8; 4], &[u8])>> {
    if webp.get(..4)? != b"RIFF" || webp.get(8..12)? != b"WEBP" {
        return None;
    }
    let riff_end =
        8usize.checked_add(u32::from_le_bytes(webp.get(4..8)?.try_into().ok()?) as usize)?;
    let end = riff_end.min(webp.len());
    let mut pos = 12;
    let mut out = Vec::new();
    while pos + 8 <= end {
        let fourcc: [u8; 4] = webp[pos..pos + 4].try_into().ok()?;
        let len = u32::from_le_bytes(webp[pos + 4..pos + 8].try_into().ok()?) as usize;
        let data = webp.get(pos + 8..pos.checked_add(8 + len)?)?;
        out.push((fourcc, data));
        pos += 8 + len + (len & 1);
    }
    Some(out)
}

fn push_chunk(out: &mut Vec<u8>, fourcc: &[u8; 4], data: &[u8]) {
    out.extend_from_slice(fourcc);
    out.extend_from_slice(&(data.len() as u32).to_le_bytes());
    out.extend_from_slice(data);
    if data.len() % 2 == 1 {
        out.push(0);
    }
}

/// Rewrites a simple (VP8L or VP8) WebP as the extended format with an `XMP ` chunk. The pixels are not touched.
fn add_to_webp(webp: &[u8], xmp: &[u8]) -> Option<Vec<u8>> {
    let chunks = webp_chunks(webp)?;
    let (width, height) =
        image::ImageReader::with_format(std::io::Cursor::new(webp), image::ImageFormat::WebP)
            .into_dimensions()
            .ok()?;
    let has_alpha = image::load_from_memory_with_format(webp, image::ImageFormat::WebP)
        .ok()?
        .color()
        .has_alpha();
    let mut body = Vec::with_capacity(webp.len() + xmp.len() + 32);
    let (mut flags, mut vp8x) = (0x04u8, None);
    if has_alpha {
        flags |= 0x10;
    }
    for (fourcc, data) in &chunks {
        if fourcc == b"VP8X" {
            vp8x = Some(data.to_vec());
        }
    }
    let mut header = vp8x.unwrap_or_else(|| {
        let mut h = vec![0u8; 10];
        let w = (width - 1).to_le_bytes();
        let hgt = (height - 1).to_le_bytes();
        h[4..7].copy_from_slice(&w[..3]);
        h[7..10].copy_from_slice(&hgt[..3]);
        h
    });
    *header.first_mut()? |= flags;
    push_chunk(&mut body, b"VP8X", &header);
    for (fourcc, data) in &chunks {
        if fourcc != b"VP8X" && fourcc != b"XMP " {
            push_chunk(&mut body, fourcc, data);
        }
    }
    push_chunk(&mut body, b"XMP ", xmp);
    let mut out = Vec::with_capacity(body.len() + 12);
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&u32::try_from(body.len() + 4).ok()?.to_le_bytes());
    out.extend_from_slice(b"WEBP");
    out.extend_from_slice(&body);
    Some(out)
}

/// Every XMP packet of a file (outside data): the `<x:xmpmeta` ... `</x:xmpmeta>` spans in its bytes, each at most
/// 1 MB. Compressed packets (zTXt, compressed iTXt) are not read.
fn packets(bytes: &[u8]) -> Vec<&str> {
    const OPEN: &[u8] = b"<x:xmpmeta";
    const CLOSE: &[u8] = b"</x:xmpmeta>";
    let mut out = Vec::new();
    let mut pos = 0;
    while let Some(start) = find(&bytes[pos..], OPEN).map(|i| pos + i) {
        let window = &bytes[start..bytes.len().min(start + MAX_PACKET)];
        let Some(end) = find(window, CLOSE) else {
            break;
        };
        if let Ok(text) = std::str::from_utf8(&window[..end + CLOSE.len()]) {
            out.push(text);
        }
        pos = start + end + CLOSE.len();
    }
    out
}

fn find(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|w| w == needle)
}

/// The IPTC digital source type an XMP packet of the file names (the code after `digitalsourcetype/`), if any.
pub fn digital_source_type(bytes: &[u8]) -> Option<String> {
    const PREFIX: &str = "digitalsourcetype/";
    for packet in packets(bytes) {
        let Some(at) = packet.find("DigitalSourceType") else {
            continue;
        };
        let rest = &packet[at..packet.len().min(at + 400)];
        if let Some(code_at) = rest.find(PREFIX) {
            let code: String = rest[code_at + PREFIX.len()..]
                .chars()
                .take_while(|c| c.is_ascii_alphanumeric())
                .take(64)
                .collect();
            if !code.is_empty() {
                return Some(code);
            }
        }
    }
    None
}

/// Whether a digital source type says the picture was made by AI (fully or as part of a composite).
pub fn is_ai_source(code: &str) -> bool {
    matches!(
        code,
        "trainedAlgorithmicMedia" | "compositeWithTrainedAlgorithmicMedia" | "algorithmicMedia"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{DynamicImage, ImageFormat, RgbaImage};

    fn encoded(format: ImageFormat, alpha: bool) -> Vec<u8> {
        let img = RgbaImage::from_fn(17, 9, |x, y| {
            image::Rgba([
                x as u8 * 10,
                y as u8 * 20,
                90,
                if alpha { 128 } else { 255 },
            ])
        });
        let img = DynamicImage::ImageRgba8(img);
        let img = if format == ImageFormat::Jpeg {
            DynamicImage::ImageRgb8(img.to_rgb8())
        } else {
            img
        };
        let mut out = std::io::Cursor::new(Vec::new());
        img.write_to(&mut out, format).unwrap();
        out.into_inner()
    }

    #[test]
    fn the_packet_names_the_iptc_code_and_reads_back() {
        let p = packet();
        assert!(p.contains(TRAINED_ALGORITHMIC_MEDIA));
        assert_eq!(
            digital_source_type(p.as_bytes()).as_deref(),
            Some("trainedAlgorithmicMedia")
        );
    }

    #[test]
    fn every_format_keeps_its_pixels_and_gains_the_label() {
        for (format, alpha) in [
            (ImageFormat::Png, false),
            (ImageFormat::Png, true),
            (ImageFormat::Jpeg, false),
            (ImageFormat::WebP, false),
            (ImageFormat::WebP, true),
        ] {
            let plain = encoded(format, alpha);
            assert_eq!(digital_source_type(&plain), None, "{format:?}");
            let labelled = add(&plain, format).unwrap();
            assert_eq!(
                digital_source_type(&labelled).as_deref(),
                Some("trainedAlgorithmicMedia"),
                "{format:?}"
            );
            let a = image::load_from_memory(&plain).unwrap();
            let b = image::load_from_memory_with_format(&labelled, format).unwrap();
            assert_eq!(
                (a.width(), a.height()),
                (b.width(), b.height()),
                "{format:?}"
            );
            assert_eq!(a.to_rgba8(), b.to_rgba8(), "{format:?} {alpha}");
            assert_eq!(a.color().has_alpha(), b.color().has_alpha(), "{format:?}");
        }
    }

    #[test]
    fn a_webp_becomes_the_extended_format_with_flags_and_canvas_size() {
        let out = add(&encoded(ImageFormat::WebP, true), ImageFormat::WebP).unwrap();
        let chunks = webp_chunks(&out).unwrap();
        assert_eq!(&chunks[0].0, b"VP8X");
        let h = chunks[0].1;
        assert_eq!(h[0] & 0x04, 0x04, "XMP flag");
        assert_eq!(h[0] & 0x10, 0x10, "alpha flag");
        assert_eq!(u32::from_le_bytes([h[4], h[5], h[6], 0]) + 1, 17);
        assert_eq!(u32::from_le_bytes([h[7], h[8], h[9], 0]) + 1, 9);
        assert_eq!(&chunks.last().unwrap().0, b"XMP ");
        let riff = u32::from_le_bytes(out[4..8].try_into().unwrap()) as usize;
        assert_eq!(riff + 8, out.len());
    }

    #[test]
    fn a_jpeg_segment_goes_after_the_jfif_header() {
        let plain = encoded(ImageFormat::Jpeg, false);
        let out = add(&plain, ImageFormat::Jpeg).unwrap();
        assert_eq!(&out[..4], &[0xFF, 0xD8, 0xFF, 0xE0]);
        let app0 = 4 + u16::from_be_bytes([out[4], out[5]]) as usize;
        assert_eq!(&out[app0..app0 + 2], &[0xFF, 0xE1]);
        assert_eq!(&out[app0 + 4..app0 + 4 + JPEG_XMP_NS.len()], JPEG_XMP_NS);
    }

    #[test]
    fn files_of_the_wrong_kind_are_refused() {
        assert!(add(b"not a picture", ImageFormat::Png).is_err());
        assert!(add(b"not a picture", ImageFormat::Jpeg).is_err());
        assert!(add(b"RIFF\x04\0\0\0WEBP", ImageFormat::WebP).is_err());
        assert!(add(&encoded(ImageFormat::Png, false), ImageFormat::Gif).is_err());
    }

    #[test]
    fn the_source_type_is_read_only_inside_an_xmp_packet() {
        // The address alone (as a C2PA manifest carries it) is not a label.
        let bare = format!("junk {TRAINED_ALGORITHMIC_MEDIA} junk");
        assert_eq!(digital_source_type(bare.as_bytes()), None);
        // The element form other tools write is read too.
        let element = "<x:xmpmeta><rdf:RDF><rdf:Description><Iptc4xmpExt:DigitalSourceType>\
http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture</Iptc4xmpExt:DigitalSourceType>\
</rdf:Description></rdf:RDF></x:xmpmeta>";
        assert_eq!(
            digital_source_type(element.as_bytes()).as_deref(),
            Some("digitalCapture")
        );
        // An unterminated packet or one without the field reads as nothing.
        assert_eq!(digital_source_type(b"<x:xmpmeta DigitalSourceType"), None);
        assert_eq!(digital_source_type(b"<x:xmpmeta></x:xmpmeta>"), None);
    }

    #[test]
    fn ai_source_codes() {
        assert!(is_ai_source("trainedAlgorithmicMedia"));
        assert!(is_ai_source("compositeWithTrainedAlgorithmicMedia"));
        assert!(!is_ai_source("digitalCapture"));
        assert!(!is_ai_source(""));
    }
}
