//! The words ComfyUI's own frontend shows in a language: the names of node categories, of nodes, of their inputs and
//! outputs, and the headings of its node library. They are read from the frontend the running ComfyUI serves, so they
//! follow the installed version and the app ships none of them. Its locale files are JavaScript modules that only
//! declare data (`var e={display_name:`…`},t={…};export{e as APG,…}`); they are read here as data and never run, and
//! anything else in them makes the whole file unreadable.
use serde::Serialize;
use serde_json::{Map, Value};
use std::collections::{BTreeMap, HashMap};

/// The words of one language. Anything ComfyUI has no word for is absent; the caller keeps its own text then.
#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComfyUiLocale {
    /// Names of the parts of node categories, by the part (`model` → `Modèle` in French).
    pub categories: BTreeMap<String, String>,
    /// Heading of the node library's section of ComfyUI's own nodes ("Comfy Nodes" in English).
    pub comfy_nodes_heading: Option<String>,
    /// Heading of its section of extension nodes.
    pub extensions_heading: Option<String>,
    /// The words of each node, by node class.
    pub nodes: BTreeMap<String, ComfyUiNodeText>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComfyUiNodeText {
    pub name: Option<String>,
    pub description: Option<String>,
    /// By input name.
    pub inputs: BTreeMap<String, ComfyUiFieldText>,
    /// By output index (`"0"`).
    pub outputs: BTreeMap<String, ComfyUiFieldText>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComfyUiFieldText {
    pub name: Option<String>,
    pub tooltip: Option<String>,
}

/// ComfyUI's name for one of the app's languages, or None for a language it has no files for.
pub fn comfy_language(locale: &str) -> Option<&'static str> {
    Some(match locale {
        "ja" => "ja",
        "en" => "en",
        "zh-CN" => "zh",
        "zh-TW" => "zh-TW",
        "ko" => "ko",
        "ru" => "ru",
        "es" => "es",
        "pt-BR" => "pt-BR",
        "fr" => "fr",
        "de" => "de",
        _ => return None,
    })
}

/// A file name the frontend's scripts may name: letters, digits, `-`, `_` and `.`, ending in `.js`, nothing that
/// leaves the assets folder.
fn is_asset_name(name: &str) -> bool {
    name.ends_with(".js")
        && !name.starts_with('.')
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
}

/// The text between `start` and the next `end` after each place `start` occurs.
fn between<'a>(text: &'a str, start: &'a str, end: &'a str) -> impl Iterator<Item = &'a str> {
    text.match_indices(start).filter_map(move |(i, _)| {
        let rest = &text[i + start.len()..];
        rest.find(end).map(|j| &rest[..j])
    })
}

/// The entry script `index.html` loads (`./assets/index-….js`).
pub fn entry_script(index_html: &str) -> Option<String> {
    between(index_html, "src=\"./assets/", "\"")
        .find(|n| n.starts_with("index-") && is_asset_name(n))
        .map(str::to_string)
}

/// The script that maps each language to its locale files (`i18n-….js`, not the vendor library of the same name).
pub fn i18n_script(entry_js: &str) -> Option<String> {
    entry_js
        .match_indices("i18n-")
        .filter(|(i, _)| !entry_js[..*i].ends_with("vendor-"))
        .find_map(|(i, _)| {
            let rest = &entry_js[i..];
            let name = &rest[..rest.find(".js")? + 3];
            is_asset_name(name).then(|| name.to_string())
        })
}

/// The files of one language the map names: `(main, nodeDefs)`.
pub fn locale_scripts(i18n_js: &str, language: &str) -> Option<(String, String)> {
    let file = |kind: &str| {
        let key = format!("\"./{language}/{kind}.json\"");
        let at = i18n_js.find(&key)?;
        let rest = &i18n_js[at + key.len()..];
        let name = between(rest, "import(`./", "`").next()?;
        is_asset_name(name).then(|| name.to_string())
    };
    Some((file("main")?, file("nodeDefs")?))
}

/// Reads the words of the main locale file and the node file.
pub fn read_locale(main_js: &str, node_defs_js: &str) -> Result<ComfyUiLocale, String> {
    let main = parse_module(main_js)?;
    let nodes = parse_module(node_defs_js)?;
    let text = |v: &Value| v.as_str().filter(|s| !s.is_empty()).map(str::to_string);
    let sections = &main["sideToolbar"]["nodeLibraryTab"]["sections"];
    let field = |v: &Value| ComfyUiFieldText {
        name: text(&v["name"]),
        tooltip: text(&v["tooltip"]),
    };
    let fields = |v: &Value| -> BTreeMap<String, ComfyUiFieldText> {
        v.as_object()
            .map(|o| o.iter().map(|(k, v)| (k.clone(), field(v))).collect())
            .unwrap_or_default()
    };
    Ok(ComfyUiLocale {
        categories: main["nodeCategories"]
            .as_object()
            .map(|o| {
                o.iter()
                    .filter_map(|(k, v)| Some((k.clone(), text(v)?)))
                    .collect()
            })
            .unwrap_or_default(),
        comfy_nodes_heading: text(&sections["comfyNodes"]),
        extensions_heading: text(&sections["extensions"]),
        nodes: nodes
            .as_object()
            .map(|o| {
                o.iter()
                    .map(|(class, v)| {
                        let node = ComfyUiNodeText {
                            name: text(&v["display_name"]),
                            description: text(&v["description"]),
                            inputs: fields(&v["inputs"]),
                            outputs: fields(&v["outputs"]),
                        };
                        (class.clone(), node)
                    })
                    .collect()
            })
            .unwrap_or_default(),
    })
}

/// The largest locale file read (the Japanese node file is about half a megabyte).
pub const MAX_SCRIPT_BYTES: usize = 8 * 1024 * 1024;

#[derive(Debug, Clone)]
enum Expr {
    Value(Value),
    Ref(String),
    Object(Vec<(String, Expr)>),
    Array(Vec<Expr>),
}

/// A module that only declares data, as JSON: its default export, or an object of its named exports when it has none.
pub fn parse_module(src: &str) -> Result<Value, String> {
    if src.len() > MAX_SCRIPT_BYTES {
        return Err("the file is too large".into());
    }
    let mut p = Parser {
        s: src.as_bytes(),
        src,
        i: 0,
    };
    let mut vars: HashMap<String, Expr> = HashMap::new();
    let mut exports: Vec<(String, String)> = Vec::new();
    loop {
        p.skip();
        if p.done() {
            break;
        }
        if p.eat(";") {
            continue;
        }
        let word = p.ident()?;
        match word.as_str() {
            "var" | "let" | "const" => loop {
                let name = p.ident()?;
                p.expect("=")?;
                let value = p.expr(0)?;
                vars.insert(name, value);
                if !p.eat(",") {
                    break;
                }
            },
            "export" => {
                p.expect("{")?;
                while !p.eat("}") {
                    let local = p.ident()?;
                    let exported = if p.eat_word("as") {
                        p.ident()?
                    } else {
                        local.clone()
                    };
                    exports.push((exported, local));
                    if !p.eat(",") {
                        p.expect("}")?;
                        break;
                    }
                }
            }
            other => return Err(format!("unexpected `{other}` at {}", p.i)),
        }
    }
    let resolve = |name: &str| resolve(&Expr::Ref(name.to_string()), &vars, 0);
    if let Some((_, local)) = exports.iter().find(|(e, _)| e == "default") {
        return resolve(local);
    }
    let mut out = Map::new();
    for (exported, local) in &exports {
        out.insert(exported.clone(), resolve(local)?);
    }
    Ok(Value::Object(out))
}

fn resolve(e: &Expr, vars: &HashMap<String, Expr>, depth: usize) -> Result<Value, String> {
    if depth > 64 {
        return Err("values nest too deeply".into());
    }
    Ok(match e {
        Expr::Value(v) => v.clone(),
        Expr::Ref(name) => {
            let target = vars
                .get(name)
                .ok_or_else(|| format!("unknown name `{name}`"))?;
            resolve(target, vars, depth + 1)?
        }
        Expr::Object(fields) => {
            let mut m = Map::new();
            for (k, v) in fields {
                m.insert(k.clone(), resolve(v, vars, depth + 1)?);
            }
            Value::Object(m)
        }
        Expr::Array(items) => Value::Array(
            items
                .iter()
                .map(|v| resolve(v, vars, depth + 1))
                .collect::<Result<_, _>>()?,
        ),
    })
}

struct Parser<'a> {
    s: &'a [u8],
    src: &'a str,
    i: usize,
}

impl Parser<'_> {
    fn done(&self) -> bool {
        self.i >= self.s.len()
    }

    fn peek(&self) -> u8 {
        self.s.get(self.i).copied().unwrap_or(0)
    }

    /// Skips white space and comments.
    fn skip(&mut self) {
        loop {
            while self.peek().is_ascii_whitespace() {
                self.i += 1;
            }
            if self.src[self.i..].starts_with("//") {
                self.i = self.src[self.i..]
                    .find('\n')
                    .map_or(self.s.len(), |j| self.i + j);
            } else if self.src[self.i..].starts_with("/*") {
                self.i = self.src[self.i + 2..]
                    .find("*/")
                    .map_or(self.s.len(), |j| self.i + 2 + j + 2);
            } else {
                break;
            }
        }
    }

    fn eat(&mut self, token: &str) -> bool {
        self.skip();
        if self.src[self.i..].starts_with(token) {
            self.i += token.len();
            true
        } else {
            false
        }
    }

    fn eat_word(&mut self, word: &str) -> bool {
        self.skip();
        let start = self.i;
        match self.ident() {
            Ok(w) if w == word => true,
            _ => {
                self.i = start;
                false
            }
        }
    }

    fn expect(&mut self, token: &str) -> Result<(), String> {
        if self.eat(token) {
            Ok(())
        } else {
            Err(format!("expected `{token}` at {}", self.i))
        }
    }

    fn ident(&mut self) -> Result<String, String> {
        self.skip();
        let start = self.i;
        while self.peek().is_ascii_alphanumeric() || matches!(self.peek(), b'_' | b'$') {
            self.i += 1;
        }
        if self.i == start || self.s[start].is_ascii_digit() {
            return Err(format!("expected a name at {start}"));
        }
        Ok(self.src[start..self.i].to_string())
    }

    fn expr(&mut self, depth: usize) -> Result<Expr, String> {
        if depth > 64 {
            return Err("values nest too deeply".into());
        }
        self.skip();
        match self.peek() {
            b'{' => {
                self.i += 1;
                let mut fields = Vec::new();
                while !self.eat("}") {
                    let key = self.key()?;
                    let value = if self.eat(":") {
                        self.expr(depth + 1)?
                    } else {
                        // `{a}` is `{a:a}`.
                        Expr::Ref(key.clone())
                    };
                    fields.push((key, value));
                    if !self.eat(",") {
                        self.expect("}")?;
                        break;
                    }
                }
                Ok(Expr::Object(fields))
            }
            b'[' => {
                self.i += 1;
                let mut items = Vec::new();
                while !self.eat("]") {
                    items.push(self.expr(depth + 1)?);
                    if !self.eat(",") {
                        self.expect("]")?;
                        break;
                    }
                }
                Ok(Expr::Array(items))
            }
            b'`' | b'"' | b'\'' => Ok(Expr::Value(Value::String(self.string()?))),
            b'!' => {
                // The minifier writes `!0` for true and `!1` for false.
                self.i += 1;
                match self.peek() {
                    b'0' => {
                        self.i += 1;
                        Ok(Expr::Value(Value::Bool(true)))
                    }
                    b'1' => {
                        self.i += 1;
                        Ok(Expr::Value(Value::Bool(false)))
                    }
                    _ => Err(format!("unexpected `!` at {}", self.i)),
                }
            }
            c if c.is_ascii_digit() || c == b'-' || c == b'.' => self.number(),
            _ => {
                let word = self.ident()?;
                Ok(match word.as_str() {
                    "true" => Expr::Value(Value::Bool(true)),
                    "false" => Expr::Value(Value::Bool(false)),
                    "null" => Expr::Value(Value::Null),
                    "void" => {
                        self.number()?;
                        Expr::Value(Value::Null)
                    }
                    // A large object is written as `JSON.parse(`{…}`)`: the text is read as JSON, nothing is called.
                    "JSON" => {
                        self.expect(".")?;
                        if self.ident()? != "parse" {
                            return Err(format!("unexpected call at {}", self.i));
                        }
                        self.expect("(")?;
                        self.skip();
                        if !matches!(self.peek(), b'`' | b'"' | b'\'') {
                            return Err(format!("expected text at {}", self.i));
                        }
                        let text = self.string()?;
                        self.expect(")")?;
                        Expr::Value(
                            serde_json::from_str(&text)
                                .map_err(|e| format!("bad JSON at {}: {e}", self.i))?,
                        )
                    }
                    _ => Expr::Ref(word),
                })
            }
        }
    }

    fn key(&mut self) -> Result<String, String> {
        self.skip();
        match self.peek() {
            b'`' | b'"' | b'\'' => self.string(),
            c if c.is_ascii_digit() => {
                let start = self.i;
                while self.peek().is_ascii_digit() {
                    self.i += 1;
                }
                Ok(self.src[start..self.i].to_string())
            }
            _ => self.ident(),
        }
    }

    fn number(&mut self) -> Result<Expr, String> {
        self.skip();
        let start = self.i;
        while self.peek().is_ascii_alphanumeric() || matches!(self.peek(), b'.' | b'-' | b'+') {
            self.i += 1;
        }
        let text = &self.src[start..self.i];
        text.parse::<f64>()
            .ok()
            .and_then(serde_json::Number::from_f64)
            .map(|n| Expr::Value(Value::Number(n)))
            .ok_or_else(|| format!("expected a number at {start}"))
    }

    /// A quoted string or a template without `${…}`, with its escapes read.
    fn string(&mut self) -> Result<String, String> {
        let quote = self.peek();
        let start = self.i;
        self.i += 1;
        let mut out = String::new();
        loop {
            let rest = &self.src[self.i..];
            let mut chars = rest.chars();
            let c = chars
                .next()
                .ok_or_else(|| format!("unclosed text from {start}"))?;
            self.i += c.len_utf8();
            match c {
                c if c as u32 == quote as u32 => return Ok(out),
                '$' if quote == b'`' && self.peek() == b'{' => {
                    return Err(format!("a template with a value at {start}"));
                }
                '\\' => {
                    let e = self.src[self.i..].chars().next().ok_or("unclosed text")?;
                    self.i += e.len_utf8();
                    match e {
                        'n' => out.push('\n'),
                        't' => out.push('\t'),
                        'r' => out.push('\r'),
                        'b' => out.push('\u{8}'),
                        'f' => out.push('\u{c}'),
                        'v' => out.push('\u{b}'),
                        '0' => out.push('\0'),
                        // A line continuation.
                        '\n' => {}
                        'u' => out.push(self.unicode_escape()?),
                        'x' => {
                            let hex = self.src.get(self.i..self.i + 2).ok_or("bad escape")?;
                            self.i += 2;
                            let n = u32::from_str_radix(hex, 16).map_err(|_| "bad escape")?;
                            out.push(char::from_u32(n).ok_or("bad escape")?);
                        }
                        other => out.push(other),
                    }
                }
                '\n' if quote != b'`' => return Err(format!("unclosed text from {start}")),
                c => out.push(c),
            }
        }
    }

    fn unicode_escape(&mut self) -> Result<char, String> {
        let hex = if self.peek() == b'{' {
            let end = self.src[self.i..].find('}').ok_or("bad escape")?;
            let hex = &self.src[self.i + 1..self.i + end];
            self.i += end + 1;
            hex
        } else {
            let hex = self.src.get(self.i..self.i + 4).ok_or("bad escape")?;
            self.i += 4;
            hex
        };
        let n = u32::from_str_radix(hex, 16).map_err(|_| "bad escape")?;
        // A surrogate pair is written as two escapes.
        if (0xD800..0xDC00).contains(&n) && self.src[self.i..].starts_with("\\u") {
            self.i += 2;
            let low = self.src.get(self.i..self.i + 4).ok_or("bad escape")?;
            self.i += 4;
            let low = u32::from_str_radix(low, 16).map_err(|_| "bad escape")?;
            let joined = 0x10000 + ((n - 0xD800) << 10) + (low.wrapping_sub(0xDC00) & 0x3FF);
            return char::from_u32(joined).ok_or_else(|| "bad escape".to_string());
        }
        char::from_u32(n).ok_or_else(|| "bad escape".to_string())
    }
}

#[cfg(test)]
mod tests;
