//! The Wikipedia look-up when the connection itself fails: nothing listens, or the server hangs up in the middle of
//! the answer. One test, because the address override is a process-wide environment variable.
use novira_core::agent::reference::lookup;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[tokio::test]
async fn a_closed_port_and_a_cut_off_answer_are_sentences_for_the_model() {
    // A port that was free a moment ago and now has no listener.
    let closed = {
        let l = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        l.local_addr().unwrap().port()
    };
    std::env::set_var(
        "NOVIRA_TEST_WIKIPEDIA_EN_BASE",
        format!("http://127.0.0.1:{closed}"),
    );
    let err = lookup("en", "cats").await.unwrap_err();
    assert_eq!(err, "Cannot reach Wikipedia");

    // The server promises 1000 bytes, sends a few and hangs up.
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut buf = [0u8; 4096];
        let _ = socket.read(&mut buf).await;
        let _ = socket
            .write_all(b"HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: 1000\r\n\r\n{\"ba")
            .await;
        let _ = socket.shutdown().await;
    });
    std::env::set_var(
        "NOVIRA_TEST_WIKIPEDIA_EN_BASE",
        format!("http://127.0.0.1:{port}"),
    );
    let err = lookup("en", "cats").await.unwrap_err();
    assert_eq!(err, "Wikipedia's answer was cut off");
}

#[tokio::test]
async fn an_answer_sent_in_chunks_past_the_size_cap_is_refused_while_it_streams() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut buf = [0u8; 4096];
        let _ = socket.read(&mut buf).await;
        let _ = socket
            .write_all(b"HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ntransfer-encoding: chunked\r\n\r\n")
            .await;
        // 40 chunks of 64 KiB: more than the cap, with no length announced.
        let piece = vec![b' '; 65536];
        for _ in 0..40 {
            if socket.write_all(b"10000\r\n").await.is_err()
                || socket.write_all(&piece).await.is_err()
                || socket.write_all(b"\r\n").await.is_err()
            {
                return;
            }
        }
        let _ = socket.write_all(b"0\r\n\r\n").await;
    });
    std::env::set_var(
        "NOVIRA_TEST_WIKIPEDIA_JA_BASE",
        format!("http://127.0.0.1:{port}"),
    );
    let err = lookup("ja", "cats").await.unwrap_err();
    assert!(err.contains("unexpectedly large"), "{err}");
}
