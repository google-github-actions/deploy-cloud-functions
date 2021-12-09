# Changelog

## [0.7.0](https://www.github.com/google-github-actions/deploy-cloud-functions/compare/v0.6.0...v0.7.0) (2021-12-09)


### Features

* add support for event_trigger_retry ([#216](https://www.github.com/google-github-actions/deploy-cloud-functions/issues/216)) ([1253ca1](https://www.github.com/google-github-actions/deploy-cloud-functions/commit/1253ca12e3e3b5ab038b24b02554af1cd2cd1efd))
* Add vpcConnectorEgressSettings & ingressSettings options ([#112](https://www.github.com/google-github-actions/deploy-cloud-functions/issues/112)) ([#141](https://www.github.com/google-github-actions/deploy-cloud-functions/issues/141)) ([d5dec31](https://www.github.com/google-github-actions/deploy-cloud-functions/commit/d5dec313cb9c6f9c5464bf45570c9fe674152357))
* add WIF docs, add warning for credentials input ([#194](https://www.github.com/google-github-actions/deploy-cloud-functions/issues/194)) ([5291949](https://www.github.com/google-github-actions/deploy-cloud-functions/commit/5291949fd2128ce3013b033205506ec53614bba7))
* expose deploy timeout as an action input ([#125](https://www.github.com/google-github-actions/deploy-cloud-functions/issues/125)) ([#128](https://www.github.com/google-github-actions/deploy-cloud-functions/issues/128)) ([2623495](https://www.github.com/google-github-actions/deploy-cloud-functions/commit/2623495fff7402d0f2c4a2162f74d43952442d6b)), closes [#124](https://www.github.com/google-github-actions/deploy-cloud-functions/issues/124)
* Merge EnvVars and EnVarsFile ([#134](https://www.github.com/google-github-actions/deploy-cloud-functions/issues/134)) ([#139](https://www.github.com/google-github-actions/deploy-cloud-functions/issues/139)) ([afe2cad](https://www.github.com/google-github-actions/deploy-cloud-functions/commit/afe2cade5e32aba53275d9bcd9be6820961e214d))


### Bug Fixes

* bump deps and googleapis ([#144](https://www.github.com/google-github-actions/deploy-cloud-functions/issues/144)) ([b18cd87](https://www.github.com/google-github-actions/deploy-cloud-functions/commit/b18cd87804b7d330ee30910b872c78eb9108e21c))
* improve archive performance ([#101](https://www.github.com/google-github-actions/deploy-cloud-functions/issues/101)) ([bdd610a](https://www.github.com/google-github-actions/deploy-cloud-functions/commit/bdd610a0768d530458fa2dbcf4b0a8ef1b4e85af))
* improve env var parsing behaviour ([#122](https://www.github.com/google-github-actions/deploy-cloud-functions/issues/122)) ([#126](https://www.github.com/google-github-actions/deploy-cloud-functions/issues/126)) ([199d134](https://www.github.com/google-github-actions/deploy-cloud-functions/commit/199d134e25ce4d245f4e6a2b9cef23c06ec4f35a))

## [0.6.0](https://www.github.com/google-github-actions/deploy-cloud-functions/compare/v0.5.0...v0.6.0) (2021-06-29)


### Features

* support gcloudignore ([#65](https://www.github.com/google-github-actions/deploy-cloud-functions/issues/65)) ([bc4a13e](https://www.github.com/google-github-actions/deploy-cloud-functions/commit/bc4a13eb460adf9045c2b9a4450acb06c25cb0a1))

## [0.5.0](https://www.github.com/google-github-actions/deploy-cloud-functions/compare/v0.4.0...v0.5.0) (2021-05-26)


### Features

* add function labels support ([#60](https://www.github.com/google-github-actions/deploy-cloud-functions/issues/60)) ([#62](https://www.github.com/google-github-actions/deploy-cloud-functions/issues/62)) ([9f988bd](https://www.github.com/google-github-actions/deploy-cloud-functions/commit/9f988bd980b153cced94fea8580557d6f24a5ba4))

## [0.4.0](https://www.github.com/google-github-actions/deploy-cloud-functions/compare/v0.3.0...v0.4.0) (2021-02-25)


### Features

* fix zip file creation, improve logs ([#48](https://www.github.com/google-github-actions/deploy-cloud-functions/issues/48)) ([c084c5e](https://www.github.com/google-github-actions/deploy-cloud-functions/commit/c084c5e00e731bf0c3bf97ac62ba6d2859564812))


### Bug Fixes

* Increase deploy create/update timeout ([#46](https://www.github.com/google-github-actions/deploy-cloud-functions/issues/46)) ([f63fa6d](https://www.github.com/google-github-actions/deploy-cloud-functions/commit/f63fa6d271b3a9b596ff9f9726176e6d1d7b1283))

## [0.3.0](https://www.github.com/google-github-actions/deploy-cloud-functions/compare/v0.2.0...v0.3.0) (2021-02-11)


### Features

* add env var file support ([#34](https://www.github.com/google-github-actions/deploy-cloud-functions/issues/34)) ([6513a6e](https://www.github.com/google-github-actions/deploy-cloud-functions/commit/6513a6e5f0f53eeec94f324ed9c02ab56eab852d))

## [0.2.0](https://www.github.com/google-github-actions/deploy-cloud-functions/compare/v0.1.2...v0.2.0) (2021-01-22)


### Features

* Add optional memory input ([#27](https://www.github.com/google-github-actions/deploy-cloud-functions/issues/27)) ([5d58680](https://www.github.com/google-github-actions/deploy-cloud-functions/commit/5d586803b3bd3a70307a96a4e1d14f0ed766f280))


### Bug Fixes

* improve upload error handling ([#28](https://www.github.com/google-github-actions/deploy-cloud-functions/issues/28)) ([2ee38a0](https://www.github.com/google-github-actions/deploy-cloud-functions/commit/2ee38a0bf7722e3ee699188ece8ba82df1c5d320))

### [0.1.2](https://www.github.com/google-github-actions/deploy-cloud-functions/compare/v0.1.1...v0.1.2) (2020-11-13)


### Bug Fixes

* update action desc ([#15](https://www.github.com/google-github-actions/deploy-cloud-functions/issues/15)) ([695158f](https://www.github.com/google-github-actions/deploy-cloud-functions/commit/695158fd32feff3535e3e1eddbed2f70b06e4440))

### [0.1.1](https://www.github.com/google-github-actions/deploy-cloud-functions/compare/v0.1.0...v0.1.1) (2020-11-13)


### Bug Fixes

* accept region ([627c9d3](https://www.github.com/google-github-actions/deploy-cloud-functions/commit/627c9d30047b1be097d0fdffd2c3d0cc728abdf6))
* Only set url output if present ([#8](https://www.github.com/google-github-actions/deploy-cloud-functions/issues/8)) ([d3a02f7](https://www.github.com/google-github-actions/deploy-cloud-functions/commit/d3a02f7119ba31fe168ce9bf5106eb463e1877a7))
