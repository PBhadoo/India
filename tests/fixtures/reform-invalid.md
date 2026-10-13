---
title: Example invalid reform entry
sources:
  - { title: "Source one", url: "https://example.org/1", publisher: "Pub", type: primary }
  - { title: "Source two", url: "https://example.org/2", publisher: "Pub", type: court }
reform:
  asOf: soon
  keep:
    - { point: "Fine point.", madeBy: "", source: 1 }
    - { point: "Source index out of range.", madeBy: "Someone", source: 7 }
    - { point: "Source index not an integer.", madeBy: "Someone", source: "1" }
  change:
    - "a bare string"
    - { point: 42, madeBy: "Someone", source: 1 }
  repeal: not-a-list
---
