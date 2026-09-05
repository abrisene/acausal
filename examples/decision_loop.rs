use acausal::{
    Assignment, GenerateOptions, Limits, Markov, Model, ModelSpec, Rng, Row, Table, Variable,
    Weighted,
};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut rng = Rng::seeded(42);
    let rewards = Weighted::new([
        ("common", 60.0),
        ("uncommon", 25.0),
        ("rare", 12.0),
        ("legendary", 3.0),
    ])?;
    println!("reward: {}", rewards.draw(&mut rng)?);

    // Corpus from the existing acausal Markov replay fixture.
    let mut language = Markov::new(2)?;
    language.learn([
        vec!["the", "cat", "sat", "on", "the", "mat"],
        vec!["the", "cat", "ate", "the", "fish"],
        vec!["a", "dog", "sat", "on", "the", "log"],
        vec!["a", "dog", "ate", "the", "bone"],
    ])?;
    let sentence = language.generate(
        &mut rng,
        GenerateOptions {
            min: 4,
            max: 12,
            max_attempts: 20,
            ..Default::default()
        },
    )?;
    println!("sentence: {}", sentence.join(" "));

    // The existing conditioning package's forward/reverse soldier example.
    let model = Model::compile(ModelSpec::new(
        vec![
            Variable::new("gender", ["female", "male"]),
            Variable::new("profession", ["baker", "soldier"]),
        ],
        vec![
            Table::new(
                "gender",
                Vec::<String>::new(),
                vec![Row::new(
                    Assignment::new(),
                    [("female", 1.0), ("male", 1.0)],
                )],
            ),
            Table::new(
                "profession",
                ["gender"],
                vec![
                    Row::new(
                        Assignment::from([("gender".into(), "female".into())]),
                        [("baker", 1.0), ("soldier", 1.0)],
                    ),
                    Row::new(
                        Assignment::from([("gender".into(), "male".into())]),
                        [("baker", 1.0), ("soldier", 1.5)],
                    ),
                ],
            ),
        ],
        vec![],
    ))?;
    let evidence = Assignment::from([("profession".into(), "soldier".into())]);
    println!(
        "gender given soldier: {:?}",
        model
            .posterior("gender", &evidence, Limits::default())?
            .probabilities
    );
    println!(
        "conditioned person: {:?}",
        model.sample(&mut rng, &evidence, Limits::default())?
    );
    println!("shared random stream uses: {}", rng.uses());
    Ok(())
}
