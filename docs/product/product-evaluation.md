# Evidence-aware product evaluation

Pass 6 evaluates one canonical product against one runtime-validated `PurchaseGoal`. Draft goals cannot enter the evaluator. Results preserve goal and product identities, goal revision, condition category, original condition, status, observed value, provenance, and deterministic reason.

## Evidence rules

Fields are matched by trimmed, case-insensitive exact names against canonical attributes, product options, and selected merchant-offer options. No synonyms or product/category ontology exists. Titles and descriptions are never used as structured proof. Free-text requirements remain unknown.

Equality compares trimmed, case-insensitive structured values. Boolean evaluation accepts only `true`, `false`, `yes`, and `no`. Numeric evaluation accepts unambiguous numbers and requires identical unit representation; the current validated goal model is unitless, so unit-bearing provider values remain unknown. No unit conversion occurs.

Provider-explicit evidence can establish satisfied or failed. Provider-inferred evidence remains unknown and is labelled Inferred. Safe deterministic budget comparison is labelled Derived. Missing evidence is Unknown.

When multiple values resolve for one field, evaluation applies deterministic provenance precedence: provider-explicit, CoSource-derived, provider-inferred, then unknown. Only the strongest applicable tier is evaluated. Weaker evidence cannot mask or override it. Distinct conflicting values within the same strongest tier return unknown instead of being selected by array order. Canonical provider arrays are never reordered or mutated.

## Eligibility and money

- `ineligible`: a hard requirement fails, an exclusion is violated, or a safely comparable budget fails.
- `eligible_with_unknowns`: there is no definite failure, but a mandatory condition or budget remains unknown.
- `eligible`: all entered mandatory conditions and any budget are established without failure.

Preferences are evaluated but never affect eligibility. Budget comparison requires identical currencies and one evidence-selected item price. Quantities above one remain unknown because pack/per-unit semantics are not established. The comparison excludes shipping and tax and is never described as a final total.

Evaluation does not reorder products or offers and produces no scores, ranking, recommendations, AI prose, or compatibility inference.
