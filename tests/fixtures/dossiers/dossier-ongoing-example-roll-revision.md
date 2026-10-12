---
title: Fixture - Example roll revision
summary: Fictional fixture dossier used to test layout. A fictional commission revised a fictional state voter list in two phases; one petition is pending.
category: elections
subcategories: [electoral-rolls]
kind: topic
asOf: 2026-10-10
status: ongoing
lastReviewed: 2026-10-10
timeline:
  - { date: 2026-03-02, event: "The Example Roll Commission notifies a two-phase revision of the Example State voter list.", actor: "Example Roll Commission", type: event, source: 1 }
  - { date: 2026-05-15, event: "Draft list published with a 30-day window for objections.", actor: "Example Roll Commission", type: official-statement, source: 2 }
  - { date: 2026-07-01, event: "A petitioner challenges the notice requirements of the second phase.", actor: "Example Petitioners Forum", type: allegation, source: 3 }
  - { date: 2026-08-20, event: "The court issues an interim order on the form of notice and lists the petition for hearing.", actor: "Example High Court", type: finding, source: 3 }
  - { date: 2026-09, event: "Final list published; bulletin gives totals by district.", actor: "Example Roll Commission", type: data, source: 4 }
claims:
  - claim: "The interim order directs the commission to give written notice to each person whose name is proposed for removal."
    type: finding
    madeBy: Example High Court
    status: "In force pending final hearing"
    source: 3
  - claim: "The revision followed the survey method set out in the commission's notification."
    type: official-statement
    madeBy: Example Roll Commission
    status: "Stated in notification"
    source: 1
  - claim: "The notice period was too short for residents of remote districts to file objections."
    type: allegation
    madeBy: Example Petitioners Forum
    status: "Pending before the Example High Court"
    response: "The commission states the period matched the notified schedule and was extended in two districts."
    source: 3
  - claim: "The final list has 4,820,000 names across 12 districts."
    type: data
    madeBy: Example Roll Commission
    status: "Published bulletin"
    source: 4
positions:
  - { holder: "Example Roll Commission", position: "States that the revision followed the notified schedule and extended deadlines where requested.", source: 2 }
  - { holder: "Example Petitioners Forum", position: "Argues that notice to residents of remote districts was insufficient.", source: 3 }
  - { holder: "Example State Government (government id centre-fixture)", position: "Has stated that it takes no position while the petition is pending.", source: 5 }
tables:
  - title: "Names on the voter list, by stage"
    caption: "Number of names on the Example State voter list at each stage, in thousands; fictional data."
    columns: [Stage, Names (thousand), Change (thousand)]
    rows:
      - [Before revision, 4950, ""]
      - [Draft list, 4790, -160]
      - [Final list, 4820, 30]
    source: 4
notShown:
  - "The figures do not show how many of the names removed belonged to people still living at the listed address."
  - "The interim order does not decide whether the revision as a whole was lawful."
  - "The totals do not show any difference between districts in the time taken to process objections."
sources:
  - { title: "Fixture source 1", url: https://example.org/fixture/1, publisher: "Example Publisher 1", type: primary }
  - { title: "Fixture source 2", url: https://example.org/fixture/2, publisher: "Example Publisher 2", type: official-data }
  - { title: "Fixture source 3", url: https://example.org/fixture/3, publisher: "Example Publisher 3", type: court }
  - { title: "Fixture source 4", url: https://example.org/fixture/4, publisher: "Example Publisher 4", type: reputable-media }
  - { title: "Fixture source 5", url: https://example.org/fixture/5, publisher: "Example Publisher 5", type: academic }
  - { title: "Fixture source 6", url: https://example.org/fixture/6, publisher: "Example Publisher 6", type: primary }
---
This is fixture text used only to test the page layout. The Example Roll Commission (a fictional body) revised the Example State voter list in two phases. The first phase compared the existing list against a house-to-house survey [1]. The second phase invited objections and held hearings [2].

The commission published a draft list, a set of objections received and a final list. Each of those documents is cited in the timeline below. A court petition challenged the second phase, and the court issued an interim order on the form of notice but did not rule on the revision as a whole [3].

Figures in the data table come from the commission's published bulletins. The claims table keeps the commission's statements, the court's recorded order and the petitioner's allegation apart, and gives the status and the response for each allegation [4].

Nothing on this page predicts the outcome of the pending petition. The section titled "What these facts do not show" lists questions that the cited documents do not answer. Readers should check the sources for developments after the date shown at the top of the page [5].

The same questions are asked of every government in office during the period: what was notified, by whom, on what date, and what was recorded by a court or regulator afterwards. Parties in office are named by government identifier and date, not by description, and the same fields are filled for each of them wherever the sources allow it.
