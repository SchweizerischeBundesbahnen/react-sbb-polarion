# Changelog

## [2.0.2](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/compare/v2.0.1...v2.0.2) (2026-08-26)


### Bug Fixes

* keep the shared marker placement in a flex option ([#98](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/issues/98)) ([48be4a9](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/48be4a9dd2cc689abab5298695caeee65b2ac42b))
* mark an inherited config the way generic marked it ([#96](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/issues/96)) ([2d64760](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/2d6476071498085495f0bb8a463515cc5af13544))

## [2.0.1](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/compare/v2.0.0...v2.0.1) (2026-08-20)


### Bug Fixes

* no focus ring on an opener that was only clicked ([#90](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/issues/90)) ([1300bf2](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/1300bf2d3d38fbcb3fcff68efbef36ad9bfe3f9c))
* share the disabled-state click blocker across engine loads ([#89](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/issues/89)) ([e35f76e](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/e35f76e5e6a06ad8013220bf5ccc8255f317ecdd))

## [2.0.0](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/compare/v1.0.0...v2.0.0) (2026-08-20)


### ⚠ BREAKING CHANGES

* configureGenericModules is removed. BreadcrumbInjector was its only caller, so a consuming app drops the call from main.tsx and adds a build step copying breadcrumb-bridge.js into its served app folder. See "Shell scripts" in the README.

### Features

* breadcrumbs and toolbars ([#64](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/issues/64)) ([c82c483](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/c82c483eee8566505c542190a9cdcf44b0db17b4)), closes [#59](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/issues/59)
* bundle tables.css and configurations.css ([#80](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/issues/80)) ([45fac9b](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/45fac9ba2c94aaac6c29f0e569442056cce692dd))
* bundle the base markdown stylesheet ([#79](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/issues/79)) ([74ed503](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/74ed5031801c9d00853d302bc69b64802bae2490))


### Bug Fixes

* open the option list above a Modal dialog ([#88](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/issues/88)) ([54a1d58](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/54a1d5827518837570c4f6af0d71fd04e8b99537))

## [1.0.0](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/compare/v0.2.1...v1.0.0) (2026-08-18)


### ⚠ BREAKING CHANGES

* the package is now @sbb-polarion/react-sbb-polarion. Consumers change the dependency name and every import.
* PropertiesEditor is gone - use CodeEditor with language="properties". The tokenizePropertiesLine export is gone with it; refractor's properties grammar replaces it and additionally handles line continuations.

### Features

* add a multi-select mode to SearchableSelect ([5789a28](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/5789a28474ca11fee0a4e7c8e602b16588bd9fbd))
* add a multi-select mode to SearchableSelect ([0059ced](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/0059cedb40a8571cd73e6b9f8ff336e59b3ed546))
* add a searchable prop to SearchableSelect ([#61](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/issues/61)) ([a14063b](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/a14063bd404be501ee6366e213bc99b7d5931385))
* add PropertiesEditor component ([7978573](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/79785734405ac2e9338923588317771063614ee8))
* add PropertiesEditor component ([3c06ea6](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/3c06ea6d17ba7b3fc6d8270fb3e324ddff13d907))
* add StylePackageWeights, the exporters' ordering page ([33e87b7](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/33e87b798cf5eeaedff0ed34d0404b521cbcc4c6))
* add the AuthorizationSettings page ([72dd552](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/72dd552cbb7c17b75a7fa49649845bf7bd692590))
* add the AuthorizationSettings page ([8a29579](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/8a2957920a25800bd15bbe80684ebf94e8832f6b))
* add the shared Tabs component ([34b4c33](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/34b4c335b5ae259b5fd33350b446be2df454d43d))
* add the shared Tabs component ([645158e](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/645158e16e82d59960d39927b74c658cdf42456e))
* CodeEditor ([b6c5e36](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/b6c5e36173c108cb346b504a2683ba5d40f89718))
* highlight css, html, velocity and properties in CodeEditor ([87fe0d3](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/87fe0d3a8b3404f9f75d7e04ed5db5387f38407c))
* make the Revisions toolbar button optional ([04aabae](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/04aabaef56085afd5050d12217b317017f761e40))
* publish to npmjs alongside the release asset ([3ae139e](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/3ae139e261a6535714984ea1178e7b8a5312616e))
* publish to npmjs alongside the release asset ([264d623](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/264d6232096aafa103b8a100a84036be3c80cc5c))
* publish under the [@sbb-polarion](https://github.com/sbb-polarion) scope ([#73](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/issues/73)) ([40d437e](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/40d437e969fa71106b9a5c4396e769a2cf5edccc))
* replace window.confirm with a real dialog ([019fbd9](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/019fbd984aa086c6c89d515d9d981c5bda7c1305))
* replace window.confirm with a real dialog ([1e1ba50](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/1e1ba50da105edf0d34c7120860b91eaafcee33c))
* style package weights ([1e0446c](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/1e0446c785d6d911d92aba9afa1ffd1d498861a1))


### Bug Fixes

* clear the ambiguous jsx spacing and the revision regex ([a4103e2](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/a4103e2929bb20e7e8c391048541463d0407a806))
* clear the ambiguous jsx spacing and the revision regex ([197b8c5](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/197b8c55fa1da37be4f79b3c50cee980aa1c7e0b))
* clear the sonar findings worth acting on ([ecff492](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/ecff49271ba18bff7881c56703ab0be0deea3ed0))
* clear the sonar findings worth acting on ([5980c0e](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/5980c0e2a944f415a921d2a034edd6cb2d6a7637))
* correct About page table layout and Selawik font + link handling ([275bb72](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/275bb72b8b5da32f1faa673f47a4dff69c0434a9))
* correct About page table layout and Selawik font + link handling ([4294631](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/42946319ff0b832fbf062e17107458bc067f38d6))
* drop the newer-bundle warning from the authorization page ([ba32d17](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/ba32d173222a6fc681cf766d7c374716de8fc184))
* drop the newer-bundle warning from the authorization page ([11a385f](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/11a385f48cb274a2ce3743677c9dc8c8ed47fc23))
* keep the component out of the release tag ([#76](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/issues/76)) ([356733e](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/356733e3ae48cf43a0aeff3b558a8152fbdb0073))
* make the release job safe to fail and safe to repeat ([5768ef8](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/5768ef802d38736734064155286a6410464bcebd))
* move admin font-size and color into the shared .app rule ([b908854](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/b908854f515f2e46165a8a83e38bc5ad3a545942))
* pin a concrete monospace face in RestAuthTest ([06664f0](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/06664f08aabf0289739b41c911a3735c4748875a))
* pin a monospace face that exists in the test image ([f6da366](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/f6da366e21315324e006abde4f969fcfdc0b2f34))
* pin a monospace face that exists in the test image ([3311d6d](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/3311d6db3ff0f34af2f93c6802a971b6d94be60d))
* raise the contrast of the read-only weights row ([6fc7ca2](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/6fc7ca21d58309ef07d83c0f27b6ea61dd917145))
* raise the contrast of the weights drag handle ([01ee46c](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/01ee46c5581d616a0a594876aab35dea81f25f82))
* unify admin font size color ([2add6c0](https://github.com/SchweizerischeBundesbahnen/react-sbb-polarion/commit/2add6c0f750d8a4143026dba15bae1a57a366c5b))
