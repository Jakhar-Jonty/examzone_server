"""Parse HSSC CET papers (Group C 2022/2025, Group D 2023) (Hindi text + answer key) into batch rows.

Source pages (third-party transcription of the official papers and keys):
  mseducationtv.com/hssc-cet-group-c-paper-<date>-shift-<n>-answer-key/
Run:  python3 content/pyq/parse_cet_2025.py   → writes content/pyq/cet-2025-<shift>.json
Skips any question that depends on an image or whose answer can't be matched
to one of its options; prints what it skipped.
"""
import html
import json
import re
import subprocess
import sys

PAPERS = [
    # (label, url, sourceExam, year, section rule)
    ("26 July 2025 Shift 1", "https://mseducationtv.com/hssc-cet-group-c-paper-26-july-2025-shift-1-answer-key/", "HSSC CET Group C", 2025, "cet-c"),
    ("26 July 2025 Shift 2", "https://mseducationtv.com/hssc-cet-group-c-paper-26-july-2025-shift-2-answer-key/", "HSSC CET Group C", 2025, "cet-c"),
    ("27 July 2025 Shift 1", "https://mseducationtv.com/hssc-cet-group-c-paper-27-july-2025-shift-1-answer-key/", "HSSC CET Group C", 2025, "cet-c"),
    ("27 July 2025 Shift 2", "https://mseducationtv.com/hssc-cet-group-c-paper-27-july-2025-shift-2-answer-key/", "HSSC CET Group C", 2025, "cet-c"),
    ("5 Nov 2022 Shift 1", "https://mseducationtv.com/hssc-cet-group-c-paper-05-nov-2022-shift-1-answer-key/", "HSSC CET Group C", 2022, "none"),
    ("5 Nov 2022 Shift 2", "https://mseducationtv.com/hssc-cet-group-c-paper-05-nov-2022-shift-2-answer-key/", "HSSC CET Group C", 2022, "none"),
    ("6 Nov 2022 Shift 1", "https://mseducationtv.com/hssc-cet-group-c-paper-06-nov-2022-shift-1-answer-key/", "HSSC CET Group C", 2022, "none"),
    ("6 Nov 2022 Shift 2", "https://mseducationtv.com/hssc-cet-group-c-paper-06-nov-2022-shift-2-answer-key/", "HSSC CET Group C", 2022, "none"),
    ("21 Oct 2023 Shift 1", "https://mseducationtv.com/hssc-cet-group-d-paper-21-oct-2023-shift-1-answer-key/", "HSSC CET Group D", 2023, "none"),
    ("21 Oct 2023 Shift 2", "https://mseducationtv.com/hssc-cet-group-d-paper-21-oct-2023-shift-2-answer-key/", "HSSC CET Group D", 2023, "none"),
    ("22 Oct 2023 Shift 1", "https://mseducationtv.com/hssc-cet-group-d-paper-22-oct-2023-shift-1-answer-key/", "HSSC CET Group D", 2023, "none"),
    ("22 Oct 2023 Shift 2", "https://mseducationtv.com/hssc-cet-group-d-paper-22-oct-2023-shift-2-answer-key/", "HSSC CET Group D", 2023, "none"),
]
L = "ABCD"


def fetch(url):
    return subprocess.run(["curl", "-s", "-m", "40", "-L", "-A", "Mozilla/5.0", url], capture_output=True, text=True).stdout


def table_to_text(m):
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", m.group(0), re.S)
    out = []
    for r in rows:
        cells = [re.sub(r"<[^>]+>", "", c).strip() for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", r, re.S)]
        out.append("  ".join(cells))
    return "\n" + "\n".join(out) + "\n"


def clean(s):
    s = html.unescape(re.sub(r"<[^>]+>", "", s))
    return re.sub(r"[ \t ]+", " ", s).strip()


def parse(page):
    body = page[page.find('class="entry-content"'):]
    body = re.sub(r"(?is)<(script|style|ins)[^>]*>.*?</\1>", "", body)
    body = re.sub(r"(?is)<div class='code-block.*?</div>", "", body)
    body = re.sub(r"(?is)<table.*?</table>", table_to_text, body)
    body = re.sub(r"(?i)<img[^>]*>", "\n[[IMAGE]]\n", body)
    body = re.sub(r"(?i)<br\s*/?>|</p>|</li>|</h\d>", "\n", body)
    text = clean(re.sub(r"(?s)<(?!/?)", "<", body))
    lines = [l.strip() for l in html.unescape(re.sub(r"<[^>]+>", "", body)).split("\n")]
    text = "\n".join(l for l in lines if l)
    # questions start with "N. " at a line start; only accept the next number in
    # sequence so numbered statements inside a question don't split it
    qs, expect, pos = [], 1, 0
    starts = []
    for m in re.finditer(r"(?m)^(\d{1,3})\.\s", text):
        if int(m.group(1)) == expect:
            starts.append((expect, m.start(), m.end()))
            expect += 1
    for i, (num, s0, e0) in enumerate(starts):
        end = starts[i + 1][1] if i + 1 < len(starts) else len(text)
        qs.append((num, text[e0:end]))
    return qs


NUM2L = {"1": "A", "2": "B", "3": "C", "4": "D", "5": "E"}


def to_row(num, rest):
    if "[[IMAGE]]" in rest:
        return None, "image"
    # options are (A)-(E) on newer papers and (1)-(5) on older ones
    rest = re.sub(r"(?m)^\(([1-5])\)", lambda m: f"({NUM2L[m.group(1)]})", rest)
    rest = re.sub(r"((?:उत्तर|Answer)\s*[–—:-]\s*)\(([1-5])\)", lambda m: f"{m.group(1)}({NUM2L[m.group(2)]})", rest)
    ans = re.search(r"(?:उत्तर|Answer)\s*[–—:-]\s*\(([A-E])\)\s*(.*)", rest)
    if not ans:
        return None, "no answer line"
    letter = ans.group(1)
    if letter == "E":
        return None, "answer E"
    head = rest[: ans.start()]
    opts = {}
    for k in "ABCDE":
        mm = re.search(rf"\({k}\)\s*(.*?)(?=\n\([A-E]\)|\Z)", head, re.S)
        if mm:
            opts[k] = re.sub(r"\s+", " ", mm.group(1)).strip()
    if not all(opts.get(k) for k in L):
        return None, "missing option"
    first = re.search(r"\n?\(A\)", head)
    q = head[: first.start()].strip() if first else head.strip()
    q = re.sub(r"[ \t]+", " ", q)
    if len(q) < 8:
        return None, "short question"
    # the answer text after the letter must agree with that option (catches shifted keys)
    tail = re.sub(r"\s+", " ", ans.group(2)).strip()
    opt = opts[letter]
    if tail and not (tail.startswith(opt[:12]) or opt.startswith(tail[:12]) or len(tail) <= 3):
        if tail.split("(")[0].strip() and tail.split("(")[0].strip()[:8] not in opt:
            return None, f"answer text mismatch: {tail[:30]} vs {opt[:30]}"
    return {"num": num, "q": q, "options": [opts[k] for k in L], "correct": L.index(letter)}, None


only = sys.argv[1:]  # optional filter, e.g. "2022" or "Group D"
for label, url, exam, year, rule in PAPERS:
    if only and not any(o in f"{exam} {label}" for o in only):
        continue
    page = fetch(url)
    raw = parse(page)
    rows, skipped = [], []
    for num, rest in raw:
        r, why = to_row(num, rest)
        if r:
            rows.append(r)
        else:
            skipped.append((num, why))
    nums = [r["num"] for r in rows]
    print(f"{exam} {label}: parsed {len(raw)}, kept {len(rows)}, skipped {len(skipped)} {skipped[:12]}", file=sys.stderr)
    assert len(set(nums)) == len(nums), "duplicate question numbers"
    slug = ("cet-d" if "Group D" in exam else "cet") + f"-{year}-" + label.lower().replace(" ", "-")
    json.dump({"label": label, "sourceExam": exam, "year": year, "sectionRule": rule, "source": url, "questions": rows},
              open(f"content/pyq/{slug}.json", "w"), ensure_ascii=False, indent=0)
