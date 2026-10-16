//! Writes fixtures/graph.json: golden conformance cases for the counter hash,
//! the pairwise network samplers and the pair statistics.
//!
//!     cargo run --offline --example graph_fixtures
//!
//! The Rust implementation is the reference. A port (wasm, Python, a GPU
//! shader, GDScript) must reproduce every `word`, `labels` and `table` here
//! exactly. Regenerate only after an intentional semantics change and read the
//! diff.

use acausal::{Budget, Counter, Edge, Network, Outcome, PairStats, PairTable, Schedule};
use std::fmt::Write as _;

/// Directions of a grid node's four edges: 0 east, 1 north, 2 west, 3 south.
fn grid(w: usize, h: usize) -> Vec<Vec<Edge>> {
    let mut edges = vec![Vec::new(); w * h];
    for y in 0..h {
        for x in 0..w {
            let i = y * w + x;
            if x + 1 < w {
                edges[i].push(Edge {
                    to: (i + 1) as u32,
                    relation: 0,
                });
            }
            if y + 1 < h {
                edges[i].push(Edge {
                    to: (i + w) as u32,
                    relation: 1,
                });
            }
            if x > 0 {
                edges[i].push(Edge {
                    to: (i - 1) as u32,
                    relation: 2,
                });
            }
            if y > 0 {
                edges[i].push(Edge {
                    to: (i - w) as u32,
                    relation: 3,
                });
            }
        }
    }
    edges
}

fn transpose(labels: u32, table: &PairTable) -> PairTable {
    let n = labels as usize;
    let mut w = vec![0; n * n];
    for a in 0..n {
        for b in 0..n {
            w[a * n + b] = table.get(b as u32, a as u32);
        }
    }
    PairTable::new(labels, w).unwrap()
}

/// Tables for relations 0..4 from the east and north tables.
fn four(labels: u32, east: PairTable, north: PairTable) -> Vec<PairTable> {
    let west = transpose(labels, &east);
    let south = transpose(labels, &north);
    vec![east, north, west, south]
}

fn table(labels: u32, rows: &[&[u32]]) -> PairTable {
    PairTable::new(
        labels,
        rows.iter().flat_map(|r| r.iter().copied()).collect(),
    )
    .unwrap()
}

fn all_labels(nodes: usize, labels: u32, weights: &[u32]) -> Vec<Vec<(u32, u32)>> {
    vec![(0..labels).map(|l| (l, weights[l as usize])).collect(); nodes]
}

struct Case {
    name: &'static str,
    labels: u32,
    edges: Vec<Vec<Edge>>,
    tables: Vec<PairTable>,
    unary: Vec<Vec<(u32, u32)>>,
}

fn list<T: std::fmt::Display>(items: impl IntoIterator<Item = T>) -> String {
    let parts: Vec<String> = items.into_iter().map(|i| i.to_string()).collect();
    format!("[{}]", parts.join(","))
}

fn network_json(case: &Case) -> String {
    let edges = case
        .edges
        .iter()
        .map(|node| list(node.iter().map(|e| format!("[{},{}]", e.to, e.relation))))
        .collect::<Vec<_>>();
    let tables = case
        .tables
        .iter()
        .map(|t| list(t.weights().iter()))
        .collect::<Vec<_>>();
    let unary = case
        .unary
        .iter()
        .map(|node| list(node.iter().map(|(l, w)| format!("[{l},{w}]"))))
        .collect::<Vec<_>>();
    format!(
        "{{\"labels\":{},\"edges\":{},\"tables\":{},\"unary\":{}}}",
        case.labels,
        list(edges),
        list(tables),
        list(unary)
    )
}

fn run_sample(net: &Network, seed: u32, gibbs: u32, icm: u32) -> String {
    let labels = net
        .sample(&Counter::new(seed), Schedule { gibbs, icm })
        .unwrap();
    format!(
        "{{\"op\":\"sample\",\"seed\":{seed},\"gibbs\":{gibbs},\"icm\":{icm},\"violations\":{},\"labels\":{}}}",
        net.violations(&labels),
        list(labels)
    )
}

fn run_solve(net: &Network, seed: u32, max_decisions: u32, max_backtracks: u32) -> String {
    let head = format!(
        "{{\"op\":\"solve\",\"seed\":{seed},\"maxDecisions\":{max_decisions},\"maxBacktracks\":{max_backtracks},"
    );
    match net.solve(
        &Counter::new(seed),
        Budget {
            max_decisions,
            max_backtracks,
        },
    ) {
        Outcome::Solved { labels, stats } => format!(
            "{head}\"status\":\"solved\",\"decisions\":{},\"backtracks\":{},\"labels\":{}}}",
            stats.decisions,
            stats.backtracks,
            list(labels)
        ),
        Outcome::Refused {
            reason,
            node,
            stats,
        } => format!(
            "{head}\"status\":\"refused\",\"reason\":\"{}\",\"node\":{},\"decisions\":{},\"backtracks\":{}}}",
            reason.name(),
            node.map_or("null".to_owned(), |n| n.to_string()),
            stats.decisions,
            stats.backtracks
        ),
    }
}

fn main() {
    let mut out = String::new();
    out.push_str("{\"schema\":1,\n\"counter\":[\n");
    let vectors: Vec<(u32, Vec<u32>)> = vec![
        (0, vec![]),
        (0, vec![0]),
        (1, vec![0]),
        (1, vec![1]),
        (42, vec![0, 0, 0]),
        (42, vec![1, 2, 3]),
        (42, vec![3, 2, 1]),
        (42, vec![1, 2, 3, 0]),
        (7, vec![1000, 0, 0]),
        (7, vec![1000, 1, 1]),
        (0xffff_ffff, vec![0xffff_ffff, 0xffff_ffff, 0xffff_ffff]),
        (123456789, vec![5, 4, 3, 2, 1]),
        (2024, vec![99, 0, 1]),
        (2024, vec![99, 1, 1]),
        (31337, vec![0, 17, 2]),
        (31337, vec![4095, 4095, 4095, 4095]),
    ];
    let rows: Vec<String> = vectors
        .iter()
        .map(|(seed, keys)| {
            let c = Counter::new(*seed);
            format!(
                "{{\"seed\":{seed},\"keys\":{},\"word\":{},\"unit\":{}}}",
                list(keys.iter()),
                c.word(keys),
                c.unit(keys)
            )
        })
        .collect();
    out.push_str(&rows.join(",\n"));
    out.push_str("\n],\n\"networks\":[\n");

    let mut cases: Vec<Case> = Vec::new();
    let same = table(2, &[&[9, 1], &[1, 9]]);
    cases.push(Case {
        name: "grid-attract-2",
        labels: 2,
        edges: grid(8, 6),
        tables: four(2, same.clone(), same),
        unary: all_labels(48, 2, &[1, 1]),
    });
    let differ3 = table(3, &[&[1, 8, 8], &[8, 1, 8], &[8, 8, 1]]);
    let like3 = table(3, &[&[8, 1, 1], &[1, 8, 1], &[1, 1, 8]]);
    cases.push(Case {
        name: "grid-stripes-3",
        labels: 3,
        edges: grid(10, 6),
        tables: four(3, differ3, like3),
        unary: all_labels(60, 3, &[1, 1, 1]),
    });
    let neutral = table(3, &[&[1, 1, 1], &[1, 1, 1], &[1, 1, 1]]);
    cases.push(Case {
        name: "grid-skewed-unary",
        labels: 3,
        edges: grid(6, 6),
        tables: four(3, neutral.clone(), neutral),
        unary: all_labels(36, 3, &[7, 2, 1]),
    });
    // Big weights stress the renormalisation: 250^4 overflows 32 bits.
    let heavy = table(2, &[&[250, 3], &[3, 250]]);
    cases.push(Case {
        name: "grid-heavy-weights",
        labels: 2,
        edges: grid(7, 7),
        tables: four(2, heavy.clone(), heavy),
        unary: all_labels(49, 2, &[4_000_000_000, 1_000_000]),
    });
    // Eight neighbours per node and weights large enough that products need
    // renormalising at every edge. Relation r points along direction r of
    // the king-move graph, and every table is symmetric.
    {
        let (w, h) = (6usize, 5usize);
        let directions: [(i32, i32); 8] = [
            (1, 0),
            (1, 1),
            (0, 1),
            (-1, 1),
            (-1, 0),
            (-1, -1),
            (0, -1),
            (1, -1),
        ];
        let mut king = vec![Vec::new(); w * h];
        for y in 0..h as i32 {
            for x in 0..w as i32 {
                for (r, (dx, dy)) in directions.iter().enumerate() {
                    let (nx, ny) = (x + dx, y + dy);
                    if (0..w as i32).contains(&nx) && (0..h as i32).contains(&ny) {
                        king[(y * w as i32 + x) as usize].push(Edge {
                            to: (ny * w as i32 + nx) as u32,
                            relation: r as u32,
                        });
                    }
                }
            }
        }
        let big = table(
            3,
            &[
                &[4_000_000_000, 7, 1],
                &[7, 300_000_000, 9],
                &[1, 9, 2_000_000_000],
            ],
        );
        cases.push(Case {
            name: "grid-king-moves-huge-weights",
            labels: 3,
            edges: king.clone(),
            tables: vec![big.clone(); 8],
            unary: all_labels(w * h, 3, &[4_000_000_000, 1, 3_000_000_000]),
        });
        // Every candidate of some node conflicts with a neighbour: the node
        // keeps its label and the labelling carries a violation.
        let differ3b = table(3, &[&[0, 5, 5], &[5, 0, 5], &[5, 5, 0]]);
        let mut triangle = vec![Vec::new(); 4];
        for (i, j) in [(0usize, 1usize), (0, 2), (1, 2), (0, 3), (1, 3), (2, 3)] {
            triangle[i].push(Edge {
                to: j as u32,
                relation: 0,
            });
            triangle[j].push(Edge {
                to: i as u32,
                relation: 0,
            });
        }
        cases.push(Case {
            name: "grid-frustrated-k4-three-labels",
            labels: 3,
            edges: triangle,
            tables: vec![differ3b],
            unary: all_labels(4, 3, &[1, 1, 1]),
        });
    }
    // More labels than a 40-bit total allows at full weight, so the draw
    // has to renormalise the total.
    cases.push(Case {
        name: "grid-three-hundred-labels",
        labels: 300,
        edges: vec![Vec::new(); 40],
        tables: vec![],
        unary: vec![(0..300).map(|l| (l, 4_294_967_295)).collect(); 40],
    });
    let differ2 = table(2, &[&[0, 1], &[1, 0]]);
    cases.push(Case {
        name: "wfc-checkerboard-2",
        labels: 2,
        edges: grid(7, 5),
        tables: four(2, differ2.clone(), differ2),
        unary: all_labels(35, 2, &[1, 1]),
    });
    let differ_all = table(3, &[&[0, 1, 1], &[1, 0, 1], &[1, 1, 0]]);
    cases.push(Case {
        name: "wfc-three-colouring",
        labels: 3,
        edges: grid(8, 6),
        tables: four(3, differ_all.clone(), differ_all.clone()),
        unary: all_labels(48, 3, &[3, 2, 1]),
    });
    // A pinned corner forces everything else through propagation.
    let mut pinned = all_labels(35, 2, &[1, 1]);
    pinned[0] = vec![(1, 1)];
    cases.push(Case {
        name: "wfc-pinned-corner",
        labels: 2,
        edges: grid(7, 5),
        tables: four(
            2,
            table(2, &[&[0, 1], &[1, 0]]),
            table(2, &[&[0, 1], &[1, 0]]),
        ),
        unary: pinned,
    });
    // Odd cycle: two labels that must differ cannot colour it.
    let mut ring = vec![Vec::new(); 5];
    for i in 0..5usize {
        let j = (i + 1) % 5;
        ring[i].push(Edge {
            to: j as u32,
            relation: 0,
        });
        ring[j].push(Edge {
            to: i as u32,
            relation: 0,
        });
    }
    cases.push(Case {
        name: "wfc-odd-cycle",
        labels: 2,
        edges: ring,
        tables: vec![table(2, &[&[0, 1], &[1, 0]])],
        unary: all_labels(5, 2, &[1, 1]),
    });
    // K5 with four labels that must differ: needs search to refute.
    let mut k5 = vec![Vec::new(); 5];
    for (i, node) in k5.iter_mut().enumerate() {
        for j in 0..5usize {
            if i != j {
                node.push(Edge {
                    to: j as u32,
                    relation: 0,
                });
            }
        }
    }
    let differ4 = table(
        4,
        &[&[0, 1, 1, 1], &[1, 0, 1, 1], &[1, 1, 0, 1], &[1, 1, 1, 0]],
    );
    cases.push(Case {
        name: "wfc-k5-four-colours",
        labels: 4,
        edges: k5,
        tables: vec![differ4],
        unary: all_labels(5, 4, &[1, 1, 1, 1]),
    });
    // Sparse random graphs near the hardest density for three colours: arc
    // consistency alone does not finish them, so the search must backtrack.
    // The first is colourable (the search backtracks and succeeds); the second
    // is not (the search exhausts and refuses).
    for (name, wire, density) in [
        ("wfc-random-colourable", 39u32, 3.8f64),
        ("wfc-random-unsatisfiable", 99, 4.6),
    ] {
        let mut random = vec![Vec::new(); 40];
        let wiring = Counter::new(wire);
        for i in 0..40u32 {
            for j in (i + 1)..40u32 {
                if (wiring.unit(&[i, j, 0]) as f64) < density / 39.0 * 16_777_216.0 {
                    random[i as usize].push(Edge { to: j, relation: 0 });
                    random[j as usize].push(Edge { to: i, relation: 0 });
                }
            }
        }
        cases.push(Case {
            name,
            labels: 3,
            edges: random,
            tables: vec![differ_all.clone()],
            unary: all_labels(40, 3, &[1, 1, 1]),
        });
    }
    let free = table(4, &[&[1; 4], &[1; 4], &[1; 4], &[1; 4]]);
    cases.push(Case {
        name: "wfc-unconstrained-path",
        labels: 4,
        edges: grid(20, 1),
        tables: four(4, free.clone(), free),
        unary: all_labels(20, 4, &[1, 1, 1, 1]),
    });

    let mut rendered = Vec::new();
    for case in &cases {
        let net = Network::new(
            case.labels,
            case.edges.clone(),
            case.tables.clone(),
            case.unary.clone(),
        )
        .unwrap();
        let mut runs = Vec::new();
        if case.name.starts_with("grid") {
            runs.push(run_sample(&net, 1, 6, 2));
            runs.push(run_sample(&net, 2, 6, 2));
            runs.push(run_sample(&net, 3, 0, 0));
            runs.push(run_sample(&net, 4, 3, 0));
            runs.push(run_sample(&net, 5, 0, 3));
        } else {
            for seed in [1u32, 2, 3] {
                runs.push(run_solve(&net, seed, 100_000, 1_000));
            }
            if case.name == "wfc-k5-four-colours" {
                runs.push(run_solve(&net, 1, 100_000, 2));
                runs.push(run_solve(&net, 1, 3, 1_000));
            }
            if case.name == "wfc-unconstrained-path" {
                runs.push(run_solve(&net, 1, 5, 10));
            }
        }
        let mut text = String::new();
        write!(
            text,
            "{{\"name\":\"{}\",\"network\":{},\"runs\":[\n{}\n]}}",
            case.name,
            network_json(case),
            runs.join(",\n")
        )
        .unwrap();
        rendered.push(text);
    }
    out.push_str(&rendered.join(",\n"));
    out.push_str("\n],\n\"pairStats\":[\n");

    // Pair statistics from a labelled grid.
    let edges = grid(6, 4);
    let pattern: Vec<u32> = (0..24)
        .map(|i| ((i % 6) / 2 + (i / 6)) as u32 % 3)
        .collect();
    let mut stats = PairStats::new(3).unwrap();
    stats.observe_graph(&edges, &pattern).unwrap();
    let mut relations = Vec::new();
    for r in 0..4u32 {
        relations.push(format!(
            "{{\"relation\":{r},\"pairs\":{},\"table\":{},\"support\":{}}}",
            list(
                stats
                    .pairs(r)
                    .iter()
                    .map(|(a, b, n)| format!("[{a},{b},{n}]"))
            ),
            list(stats.table(r).weights().iter()),
            list(stats.support_table(r).weights().iter())
        ));
    }
    out.push_str(&format!(
        "{{\"name\":\"grid-patterned\",\"labels\":3,\"edges\":{},\"nodeLabels\":{},\"labelCounts\":{},\"unaryWeights\":{},\"relations\":[{}]}}",
        list(edges.iter().map(|node| list(node.iter().map(|e| format!("[{},{}]", e.to, e.relation))))),
        list(pattern.iter()),
        list(stats.label_counts().iter()),
        list(stats.unary_weights().iter()),
        relations.join(",")
    ));
    out.push_str("\n]}\n");
    std::fs::create_dir_all("fixtures").unwrap();
    std::fs::write("fixtures/graph.json", out).unwrap();
    println!("wrote fixtures/graph.json");
}
