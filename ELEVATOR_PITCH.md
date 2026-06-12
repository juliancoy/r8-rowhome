# The Long Elevator Pitch

*It's an elevator pitch, except it's a long-ass elevator.*

## The One-Floor Version

We procedurally generate Baltimore R-8 rowhomes — real ones, source-traced to the
actual city code — in two construction systems (brick + wood, or steel + concrete),
with the full permit path, personnel plan, and bill of materials attached. Then we
scale them by instancing: 32 rowhomes make a city block, four blocks make a
128-home district. Put a parcel on it, assess its value, and compare that parcel to
the entire real estate market of the world. That comparison is the pitch.

## The Three Circles

Investors want to see three circles in a row. Here they are:

1. **The big circle** — the entire real estate market of the world. Public market
   estimates put global real estate around **$380 trillion** (Savills-class
   estimates; verify before quoting).
2. **The littler circle** — all residential real estate in the United States,
   roughly **$50 trillion** (Zillow-class estimates; verify before quoting).
3. **The littlest circle** — one city block of this thing. A block means **32**
   R-8 rowhomes. At the model's rough-order valuation, that's a parcel in the
   low tens of millions of dollars.

The littlest circle is the one we can actually build, which is the point. The
investor dashboard in the app renders these three circles live (log-scaled radii,
because the big circle would otherwise not fit in the elevator), next to pie
charts of cost by category, labor by crew, and projected profit per home.

## The Block

- Rowhomes multiply **by instancing** — the model arranges up to **128 homes**
  (4 blocks of 32) into a city-block layout: two rows of sixteen, back to back
  across a rear alley, facing opposite streets, with street grids between blocks.
- Each block carries a **parcel** with an assessed value derived from the per-home
  pro forma (development cost, sale comp per square foot, margin).
- One detailed rowhome (or row) stays fully modeled — structure, MEP, BOM,
  personnel — and stands in for every instance, the way one good unit drawing
  stands in for a hundred units.

## The Blockchain

This parcel doesn't go on the county ledger alone — **we put it on blockchain**.
A new chain built on these houses: each instanced home is a token backed by a
generated, source-traced, permit-tracked model of itself, and the parcel registry
is the genesis block. (Status: concept. The registry design is the next pitch.)

## The Society

The block isn't just housing stock. It's a solar-powered society:

- **Solar on every roof.** The model already generates the PV arrays, hybrid
  inverters, and battery storage, with verified electrical connectivity from the
  panels to the main service. All-electric homes, no gas anywhere — that's
  enforced by tests.
- **Gardens on the roofs.** We can't grow much up there and we know it — the
  roof garden is carried in the structural load model at saturated soil weight,
  but it's mostly **symbolic**: the block grows things.
- **Composters in the alley.** Green Mount West already has the composters —
  that program exists today. The next neighborhood gets them too. East 25th
  Street, where it starts to get deserted, is a candidate; really, **northeast
  Baltimore is pretty nice for this kind of thing**.

## The Comparable

There is a community-energy grant model we look at as a comparable — Carbon
Country — whose own pitch materials combine **yurts ("YOATS"), solar, Bitcoin
mining, and biochar** into a single grant proposal: a **$1 million** investment
described as safe against a **$5 million** projected payoff. Those figures come
from their pitch deck, not from us, and we have not verified them. The takeaway
we borrow is the shape, not the numbers: bundle energy, land, and community
infrastructure into one fundable story. Ours bundles solar rowhomes, roof
gardens, composting, and a tokenized parcel.

## The Numbers (run them yourself)

```sh
npm run investor:dashboard   # pro forma, labor/cost/profit pies, market circles
npm run sow:generate         # who builds it: roles, skills, Maryland licenses
npm run permit:package       # the Baltimore DHCD permit path, gap by gap
npm run print:kit            # the whole block, 3D-printable at 1:48
```

## The Disclaimers (the elevator has a basement)

- Every dollar figure in the dashboard is a **rough-order, illustrative
  projection** from model metadata and public market estimates. None of it is an
  appraisal, an offering, or investment advice.
- The model is **not a permit set**. The permit package lists exactly which
  documents still require licensed Maryland professionals and site-specific
  input before anything gets built.
- Market-size figures are public estimates and must be independently verified
  before appearing in any investor-facing material.
- Third-party program figures (including the comparable above) are quoted from
  their own public pitch materials and are not verified or endorsed here.
