# BPMN 2.0 and BPSim 1.0 schema conformance — 2026-10-08

> Historical, source-bound verification record. It covers the exports and files listed below at the stated source only; it is not a registered gate check and is not evidence for later source changes.

## Source and schemas

- Branch `feature/business-process-simulation`, exporter and importer at commit
  `acd7413dde2a87dc23bb0e10d0385a7eed9fac95`; the two example files were then corrected
  in the commit that adds this record (see Findings).
- OMG BPMN 2.0 XML Schemas, downloaded from `https://www.omg.org/spec/BPMN/20100501/`:

  | File | SHA-256 |
  |---|---|
  | `BPMN20.xsd` | `a07c159cb0594573dd7c97b1370dd116112378f377e43c89a8bf512ac5030705` |
  | `Semantic.xsd` | `c4318842f7d2bbc262d7954c9452c501db16f0868eac0b8732ec5d7fb384d9a7` |
  | `BPMNDI.xsd` | `f0dff1cd559d1514d8ebfc8c646f58402bcaced27ec22e2aa6456c2dcc80b038` |
  | `DI.xsd` | `8220b179c175572df74e08a51bffabe957867962035cee7b5fee0b6acb4c4498` |
  | `DC.xsd` | `a2f90e5ad9bb48c6915e4e034b4e27ac838264a1d4f27bfc70dbdfc69351312d` |

- BPSim 1.0 XML Schema (namespace `http://www.bpsim.org/schemas/1.0`, the one the exporter
  writes), downloaded from `https://www.bpsim.org/schemas/1.0/BPSim-1.0.xsd`, SHA-256
  `a2e75369d27350e8d500b63aa294e4bfd1f4d145d1d9df6e29b29d3884606186`. BPSim 2.0 was not used.
- Validator: `xmllint` with libxml 2.9.14.

The schemas were not added to the repository. `extensionElements` in BPMN accepts foreign
content laxly, so a validation wrapper made BPSim content validated rather than skipped:

```xml
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  targetNamespace="http://www.omg.org/spec/BPMN/20100524/MODEL"
  elementFormDefault="qualified" attributeFormDefault="unqualified">
  <xsd:import namespace="http://www.bpsim.org/schemas/1.0" schemaLocation="BPSim-1.0.xsd"/>
  <xsd:include schemaLocation="BPMN20.xsd"/>
</xsd:schema>
```

The `urn:wildlands:process:1` extension has no schema and is skipped as lax content, as
the BPMN schema allows.

## Executed evidence

Each file was validated with `xmllint --noout --schema wrapper.xsd <file>`.

| Files | Result |
|---|---|
| `export-bpmn` of the six `docs/concepts/agency-delivery` processes, with and without `--bpsim` (12 files) | all valid |
| `import-bpmn` then `export-bpmn --bpsim` of both `examples/bpmn` files (2 files) | all valid |
| Loan application variants exported with and without BPSim (10 files): sequential instances, instances from a case field, an interrupting deadline, a `not`/`all` condition, and descriptions with tabs, newlines, quotes, `&` and `<` | all valid; each re-imports to the same fingerprint |
| `examples/bpmn/loan-application.bpmn` and `support-ticket.bpmn` as committed at `acd7413` | invalid (see Findings); valid after the correction |

Negative controls: renaming one `bpsim:Scenario` element in a BPSim export, and renaming
one `bpmn:task` in a plain export, each made validation fail. So BPSim content and BPMN
content were both validated, not skipped.

## Findings

The exporter's output conformed. The two hand-written example input files did not:

- `loan-application.bpmn` used `timeUnit="hrs"`; BPSim 1.0 allows only `ms`, `s`, `min`,
  `hour`, `day` and `year`. Changed to `hour`.
- `loan-application.bpmn` gave `LogNormalDistribution` the attributes `scale` and `shape`;
  BPSim 1.0 defines `mean` and `standardDeviation`. Changed to those attributes.
- Both files placed the `BPSimData` relationship before `bpmndi:BPMNDiagram`; the BPMN
  schema orders `relationship` after the diagrams. Moved after the diagram.

The importer reads `hrs` and `hour` alike and reports LogNormal as unsupported whatever
its attributes, so importing the corrected files gave byte-identical definitions and
identical warnings, and every pinned example number is unchanged. The importer still
accepts the non-conforming forms in foreign files; that tolerance is deliberate and tested.

## Limits

- XML Schema validation checks structure, types and ID references. It does not check the
  semantic rules the BPMN specification states in prose (for example gateway and event
  constraints), and no BPMN conformance test suite or modeling tool import was run.
- Only the files listed above were validated. Other definitions, later exporter changes
  and BPSim 2.0 are not covered, and no check in the registered gate repeats this.
