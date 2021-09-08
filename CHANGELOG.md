# Change Log

<a name="2.0.1"></a>
## [2.0.1](https://github.com/abrisene/acausal/compare/v2.0.1...v2.0.0) (2021-09-08)
* Added "Analyze" function to Markov Chains.
* Fixed a minor bug which caused the passed "start" sequence to be mutated during Markov generation in some circumstances.
* Temporary changes to CI version to avoid [node 16.8 issues](https://github.com/nodejs/node/issues/40030).

<a name="2.0.0"></a>
# [2.0.0](https://github.com/abrisene/acausal/compare/v2.0.0...v1.0.7) (2021-09-05)


### Features

* Full conversion to Typescript.
* Rewrote Markov Chain class.
* Rewrote "Transition Matrix" class, now named "Distribution".
* Wrote "Random" class, which wraps `random-js`.
* Rewrote Unit Tests.
* Test Coverage at > 99%
* Removed file loading utilities - these should be a separate module, or written ad hoc as needed with implementations.
* Wrote new readme and quickstart guides for Markov Chains and Distributions.
* Integration with Travis-CI and Coveralls.

<a name="1.0.7"></a>
## [1.0.7](https://github.com/abrisene/acausal/compare/v1.0.7...v1.0.1) (2021-04-16)


### Features

* Minor bugfixes.
* Updated npm developer dependencies.
* Added utilities for file loading.
* Added Unit Tests.
* Test Coverage at 83%.

<a name="1.0.1"></a>
# [1.0.0]() (2018-09-03)

### Features

* Initial Commit
* Markov Chain class allows creation of Markov Chains.
* Transition Matrix class allows creation of distributions used by Markov States.
* Utilities for managing async and creating deep copies.
