//! Replays fixtures/graph.json (written by `cargo run --example graph_fixtures`)
//! and asserts exact equality. The same file is replayed through the wasm and
//! Python bindings by scripts/smoke-bindings.*.

use acausal::{
    Budget, Counter, Edge, Network, Outcome, PairStats, PairTable, RepairBudget, RepairOutcome,
    Schedule,
};
use std::collections::BTreeMap;

#[derive(Debug, Clone)]
enum Json {
    Null,
    Num(f64),
    Str(String),
    List(Vec<Json>),
    Map(BTreeMap<String, Json>),
}

struct Parser<'a> {
    bytes: &'a [u8],
    at: usize,
}

impl Parser<'_> {
    fn ws(&mut self) {
        while self.at < self.bytes.len() && self.bytes[self.at].is_ascii_whitespace() {
            self.at += 1;
        }
    }
    fn eat(&mut self, c: u8) {
        self.ws();
        assert_eq!(self.bytes[self.at], c, "at {}", self.at);
        self.at += 1;
    }
    fn value(&mut self) -> Json {
        self.ws();
        match self.bytes[self.at] {
            b'{' => {
                self.at += 1;
                let mut map = BTreeMap::new();
                loop {
                    self.ws();
                    if self.bytes[self.at] == b'}' {
                        self.at += 1;
                        return Json::Map(map);
                    }
                    if self.bytes[self.at] == b',' {
                        self.at += 1;
                        continue;
                    }
                    let Json::Str(key) = self.value() else {
                        panic!("key")
                    };
                    self.eat(b':');
                    map.insert(key, self.value());
                }
            }
            b'[' => {
                self.at += 1;
                let mut list = Vec::new();
                loop {
                    self.ws();
                    if self.bytes[self.at] == b']' {
                        self.at += 1;
                        return Json::List(list);
                    }
                    if self.bytes[self.at] == b',' {
                        self.at += 1;
                        continue;
                    }
                    list.push(self.value());
                }
            }
            b'"' => {
                self.at += 1;
                let start = self.at;
                while self.bytes[self.at] != b'"' {
                    self.at += 1;
                }
                let s = String::from_utf8(self.bytes[start..self.at].to_vec()).unwrap();
                self.at += 1;
                Json::Str(s)
            }
            b'n' => {
                self.at += 4;
                Json::Null
            }
            _ => {
                let start = self.at;
                while self.at < self.bytes.len() && !b",]} \n".contains(&self.bytes[self.at]) {
                    self.at += 1;
                }
                Json::Num(
                    std::str::from_utf8(&self.bytes[start..self.at])
                        .unwrap()
                        .parse()
                        .unwrap(),
                )
            }
        }
    }
}

impl Json {
    fn get(&self, key: &str) -> &Json {
        match self {
            Json::Map(m) => m.get(key).unwrap_or_else(|| panic!("missing {key}")),
            _ => panic!("not a map"),
        }
    }
    fn list(&self) -> &[Json] {
        match self {
            Json::List(l) => l,
            _ => panic!("not a list"),
        }
    }
    fn u32(&self) -> u32 {
        match self {
            Json::Num(n) => *n as u32,
            _ => panic!("not a number"),
        }
    }
    fn u64(&self) -> u64 {
        match self {
            Json::Num(n) => *n as u64,
            _ => panic!("not a number"),
        }
    }
    fn str(&self) -> &str {
        match self {
            Json::Str(s) => s,
            _ => panic!("not a string"),
        }
    }
    fn u32s(&self) -> Vec<u32> {
        self.list().iter().map(Json::u32).collect()
    }
}

fn fixtures() -> Json {
    let text = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/fixtures/graph.json"))
        .unwrap();
    Parser {
        bytes: text.as_bytes(),
        at: 0,
    }
    .value()
}

fn edges_of(json: &Json) -> Vec<Vec<Edge>> {
    json.list()
        .iter()
        .map(|node| {
            node.list()
                .iter()
                .map(|e| {
                    let p = e.u32s();
                    Edge {
                        to: p[0],
                        relation: p[1],
                    }
                })
                .collect()
        })
        .collect()
}

#[test]
fn counter_words_match_the_fixture() {
    let f = fixtures();
    let rows = f.get("counter").list();
    assert!(rows.len() >= 10);
    for row in rows {
        let c = Counter::new(row.get("seed").u32());
        let keys = row.get("keys").u32s();
        assert_eq!(c.word(&keys), row.get("word").u32());
        assert_eq!(c.unit(&keys), row.get("unit").u32());
    }
}

#[test]
fn network_samples_and_solves_match_the_fixture() {
    let f = fixtures();
    let mut sampled = 0;
    let mut solved = 0;
    let mut refused = 0;
    let mut repaired = 0;
    let mut repair_refused = 0;
    for case in f.get("networks").list() {
        let n = case.get("network");
        let labels = n.get("labels").u32();
        let tables = n
            .get("tables")
            .list()
            .iter()
            .map(|t| PairTable::new(labels, t.u32s()).unwrap())
            .collect();
        let unary = n
            .get("unary")
            .list()
            .iter()
            .map(|node| {
                node.list()
                    .iter()
                    .map(|p| {
                        let v = p.u32s();
                        (v[0], v[1])
                    })
                    .collect()
            })
            .collect();
        let net = Network::new(labels, edges_of(n.get("edges")), tables, unary).unwrap();
        for run in case.get("runs").list() {
            let seed = run.get("seed").u32();
            match run.get("op").str() {
                "sample" => {
                    let got = net
                        .sample(
                            &Counter::new(seed),
                            Schedule {
                                gibbs: run.get("gibbs").u32(),
                                icm: run.get("icm").u32(),
                            },
                        )
                        .unwrap();
                    assert_eq!(
                        net.violations(&got).unwrap() as u32,
                        run.get("violations").u32()
                    );
                    assert_eq!(
                        got,
                        run.get("labels").u32s(),
                        "{} seed {seed}",
                        case.get("name").str()
                    );
                    sampled += 1;
                }
                "solve" => {
                    let outcome = net.solve(
                        &Counter::new(seed),
                        Budget {
                            max_decisions: run.get("maxDecisions").u32(),
                            max_backtracks: run.get("maxBacktracks").u32(),
                        },
                    );
                    match (outcome, run.get("status").str()) {
                        (Outcome::Solved { labels, stats }, "solved") => {
                            assert_eq!(labels, run.get("labels").u32s());
                            assert_eq!(stats.decisions, run.get("decisions").u32());
                            assert_eq!(stats.backtracks, run.get("backtracks").u32());
                            // A solved labelling really satisfies every edge.
                            for (node, list) in net_edges(n).iter().enumerate() {
                                for e in list {
                                    let t = &net_table(n, e.relation);
                                    assert!(t.get(labels[node], labels[e.to as usize]) > 0);
                                }
                            }
                            solved += 1;
                        }
                        (
                            Outcome::Refused {
                                reason,
                                node,
                                stats,
                            },
                            "refused",
                        ) => {
                            assert_eq!(reason.name(), run.get("reason").str());
                            assert_eq!(
                                node,
                                match run.get("node") {
                                    Json::Null => None,
                                    j => Some(j.u32()),
                                }
                            );
                            assert_eq!(stats.decisions, run.get("decisions").u32());
                            assert_eq!(stats.backtracks, run.get("backtracks").u32());
                            refused += 1;
                        }
                        (other, status) => panic!(
                            "{}: got {other:?}, fixture says {status}",
                            case.get("name").str()
                        ),
                    }
                }
                "repair" => {
                    let start = run.get("start").u32s();
                    let outcome = net
                        .repair(
                            &start,
                            &Counter::new(seed),
                            RepairBudget {
                                max_radius: run.get("maxRadius").u32(),
                                max_decisions: run.get("maxDecisions").u32(),
                                max_backtracks: run.get("maxBacktracks").u32(),
                                max_rounds: run.get("maxRounds").u32(),
                            },
                        )
                        .unwrap();
                    let name = case.get("name").str();
                    let (labels, stats) = match (&outcome, run.get("status").str()) {
                        (RepairOutcome::Repaired { labels, stats }, "repaired") => {
                            // A repaired labelling really satisfies every edge.
                            for (node, list) in net_edges(n).iter().enumerate() {
                                for e in list {
                                    let t = &net_table(n, e.relation);
                                    assert!(t.get(labels[node], labels[e.to as usize]) > 0);
                                }
                            }
                            repaired += 1;
                            (labels, stats)
                        }
                        (
                            RepairOutcome::Refused {
                                reason,
                                node,
                                remaining,
                                labels,
                                stats,
                            },
                            "refused",
                        ) => {
                            assert_eq!(reason.name(), run.get("reason").str(), "{name}");
                            assert_eq!(*node, run.get("node").u32(), "{name}");
                            assert_eq!(*remaining as u32, run.get("remaining").u32(), "{name}");
                            assert_eq!(net.violations(labels).unwrap(), *remaining);
                            repair_refused += 1;
                            (labels, stats)
                        }
                        (other, status) => {
                            panic!("{name}: got {other:?}, fixture says {status}")
                        }
                    };
                    assert_eq!(labels, &run.get("labels").u32s(), "{name} seed {seed}");
                    assert_eq!(stats.rounds, run.get("rounds").u32(), "{name}");
                    assert_eq!(stats.decisions, run.get("decisions").u32(), "{name}");
                    assert_eq!(stats.backtracks, run.get("backtracks").u32(), "{name}");
                    assert_eq!(stats.changed, run.get("changed").u32(), "{name}");
                }
                op => panic!("unknown op {op}"),
            }
        }
    }
    assert!(
        sampled >= 20 && solved >= 10 && refused >= 6 && repaired >= 4 && repair_refused >= 4,
        "{sampled} {solved} {refused} {repaired} {repair_refused}"
    );
}

fn net_edges(n: &Json) -> Vec<Vec<Edge>> {
    edges_of(n.get("edges"))
}

fn net_table(n: &Json, relation: u32) -> PairTable {
    let labels = n.get("labels").u32();
    PairTable::new(labels, n.get("tables").list()[relation as usize].u32s()).unwrap()
}

#[test]
fn pair_statistics_match_the_fixture() {
    let f = fixtures();
    for case in f.get("pairStats").list() {
        let labels = case.get("labels").u32();
        let mut stats = PairStats::new(labels).unwrap();
        stats
            .observe_graph(&edges_of(case.get("edges")), &case.get("nodeLabels").u32s())
            .unwrap();
        let counts: Vec<u64> = case
            .get("labelCounts")
            .list()
            .iter()
            .map(Json::u64)
            .collect();
        assert_eq!(stats.label_counts(), counts);
        assert_eq!(stats.unary_weights(), case.get("unaryWeights").u32s());
        for r in case.get("relations").list() {
            let relation = r.get("relation").u32();
            let pairs: Vec<(u32, u32, u64)> = r
                .get("pairs")
                .list()
                .iter()
                .map(|p| {
                    let v = p.list();
                    (v[0].u32(), v[1].u32(), v[2].u64())
                })
                .collect();
            assert_eq!(stats.pairs(relation), pairs);
            assert_eq!(stats.table(relation).weights(), r.get("table").u32s());
            assert_eq!(
                stats.support_table(relation).weights(),
                r.get("support").u32s()
            );
        }
    }
}
