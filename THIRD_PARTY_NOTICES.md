# Third-party notices

Nexora's own code is distributed under its MIT license. Bundled dependencies retain their respective licenses.

## Water and steam properties

The Rankine-cycle lab uses the unmodified pressure–temperature routines from **@neutrium/thermo.eos.iapws97 2.1.0**, by **Trevor Walker / Neutrium**, licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

- Source: [neutrium/thermo.eos.iapws97](https://github.com/neutrium/thermo.eos.iapws97).
- [Included upstream license](frontend/public/steam-library-license.txt), also served at `/steam-library-license.txt` and included in source-built solver packages.
- Nexora adds its own bounded cycle, saturation-mixture and state-inversion adapters; it does not modify the upstream library or imply endorsement by its authors or IAPWS.
- The implementation's transitive Neutrium packages and core-js retain their package licenses in `node_modules`; upstream Neutrium components use CC BY 4.0, and core-js uses MIT.

The published solver package 0.1.0 predates this release and remains unchanged. Source-built packages include these notices with the new bundled implementation.
