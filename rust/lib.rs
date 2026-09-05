//! Reusable models draw through a caller-owned random stream.

mod bridge;
mod conditioning;
mod markov;
mod rng;
mod weighted;

pub use conditioning::{
    Assignment, Constraint, Limits, Model, ModelSpec, Posterior, Row, Table, Variable,
};
pub use markov::{
    BlendStrategy, BoundaryData, Direction, GenerateOptions, Markov, MarkovData, MarkovStats,
    Score, TransitionData,
};
pub use rng::{Distribution, Rng, RngState, Seed};
pub use weighted::{Replacement, Weighted};

/// Failures are explicit; a failed search is distinct from empty support.
#[derive(Debug, Clone, PartialEq)]
pub enum Error {
    InvalidParameter(String),
    InvalidState(String),
    EmptySupport,
    InsufficientSupport { requested: usize, available: usize },
    InvalidModel(String),
    UnknownVariable(String),
    UnknownValue { variable: String, value: String },
    BudgetExceeded { operations: usize, limit: usize },
    GenerationExhausted { attempts: usize },
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidParameter(s) => write!(f, "invalid parameter: {s}"),
            Self::InvalidState(s) => write!(f, "invalid random state: {s}"),
            Self::EmptySupport => write!(f, "no supported choice"),
            Self::InsufficientSupport {
                requested,
                available,
            } => write!(
                f,
                "requested {requested} distinct choices, only {available} available"
            ),
            Self::InvalidModel(s) => write!(f, "invalid model: {s}"),
            Self::UnknownVariable(s) => write!(f, "unknown variable: {s}"),
            Self::UnknownValue { variable, value } => {
                write!(f, "unknown value {value:?} for {variable:?}")
            }
            Self::BudgetExceeded { operations, limit } => {
                write!(f, "work limit {limit} exceeded at {operations}")
            }
            Self::GenerationExhausted { attempts } => {
                write!(f, "generation exhausted after {attempts} attempts")
            }
        }
    }
}

impl std::error::Error for Error {}
