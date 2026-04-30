# BMAS Employment Law Quiz Platform

Last updated: 2026-04-30

## Product brief

BMAS will launch a free, gamified Zambian employment law quiz platform for students and the general public. The experience should feel educational first and competitive second: users sign in with social OAuth, attempt one quiz per level per calendar month, unlock the next level only by passing, and appear on a live monthly leaderboard that resets automatically.

## Recommended MVP decisions

- Backend: Supabase
- Auth: Supabase Auth with Google and Facebook providers
- Storage principle: do not copy profile data into custom tables; only store the Supabase auth user id plus quiz metadata
- Public identity: generate a pseudonym such as `Copper Eagle 482` for the leaderboard instead of storing name, email, or profile photo
- Passing score: recommend `75%` for MVP
- Questions per attempt: recommend `12` per level attempt
- Scoring rule: `1 point` per correct answer, no negative marking
- Attempt rule: one submitted attempt per `user_id + level + month_key`

## Core journeys

1. User signs in with Google or Facebook.
2. System creates or fetches a pseudonymous quiz profile.
3. User sees unlocked level, current-month attempt status, leaderboard, and hall of fame.
4. User starts a level attempt for the current month.
5. User submits answers and receives score plus per-question legal feedback.
6. If the user passes, the next level unlocks.
7. At month end, the leaderboard snapshots winners into hall of fame and resets automatically.

## Privacy model

- Store in custom tables: `user_id`, `alias`, `current_level`, `level`, `score`, `passed`, `month_key`, timestamps
- Avoid storing: email, real name, phone number, profile image, raw OAuth payloads
- Feedback should be generated from the question bank and legal references, not from stored personal data

## Suggested data model

### `quiz_profiles`

- `user_id uuid primary key references auth.users(id)`
- `alias text unique not null`
- `current_level smallint not null default 1`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `quiz_attempts`

- `id uuid primary key`
- `user_id uuid not null references quiz_profiles(user_id)`
- `level smallint not null check (level between 1 and 3)`
- `month_key date not null`
- `score numeric(5,2) not null`
- `passed boolean not null`
- `submitted_at timestamptz not null default now()`
- unique constraint on `user_id, level, month_key`

### `leaderboard_monthly_snapshot`

- `id uuid primary key`
- `month_key date not null`
- `rank integer not null`
- `alias text not null`
- `score numeric(5,2) not null`
- `level smallint not null`
- `captured_at timestamptz not null default now()`

### `question_bank`

- `id uuid primary key`
- `level smallint not null`
- `slug text unique not null`
- `scenario text not null`
- `question text not null`
- `options jsonb not null`
- `correct_option text not null`
- `explanation text not null`
- `act_reference text not null`
- `case_reference text null`
- `is_active boolean not null default true`

## Content architecture

### Level One: Act fundamentals

Focus on statutory basics and straightforward application.

- Sections 2 to 8: application, interpretation, non-discrimination, disability protection, casualisation, forced labour
- Sections 19 to 27: contract types, writing requirements, contents, attestation, probation
- Sections 33 to 47: repatriation, annual leave, sick leave, compassionate leave, family leave, maternity, nursing breaks, paternity leave
- Sections 66 to 75: wage payment timing, permitted deductions, gratuity, normal hours, overtime
- Section 95: required workplace policies

Example question styles:

- identify the lawful contract type
- identify whether a deduction is permitted
- compute whether a worker qualifies for annual leave or paternity leave
- determine whether conduct amounts to casualisation

### Level Two: procedure and remedies

Focus on dismissal, termination, severance, and redundancy procedure.

- Sections 49 to 53: suspension, summary dismissal, fair termination, notice
- Sections 54 to 59: severance, redundancy, exemption, re-employment rights, retirement, certificate of service
- Sections 68 and 73 to 75: deductions, gratuity, hours, overtime
- Sections 43 to 46: pregnancy and family-related protections in disputes

Example question styles:

- identify whether dismissal or termination rules apply
- test hearing fairness and burden of proof
- distinguish severance pay from gratuity and redundancy payment
- apply redundancy notice and consultation requirements

### Level Three: edge cases and mashups

Focus on mixed-fact scenarios with multiple statutory hooks.

- Sections 28 to 32: transfer of rights, transfer refusal, employment outside the Republic
- Sections 55 to 57 with section 95: redundancy plus policy and consultation failures
- Sections 60 to 65: expatriate employment and citizen priority
- Sections 92 to 95: housing, medical attention, mandatory workplace policies

Example question styles:

- redundancy plus discrimination plus failure to hear the employee
- maternity-protected employee selected for restructuring
- long-term contract dispute involving gratuity and early termination
- transfer refusal followed by severance and certificate of service issues

## Landmark case shortlist

These are good first-wave cases for the question bank and feedback engine.

1. `Redrilza v Nkazi (SCZ 7 of 2011) [2011] ZMSC 7`
   Use for distinguishing dismissal from termination and when courts examine employer reasons.

2. `Contract Haulage Limited v Kamayoyo (S.C.Z. Judgment 2 of 1982) [1982] ZMSC 13`
   Use for the classic distinction between ordinary wrongful dismissal remedies and statutory-protection cases.

3. `Tinashe Timothy Gandize v Newrest Zambia Limited (COMP / IRCLK/245 / 2021) [2023] ZMHC 53`
   Use for gratuity under the Employment Code Act applying to long-term contracts, not every permanent contract.

4. `Oliver Zimba and Ors v Kay Two Zambia Limited (2022/HPIR/632) [2023] ZMHC 42`
   Use for redundancy under section 55 and the employer duty to keep paying wages until the redundancy package is paid.

5. `Brighton Mwaipopo v Zesco Limited (2022 /HPIR/ 667) [2023] ZMHC 83`
   Use for consultation, genuine redundancy analysis, and the re-employment principle in section 57.

6. `Francis Machakube and Ors v City University of Science and Technology (COMP/IRCLK/641 / 2020) [2024] ZMHC 115`
   Use for retaliatory dismissal, natural justice, and damages.

7. `Protea Hotels Zambia v Longa William Mulikelela (APPEAL 179/2023) [2025] ZMCA 116`
   Use for disciplinary bias, the right to an impartial hearing, and the difference between wrongful and unfair dismissal terminology.

## Question template

Each question should carry enough metadata for scoring and educational feedback.

```json
{
  "level": 2,
  "slug": "redundancy-consultation-001",
  "scenario": "An employer announces that ten employees will be released next week because business has slowed down.",
  "question": "What is the strongest compliance problem on these facts?",
  "options": [
    "No issue because the employer can reduce staff immediately",
    "The employer must only notify the affected employees verbally",
    "The employer must consult and notify an authorised officer at least 60 days before the redundancy takes effect",
    "The employer may delay all redundancy payments indefinitely"
  ],
  "correct_option": "C",
  "act_reference": "Employment Code Act, 2019, s.55(2)-(3)",
  "case_reference": "Oliver Zimba and Ors v Kay Two Zambia Limited [2023] ZMHC 42",
  "feedback": "Redundancy requires consultation and advance notice to an authorised officer, and the package must be paid by the last day of duty unless an exemption applies."
}
```

## Build tracker

### Phase 0: Research and scope

- `Done`: extract first-pass section map from the Employment Code Act PDF
- `Done`: shortlist initial case authorities for dismissal, gratuity, and redundancy
- `In progress`: confirm the final case list and match each case to level difficulty

### Phase 1: Content design

- `Pending`: set the final pass mark, question count, and leaderboard tie-break rules
- `Pending`: draft at least 36 questions for Level One
- `Pending`: draft at least 36 questions for Level Two
- `Pending`: draft at least 36 questions for Level Three
- `Pending`: standardise explanation format for Act plus case-law feedback

### Phase 2: Platform foundation

- `Pending`: create Supabase project
- `Pending`: enable Google OAuth
- `Pending`: enable Facebook OAuth
- `Done`: create SQL schema, RLS policies, and uniqueness rules in `supabase/quiz-schema.sql`
- `Done`: add public config endpoint for runtime mode switching
- `Pending`: create monthly reset snapshot function scheduler in Supabase

### Phase 3: Frontend integration

- `Done`: add dedicated quiz landing page to BMAS site
- `Done`: build auth gate with demo fallback and pseudonym onboarding
- `Done`: build level cards, lock states, and attempt state
- `Done`: build quiz runner
- `Done`: build score view and legal feedback panel
- `Done`: build current leaderboard and hall of fame views

### Phase 4: QA and launch

- `Pending`: verify one-attempt-per-level-per-month rule
- `Pending`: verify level unlocking logic
- `Pending`: verify month rollover snapshot and reset
- `Pending`: cross-check every answer explanation against source law and case citation
- `Pending`: publish and test on mobile

## Open decisions

- Whether the pass mark should be `70%` or `75%`
- Whether each monthly attempt should be timed
- Whether the leaderboard ranks by raw score only or score plus completion time
- Whether users can review missed questions after submission without seeing the entire bank
- Whether BMAS wants a public hall of fame page or an in-app archive only

## Source notes

- Primary statute reviewed locally: `The Employment Code Act No. 3 of 2019.pdf`
- Case citations cross-checked against ZambiaLII
- Before production launch, each question explanation should be checked against the full judgment text, not only the case summaries
