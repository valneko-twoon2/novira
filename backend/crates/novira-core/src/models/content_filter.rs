//! Judging whether a Hugging Face repository is adult content. The Hub has no content rating (only an optional
//! author-set tag), so repositories are judged by their name, tags, model card text and example prompts, and by
//! who publishes them.
use serde_json::Value;

/// Words that mark a repository as adult content. Hugging Face has no rating, only an optional author-set tag, so
/// repositories without the tag are judged by their name, tags, model card text and example prompts.
const ADULT_WORDS: &[&str] = &[
    "nsfw",
    "porn",
    "porno",
    "pornographic",
    "hentai",
    "lewd",
    "erotic",
    "erotica",
    "nude",
    "nudes",
    "nudity",
    "naked",
    "undress",
    "undressing",
    "topless",
    "sex",
    "sexy",
    "sexual",
    "xxx",
    "r18",
    "r-18",
    "explicit",
    "uncensored",
    "adult",
    "adults",
    "ecchi",
    "fetish",
    "bdsm",
    "bondage",
    "lingerie",
    "boobs",
    "breasts",
    "nipples",
    "areola",
    "pussy",
    "vagina",
    "penis",
    "cock",
    "dick",
    "cum",
    "futanari",
    "futa",
    "orgasm",
    "milf",
    "slut",
    "whore",
    "anal",
    "blowjob",
    "dildo",
    "genitals",
    "onlyfans",
    "gonewild",
    "playboy",
    "18",
    "smut",
    "underwear",
    "panties",
    "panty",
    "thong",
    "thot",
    "cleavage",
    "busty",
    "ahegao",
    "nsfl",
    "hardcore",
    "masturbation",
    "fellatio",
    "gangbang",
    "tentacles",
    "penetration",
    "gape",
    "gaping",
    "pubic",
    "breast",
    "boob",
    "nipple",
    "tits",
    "tit",
    "ass",
    "asshole",
    "booty",
    "creampie",
    "cumshot",
    "squirt",
    "squirting",
    "deepthroat",
    "handjob",
    "footjob",
    "titjob",
    "paizuri",
    "rape",
    "incest",
    "bukkake",
    "femdom",
    "exhibitionism",
    "voyeur",
    "crotch",
    "chastity",
    "cocksleeve",
    "cocks",
    "masturbate",
    "fingering",
    "sensual",
    "kinky",
    "kink",
    "fuck",
    "fucked",
    "fucking",
    "shemale",
    "yiff",
    "pantyhose",
    "stockings",
    "thighhighs",
    "cameltoe",
    "upskirt",
    "pantsu",
    "oppai",
    "ero",
    "yuri",
    "yaoi",
    "bara",
    "shota",
    "loli",
    "lolicon",
    "cowgirl",
    "testicle",
    "testicles",
    "sucking",
    "licking",
    "spread",
    "gagged",
];
/// Accounts that mirror Civitai models without any rating (adult models sit among them under harmless names), so
/// none of their repositories is offered while adult content is off. Civitai itself is searched with its own rating.
const UNRATED_MIRRORS: &[&str] = &["muapi"];
/// Words that count when they appear anywhere in a name once its separators are removed (`n-sfw`, `NSFWpony`).
const ADULT_SUBSTRINGS: &[&str] = &[
    "nsfw", "porn", "hentai", "nude", "naked", "lewd", "erotic", "undress", "xxx",
];
/// Words matched as the start of a token (`nudes`, `pornstar`, `eroticism`, ...).
const ADULT_STEMS: &[&str] = &[
    "nsfw",
    "porn",
    "hentai",
    "erotic",
    "nudit",
    "undress",
    "sexual",
    "lewd",
    "xxx",
    "r18",
    "fuck",
    "masturb",
    "penetrat",
    "orgas",
    "creampie",
    "cumshot",
    "bukkake",
    "paizuri",
    "fellat",
    "cunni",
    "genital",
    "prostitut",
    "stripper",
    "striptease",
];

/// Lowercase alphanumeric tokens of `text`; camelCase and digit boundaries also split (`NudeXL` -> `nude`, `xl`).
fn tokens(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    let mut prev_lower = false;
    for ch in text.chars() {
        if ch.is_alphanumeric() {
            if ch.is_uppercase() && prev_lower && !cur.is_empty() {
                out.push(std::mem::take(&mut cur));
            }
            prev_lower = ch.is_lowercase();
            cur.extend(ch.to_lowercase());
        } else {
            prev_lower = false;
            if !cur.is_empty() {
                out.push(std::mem::take(&mut cur));
            }
        }
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out
}

fn has_adult_word(text: &str) -> bool {
    tokens(text)
        .iter()
        .any(|t| ADULT_WORDS.contains(&t.as_str()) || ADULT_STEMS.iter().any(|s| t.starts_with(s)))
}

/// Whether a repository looks like adult content: the author-set tag, or an adult word in its name, tags, model card
/// text or example prompts.
pub fn looks_adult(id: &str, tags: &[String], card: &Value) -> bool {
    let owner = id.split('/').next().unwrap_or("").to_lowercase();
    if UNRATED_MIRRORS.contains(&owner.as_str()) {
        return true;
    }
    if tags.iter().any(|t| t == "not-for-all-audiences") {
        return true;
    }
    let compact: String = id
        .chars()
        .filter(|c| c.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect();
    if ADULT_SUBSTRINGS.iter().any(|w| compact.contains(w)) {
        return true;
    }
    if has_adult_word(id) || tags.iter().any(|t| !t.contains(':') && has_adult_word(t)) {
        return true;
    }
    let mut texts: Vec<&str> = Vec::new();
    for key in ["instance_prompt", "description", "title"] {
        if let Some(t) = card[key].as_str() {
            texts.push(t);
        }
    }
    for key in ["tags", "widget"] {
        for item in card[key].as_array().into_iter().flatten() {
            if let Some(t) = item.as_str() {
                texts.push(t);
            }
            for field in ["text", "prompt", "negative_prompt"] {
                // A negative prompt names what is left out, so it says nothing about the content.
                if field != "negative_prompt" {
                    if let Some(t) = item[field].as_str() {
                        texts.push(t);
                    }
                }
            }
        }
    }
    texts.into_iter().any(has_adult_word)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn adult_repositories_are_recognised_without_the_tag() {
        let none: Vec<String> = Vec::new();
        let card = json!({});
        assert!(looks_adult("someone/NSFW-Pony-LoRA", &none, &card));
        assert!(looks_adult("someone/nudeXL", &none, &card));
        assert!(looks_adult("Muapi/n-sfw-filter-slider", &none, &card));
        assert!(looks_adult("Muapi/girl-s-underwear-xl", &none, &card));
        assert!(looks_adult(
            "someone/pretty-girls",
            &["hentai".to_string()],
            &card
        ));
        assert!(looks_adult(
            "a/b",
            &["not-for-all-audiences".to_string()],
            &card
        ));
        assert!(looks_adult(
            "a/b",
            &none,
            &json!({"widget": [{"text": "1girl, naked, bed"}]})
        ));
        assert!(looks_adult(
            "a/b",
            &none,
            &json!({"instance_prompt": "explicit, sex"})
        ));
        assert!(looks_adult("Muapi/pixel-art-style", &none, &card));
        // Words that only contain an adult word are not adult.
        assert!(!looks_adult("someone/sussex-landscapes", &none, &card));
        assert!(!looks_adult("someone/analysis-tools", &none, &card));
        assert!(!looks_adult(
            "stabilityai/stable-diffusion-xl-base-1.0",
            &none,
            &json!({"widget": [{"text": "a cat"}]})
        ));
        // A negative prompt lists what is avoided.
        assert!(!looks_adult(
            "a/b",
            &none,
            &json!({"widget": [{"text": "a cat", "negative_prompt": "nsfw, nude"}]})
        ));
    }
}
