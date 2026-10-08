# Personas and jobs-to-be-done

Status: hypotheses from the roadmap, not from interviews. Phase 0 interviews (>= 15) must confirm or replace them. Names are illustrative.

## 1. Procurement manager: Айгерим, mid-size mining supplier, Karaganda
**Job:** buy what operations needs, on time, at a price she can defend.
**Top 3 tasks:** 1) compare offers for a recurring item; 2) check a new supplier before the first order; 3) explain to finance why this price.
**Fears:** being blamed for overpaying; a supplier that turns out to be on a sanctions list; an audit finding split purchases.
**Bad day:** the plant manager needs bearings today, the usual supplier is out, the alternative's BIN shows nothing she recognises, and finance asks why last month's price was 20% higher.
**Design implications:** fast supplier check from BIN; price history per Item; exportable decision record.

## 2. CFO / internal auditor: Ерлан
**Job:** control spend and prove it to the board and owners.
**Top 3 tasks:** 1) read the audit report headline and drill into the biggest finding; 2) see supplier concentration risk; 3) sign off large purchases.
**Fears:** acting on a wrong number; a report that collapses under an owner's question; data leaking to competitors.
**Bad day:** the board asks "where did the 4% go?" and the only answer is a spreadsheet nobody can trace.
**Design implications:** Evidence drawer on every number; named reviewer on the report; PDF identical to screen.

## 3. Logistics coordinator: Дмитрий, works from a phone
**Job:** get shipments through borders and to site without surprises.
**Top 3 tasks:** 1) see which shipments need action now; 2) check a document before the border; 3) tell the site when it will really arrive.
**Fears:** a truck stuck at Khorgos because of one wrong field in a CMR; promising a date he can't keep.
**Bad day:** three carriers, three WhatsApp chats, one container "lost" between rail and truck, and site calling every hour.
**Design implications:** exception-first list, last-updated stamps, probability not single dates, works offline-ish.

## 4. Supplier sales rep: Асель, distributor
**Job:** win and keep buyers with minimal paperwork.
**Top 3 tasks:** 1) complete onboarding for a new buyer; 2) respond to an RFQ; 3) correct data the buyer extracted from her offer.
**Fears:** being rejected by an algorithm without explanation; buyers seeing her prices shared with competitors.
**Bad day:** a buyer's portal makes her retype everything from the PDF she already sent, on a phone, in a language she doesn't prefer.
**Design implications:** phone-first onboarding, prefilled from registry, confirm-not-retype, clear data-sharing statement.

## 5. QazSupply reviewer: (initially the owner)
**Job:** make sure nothing wrong reaches a client.
**Top 3 tasks:** 1) review findings fast with evidence side by side; 2) resolve low-confidence matches in bulk; 3) release the report.
**Fears:** approving a false finding that a CFO later disproves; review backlog delaying paid audits.
**Bad day:** 600 low-confidence matches, a report due tomorrow, and no way to see why the matcher chose a code.
**Design implications:** keyboard-first queue, "why suggested", batch actions with undo, SLA timer, diff view.
