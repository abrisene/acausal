//! Exact conditioning over small, finite categorical models.
//!
//! The authored representation deliberately keeps rows small: a table owns
//! its target and parent scope, while a row contains only the parent values
//! and the target weights.  Compilation turns those tables into private
//! factors.  Query and sampling paths then use the same evidence validation
//! and variable-elimination implementation.

use std::collections::{BTreeMap, BTreeSet};

use crate::{Error, Rng};

/// A complete or partial assignment of finite categorical variables.
pub type Assignment = BTreeMap<String, String>;

/// A finite variable and its (ordered) domain.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Variable {
    pub id: String,
    pub domain: Vec<String>,
}

impl Variable {
    pub fn new<I, S>(id: impl Into<String>, domain: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        Self {
            id: id.into(),
            domain: domain.into_iter().map(Into::into).collect(),
        }
    }
}

/// A conditional-table row.  `parent_values` has one entry for each parent
/// in the enclosing table; `weights` contains one `(outcome, raw weight)`
/// pair for each value in that table's target domain.
#[derive(Clone, Debug, PartialEq)]
pub struct Row {
    pub parent_values: Assignment,
    pub weights: Vec<(String, f64)>,
}

impl Row {
    pub fn new<I, S>(parent_values: Assignment, weights: I) -> Self
    where
        I: IntoIterator<Item = (S, f64)>,
        S: Into<String>,
    {
        Self {
            parent_values,
            weights: weights
                .into_iter()
                .map(|(outcome, weight)| (outcome.into(), weight))
                .collect(),
        }
    }
}

/// A conditional table for one target variable.
#[derive(Clone, Debug, PartialEq)]
pub struct Table {
    pub target: String,
    pub parents: Vec<String>,
    pub rows: Vec<Row>,
}

impl Table {
    pub fn new<I, S>(target: impl Into<String>, parents: I, rows: Vec<Row>) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        Self {
            target: target.into(),
            parents: parents.into_iter().map(Into::into).collect(),
            rows,
        }
    }
}

/// A hard constraint over a partial assignment.
///
/// Each `Allowed` constraint contains alternatives and requires the full
/// assignment to match one of them.  Every `Forbidden` pattern excludes
/// matching full assignments.  With no allowed constraints, all assignments
/// are allowed apart from forbidden patterns.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Constraint {
    Allowed(Vec<Assignment>),
    Forbidden(Assignment),
}

impl Constraint {
    pub fn allowed(patterns: Vec<Assignment>) -> Self {
        Self::Allowed(patterns)
    }

    pub fn forbidden(assignment: Assignment) -> Self {
        Self::Forbidden(assignment)
    }

    fn patterns(&self) -> &[Assignment] {
        match self {
            Self::Allowed(patterns) => patterns,
            Self::Forbidden(pattern) => std::slice::from_ref(pattern),
        }
    }

    fn is_allowed_pattern(&self) -> bool {
        matches!(self, Self::Allowed(_))
    }
}

/// Limits applied before factor allocation and throughout one operation.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Limits {
    pub max_domain_size: usize,
    pub max_variables: usize,
    pub max_factors: usize,
    pub max_elimination_width: usize,
    pub max_joint_support: usize,
    pub max_operations: usize,
}

impl Default for Limits {
    fn default() -> Self {
        Self {
            max_domain_size: 256,
            max_variables: 512,
            max_factors: 1_024,
            max_elimination_width: 12,
            max_joint_support: 100_000,
            max_operations: 1_000_000,
        }
    }
}

/// A normalized posterior for one variable.
#[derive(Clone, Debug, PartialEq)]
pub struct Posterior {
    pub target: String,
    pub probabilities: BTreeMap<String, f64>,
}

/// The small authored model accepted by [`Model::compile`].
#[derive(Clone, Debug, PartialEq)]
pub struct ModelSpec {
    pub variables: Vec<Variable>,
    pub tables: Vec<Table>,
    pub constraints: Vec<Constraint>,
    pub id: Option<String>,
    pub revision: Option<String>,
}

impl ModelSpec {
    pub fn new(variables: Vec<Variable>, tables: Vec<Table>, constraints: Vec<Constraint>) -> Self {
        Self {
            variables,
            tables,
            constraints,
            id: None,
            revision: None,
        }
    }
}

#[derive(Clone, Debug)]
struct CompiledRow {
    parents: Assignment,
    /// Normalized log weights.  Zero raw weights are represented by
    /// negative infinity and do not enter runtime factor rows.
    outcomes: BTreeMap<String, f64>,
}

#[derive(Clone, Debug)]
struct CompiledTable {
    target: String,
    parents: Vec<String>,
    rows: Vec<CompiledRow>,
}

/// A validated, immutable compiled model.
#[derive(Clone, Debug)]
pub struct Model {
    spec: ModelSpec,
    variables: Vec<Variable>,
    tables: Vec<CompiledTable>,
    constraints: Vec<Constraint>,
    id: Option<String>,
    revision: Option<String>,
}

impl Model {
    /// Compile using the default safety limits.
    pub fn compile(spec: ModelSpec) -> Result<Self, Error> {
        Self::compile_with_limits(spec, Limits::default())
    }

    /// Compile with explicit preflight limits.
    pub fn compile_with_limits(spec: ModelSpec, limits: Limits) -> Result<Self, Error> {
        validate_limits(limits)?;
        if spec.variables.is_empty() {
            return Err(Error::InvalidModel(
                "model must declare at least one variable".into(),
            ));
        }
        if spec.variables.len() > limits.max_variables {
            return Err(limit_error(spec.variables.len(), limits.max_variables));
        }
        preflight_spec(&spec, limits)?;
        let authored_spec = spec.clone();

        let mut variables = spec.variables;
        variables.sort_by(|left, right| left.id.cmp(&right.id));
        let mut variable_ids = BTreeSet::new();
        for variable in &variables {
            if variable.id.is_empty() {
                return Err(Error::InvalidModel("variable id must not be empty".into()));
            }
            if !variable_ids.insert(variable.id.clone()) {
                return Err(Error::InvalidModel(format!(
                    "duplicate variable id {:?}",
                    variable.id
                )));
            }
            if variable.domain.is_empty() {
                return Err(Error::InvalidModel(format!(
                    "variable {:?} has an empty domain",
                    variable.id
                )));
            }
            let mut values = BTreeSet::new();
            for value in &variable.domain {
                if value.is_empty() {
                    return Err(Error::InvalidModel(format!(
                        "variable {:?} contains an empty value",
                        variable.id
                    )));
                }
                if !values.insert(value.clone()) {
                    return Err(Error::InvalidModel(format!(
                        "duplicate domain value {:?} for {:?}",
                        value, variable.id
                    )));
                }
            }
        }
        let variable_by_id: BTreeMap<String, Variable> = variables
            .iter()
            .cloned()
            .map(|variable| (variable.id.clone(), variable))
            .collect();

        let mut tables = spec.tables;
        tables.sort_by(|left, right| left.target.cmp(&right.target));
        if tables.len() != variables.len() {
            return Err(Error::InvalidModel(format!(
                "expected one table per variable, got {} tables for {} variables",
                tables.len(),
                variables.len()
            )));
        }
        let mut targets = BTreeSet::new();
        let mut compiled_tables = Vec::with_capacity(tables.len());
        for table in tables {
            if !variable_ids.contains(&table.target) {
                return Err(Error::UnknownVariable(table.target));
            }
            if !targets.insert(table.target.clone()) {
                return Err(Error::InvalidModel(format!(
                    "duplicate table for target {:?}",
                    table.target
                )));
            }
            let target = variable_by_id
                .get(&table.target)
                .expect("target checked above");
            validate_table_scope(&table, &variable_ids)?;
            let expected_rows = checked_product(
                table
                    .parents
                    .iter()
                    .map(|parent| variable_by_id[parent].domain.len()),
                limits.max_joint_support,
            )?;
            let factor_support =
                expected_rows
                    .checked_mul(target.domain.len())
                    .ok_or_else(|| {
                        limit_error(limits.max_joint_support + 1, limits.max_joint_support)
                    })?;
            if factor_support > limits.max_joint_support {
                return Err(limit_error(factor_support, limits.max_joint_support));
            }
            if table.rows.len() != expected_rows {
                return Err(Error::InvalidModel(format!(
                    "table {:?} has {} rows, expected {}",
                    table.target,
                    table.rows.len(),
                    expected_rows
                )));
            }

            let mut seen_parents = BTreeSet::new();
            let mut normalized_rows = Vec::with_capacity(table.rows.len());
            for row in table.rows {
                validate_parent_values(&row.parent_values, &table.parents, &variable_by_id)?;
                if !seen_parents.insert(row.parent_values.clone()) {
                    return Err(Error::InvalidModel(format!(
                        "duplicate parent row in table {:?}",
                        table.target
                    )));
                }
                let mut raw = BTreeMap::new();
                for (outcome, weight) in row.weights {
                    if !target.domain.contains(&outcome) {
                        return Err(Error::UnknownValue {
                            variable: table.target.clone(),
                            value: outcome,
                        });
                    }
                    if raw.insert(outcome.clone(), weight).is_some() {
                        return Err(Error::InvalidModel(format!(
                            "duplicate outcome {:?} in table {:?}",
                            outcome, table.target
                        )));
                    }
                    if !weight.is_finite() || weight < 0.0 {
                        return Err(Error::InvalidModel(format!(
                            "weight for {:?} in table {:?} must be finite and nonnegative",
                            outcome, table.target
                        )));
                    }
                }
                if raw.len() != target.domain.len()
                    || target
                        .domain
                        .iter()
                        .any(|outcome| !raw.contains_key(outcome))
                {
                    return Err(Error::InvalidModel(format!(
                        "table {:?} must provide exactly one weight for every target value",
                        table.target
                    )));
                }
                let total: f64 = raw.values().sum();
                if total.partial_cmp(&0.0) != Some(std::cmp::Ordering::Greater)
                    || !total.is_finite()
                {
                    return Err(Error::InvalidModel(format!(
                        "table {:?} contains an all-zero or overflowing row",
                        table.target
                    )));
                }
                let outcomes = raw
                    .into_iter()
                    .map(|(outcome, weight)| {
                        (
                            outcome,
                            if weight == 0.0 {
                                f64::NEG_INFINITY
                            } else {
                                (weight / total).ln()
                            },
                        )
                    })
                    .collect();
                normalized_rows.push(CompiledRow {
                    parents: row.parent_values,
                    outcomes,
                });
            }
            compiled_tables.push(CompiledTable {
                target: table.target,
                parents: table.parents,
                rows: normalized_rows,
            });
        }
        if targets.len() != variables.len() {
            return Err(Error::InvalidModel(
                "every variable requires a conditional table".into(),
            ));
        }

        validate_acyclic(&variables, &compiled_tables)?;
        validate_constraints(&spec.constraints, &variable_by_id)?;

        Ok(Self {
            spec: authored_spec,
            variables,
            tables: compiled_tables,
            constraints: spec.constraints,
            id: spec.id,
            revision: spec.revision,
        })
    }

    pub fn id(&self) -> Option<&str> {
        self.id.as_deref()
    }

    pub fn revision(&self) -> Option<&str> {
        self.revision.as_deref()
    }

    pub fn variables(&self) -> &[Variable] {
        &self.variables
    }

    /// Return the authored description used to create this compiled model.
    pub fn to_spec(&self) -> ModelSpec {
        self.spec.clone()
    }

    /// Compute an exact normalized posterior under arbitrary evidence.
    pub fn posterior(
        &self,
        target: &str,
        evidence: &Assignment,
        limits: Limits,
    ) -> Result<Posterior, Error> {
        validate_limits(limits)?;
        let evidence = self.validate_evidence(Some(target), evidence)?;
        self.validate_for_limits(limits)?;
        let mut budget = Budget::new(limits);
        let target_variable = self.variable(target)?;

        // Restriction removes fixed variables from factor scopes.  For a
        // pinned target, therefore, run the full scalar support check first
        // and return its point mass only after the rest of the model agrees.
        if let Some(fixed) = evidence.get(target) {
            let result = self.infer_factor(None, &evidence, &mut budget, limits)?;
            let support = result
                .iter()
                .map(|entry| entry.log_value)
                .fold(f64::NEG_INFINITY, log_add);
            if support == f64::NEG_INFINITY {
                return Err(Error::EmptySupport);
            }
            return Ok(Posterior {
                target: target.to_owned(),
                probabilities: target_variable
                    .domain
                    .iter()
                    .map(|value| (value.clone(), usize::from(value == fixed) as f64))
                    .collect(),
            });
        }

        let result = self.infer_factor(Some(target), &evidence, &mut budget, limits)?;

        let mut log_by_value = BTreeMap::new();
        for value in &target_variable.domain {
            let log_value = result
                .iter()
                .filter(|entry| entry.assignment.get(target) == Some(value))
                .map(|entry| entry.log_value)
                .fold(f64::NEG_INFINITY, log_add);
            log_by_value.insert(value.clone(), log_value);
        }
        let partition = log_by_value
            .values()
            .copied()
            .fold(f64::NEG_INFINITY, log_add);
        if partition == f64::NEG_INFINITY {
            return Err(Error::EmptySupport);
        }

        let mut probabilities = BTreeMap::new();
        for value in &target_variable.domain {
            let probability = match log_by_value[value] {
                value if value == f64::NEG_INFINITY => 0.0,
                value => (value - partition).exp(),
            };
            probabilities.insert(value.clone(), probability);
        }
        Ok(Posterior {
            target: target.to_owned(),
            probabilities,
        })
    }

    /// Draw one complete assignment from the exact conditional joint
    /// distribution. Evidence may pin root or non-root variables.
    pub fn sample(
        &self,
        rng: &mut Rng,
        evidence: &Assignment,
        limits: Limits,
    ) -> Result<Assignment, Error> {
        validate_limits(limits)?;
        let evidence = self.validate_evidence(None, evidence)?;
        self.validate_for_limits(limits)?;
        let mut budget = Budget::new(limits);

        // Check global evidence support before returning an all-fixed
        // assignment or beginning any random draws.
        self.infer_factor(None, &evidence, &mut budget, limits)?;
        let mut assignment = evidence.clone();
        for variable in &self.variables {
            if assignment.contains_key(&variable.id) {
                continue;
            }
            let posterior =
                self.posterior_with_budget(&variable.id, &assignment, &mut budget, limits)?;
            let positive: Vec<(&str, f64)> = variable
                .domain
                .iter()
                .filter_map(|value| {
                    let probability = posterior.probabilities[value];
                    (probability > 0.0 && probability.is_finite())
                        .then_some((value.as_str(), probability))
                })
                .collect();
            let total: f64 = positive.iter().map(|(_, probability)| *probability).sum();
            if total.partial_cmp(&0.0) != Some(std::cmp::Ordering::Greater) || !total.is_finite() {
                return Err(Error::EmptySupport);
            }
            // Exponentiation can leave a normalized posterior summing just
            // below one. Draw over positive mass so a boundary draw can
            // never silently select a zero-probability domain value.
            budget.charge(1)?;
            let draw = rng.float(0.0, total)?;
            let mut cursor = 0.0;
            let mut selected = positive.last().map(|(value, _)| (*value).to_owned());
            for (value, probability) in positive {
                cursor += probability;
                if draw < cursor {
                    selected = Some(value.to_owned());
                    break;
                }
            }
            let value = selected.ok_or(Error::EmptySupport)?;
            assignment.insert(variable.id.clone(), value);
        }
        Ok(assignment)
    }

    fn posterior_with_budget(
        &self,
        target: &str,
        evidence: &Assignment,
        budget: &mut Budget,
        limits: Limits,
    ) -> Result<Posterior, Error> {
        let evidence = self.validate_evidence(Some(target), evidence)?;
        let result = self.infer_factor(Some(target), &evidence, budget, limits)?;
        let target_variable = self.variable(target)?;
        let mut log_by_value = BTreeMap::new();
        for value in &target_variable.domain {
            log_by_value.insert(
                value.clone(),
                result
                    .iter()
                    .filter(|entry| entry.assignment.get(target) == Some(value))
                    .map(|entry| entry.log_value)
                    .fold(f64::NEG_INFINITY, log_add),
            );
        }
        let partition = log_by_value
            .values()
            .copied()
            .fold(f64::NEG_INFINITY, log_add);
        if partition == f64::NEG_INFINITY {
            return Err(Error::EmptySupport);
        }
        let probabilities = target_variable
            .domain
            .iter()
            .map(|value| {
                let log_value = log_by_value[value];
                (
                    value.clone(),
                    if log_value == f64::NEG_INFINITY {
                        0.0
                    } else {
                        (log_value - partition).exp()
                    },
                )
            })
            .collect();
        Ok(Posterior {
            target: target.to_owned(),
            probabilities,
        })
    }

    fn validate_for_limits(&self, limits: Limits) -> Result<(), Error> {
        if self.variables.len() > limits.max_variables {
            return Err(limit_error(self.variables.len(), limits.max_variables));
        }
        for variable in &self.variables {
            if variable.domain.len() > limits.max_domain_size {
                return Err(limit_error(variable.domain.len(), limits.max_domain_size));
            }
        }
        let factor_count = self.tables.len() + self.constraints.len();
        if factor_count > limits.max_factors {
            return Err(limit_error(factor_count, limits.max_factors));
        }
        Ok(())
    }

    fn validate_evidence(
        &self,
        target: Option<&str>,
        evidence: &Assignment,
    ) -> Result<Assignment, Error> {
        if let Some(target) = target {
            self.variable(target)?;
        }
        for (variable, value) in evidence {
            let declaration = self.variable(variable)?;
            if !declaration
                .domain
                .iter()
                .any(|candidate| candidate == value)
            {
                return Err(Error::UnknownValue {
                    variable: variable.clone(),
                    value: value.clone(),
                });
            }
        }
        Ok(evidence.clone())
    }

    fn variable(&self, id: &str) -> Result<&Variable, Error> {
        self.variables
            .iter()
            .find(|variable| variable.id == id)
            .ok_or_else(|| Error::UnknownVariable(id.to_owned()))
    }

    fn infer_factor(
        &self,
        target: Option<&str>,
        evidence: &Assignment,
        budget: &mut Budget,
        limits: Limits,
    ) -> Result<Vec<FactorEntry>, Error> {
        let mut factors = self.runtime_factors(evidence, budget)?;
        let active: BTreeSet<String> = self
            .variables
            .iter()
            .filter(|variable| !evidence.contains_key(&variable.id))
            .map(|variable| variable.id.clone())
            .collect();
        let eliminable: BTreeSet<String> = active
            .iter()
            .filter(|variable| Some(variable.as_str()) != target)
            .cloned()
            .collect();
        let plan = plan_order(&factors, &active, &eliminable, budget, limits)?;
        for variable in plan {
            let mut selected = Vec::new();
            let mut retained = Vec::new();
            for factor in factors {
                if factor.scope.contains(&variable) {
                    selected.push(factor);
                } else {
                    retained.push(factor);
                }
            }
            if !selected.is_empty() {
                let product = multiply_factors(selected, budget)?;
                retained.push(sum_out(product, &variable, budget)?);
            }
            factors = retained;
        }
        let mut result = multiply_factors(factors, budget)?;
        if let Some(target) = target {
            let remaining: Vec<String> = result
                .scope
                .iter()
                .filter(|variable| variable.as_str() != target)
                .cloned()
                .collect();
            for variable in remaining {
                result = sum_out(result, &variable, budget)?;
            }
        } else {
            let remaining = result.scope.clone();
            for variable in remaining {
                result = sum_out(result, &variable, budget)?;
            }
        }
        Ok(result.entries)
    }

    fn runtime_factors(
        &self,
        evidence: &Assignment,
        budget: &mut Budget,
    ) -> Result<Vec<Factor>, Error> {
        let mut factors = Vec::with_capacity(self.tables.len() + 1);
        for table in &self.tables {
            let mut scope = table.parents.clone();
            scope.push(table.target.clone());
            let mut entries = Vec::new();
            for row in &table.rows {
                for (outcome, log_value) in &row.outcomes {
                    budget.charge(1)?;
                    if *log_value == f64::NEG_INFINITY {
                        continue;
                    }
                    let mut assignment = row.parents.clone();
                    assignment.insert(table.target.clone(), outcome.clone());
                    if evidence.iter().any(|(variable, value)| {
                        assignment
                            .get(variable)
                            .is_some_and(|actual| actual != value)
                    }) {
                        continue;
                    }
                    budget.support(entries.len().saturating_add(1))?;
                    entries.push(FactorEntry {
                        assignment,
                        log_value: *log_value,
                    });
                }
            }
            factors.push(restrict_factor(
                Factor { scope, entries },
                evidence,
                budget,
            )?);
        }
        for constraint in &self.constraints {
            let scope: Vec<String> = constraint
                .patterns()
                .iter()
                .flat_map(|pattern| pattern.keys().cloned())
                .collect::<BTreeSet<_>>()
                .into_iter()
                .collect();
            let mut entries = Vec::new();
            let domains: Vec<&[String]> = scope
                .iter()
                .map(|variable| self.variable(variable).map(|item| item.domain.as_slice()))
                .collect::<Result<_, _>>()?;
            enumerate_assignments(
                &scope,
                &domains,
                0,
                &mut Assignment::new(),
                &mut |assignment| {
                    budget.charge(1)?;
                    if permits_constraint(constraint, assignment) {
                        budget.support(entries.len().saturating_add(1))?;
                        entries.push(FactorEntry {
                            assignment: assignment.clone(),
                            log_value: 0.0,
                        });
                    }
                    Ok(())
                },
            )?;
            factors.push(restrict_factor(
                Factor { scope, entries },
                evidence,
                budget,
            )?);
        }
        Ok(factors)
    }
}

#[derive(Clone, Debug)]
struct FactorEntry {
    assignment: Assignment,
    log_value: f64,
}

#[derive(Clone, Debug)]
struct Factor {
    scope: Vec<String>,
    entries: Vec<FactorEntry>,
}

#[derive(Clone, Debug)]
struct Budget {
    used: usize,
    limit: usize,
    support_limit: usize,
}

impl Budget {
    fn new(limits: Limits) -> Self {
        Self {
            used: 0,
            limit: limits.max_operations,
            support_limit: limits.max_joint_support,
        }
    }

    fn charge(&mut self, amount: usize) -> Result<(), Error> {
        self.used = self.used.checked_add(amount).ok_or(Error::BudgetExceeded {
            operations: usize::MAX,
            limit: self.limit,
        })?;
        if self.used > self.limit {
            return Err(Error::BudgetExceeded {
                operations: self.used,
                limit: self.limit,
            });
        }
        Ok(())
    }

    fn support(&self, observed: usize) -> Result<(), Error> {
        if observed > self.support_limit {
            Err(limit_error(observed, self.support_limit))
        } else {
            Ok(())
        }
    }
}

fn validate_limits(limits: Limits) -> Result<(), Error> {
    if limits.max_domain_size == 0
        || limits.max_variables == 0
        || limits.max_factors == 0
        || limits.max_elimination_width == 0
        || limits.max_joint_support == 0
        || limits.max_operations == 0
    {
        return Err(Error::InvalidParameter(
            "conditioning limits must be positive".into(),
        ));
    }
    Ok(())
}

fn limit_error(observed: usize, limit: usize) -> Error {
    Error::BudgetExceeded {
        operations: observed,
        limit,
    }
}

fn preflight_spec(spec: &ModelSpec, limits: Limits) -> Result<(), Error> {
    let factors = spec
        .tables
        .len()
        .checked_add(spec.constraints.len())
        .ok_or_else(|| limit_error(usize::MAX, limits.max_factors))?;
    if factors > limits.max_factors {
        return Err(limit_error(factors, limits.max_factors));
    }
    for variable in &spec.variables {
        if variable.domain.len() > limits.max_domain_size {
            return Err(limit_error(variable.domain.len(), limits.max_domain_size));
        }
    }
    let domains: BTreeMap<&String, usize> = spec
        .variables
        .iter()
        .map(|v| (&v.id, v.domain.len()))
        .collect();
    let mut entries = 0usize;
    for table in &spec.tables {
        let sizes = table
            .parents
            .iter()
            .chain(std::iter::once(&table.target))
            .map(|id| {
                domains
                    .get(id)
                    .copied()
                    .ok_or_else(|| Error::UnknownVariable(id.clone()))
            })
            .collect::<Result<Vec<_>, _>>()?;
        checked_product(sizes, limits.max_joint_support)?;
        if table.rows.len() > limits.max_joint_support {
            return Err(limit_error(table.rows.len(), limits.max_joint_support));
        }
        let mut support = 0usize;
        for row in &table.rows {
            support = support
                .checked_add(row.weights.len())
                .ok_or_else(|| limit_error(usize::MAX, limits.max_joint_support))?;
            if support > limits.max_joint_support {
                return Err(limit_error(support, limits.max_joint_support));
            }
        }
        entries = entries
            .checked_add(support)
            .ok_or_else(|| limit_error(usize::MAX, limits.max_operations))?;
        if entries > limits.max_operations {
            return Err(limit_error(entries, limits.max_operations));
        }
    }
    for constraint in &spec.constraints {
        let scope: BTreeSet<&String> = constraint
            .patterns()
            .iter()
            .flat_map(|p| p.keys())
            .collect();
        let sizes = scope
            .into_iter()
            .map(|id| {
                domains
                    .get(id)
                    .copied()
                    .ok_or_else(|| Error::UnknownVariable(id.clone()))
            })
            .collect::<Result<Vec<_>, _>>()?;
        checked_product(sizes, limits.max_joint_support)?;
        for pattern in constraint.patterns() {
            entries = entries
                .checked_add(pattern.len().max(1))
                .ok_or_else(|| limit_error(usize::MAX, limits.max_operations))?;
            if entries > limits.max_operations {
                return Err(limit_error(entries, limits.max_operations));
            }
        }
    }
    Ok(())
}

fn checked_product<I>(sizes: I, limit: usize) -> Result<usize, Error>
where
    I: IntoIterator<Item = usize>,
{
    let mut product = 1usize;
    for size in sizes {
        product = product
            .checked_mul(size)
            .ok_or_else(|| limit_error(limit.saturating_add(1), limit))?;
        if product > limit {
            return Err(limit_error(product, limit));
        }
    }
    Ok(product)
}

fn validate_table_scope(table: &Table, ids: &BTreeSet<String>) -> Result<(), Error> {
    let mut seen = BTreeSet::new();
    for parent in &table.parents {
        if !ids.contains(parent) {
            return Err(Error::UnknownVariable(parent.clone()));
        }
        if parent == &table.target {
            return Err(Error::InvalidModel(format!(
                "table {:?} cannot depend on itself",
                table.target
            )));
        }
        if !seen.insert(parent) {
            return Err(Error::InvalidModel(format!(
                "duplicate parent {:?} in table {:?}",
                parent, table.target
            )));
        }
    }
    Ok(())
}

fn validate_parent_values(
    values: &Assignment,
    parents: &[String],
    variables: &BTreeMap<String, Variable>,
) -> Result<(), Error> {
    if values.len() != parents.len() || parents.iter().any(|parent| !values.contains_key(parent)) {
        return Err(Error::InvalidModel(
            "row parent values do not match table scope".into(),
        ));
    }
    for (variable, value) in values {
        let declaration = variables
            .get(variable)
            .ok_or_else(|| Error::UnknownVariable(variable.clone()))?;
        if !declaration.domain.contains(value) {
            return Err(Error::UnknownValue {
                variable: variable.clone(),
                value: value.clone(),
            });
        }
    }
    Ok(())
}

fn validate_constraints(
    constraints: &[Constraint],
    variables: &BTreeMap<String, Variable>,
) -> Result<(), Error> {
    for constraint in constraints {
        for pattern in constraint.patterns() {
            for (variable, value) in pattern {
                let declaration = variables
                    .get(variable)
                    .ok_or_else(|| Error::UnknownVariable(variable.clone()))?;
                if !declaration.domain.contains(value) {
                    return Err(Error::UnknownValue {
                        variable: variable.clone(),
                        value: value.clone(),
                    });
                }
            }
        }
    }
    Ok(())
}

fn validate_acyclic(variables: &[Variable], tables: &[CompiledTable]) -> Result<(), Error> {
    let mut adjacency: BTreeMap<&str, Vec<&str>> = variables
        .iter()
        .map(|variable| (variable.id.as_str(), Vec::new()))
        .collect();
    for table in tables {
        for parent in &table.parents {
            adjacency
                .get_mut(parent.as_str())
                .expect("validated parent")
                .push(table.target.as_str());
        }
    }
    let mut visiting = BTreeSet::new();
    let mut visited = BTreeSet::new();
    for variable in variables {
        if has_cycle(
            variable.id.as_str(),
            &adjacency,
            &mut visiting,
            &mut visited,
        ) {
            return Err(Error::InvalidModel(
                "conditional table parent graph has a cycle".into(),
            ));
        }
    }
    Ok(())
}

fn has_cycle<'a>(
    node: &'a str,
    adjacency: &BTreeMap<&'a str, Vec<&'a str>>,
    visiting: &mut BTreeSet<&'a str>,
    visited: &mut BTreeSet<&'a str>,
) -> bool {
    if visiting.contains(node) {
        return true;
    }
    if visited.contains(node) {
        return false;
    }
    visiting.insert(node);
    if adjacency
        .get(node)
        .into_iter()
        .flat_map(|children| children.iter())
        .any(|child| has_cycle(child, adjacency, visiting, visited))
    {
        return true;
    }
    visiting.remove(node);
    visited.insert(node);
    false
}

fn permits_constraint(constraint: &Constraint, assignment: &Assignment) -> bool {
    if constraint.is_allowed_pattern() {
        constraint
            .patterns()
            .iter()
            .any(|pattern| matches_pattern(assignment, pattern))
    } else {
        !constraint
            .patterns()
            .iter()
            .any(|pattern| matches_pattern(assignment, pattern))
    }
}

fn matches_pattern(assignment: &Assignment, pattern: &Assignment) -> bool {
    pattern
        .iter()
        .all(|(variable, value)| assignment.get(variable) == Some(value))
}

fn restrict_factor(
    factor: Factor,
    evidence: &Assignment,
    budget: &mut Budget,
) -> Result<Factor, Error> {
    let scope: Vec<String> = factor
        .scope
        .into_iter()
        .filter(|variable| !evidence.contains_key(variable))
        .collect();
    let mut grouped: BTreeMap<Assignment, f64> = BTreeMap::new();
    for entry in factor.entries {
        budget.charge(1)?;
        if evidence.iter().any(|(variable, value)| {
            entry
                .assignment
                .get(variable)
                .is_some_and(|actual| actual != value)
        }) {
            continue;
        }
        let assignment = entry
            .assignment
            .into_iter()
            .filter(|(variable, _)| !evidence.contains_key(variable))
            .collect();
        if !grouped.contains_key(&assignment) {
            budget.support(grouped.len().saturating_add(1))?;
        }
        let next = grouped
            .remove(&assignment)
            .map_or(entry.log_value, |previous| {
                log_add(previous, entry.log_value)
            });
        grouped.insert(assignment, next);
    }
    budget.support(grouped.len())?;
    let entries = grouped
        .into_iter()
        .map(|(assignment, log_value)| FactorEntry {
            assignment,
            log_value,
        })
        .collect();
    Ok(Factor { scope, entries })
}

fn multiply_factors(factors: Vec<Factor>, budget: &mut Budget) -> Result<Factor, Error> {
    let mut iter = factors.into_iter();
    let mut result = iter.next().unwrap_or(Factor {
        scope: Vec::new(),
        entries: vec![FactorEntry {
            assignment: Assignment::new(),
            log_value: 0.0,
        }],
    });
    for factor in iter {
        let mut scope = result.scope.clone();
        for variable in &factor.scope {
            if !scope.contains(variable) {
                scope.push(variable.clone());
            }
        }
        scope.sort();
        let mut entries = Vec::new();
        for left in &result.entries {
            for right in &factor.entries {
                budget.charge(1)?;
                if !compatible(&left.assignment, &right.assignment) {
                    continue;
                }
                let mut assignment = left.assignment.clone();
                assignment.extend(right.assignment.clone());
                budget.support(entries.len().saturating_add(1))?;
                entries.push(FactorEntry {
                    assignment,
                    log_value: left.log_value + right.log_value,
                });
            }
        }
        result = Factor { scope, entries };
    }
    Ok(result)
}

fn compatible(left: &Assignment, right: &Assignment) -> bool {
    left.iter()
        .all(|(variable, value)| right.get(variable).is_none_or(|other| other == value))
}

fn sum_out(factor: Factor, variable: &str, budget: &mut Budget) -> Result<Factor, Error> {
    if !factor.scope.iter().any(|item| item == variable) {
        return Ok(factor);
    }
    let scope: Vec<String> = factor
        .scope
        .into_iter()
        .filter(|item| item != variable)
        .collect();
    let mut grouped: BTreeMap<Assignment, f64> = BTreeMap::new();
    for entry in factor.entries {
        budget.charge(1)?;
        let assignment = entry
            .assignment
            .into_iter()
            .filter(|(item, _)| item != variable)
            .collect();
        if !grouped.contains_key(&assignment) {
            budget.support(grouped.len().saturating_add(1))?;
        }
        let next = grouped
            .remove(&assignment)
            .map_or(entry.log_value, |previous| {
                log_add(previous, entry.log_value)
            });
        grouped.insert(assignment, next);
    }
    let entries = grouped
        .into_iter()
        .map(|(assignment, log_value)| FactorEntry {
            assignment,
            log_value,
        })
        .collect();
    Ok(Factor { scope, entries })
}

fn plan_order(
    factors: &[Factor],
    active: &BTreeSet<String>,
    eliminable: &BTreeSet<String>,
    budget: &mut Budget,
    limits: Limits,
) -> Result<Vec<String>, Error> {
    let mut graph: BTreeMap<String, BTreeSet<String>> = active
        .iter()
        .cloned()
        .map(|variable| (variable, BTreeSet::new()))
        .collect();
    for factor in factors {
        let vars: Vec<&String> = factor
            .scope
            .iter()
            .filter(|variable| active.contains(*variable))
            .collect();
        for (index, left) in vars.iter().enumerate() {
            for right in vars.iter().skip(index + 1) {
                graph
                    .get_mut(*left)
                    .expect("active factor variable")
                    .insert((*right).clone());
                graph
                    .get_mut(*right)
                    .expect("active factor variable")
                    .insert((*left).clone());
            }
        }
    }
    let mut remaining = eliminable.clone();
    let mut order = Vec::with_capacity(remaining.len());
    while !remaining.is_empty() {
        let candidates: Vec<String> = remaining.iter().cloned().collect();
        let mut best: Option<(usize, usize, String, BTreeSet<String>)> = None;
        for candidate in candidates {
            budget.charge(1)?;
            let neighbors = graph.get(&candidate).cloned().unwrap_or_default();
            let mut fill = 0;
            let neighbors_vec: Vec<&String> = neighbors.iter().collect();
            for (index, left) in neighbors_vec.iter().enumerate() {
                for right in neighbors_vec.iter().skip(index + 1) {
                    if !graph
                        .get(*left)
                        .is_some_and(|adjacent| adjacent.contains(*right))
                    {
                        fill += 1;
                    }
                }
            }
            let key = (fill, neighbors.len(), candidate.clone(), neighbors);
            if best.as_ref().is_none_or(|current| {
                key.0 < current.0
                    || (key.0 == current.0
                        && (key.1 < current.1 || (key.1 == current.1 && key.2 < current.2)))
            }) {
                best = Some(key);
            }
        }
        let (_, _, candidate, neighbors) = best.expect("remaining candidate");
        if neighbors.len() > limits.max_elimination_width {
            return Err(limit_error(neighbors.len(), limits.max_elimination_width));
        }
        let neighbors_vec: Vec<String> = neighbors.iter().cloned().collect();
        for (index, left) in neighbors_vec.iter().enumerate() {
            for right in neighbors_vec.iter().skip(index + 1) {
                graph
                    .get_mut(left)
                    .expect("graph neighbor")
                    .insert(right.clone());
                graph
                    .get_mut(right)
                    .expect("graph neighbor")
                    .insert(left.clone());
            }
        }
        for neighbor in &neighbors {
            graph
                .get_mut(neighbor)
                .expect("graph neighbor")
                .remove(&candidate);
        }
        graph.remove(&candidate);
        remaining.remove(&candidate);
        order.push(candidate);
    }
    Ok(order)
}

fn enumerate_assignments<F>(
    scope: &[String],
    domains: &[&[String]],
    index: usize,
    assignment: &mut Assignment,
    callback: &mut F,
) -> Result<(), Error>
where
    F: FnMut(&Assignment) -> Result<(), Error>,
{
    if index == scope.len() {
        return callback(assignment);
    }
    for value in domains[index] {
        assignment.insert(scope[index].clone(), value.clone());
        enumerate_assignments(scope, domains, index + 1, assignment, callback)?;
    }
    assignment.remove(&scope[index]);
    Ok(())
}

fn log_add(left: f64, right: f64) -> f64 {
    if left == f64::NEG_INFINITY {
        return right;
    }
    if right == f64::NEG_INFINITY {
        return left;
    }
    let max = left.max(right);
    max + ((left - max).exp() + (right - max).exp()).ln()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assignment(items: &[(&str, &str)]) -> Assignment {
        items
            .iter()
            .map(|(variable, value)| ((*variable).into(), (*value).into()))
            .collect()
    }

    fn soldier_model() -> Model {
        let variables = vec![
            Variable::new("gender", ["female", "male"]),
            Variable::new("profession", ["baker", "soldier"]),
        ];
        let tables = vec![
            Table::new(
                "gender",
                [] as [&str; 0],
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
                        assignment(&[("gender", "female")]),
                        [("baker", 1.0), ("soldier", 1.0)],
                    ),
                    Row::new(
                        assignment(&[("gender", "male")]),
                        [("baker", 1.0), ("soldier", 1.5)],
                    ),
                ],
            ),
        ];
        Model::compile(ModelSpec::new(variables, tables, Vec::new())).unwrap()
    }

    #[test]
    fn reverse_query_uses_variable_elimination() {
        let model = soldier_model();
        let forward = model
            .posterior(
                "profession",
                &assignment(&[("gender", "male")]),
                Limits::default(),
            )
            .unwrap();
        assert!((forward.probabilities["soldier"] - 0.6).abs() < 1e-12);
        assert!((forward.probabilities["baker"] - 0.4).abs() < 1e-12);

        let posterior = model
            .posterior(
                "gender",
                &assignment(&[("profession", "soldier")]),
                Limits::default(),
            )
            .unwrap();
        assert!((posterior.probabilities["male"] - 6.0 / 11.0).abs() < 1e-12);
        assert!((posterior.probabilities["female"] - 5.0 / 11.0).abs() < 1e-12);
    }

    #[test]
    fn pinned_target_still_checks_global_support() {
        let variables = vec![Variable::new("a", ["x"]), Variable::new("b", ["y"])];
        let tables = vec![
            Table::new(
                "a",
                [] as [&str; 0],
                vec![Row::new(Assignment::new(), [("x", 1.0)])],
            ),
            Table::new(
                "b",
                ["a"],
                vec![Row::new(assignment(&[("a", "x")]), [("y", 1.0)])],
            ),
        ];
        let model = Model::compile(ModelSpec::new(
            variables,
            tables,
            vec![Constraint::forbidden(assignment(&[("a", "x"), ("b", "y")]))],
        ))
        .unwrap();
        assert_eq!(
            model.posterior("a", &assignment(&[("a", "x")]), Limits::default()),
            Err(Error::EmptySupport)
        );
    }

    #[test]
    fn pinned_target_returns_a_point_mass_after_support_check() {
        let model = soldier_model();
        let posterior = model
            .posterior(
                "gender",
                &assignment(&[("gender", "male")]),
                Limits::default(),
            )
            .unwrap();
        assert_eq!(posterior.probabilities["male"], 1.0);
        assert_eq!(posterior.probabilities["female"], 0.0);
    }

    #[test]
    fn constraints_and_non_root_sampling_are_supported() {
        let model = soldier_model();
        let mut rng = Rng::seeded(42);
        let result = model
            .sample(
                &mut rng,
                &assignment(&[("profession", "soldier")]),
                Limits::default(),
            )
            .unwrap();
        assert_eq!(result["profession"], "soldier");
        assert!(result["gender"] == "female" || result["gender"] == "male");
    }

    #[test]
    fn sampling_replays_with_a_cloned_stream() {
        let model = soldier_model();
        let mut first = Rng::seeded(7);
        let mut second = first.clone();
        let evidence = assignment(&[("profession", "soldier")]);
        let left = model
            .sample(&mut first, &evidence, Limits::default())
            .unwrap();
        let right = model
            .sample(&mut second, &evidence, Limits::default())
            .unwrap();
        assert_eq!(left, right);
    }

    #[test]
    fn allowed_groups_are_conjunctive_and_patterns_are_alternatives() {
        let variables = vec![
            Variable::new("a", ["0", "1"]),
            Variable::new("b", ["0", "1"]),
        ];
        let tables = vec![
            Table::new(
                "a",
                [] as [&str; 0],
                vec![Row::new(Assignment::new(), [("0", 1.0), ("1", 1.0)])],
            ),
            Table::new(
                "b",
                [] as [&str; 0],
                vec![Row::new(Assignment::new(), [("0", 1.0), ("1", 1.0)])],
            ),
        ];
        let constraints = vec![
            Constraint::allowed(vec![assignment(&[("a", "0")]), assignment(&[("a", "1")])]),
            Constraint::allowed(vec![assignment(&[("b", "0")])]),
        ];
        let model = Model::compile(ModelSpec::new(variables, tables, constraints)).unwrap();
        let posterior = model
            .posterior("a", &Assignment::new(), Limits::default())
            .unwrap();
        assert!((posterior.probabilities["0"] - 0.5).abs() < 1e-12);
        assert!((posterior.probabilities["1"] - 0.5).abs() < 1e-12);
        let b = model
            .posterior("b", &Assignment::new(), Limits::default())
            .unwrap();
        assert_eq!(b.probabilities["0"], 1.0);
        assert_eq!(b.probabilities["1"], 0.0);
    }

    #[test]
    fn triangle_with_no_permitted_assignment_returns_empty_support() {
        let variables = vec![
            Variable::new("a", ["0", "1"]),
            Variable::new("b", ["0", "1"]),
            Variable::new("c", ["0", "1"]),
        ];
        let tables = ["a", "b", "c"]
            .into_iter()
            .map(|target| {
                Table::new(
                    target,
                    [] as [&str; 0],
                    vec![Row::new(Assignment::new(), [("0", 1.0), ("1", 1.0)])],
                )
            })
            .collect();
        let forbidden = ["000", "001", "010", "011", "100", "101", "110", "111"]
            .into_iter()
            .map(|bits| {
                Constraint::forbidden(assignment(&[
                    ("a", &bits[0..1]),
                    ("b", &bits[1..2]),
                    ("c", &bits[2..3]),
                ]))
            })
            .collect();
        let model = Model::compile(ModelSpec::new(variables, tables, forbidden)).unwrap();
        assert_eq!(
            model.posterior("a", &Assignment::new(), Limits::default()),
            Err(Error::EmptySupport)
        );
    }

    #[test]
    fn unicode_assignments_are_native_values() {
        let model = Model::compile(ModelSpec::new(
            vec![Variable::new("café", ["王"])],
            vec![Table::new(
                "café",
                [] as [&str; 0],
                vec![Row::new(Assignment::new(), [("王", 1.0)])],
            )],
            Vec::new(),
        ))
        .unwrap();
        let posterior = model
            .posterior("café", &Assignment::new(), Limits::default())
            .unwrap();
        assert_eq!(posterior.probabilities["王"], 1.0);
    }

    #[test]
    fn low_operation_budget_refuses_before_unbounded_work() {
        let model = soldier_model();
        let limits = Limits {
            max_operations: 1,
            ..Limits::default()
        };
        assert!(matches!(
            model.posterior("gender", &Assignment::new(), limits),
            Err(Error::BudgetExceeded { .. })
        ));
    }

    #[test]
    fn support_limit_is_checked_before_factor_work() {
        let model = soldier_model();
        let limits = Limits {
            max_joint_support: 2,
            ..Limits::default()
        };
        assert!(matches!(
            model.posterior("gender", &Assignment::new(), limits),
            Err(Error::BudgetExceeded { .. })
        ));
    }

    #[test]
    fn independent_network_uses_factor_support_instead_of_joint_cartesian_size() {
        let count = 32;
        let variables: Vec<_> = (0..count)
            .map(|index| Variable::new(format!("v{index}"), ["0", "1"]))
            .collect();
        let tables: Vec<_> = (0..count)
            .map(|index| {
                Table::new(
                    format!("v{index}"),
                    [] as [&str; 0],
                    vec![Row::new(Assignment::new(), [("0", 1.0), ("1", 1.0)])],
                )
            })
            .collect();
        let limits = Limits {
            max_joint_support: 2,
            max_operations: 20_000,
            ..Limits::default()
        };
        let model =
            Model::compile_with_limits(ModelSpec::new(variables, tables, Vec::new()), limits)
                .unwrap();
        let posterior = model.posterior("v0", &Assignment::new(), limits).unwrap();
        assert!((posterior.probabilities["0"] - 0.5).abs() < 1e-12);
        assert!((posterior.probabilities["1"] - 0.5).abs() < 1e-12);
    }

    #[test]
    fn independent_constraint_factors_do_not_form_one_giant_factor() {
        let count = 24;
        let variables: Vec<_> = (0..count)
            .map(|index| Variable::new(format!("v{index}"), ["0", "1"]))
            .collect();
        let tables: Vec<_> = (0..count)
            .map(|index| {
                Table::new(
                    format!("v{index}"),
                    [] as [&str; 0],
                    vec![Row::new(Assignment::new(), [("0", 1.0), ("1", 1.0)])],
                )
            })
            .collect();
        let constraints: Vec<_> = (1..count)
            .map(|index| {
                let mut pattern = Assignment::new();
                pattern.insert(format!("v{index}"), "1".into());
                Constraint::forbidden(pattern)
            })
            .collect();
        let limits = Limits {
            max_joint_support: 2,
            max_factors: 128,
            max_operations: 20_000,
            ..Limits::default()
        };
        let model =
            Model::compile_with_limits(ModelSpec::new(variables, tables, constraints), limits)
                .unwrap();
        let posterior = model.posterior("v0", &Assignment::new(), limits).unwrap();
        assert!((posterior.probabilities["0"] - 0.5).abs() < 1e-12);
        assert!((posterior.probabilities["1"] - 0.5).abs() < 1e-12);
    }
}
