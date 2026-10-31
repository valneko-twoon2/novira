//! Property tests for the AI label in a picture's XMP (`provenance::xmp`): a label written into a PNG, JPEG or WebP
//! reads back as the same code with the picture still decoding, and the reader of any bytes (the picture of a stranger)
//! never panics and only returns a short alphanumeric code. In process only.
//! Run: `cargo test -p novira-core --test prop_xmp`.
mod prop_common;

use image::{DynamicImage, ImageFormat, RgbImage};
use novira_core::media::images::with_text;
use novira_core::provenance::xmp::{add, digital_source_type, is_ai_source};
use prop_common::{bytes, check, check_up_to};
use proptest::prelude::*;

fn encode(format: ImageFormat, w: u32, h: u32, shade: u8) -> Vec<u8> {
    let img = DynamicImage::ImageRgb8(RgbImage::from_pixel(w, h, image::Rgb([shade, 20, 200])));
    let mut out = std::io::Cursor::new(Vec::new());
    img.write_to(&mut out, format).unwrap();
    out.into_inner()
}

fn format() -> impl Strategy<Value = ImageFormat> {
    prop::sample::select(&[ImageFormat::Png, ImageFormat::Jpeg, ImageFormat::WebP][..])
}

#[test]
fn a_label_added_to_any_picture_reads_back_and_the_picture_still_decodes() {
    check_up_to(
        96,
        (format(), 1u32..40, 1u32..40, any::<u8>()),
        |(format, w, h, shade)| {
            let plain = encode(format, w, h, shade);
            prop_assert_eq!(
                digital_source_type(&plain),
                None,
                "a plain picture has no label"
            );
            let labelled =
                add(&plain, format).expect("a picture of its own format takes the label");
            let code = digital_source_type(&labelled);
            prop_assert_eq!(
                code.as_deref(),
                Some("trainedAlgorithmicMedia"),
                "{:?}",
                format
            );
            prop_assert!(is_ai_source(code.as_deref().unwrap()));
            let decoded = image::load_from_memory_with_format(&labelled, format).unwrap();
            prop_assert_eq!((decoded.width(), decoded.height()), (w, h));
            Ok(())
        },
    );
}

#[test]
fn adding_the_label_to_bytes_of_any_kind_is_an_answer_never_a_panic() {
    check(
        (format(), bytes(300), any::<bool>()),
        |(format, data, jpeg_start)| {
            let mut data = data;
            if jpeg_start {
                // Bytes that begin like a JPEG reach the segment arithmetic.
                data.splice(0..0, [0xFF, 0xD8, 0xFF, 0xE0]);
            }
            if let Ok(out) = add(&data, format) {
                prop_assert!(out.len() > data.len());
            }
            Ok(())
        },
    );
}

#[test]
fn the_label_reader_returns_a_short_alphanumeric_code_or_nothing_for_any_bytes() {
    check(bytes(600), |data| {
        if let Some(code) = digital_source_type(&data) {
            prop_assert!(!code.is_empty() && code.chars().count() <= 64, "{code:?}");
            prop_assert!(code.chars().all(|c| c.is_ascii_alphanumeric()), "{code:?}");
        }
        Ok(())
    });
}

#[test]
fn a_code_in_a_pictures_packet_is_read_back_whole_up_to_sixty_four_characters() {
    let png = encode(ImageFormat::Png, 2, 2, 7);
    check(("[A-Za-z0-9]{1,100}", "[ -~]{0,30}"), |(code, tail)| {
        let packet = format!(
                "<x:xmpmeta><rdf:Description Iptc4xmpExt:DigitalSourceType=\"http://cv.iptc.org/newscodes/digitalsourcetype/{code}{tail}\"/></x:xmpmeta>"
            );
        let file = with_text(&png, "XML:com.adobe.xmp", &packet).unwrap();
        let read = digital_source_type(&file).expect("the code is in the packet");
        let expected: String = code
            .chars()
            .chain(tail.chars())
            .take_while(|c| c.is_ascii_alphanumeric())
            .take(64)
            .collect();
        prop_assert_eq!(read, expected);
        Ok(())
    });
}

#[test]
fn only_the_three_algorithmic_codes_count_as_made_by_ai() {
    check("[A-Za-z]{0,40}", |code| {
        let ai = [
            "trainedAlgorithmicMedia",
            "compositeWithTrainedAlgorithmicMedia",
            "algorithmicMedia",
        ];
        prop_assert_eq!(is_ai_source(&code), ai.contains(&code.as_str()));
        Ok(())
    });
}
