//! Reading the model's final answer: plain text for the chat, with the short account of how it read the request
//! (`<thoughts>` ... `</thoughts>` at its start) taken out.
use super::*;

/// Lines of reasoning kept, and the length of each.
const MAX_THOUGHTS: usize = 8;
const MAX_THOUGHT_CHARS: usize = 300;
/// The longest answer shown.
const MAX_TEXT_CHARS: usize = 20_000;

/// Turns the final answer into a reply: the thoughts block (when there is one) becomes `thoughts`, the rest `text`.
pub fn parse_reply(answer: &str) -> AgentReply {
    let answer = answer.trim();
    let (thoughts, text) = match (answer.find("<thoughts>"), answer.find("</thoughts>")) {
        (Some(start), Some(end)) if start < end => {
            let inner = &answer[start + "<thoughts>".len()..end];
            let rest = format!(
                "{}{}",
                &answer[..start],
                &answer[end + "</thoughts>".len()..]
            );
            (thoughts_of(inner), rest)
        }
        _ => (Vec::new(), answer.to_string()),
    };
    AgentReply {
        thoughts,
        text: text.trim().chars().take(MAX_TEXT_CHARS).collect(),
    }
}

/// The lines of the thoughts block: non-empty, list marks taken off, at most `MAX_THOUGHTS` of `MAX_THOUGHT_CHARS`.
fn thoughts_of(block: &str) -> Vec<String> {
    block
        .lines()
        .map(|l| l.trim().trim_start_matches(['-', '*', '•']).trim())
        .filter(|l| !l.is_empty())
        .map(|l| l.chars().take(MAX_THOUGHT_CHARS).collect::<String>())
        .take(MAX_THOUGHTS)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_thoughts_block_is_taken_out_of_the_text() {
        let reply = parse_reply(
            "<thoughts>\n- Read it as a portrait.\n- Picked SDXL.\n</thoughts>\nI set the prompt.",
        );
        assert_eq!(
            reply.thoughts,
            vec!["Read it as a portrait.", "Picked SDXL."]
        );
        assert_eq!(reply.text, "I set the prompt.");
    }

    #[test]
    fn an_answer_without_thoughts_is_all_text() {
        let reply = parse_reply("  Please say more.  ");
        assert!(reply.thoughts.is_empty());
        assert_eq!(reply.text, "Please say more.");
        // A block that is never closed, or closed before it opens, is text.
        assert!(parse_reply("<thoughts> half").thoughts.is_empty());
        assert_eq!(
            parse_reply("</thoughts> x <thoughts>").text,
            "</thoughts> x <thoughts>"
        );
    }

    #[test]
    fn thoughts_and_text_are_bounded() {
        let many: String = (0..20).map(|i| format!("line {i}\n")).collect();
        let long = "x".repeat(MAX_THOUGHT_CHARS + 50);
        let reply = parse_reply(&format!(
            "<thoughts>{many}{long}</thoughts>{}",
            "y".repeat(MAX_TEXT_CHARS + 5)
        ));
        assert_eq!(reply.thoughts.len(), MAX_THOUGHTS);
        assert!(reply
            .thoughts
            .iter()
            .all(|t| t.chars().count() <= MAX_THOUGHT_CHARS));
        assert_eq!(reply.text.chars().count(), MAX_TEXT_CHARS);
    }
}
