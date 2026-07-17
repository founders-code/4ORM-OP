#!/usr/bin/env python3
"""
gate_financial_docs.py
----------------------
Takes the financial documents out of the 4orm advisor / employee / engineering
rooms and replaces each with a "Not live yet" placeholder that carries a small
yellow note. Fully reversible.

WHAT IT GATES (anything tied to the unit structure, the raise, the 4orm
financials, or projections):
    captable    - Capital Structure (v14)
    fivemodel   - 5-Year Model (v14)
    capmemo     - Capital Structure Memorandum
    strategy    - Strategy & Fundraise Status
    dashboard   - Current State Dashboard
    legacy      - Legacy Token Program
    (plus the "Pre-Seed Round Structure Recs" card)

WHAT IT LEAVES ALONE:
    - The advisors' personal documents (MNDA, Engagement Letter, Compensation
      Schedule - all st:'private') are never touched.
    - Governance, company, orientation and all other non-financial docs stay live.

HOW IT WORKS:
    - Adds a reversible 'notlive' state + yellow placeholder to each room page.
    - Flips the financial cards to that state.
    - Blanks the underlying document content so the real financials are not even
      present in the page source.
    - Backs up every original block to gate_financial_backup.json so you can undo.

USAGE:
    python3 gate_financial_docs.py apply   --dir /path/to/repo/public
    python3 gate_financial_docs.py restore --dir /path/to/repo/public

If --dir is omitted it defaults to ./public next to this script.
"""

import re, json, sys, os, argparse

DOC_KEYS   = ["captable", "fivemodel", "capmemo", "strategy", "dashboard", "legacy"]
NAME_CARDS = ["Pre-Seed Round Structure Recs"]          # cards with no doc key
FILES      = ["advisor.html", "employee.html", "engineering.html"]
BACKUP     = "gate_financial_backup.json"

# ---- the yellow placeholder (reuses the room's existing .placeholder styling) ----
CSS = (
".placeholder .tag.nl{color:#C8991F;}"
".placeholder .nl-note{margin-top:16px;font-size:.92rem;font-weight:700;color:#C8991F;}"
".fbadge.b-nl{background:rgba(231,199,108,.16);color:#B4881C;}"
)

PLACEHOLDER_FN = (
"function notlivePlaceholder(name){return `<div class=\"placeholder\">"
"<div class=\"pi\" style=\"background:rgba(231,199,108,.16);color:#C8991F\">&#9788;</div>"
"<h3>${name}</h3>"
"<p>This document is not live yet.</p>"
"<div class=\"nl-note\">Available here when it is live.</div>"
"<div class=\"tag nl\">Not live yet</div></div>`;}"
)


def inject_infra(s):
    """Add CSS, the placeholder function, the badge and the openFile branch (idempotent)."""
    if ".fbadge.b-nl{" not in s:
        s = s.replace("</style>", CSS + "\n</style>", 1)
    if "function notlivePlaceholder(" not in s:
        anchor = "function soonPlaceholder(name){"
        s = s.replace(anchor, PLACEHOLDER_FN + "\n" + anchor, 1)
    if "notlive:[" not in s:
        s = s.replace("const BADGE={", "const BADGE={notlive:['b-nl','Not live'],", 1)
    if "f.st==='notlive'" not in s:
        branch = "if(f.st==='notlive'){openModalDoc(f.name, notlivePlaceholder(f.name));return;}\n "
        s = s.replace(" if(f.doc && DOCS[f.doc]){", " " + branch + "if(f.doc && DOCS[f.doc]){", 1)
    return s


def apply(pubdir):
    backup = {}
    for fn in FILES:
        path = os.path.join(pubdir, fn)
        if not os.path.exists(path):
            continue
        s = open(path, encoding="utf-8").read()
        fb = {"docs": {}, "cards": {}, "named": {}}
        s = inject_infra(s)

        # 1) flip financial cards (st before doc): st:'X',doc:'KEY'
        for key in DOC_KEYS:
            m = re.search(r"st:'([^']*)',doc:'" + re.escape(key) + r"'", s)
            if m and m.group(1) != "notlive":
                fb["cards"][key] = m.group(1)
                s = s.replace(m.group(0), "st:'notlive',doc:'" + key + "'")

        # 2) flip name-only cards (no doc key)
        for name in NAME_CARDS:
            m = re.search(r"(name:'" + re.escape(name) + r"',sub:'[^']*',st:')([^']*)'", s)
            if m and m.group(2) != "notlive":
                fb["named"][name] = m.group(2)
                s = s.replace(m.group(0), m.group(1) + "notlive'")

        # 3) blank the underlying document content so financials leave the source
        for key in DOC_KEYS:
            blk = re.search(r"(?ms)^( " + re.escape(key) + r":`)(.*?)(`,)$", s)
            if not blk:
                continue
            body = blk.group(2)
            if "notlivePlaceholder(" in body:
                continue  # already gated
            tm = re.search(r"dtop\('([^']*)'\)", body)
            title = tm.group(1) if tm else key
            fb["docs"][key] = body
            stub = "${notlivePlaceholder('" + title.replace("'", "\\'") + "')}"
            s = s[:blk.start()] + blk.group(1) + stub + blk.group(3) + s[blk.end():]

        open(path, "w", encoding="utf-8").write(s)
        backup[fn] = fb
        print(f"{fn}: gated docs={list(fb['docs'])} cards={list(fb['cards'])} named={list(fb['named'])}")

    json.dump(backup, open(os.path.join(pubdir, BACKUP), "w"), indent=2)
    print(f"\nBackup written -> {os.path.join(pubdir, BACKUP)}  (keep it; needed to restore)")


def restore(pubdir):
    bpath = os.path.join(pubdir, BACKUP)
    if not os.path.exists(bpath):
        sys.exit("No backup file found; cannot restore.")
    backup = json.load(open(bpath))
    for fn, fb in backup.items():
        path = os.path.join(pubdir, fn)
        s = open(path, encoding="utf-8").read()
        # restore doc content
        for key, body in fb["docs"].items():
            blk = re.search(r"(?ms)^( " + re.escape(key) + r":`)(.*?)(`,)$", s)
            if blk:
                s = s[:blk.start()] + blk.group(1) + body + blk.group(3) + s[blk.end():]
        # restore card states
        for key, st in fb["cards"].items():
            s = s.replace("st:'notlive',doc:'" + key + "'", "st:'" + st + "',doc:'" + key + "'")
        for name, st in fb["named"].items():
            s = re.sub(r"(name:'" + re.escape(name) + r"',sub:'[^']*',st:')notlive'",
                       r"\g<1>" + st + "'", s)
        open(path, "w", encoding="utf-8").write(s)
        print(f"{fn}: restored")
    print("\nRestore complete. (Infra CSS/function left in place; harmless.)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["apply", "restore"])
    ap.add_argument("--dir", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "public"))
    a = ap.parse_args()
    (apply if a.mode == "apply" else restore)(a.dir)
