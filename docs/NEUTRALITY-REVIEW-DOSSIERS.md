# Neutrality and legal-care review: dossiers and new actions

Reviewer: independent session. Date: 2026-10-12. Scope: the 11 files in `src/content/dossiers/`, the 3 new actions (`special-intensive-revision-electoral-rolls-2025`, `chief-election-commissioner-appointment-act-2023`, `pmla-amendments-2019-and-supreme-court-ruling-2022`), the dossier pages and the methodology dossier section. No scores, `governmentId` values or commits were changed. Web use was limited to settling specific doubts; documents actually opened are listed in section 4.

## 1. Findings table

| Item | Issue | Action taken or recommendation |
|---|---|---|
| big-business-and-governments-record, Rajasthan 2015 (flag 5a) | The chief minister/party was added from the agent's own knowledge. The Business Today agreement report (opened) names only "Rajasthan government" and says "on Monday" (15 June 2015 was a Monday). | Verified against the list of Rajasthan chief ministers (opened): Vasundhara Raje, BJP, 13 Dec 2013 to 17 Dec 2018. Kept, but the text now says the attribution comes from that list and not from the agreement source; list added as source 21 (typed reputable-media). |
| Year/month-only dates with placeholder day (5b) | Adani (9 rows), Reliance (7), CBI (6) used `-01` placeholder days, which the page would show as a precise date ("1 January 1988"). | Dates changed to `YYYY` or `YYYY-MM` strings (the page prints partial dates as written) and the "placeholder" wording removed from the event text. No placeholder wording remains in `src/content/dossiers`. ED dates such as 1956-05-01 and 2000-06-01 were checked and are real dates. Reliance SEBI order (2017-03-24) was shown as "day placeholder" in its own text, so it is now "2017-03". |
| Source types (5d) | 25 sources whose title said "seen in search results, not opened" (or were reports of parliamentary replies) were typed primary/official-data/court. | Retyped to reputable-media: Adani 5; big-business 19; concentration PPAC and MoSPI; CBI Tribune and South First reply reports; ECI two Indian Kanoon links; ED five reply reports; large-groups IL&FS; Reliance two; SIR PIB and AIR; actions (SIR: 4; PMLA: 3). Where the document could be opened it was, and the title now says "opened" (section 4). All dossiers still meet the 2-primary/official/court minimum with opened documents only. |
| Cross-dossier status conflict (5c) | big-business-and-governments-record said the US Adani case was "pending"; large-groups said "US case status not verified"; Adani dossier says counts dismissed 10 Aug 2026 and consent SEC judgment. | Both now point to the Adani Group dossier as the record of status ("as reported"). |
| Cross-dossier numbers (5c) | Adani market cap 14.0 (Dec 2025, concentration) vs "close to 20" lakh crore (May 2026, Adani); Reliance market cap 23.44 (Dec 2025) vs 20.14 (Mar 2024); Reliance employees 419,911 (FY26, unverified) vs 4,03,303 (FY25); CBI/ED "54%" vs "60%" pre-2014 opposition share. | Different dates/measures, not errors. Flagged in `notShown` of concentration and in the CBI position (54% is the ED figure, 14 of 26; CBI count is 43 of 72). ED `notShown` flags 47 decided cases (Director) vs 40+3 (Aug 2024 reply). Concentration SBI Rs 27,000 crore matches the other dossiers. |
| Concentration: unsupported claim | A World Inequality Lab claim (top 1% shares) cited source 10, which is the MoSPI release; the WIL source was not listed. It also measures individuals, not groups. | Claim removed. |
| Concentration: unsupported figure | Text said Top-5 sales share "90% of refining assets [1]"; the table has telecom over 84% and retail over 65% only. | Text changed to match the table. |
| Concentration: 2025-09-18 timeline | "SEBI dismisses the Hindenburg allegations" read as a verdict. | Reworded to the SEBI wording (allegations in the show cause notices not established). |
| Concentration: government id | Position for the Union government used centre-2014-modi-1 for a statement about the present. | Changed to centre-2024-modi-3. |
| Adani: unverified accusation about a named firm | "Hindenburg's trading was itself the subject of SEBI notices (reported, not verified)". | Removed. |
| Adani: unsourced named individual row | Table row on "Vinod Adani and 11 others ... closed with no evidence found" had no source in the list. | Row removed. |
| Adani: "flagship" in body | Evaluative adjective for a company. | Removed. |
| Adani: electoral-bond classification | Welspun/ABC India are named; only the Adani side's response was noted. | Response field now says no statement from Adani or Welspun was found. |
| Adani: SEBI findings | Status rested on Scroll.in. | SEBI Adicorp order of 18 Sep 2025 opened (para 90: allegations "not established"; no liability) and added as source 25; Milestone/Rehvar order still known only from Scroll. |
| Coal-block finding | Timeline said the 25 Aug 2014 judgment cancelled 214 of 218 blocks. | Judgment opened (Manohar Lal Sharma, 25 Aug 2014): it declares allocations illegal and leaves consequences to a further hearing. Text now separates the declaration (opened) from the cancellation count (reported by Down To Earth). |
| 2G finding | The opened Indian Kanoon page records the grant to 122 applicants and a CBI direction but not the quashing or the 10 Jan 2008 cut-off. | Source title and claim status say so; quashing is "as summarised by media". |
| Kejriwal FIR claim (Reliance gas pricing) | Naming Reliance's chairman and ministers without a response note in the timeline. | Timeline now states that responses were not found; claims table already carried the note. |
| Rahul Gandhi position | "the Government and the group deny favouritism in other statements not reviewed here" was an unsourced assertion. | Replaced with a statement of what the source does and does not contain. |
| CBI "caged parrot" | Typed finding but an oral remark. | Claim retyped official-statement, timeline retyped event, wording "remarked orally". |
| ED "SC told the ED ... quality of prosecution" | Typed finding but an oral observation. | Claim retyped official-statement, timeline event; TASMAC remark labelled oral. |
| SIR: Shah "infiltrators ... opposition raises the voter list only when it loses" | Typed official-statement though it attributes motive to the opposition; the parallel Aug 2025 claim was an allegation. | Retyped allegation (response from Gandhi/Venugopal already present). Parity with the "vote chori" allegation. |
| SIR: 27 May 2026 judgment | Described only from a case tracker; a third judge name came from a search summary. | Judgment (2026 INSC 564) and 8 Sep 2025 order opened; bench is CJI Surya Kant and Justice Bagchi; para 186 summarised; sources 28 and 29 added; `notShown` updated. |
| SIR: "independent constitutional body" and "Election results after SIR" | Adjective and a table title that could imply a link. | "constitutional body under Article 324"; table renamed "Assembly election results ... (data only)". |
| CBI s.17A "split verdict ... per exam-prep summaries" | Operative outcome unverified. | Judgment opened via Indian Kanoon: divergent opinions (Viswanathan J would save s.17A with Lokpal/Lokayukta approval; Nagarathna J struck it down) and referral to the Chief Justice. Timeline, claim and body updated. |
| CBI: Vineet Narain row | Dated 1996-01-01, mixing 1996 and 1997. | Dated "1997" with a note that the date comes from a search-result summary (judgment of 18 Dec 1997). Not opened. |
| CBI: Organiser described as "BJP-aligned" | Characterisation of a publication. | "a weekly"; "party-aligned opinion piece" now "opinion piece". |
| CBI: Himanta Sarma / Amit Shah claim | Response field did not say that no response from the named people was found. | Now explicit. |
| CBI: internal language | "the brief", "a source I opened". | Reworded. |
| ECI: unverified item about two Election Commissioners in a claim status | Unverified statement about named officials. | Removed (it remains, flagged unverified with "no response located", in the SIR dossier). |
| ECI: Sabrang headline in a source title | "BJP escapes scrutiny" in the site's source list. | Title neutralised. |
| ECI: explainer said the Commission/government "replied" in each case | Not true for every case. | Now says responses are recorded where found. |
| Large-groups: Anil Ambani claim | Stated as the site's voice ("orchestrated a scheme"), order not opened. | Reworded as SEBI's finding, "as reported", with the appeal and the statement that it is a regulator's order, not a criminal conviction; response field explicit. |
| Large-groups: Adani/Kenya claims | Hindenburg claim written as fact; Kenya claim typed allegation with a causal verb. | Claim text now "Hindenburg alleged ..."; Kenya item retyped official-statement ("said the cancellation followed new information"). "Sinking into insolvency" removed. |
| Funding: Future Gaming/Qwik | Unnamed critics; named companies. | madeBy clarified (dates are reported facts; link is the critics' claim); status says a purchase after a raid does not show causation. |
| Cockroach: "name echoes the BJP" | Unsourced insinuation; duplicated citation [10][10]. | Reworded to what sources support; citation fixed. |
| Site copy (6) | Banner gave an as-of date but did not say sources were mostly seen in summaries. | Dossier page banner now reports "N of M sources are labelled as seen only in search results or summaries"; no-verdict sentence added; dossier index lede and methodology dossier section state the as-of date, search-summary sourcing, retyping rule and the year/month date rule. |
| Actions | PMLA concern stated that bail conditions "limit accused persons' rights" as fact; source types for SC Observer/Sabrang labelled `court`. | Attributed to petitioners (and the 2022 upholding noted); types corrected; two opened court documents added to the SIR action; Pankaj Bansal title updated. CEC action reviewed: no change needed (balanced, attributed). |

## 2. Asymmetries found

- Reliance versus Adani: the shared record file has 11 rows on Adani and 3 on Reliance (gas pricing only); Reliance telecom, retail and refining dealings are uncovered. Concentration's lender-exposure table is Adani-only. Recorded in `notShown`; not fixable without new sourced material.
- UPA versus NDA: balanced in the CBI, ED, large-groups and shared record files. The shared record file has no 1998-2004 NDA or UPA bank-credit rows (already listed in `notShown`).
- INC-ruled versus BJP-ruled states: the shared record file has Rajasthan (BJP 2015, INC 2022), Telangana (INC), Gujarat (BJP) and Maharashtra, West Bengal, Kerala; Karnataka, Chhattisgarh, Madhya Pradesh, Haryana, Odisha rows are missing. CBI consent withdrawals list no BJP-ruled state (none reported). ED dossier has no case against a leader of an INC- or BJP-ruled state government; recorded in `notShown`.
- SIR: positions of INC-ruled (Karnataka, Telangana) and BJP-ruled state governments are absent; the ruling side is represented by Amit Shah, state BJP leaders, the Union reply, and NDA allies TDP and JD(U).
- ECI: opposition allegations for 2023-26 are more numerous than ruling-party allegations for 2006-2014; the Commission's and government's responses are recorded for each.
- CBI: no government or BJP response to the Indian Express count is on record in the sources; recorded in the claim.
- Source quality: Wikipedia (tertiary) underlies much of the CBI, ED, Adani and funding dossiers.

## 3. Residual risks

1. Most court and parliamentary material remains second-hand (news reports of Lok Sabha/Rajya Sabha replies, SC Observer summaries); statuses are "as reported" and may be out of date, especially the Adani US case after 3 September 2026, the Supreme Court Jet Airways/Reliance appeals and the SAT appeal for Anil Ambani.
2. Named private individuals and companies (Adani and family, Anil and Mukesh Ambani, Future Gaming, Megha Engineering, Vedanta, Welspun, Qwik, Mallya): the dossiers rely on journalism for many facts; Reliance responses are often "not retrieved". A legal review before wider promotion is advised.
3. Wikipedia used as the base for timelines, conviction rates and phase tables (typed reputable-media, which overstates it).
4. Dated or mixed measures across dossiers (market cap, employees, conviction counts, opposition share) are flagged but not reconciled; readers may still compare them.
5. The 2G quashing, the Vineet Narain date and the 214-of-218 cancellation figure rest on media summaries; the Monopolies Inquiry Commission 1965 timeline row cites a book page with no figures.

## 4. Documents opened during this review

Indian Kanoon: Centre for PIL (2G), Pankaj Bansal, Manohar Lal Sharma (25 Aug 2014), CPIL v Union of India (13 Jan 2026, s.17A). Supreme Court PDFs: Jet Airways 7 Nov 2024; SIR judgment 27 May 2026; Aadhaar order 8 Sep 2025. SEBI Adicorp order 18 Sep 2025. Business Today 15 Jun 2015 Adani-Rajasthan report; list of chief ministers of Rajasthan. Not opened (errors/403): Lok Sabha AU793, PIB, eci.gov.in, sci.gov.in s.17A PDF.
