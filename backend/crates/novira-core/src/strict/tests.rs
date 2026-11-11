use super::*;
use serde::Deserialize;
use serde_json::json;
use std::collections::BTreeMap;

#[derive(Debug, PartialEq, Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
struct Inner {
    a: Option<u32>,
    b: Option<bool>,
}

#[derive(Debug, PartialEq, Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
struct Outer {
    name: Option<String>,
    inner: Option<Inner>,
    list: Vec<Inner>,
    by_key: BTreeMap<String, Inner>,
    pair: Option<(u32, Inner)>,
    tail: Vec<u32>,
}

#[derive(Debug, PartialEq, Deserialize)]
enum Shape {
    Dot,
    Size(Inner),
    Box { inner: Inner },
}

#[derive(Debug, PartialEq, Deserialize)]
struct Newtype(Inner);

fn refused<T: DeserializeOwned + std::fmt::Debug>(v: Value) -> String {
    from_value::<T>(v.clone())
        .expect_err(&format!("{v} was accepted"))
        .to_string()
}

// tags: equivalence
#[test]
fn a_valid_object_reads_as_serde_alone_reads_it() {
    let v = json!({
        "name": "n",
        "inner": {"a": 1, "b": true},
        "list": [{"a": 2}, {}],
        "byKey": {"k": {"b": false}},
        "pair": [3, {"a": 4}],
        "tail": [1, 2, 3],
    });
    let strict: Outer = from_value(v.clone()).unwrap();
    assert_eq!(strict, serde_json::from_value::<Outer>(v.clone()).unwrap());
    assert_eq!(strict.list.len(), 2);
    assert_eq!(
        strict.pair,
        Some((
            3,
            Inner {
                a: Some(4),
                b: None
            }
        ))
    );
    // Text takes the same road.
    assert_eq!(from_str::<Outer>(&v.to_string()).unwrap(), strict);
}

// tags: error-guessing
#[test]
fn an_array_is_refused_for_a_struct_at_the_top_and_says_what_was_expected() {
    for v in [json!([]), json!([1, true]), json!([null])] {
        let message = refused::<Inner>(v);
        assert!(
            message.contains("sequence") && message.contains("struct Inner"),
            "{message}"
        );
        // serde alone accepts each of them.
    }
    assert!(serde_json::from_value::<Inner>(json!([])).is_ok());
    assert!(serde_json::from_value::<Inner>(json!([1, true])).is_ok());
}

// tags: error-guessing, boundary
#[test]
fn an_array_is_refused_for_a_struct_at_every_depth() {
    refused::<Outer>(json!({"inner": []}));
    refused::<Outer>(json!({"inner": [1, true]}));
    refused::<Outer>(json!({"list": [{}, []]}));
    refused::<Outer>(json!({"byKey": {"k": []}}));
    refused::<Outer>(json!({"pair": [1, []]}));
    refused::<Outer>(json!([]));
    refused::<Newtype>(json!([]));
    refused::<Option<Inner>>(json!([]));
    refused::<Vec<Inner>>(json!([[]]));
}

// tags: equivalence
#[test]
fn an_array_is_still_read_where_the_type_is_a_list_or_a_tuple() {
    assert_eq!(from_value::<Vec<u32>>(json!([1, 2])).unwrap(), vec![1, 2]);
    assert_eq!(
        from_value::<(u32, bool)>(json!([1, true])).unwrap(),
        (1, true)
    );
    assert_eq!(
        from_value::<Vec<Vec<u32>>>(json!([[1], []])).unwrap(),
        vec![vec![1], vec![]]
    );
    // A value kept as JSON is not a struct: whatever it holds stays.
    assert_eq!(
        from_value::<Value>(json!([1, {"a": []}])).unwrap(),
        json!([1, {"a": []}])
    );
}

// tags: equivalence
#[test]
fn enum_variants_are_read_strictly_too() {
    assert_eq!(from_value::<Shape>(json!("Dot")).unwrap(), Shape::Dot);
    assert_eq!(
        from_value::<Shape>(json!({"Size": {"a": 1}})).unwrap(),
        Shape::Size(Inner {
            a: Some(1),
            b: None
        })
    );
    assert_eq!(
        from_value::<Shape>(json!({"Box": {"inner": {}}})).unwrap(),
        Shape::Box {
            inner: Inner::default()
        }
    );
    refused::<Shape>(json!({"Size": []}));
    refused::<Shape>(json!({"Box": []}));
    refused::<Shape>(json!({"Box": {"inner": []}}));
}

// tags: error-guessing
#[test]
fn text_with_trailing_content_or_a_bad_array_is_refused() {
    assert!(from_str::<Inner>("[]").is_err());
    assert!(from_str::<Inner>("{} x").is_err());
    assert!(from_str::<Inner>("").is_err());
    assert!(from_str::<Outer>(r#"{"inner": []}"#).is_err());
}

// tags: equivalence
#[test]
fn the_strict_wrapper_works_as_an_argument_type() {
    let ok: Strict<Inner> = serde_json::from_value(json!({"a": 5})).unwrap();
    assert_eq!(ok.0.a, Some(5));
    assert!(serde_json::from_value::<Strict<Inner>>(json!([])).is_err());
    assert!(serde_json::from_value::<Strict<Vec<Inner>>>(json!([[]])).is_err());
    assert_eq!(
        serde_json::from_value::<Strict<Option<Inner>>>(json!(null)).unwrap(),
        Strict(None)
    );
}

#[derive(Debug, PartialEq, Deserialize)]
struct Marker;

#[derive(Debug, PartialEq, Deserialize)]
struct Pair(u32, Inner);

#[derive(Debug, PartialEq, Deserialize)]
enum Wide {
    Two(u32, Inner),
}

// tags: equivalence
#[test]
fn unit_tuple_and_tuple_variant_shapes_read_as_serde_alone_reads_them() {
    assert_eq!(from_value::<Marker>(json!(null)).unwrap(), Marker);
    assert_eq!(
        from_value::<Pair>(json!([1, {"a": 2}])).unwrap(),
        Pair(
            1,
            Inner {
                a: Some(2),
                b: None
            }
        )
    );
    assert_eq!(
        from_value::<Wide>(json!({"Two": [3, {"b": true}]})).unwrap(),
        Wide::Two(
            3,
            Inner {
                a: None,
                b: Some(true)
            }
        )
    );
}

// tags: error-guessing
#[test]
fn a_struct_inside_a_tuple_shape_is_still_read_strictly() {
    // The tuple is a list by design, but the struct in it is not allowed to be one.
    assert!(!refused::<Pair>(json!([1, [2]])).is_empty());
    assert!(!refused::<Wide>(json!({"Two": [3, [true]]})).is_empty());
    assert!(from_value::<Marker>(json!([])).is_err());
}
