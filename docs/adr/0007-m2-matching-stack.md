# 0007. M2 matching and analysis stack: lexical first, models on evidence

- Status: accepted
- Date: 2026-10-09
- Deciders: Ayanbergen Saduakassov (review pending)

## Context
M2 must match messy purchase text to ЕНС ТРУ and compute findings with measured accuracy. The OSS block lists 36 candidate repos. Real classifier data and the owner's 300 hand-labelled lines do not exist yet (sample classifier + synthetic set, owner decision 2026-10-09).

## Decision
1. Retrieval and scoring: RapidFuzz over ru/kk names and synonyms after deterministic normalisation (abbreviations, units, old-to-new Kazakh alphabet, light Russian suffix folding). Confidence is calibrated on a train split; low confidence goes to the human review queue.
2. LLM re-rank is optional and restricted: it only runs in the ambiguous band, only through `services.llm`, and its answer must be one of the retrieved candidate codes (else ignored).
3. Detectors are deterministic Python over normalised lines, with a second, independent SQL implementation of the savings math. No model touches any number.
4. Embeddings (bge-m3 + pgvector), probabilistic linkage (splink/dedupe), DSPy and dataframe engines are deferred with explicit triggers (`docs/research/oss-verification-M2.md`).

## Alternatives considered
Embedding-first retrieval: likely better on paraphrases, but heavy (torch, ~2 GB weights), needs a model-supply-chain review, and cannot be judged honestly without real labelled data.

## Consequences
Small dependency surface and fully explainable matches. Paraphrase-heavy real data may need the embedding spike; the eval harness is ready for that comparison.
