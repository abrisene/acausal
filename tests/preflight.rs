use acausal::{Assignment, Error, Limits, Model, ModelSpec, Row, Table, Variable};

#[test]
fn compile_capacity_is_checked_before_normalizing_tables() {
    let spec = ModelSpec::new(
        vec![Variable::new("a", ["x"]), Variable::new("b", ["y"])],
        vec![
            Table::new(
                "a",
                Vec::<String>::new(),
                vec![Row::new(Assignment::new(), [("x", f64::NAN)])],
            ),
            Table::new(
                "b",
                Vec::<String>::new(),
                vec![Row::new(Assignment::new(), [("y", 1.0)])],
            ),
        ],
        vec![],
    );
    let error = Model::compile_with_limits(
        spec,
        Limits {
            max_factors: 1,
            ..Default::default()
        },
    )
    .unwrap_err();
    assert_eq!(
        error,
        Error::BudgetExceeded {
            operations: 2,
            limit: 1
        }
    );
}
