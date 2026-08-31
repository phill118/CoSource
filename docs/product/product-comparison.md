# Product comparison

Pass 7 compares exactly two existing Pass 6 `ProductEvaluation` values. It does not inspect product prose again or replace the evidence evaluator.

The comparison publishes counts for mandatory failures, exclusion violations, mandatory unknowns and satisfactions, and preference satisfactions and unknowns. A candidate is stronger only through explicit, deterministic dominance. Conflicting advantages produce a tradeoff; equal known results produce equivalence; equal unresolved mandatory evidence produces insufficient evidence. Preferences cannot erase a known mandatory failure or exclusion violation.

Item price is supporting context. It is compared only when both evaluations provide prices in the same currency. Missing or mixed-currency prices are called out, no foreign-exchange estimate is invented, and price alone does not determine the outcome. The service returns reasons and never emits a numeric score, recommendation, or automatic winner.
