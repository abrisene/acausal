use acausal::{
    Assignment, Direction, Limits, Markov, Model, ModelSpec, Rng, RngState, Row, Table, Variable,
};

fn unright(y: u32, shift: u32) -> u32 {
    let mut x = y;
    for _ in 0..8 {
        x = y ^ (x >> shift);
    }
    x
}

fn unleft(y: u32, shift: u32, mask: u32) -> u32 {
    let mut x = y;
    for _ in 0..8 {
        x = y ^ ((x << shift) & mask);
    }
    x
}

fn untemper(y: u32) -> u32 {
    let value = unright(y, 18);
    let value = unleft(value, 15, 0xefc6_0000);
    let value = unleft(value, 7, 0x9d2c_5680);
    unright(value, 11)
}

fn state(first: u32, second: u32) -> RngState {
    RngState {
        version: RngState::VERSION,
        seed: 0u32.into(),
        uses: 0,
        index: 0,
        state: [untemper(first), untemper(second)]
            .into_iter()
            .chain(std::iter::repeat_n(0, 622))
            .collect(),
    }
}

#[test]
fn wide_i64_int_does_not_overflow_on_a_valid_result() {
    let mut rng = Rng::from_state(state(0x8000_0000, 1)).unwrap();
    assert_eq!(rng.int(-10, i64::MAX).unwrap(), i64::MAX - 8);
}

#[test]
fn conditional_sample_never_selects_zero_probability_value() {
    let model = Model::compile(ModelSpec::new(
        vec![Variable::new("x", ["a", "b", "c"])],
        vec![Table::new(
            "x",
            [] as [&str; 0],
            vec![Row::new(
                Assignment::new(),
                [("a", 1.0), ("b", 3.0), ("c", 0.0)],
            )],
        )],
        vec![],
    ))
    .unwrap();
    let mut rng = Rng::from_state(state(u32::MAX, u32::MAX)).unwrap();
    let sample = model
        .sample(&mut rng, &Assignment::new(), Limits::default())
        .unwrap();
    assert_eq!(sample["x"], "b");
}

#[test]
fn nonfinite_distribution_results_are_rejected() {
    let tiny = f64::from_bits(1);
    let mut rng = Rng::seeded(1);
    assert!(rng.exponential(tiny).is_err());
    assert!(rng.geometric(tiny).is_err());
}

#[test]
fn markov_rejects_overflowing_row_totals() {
    let mut model = Markov::new(1).unwrap();
    model.add_transition(&[], "a", f64::MAX).unwrap();
    assert!(model.add_transition(&[], "b", f64::MAX).is_err());

    let mut rng = Rng::seeded(1);
    assert!(
        model
            .step(&[], &mut rng, Direction::Forward)
            .unwrap()
            .is_some()
    );
}

#[test]
fn sampling_budget_covers_inference_and_one_draw() {
    let model = Model::compile(ModelSpec::new(
        vec![Variable::new("x", ["a", "b", "c"])],
        vec![Table::new(
            "x",
            [] as [&str; 0],
            vec![Row::new(
                Assignment::new(),
                [("a", 1.0), ("b", 3.0), ("c", 0.0)],
            )],
        )],
        vec![],
    ))
    .unwrap();
    let limits = Limits {
        max_operations: 14,
        ..Limits::default()
    };
    let mut rng = Rng::seeded(3);
    let result = model.sample(&mut rng, &Assignment::new(), limits).unwrap();
    assert_eq!(result["x"], "b");
}
