# Data notes: governments and parties

Scope: `src/data/governments.json` (Centre, 21 entries), `src/data/states/*.json` (8 states), `src/data/parties.json` (56 parties). Compiled 2026-10-11.

## Verification status
- **Verified against pages opened (Wikipedia):** every start/end date for the Centre (list of prime ministers) and for all eight states (state lists of chief ministers, including President's Rule rows). Wikipedia was the only source opened; Lok Sabha, PIB, ECI and state-assembly sites were NOT consulted, so dates are "verified against Wikipedia", not against a primary source. A primary-source pass (Gazette/ECI) is still recommended.
- **Verified seat counts:** Centre 1989 (INC 197, JD 143, BJP 85, CPI(M) 33), 1991 (INC 244, BJP 120, JD 59, CPI(M) 35), 1996 (BJP 161, INC 140), 1998 NDA table (sums to 252), 1999 (NDA 299, BJP 182), 2004 (INC 145, RJD 24, DMK 16, NCP 9, PMK 6, JMM 5, TRS 5, LJP 4, MDMK 4; UPA 218), 2009 (UPA 262, INC 206), 2014 (NDA table sums to 336), 2019 (partial), 2024 (NDA 293: BJP 240, TDP 16, JD(U) 12, SS 7, LJP(RV) 5, JD(S) 2). States: TN 2026 (TVK 108, DMK-led SPA 73, AIADMK-led 53), Kerala 2026 (UDF 102, INC 63, LDF 35, BJP 3), West Bengal 2026 (BJP 208, AITC 80), Maharashtra 2024 (BJP 132, SS 57, NCP 41) and 2019 (BJP 105, INC 44).
- **Not verified (flagged with "unverified"/"general knowledge" in each entry's `note`):** all other state seat counts and most coalition compositions, and the Centre figures noted below. Every such entry says so in `partners[].note` or `note`. Share precision should not be read as exact.

## Conventions and judgement calls
1. `lokSabha` = the Lok Sabha in being at formation. Nehru's 1947-64 government is one entry (Lok Sabha 1-3, the pre-1952 interval had a provisional Parliament; field set to 1). Indira-1 spans the 3rd-5th; Vajpayee 1998 spans the 12th and 13th.
2. INC splits (1969 INC(O)/INC(R), 1978 INC(I), 1991 "INC(I)") are all mapped to party id `inc` for the main Congress lineage; breakaway groups that governed are separate ids: `inc-o`, `inc-u`, `ics`. Reason: party-level tallies should follow the lineage.
3. Janata family ids: `janata-party` (1977), `jp-s`, `jd`, `sjp`, `jd-s`, `jd-u`, `samata`, `rjp`. Karnataka's "JP" is `janata-party`; Bommai (1988-89) is listed JP per the page.
4. Centre shares: computed as seats of each listed party among the listed governing parties. Where small allies were omitted or only part of the table was available, `partners[].note` says so (2019: six largest parties of NDA 353; 2024: six largest of NDA 293). Outside-support parties are in `outsideSupport`.
5. Centre unverified figures: United Front 1996-98 party seats (JD 46, TMC(M) 20, DMK 17, SP 17, TDP 16, CPI 12, AGP 5; cabinet membership per the Deve Gowda ministry page, seat counts from general knowledge, other minor UF parties omitted; CPI(M) is not mentioned on that page so is not listed); 2009 UPA minor-partner counts and outside supporters; 1980/1984 INC counts; Nehru-era counts; Charan Singh and Chandra Shekhar party sizes; Rao's outside-support parties.
6. Vajpayee 13-day government: Wikipedia gives both 28 May and 1 June 1996 as the end (internal inconsistency); 1 June is used so that it meets the Deve Gowda start on 1 June.
7. Centre type for Rao (1991): `minority-outside-support` because INC was short of a majority at formation; there was no formal outside-support bloc.
8. Modi III: no change in PM through 2026-10-11 (news of 7 Oct 2026; Wikipedia ministry page shows only minister resignations in June-July 2026). NDA membership changes after mid-2026 were not checked beyond that.
9. States: one entry per continuous tenure; consecutive tenures of the same CM are merged only when the governing party and coalition basis are unchanged (e.g. Kamaraj, Jyoti Basu). A change of coalition composition or of CM starts a new entry. Seat shares for merged tenures use the first assembly and say "approximate".
10. When the end of one entry and the next start differ by exactly one day (swearing-in the next day), the earlier end is set equal to the next start so periods meet. Genuine gaps are kept (below).
11. President's Rule rows: `type: presidents-rule`, `leadParty: null`, `partners: []`, `cm: null`.
12. Pre-1950 premier tenures: West Bengal and Karnataka (Mysore) include the 1947-50 premiers as listed on the pages. Tamil Nadu and Uttar Pradesh start at 1950-01-26 because the opened pages start there; pre-1950 premiers (Madras Presidency, UP) are omitted and unverified. Kerala starts 1956-11-01 (formation); Travancore-Cochin is not included. Gujarat and Maharashtra start 1960-05-01.
13. Delhi: 1952-56 Delhi State included (Brahm Prakash, Gurmukh Nihal Singh); then no assembly until 1993 (a genuine gap, 1956-11-01 to 1993-12-02).

## Items that could not be verified or are gaps
- Uttar Pradesh 1985-03-11 to 1985-09-24: the Wikipedia list shows no CM. Left as a gap (198 days). Probably the continuing Tiwari government, not verified.
- Uttar Pradesh 1996-10-17 to 1997-03-21: list shows no CM; recorded as President's Rule from general knowledge, not from the page opened.
- Gujarat 1985-03-11 to 1985-07-06: the parsed page did not name the CM; Madhav Singh Solanki recorded from general knowledge.
- West Bengal 2026-05-07 to 2026-05-09: page says Governor's rule/vacancy (no President's Rule); 2-day gap left.
- West Bengal 1967-11-21 to 1968-02-20: P. C. Ghosh listed as "Independent"; entry has `leadParty: null`, `partners: []` (shares cannot sum to 1.0; INC support not verified).
- Tamil Nadu 1980 President's Rule: table says 17 Feb, a note says 7 Feb; 17 Feb used. The party for acting CM Nedunchezhiyan is listed inconsistently on the page; DMK/AIADMK assigned by period.
- Karnataka: parties of Hanumanthaiah and Manjappa not stated on the page; INC from general knowledge. Siddaramaiah's end (2026-06-03) is the page's date for Shivakumar's swearing-in; the source states he "stepped down in May 2026" so there may be a short gap.
- Kerala 2026: 39 of the 102 UDF seats are not broken down on the pages opened, so INC is shown at share 1.0.
- Tamil Nadu 2026: TVK 108 + INC 5 = 113 of 234; four other SPA parties give outside support (names not given); the majority of 118 relied on them.
- Maharashtra 2022 Shinde government: seat split (BJP 105, Shiv Sena rebel faction about 40) is an estimate; the NCP (Ajit Pawar) joined in July 2023 and is not itemised.
- Centre seat shares for pre-1977 governments are 1.0 for INC without seat counts.
- Entries also carry an optional extra `note` field beyond the contract.

## Sources opened
- https://en.wikipedia.org/wiki/List_of_prime_ministers_of_India
- State CM lists: Wikipedia "List of chief ministers of" Tamil Nadu, Kerala, Uttar Pradesh, Gujarat, West Bengal, Maharashtra, Karnataka, Delhi.
- Wikipedia: 1989, 1991, 1996, 1998, 1999, 2004, 2009, 2014, 2019, 2024 Indian general elections; Third Modi ministry; Deve Gowda, First Vajpayee, Chandra Shekhar, Second Manmohan Singh ministries.
- Wikipedia: 2026 Tamil Nadu, Kerala, West Bengal assembly elections; 2024 Maharashtra election; Satheesan ministry; D. K. Shivakumar.
- Web search on 2026-10 news confirming Narendra Modi as PM (uniindia.com, ddindia.co.in, outlookindia.com).
