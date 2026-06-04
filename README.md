 # Tech take home

## Part 1: DSA, Rust
- fixed size (panics if it goes over capacity)
- linear probing and tombstones, to keep remove O(1) in all cases, others O(1) amortized
- embedded linked list for head/tail tracking
- some googling required, been a while since I implemented one from scratch
- no agents, just me, rust-analyzer and google

## Part 2:
Agent augmented, reviewed.

- vite, react, lightweight-charts.
- Visible on github pages: https://ziemghost.github.io/darley/ , builds with the github action there (bcs can't enable pages in this repo)
- live binance data, hosted on gh pages, works on mobile (vertical and horizontal), responsive layout switching to tabs if screen size is too small
- different resolutions, MA lines, crosshair, volume information
- draggable, zoomable, live updating, added ETH and SOL because why not
- background indicators

### What I'd add if this wasn't a tech takehome
- No styling lib because small SPA, this would probably be a part of a larger site so I'd extract components for reuse
- Polish, polish, attention to detail. I did a reasonable amount, but many small improvements could be added pretty much everywhere:
  - Order book bucketing
  - On-hover information on most UI elements
  - Custom time, different views, different themes, fullscreen chart, more on-hover indicators (open/high/low/close) on candles


# Self eval:
- Rust: 9.5/10, I think I know all there is to know without being an active developer of the language itself, but that's a different level and a different job.
- TS: 7/10
- React: 7/10
- Deno: 7/10
- Vite: 6/10

