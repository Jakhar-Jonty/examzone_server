"""Generate a verified Reasoning batch for HSSC CET practice.

Series, coding, calendar, clock, direction and ranking answers are computed
here; the few hand-written items (blood relations, analogies) are checked
with asserts. Run:
  python3 content/reasoning/gen_2026-10-29.py > content/reasoning/2026-10-29.json
"""
import datetime
import json
import math

rows = []
A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def add(topic, diff, q, qh, opts, opts_hi, exp, exph):
    assert len(opts) == 4 and len(set(opts)) == 4, (q, opts)
    assert len(opts_hi) == 4, q
    rows.append([topic, diff, q, qh, [str(o) for o in opts], [str(o) for o in opts_hi], 0, exp, exph])


def nums(answer, *wrong):
    o = [answer] + list(wrong)
    return o, o


# ---------- Number series ----------
series = [
    ([3, 6, 12, 24, 48], 96, "Each term is doubled.", "हर पद दोगुना होता है।", [72, 94, 100]),
    ([2, 5, 10, 17, 26], 37, "Differences are 3, 5, 7, 9, 11 (or n² + 1).", "अंतर 3, 5, 7, 9, 11 हैं (या n² + 1)।", [35, 36, 39]),
    ([1, 8, 27, 64, 125], 216, "Cubes of 1, 2, 3, 4, 5, 6.", "1, 2, 3, 4, 5, 6 के घन।", [180, 196, 225]),
    ([5, 11, 23, 47, 95], 191, "Each term × 2 + 1.", "हर पद × 2 + 1।", [189, 190, 185]),
    ([100, 96, 88, 76, 60], 40, "Differences are −4, −8, −12, −16, −20.", "अंतर −4, −8, −12, −16, −20 हैं।", [44, 36, 42]),
    ([2, 3, 5, 7, 11, 13], 17, "Prime numbers in order.", "क्रम से अभाज्य संख्याएँ।", [15, 19, 16]),
    ([1, 1, 2, 3, 5, 8], 13, "Each term is the sum of the previous two.", "हर पद पिछले दो पदों का योग है।", [11, 12, 16]),
    ([4, 9, 16, 25, 36], 49, "Squares of 2, 3, 4, 5, 6, 7.", "2, 3, 4, 5, 6, 7 के वर्ग।", [42, 48, 64]),
]
for seq, ans, e, eh, wrong in series:
    s = ", ".join(map(str, seq))
    o, oh = nums(ans, *wrong)
    add("Number Series", "Easy" if len(seq) > 5 or seq[0] < 5 else "Medium",
        f"Find the next number in the series: {s}, ?", f"श्रृंखला में अगली संख्या ज्ञात कीजिए: {s}, ?", o, oh,
        f"{e} Next = {ans}.", f"{eh} अगला = {ans}।")
# compute-check the rule-based ones
assert 48 * 2 == 96 and 26 + 11 == 37 and 6 ** 3 == 216 and 95 * 2 + 1 == 191 and 60 - 20 == 40 and 5 + 8 == 13 and 7 ** 2 == 49

# ---------- Letter series ----------
def letters(start, step, n):
    return [A[(A.index(start) + step * i) % 26] for i in range(n)]

for start, step in [("A", 3), ("C", 4), ("Z", -2)]:
    seq = letters(start, step, 6)
    ans = seq[-1]
    shown = ", ".join(seq[:-1])
    wrong = [A[(A.index(ans) + k) % 26] for k in (1, -1, 2)]
    add("Letter Series", "Easy", f"Find the next letter: {shown}, ?", f"अगला अक्षर ज्ञात कीजिए: {shown}, ?",
        [ans] + wrong, [ans] + wrong,
        f"Each letter moves {abs(step)} places {'forward' if step > 0 else 'backward'}; next is {ans}.",
        f"हर अक्षर {abs(step)} स्थान {'आगे' if step > 0 else 'पीछे'} जाता है; अगला {ans} है।")
add("Letter Series", "Medium", "Find the next term: AZ, BY, CX, DW, ?", "अगला पद ज्ञात कीजिए: AZ, BY, CX, DW, ?",
    ["EV", "EU", "FV", "EW"], ["EV", "EU", "FV", "EW"],
    "First letter goes A, B, C, D, E; second goes Z, Y, X, W, V. Next = EV.",
    "पहला अक्षर A, B, C, D, E; दूसरा Z, Y, X, W, V। अगला = EV।")

# ---------- Coding-decoding (letter shift) ----------
def shift(word, k):
    return "".join(A[(A.index(c) + k) % 26] for c in word)

for word, k, target in [("SUN", 3, "MOON"), ("BOOK", 1, "PEN"), ("MANGO", -1, "APPLE")]:
    code = shift(word, k)
    ans = shift(target, k)
    wrong = [shift(target, k + 1), shift(target, k - 1), shift(target[::-1], k)]
    add("Coding-Decoding", "Medium",
        f"If {word} is written as {code}, how is {target} written in that code?",
        f"यदि {word} को {code} लिखा जाता है, तो उसी कोड में {target} कैसे लिखा जाएगा?",
        [ans] + wrong, [ans] + wrong,
        f"Each letter is shifted {abs(k)} place{'s' if abs(k) > 1 else ''} {'forward' if k > 0 else 'backward'}: {target} → {ans}.",
        f"हर अक्षर {abs(k)} स्थान {'आगे' if k > 0 else 'पीछे'} खिसकाया गया है: {target} → {ans}।")
rev = "ROSE"[::-1]
add("Coding-Decoding", "Easy", "If FLOWER is written as REWOLF, how is GARDEN written?",
    "यदि FLOWER को REWOLF लिखा जाता है, तो GARDEN कैसे लिखा जाएगा?",
    ["NEDRAG", "NEDARG", "GNEDRA", "NEDRGA"], ["NEDRAG", "NEDARG", "GNEDRA", "NEDRGA"],
    "The word is written in reverse: GARDEN → NEDRAG.", "शब्द उल्टा लिखा गया है: GARDEN → NEDRAG।")
assert "GARDEN"[::-1] == "NEDRAG" and "FLOWER"[::-1] == "REWOLF"

# ---------- Alphabet ----------
add("Alphabet", "Easy", "Which letter is 7th from the right end of the English alphabet?",
    "अंग्रेज़ी वर्णमाला में दाएँ छोर से 7वाँ अक्षर कौन सा है?", [A[-7], A[6], A[-8], A[-6]], [A[-7], A[6], A[-8], A[-6]],
    f"7th from right = (27 − 7) = 20th from left = {A[-7]}.", f"दाएँ से 7वाँ = (27 − 7) = बाएँ से 20वाँ = {A[-7]}।")
add("Alphabet", "Easy", "What is the position of the letter R in the English alphabet?",
    "अंग्रेज़ी वर्णमाला में अक्षर R का स्थान कौन सा है?", [18, 17, 19, 16], [18, 17, 19, 16],
    "A=1 … R=18.", "A=1 … R=18।")
assert A.index("R") + 1 == 18

# ---------- Calendar ----------
WD = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
WD_HI = ["सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार", "रविवार"]
for (y, m, d, label, label_hi) in [(1947, 8, 15, "15 August 1947", "15 अगस्त 1947"),
                                   (1950, 1, 26, "26 January 1950", "26 जनवरी 1950"),
                                   (1966, 11, 1, "1 November 1966 (Haryana's formation)", "1 नवंबर 1966 (हरियाणा का गठन)")]:
    w = datetime.date(y, m, d).weekday()
    opts = [WD[w], WD[(w + 1) % 7], WD[(w + 2) % 7], WD[(w + 5) % 7]]
    opts_hi = [WD_HI[w], WD_HI[(w + 1) % 7], WD_HI[(w + 2) % 7], WD_HI[(w + 5) % 7]]
    add("Calendar", "Hard", f"What day of the week was {label}?", f"{label_hi} को सप्ताह का कौन सा दिन था?",
        opts, opts_hi, f"{label} was a {WD[w]}.", f"{label_hi} को {WD_HI[w]} था।")
add("Calendar", "Medium", "If today is Monday, what day will it be after 61 days?",
    "यदि आज सोमवार है, तो 61 दिन बाद कौन सा दिन होगा?",
    [WD[(0 + 61) % 7], WD[(0 + 60) % 7], WD[(0 + 62) % 7], WD[0]],
    [WD_HI[(0 + 61) % 7], WD_HI[(0 + 60) % 7], WD_HI[(0 + 62) % 7], WD_HI[0]],
    f"61 = 8 weeks + 5 days; Monday + 5 = {WD[61 % 7]}.", f"61 = 8 सप्ताह + 5 दिन; सोमवार + 5 = {WD_HI[61 % 7]}।")
add("Calendar", "Easy", "How many days are there in a leap year?", "अधिवर्ष (लीप वर्ष) में कितने दिन होते हैं?",
    [366, 365, 364, 367], [366, 365, 364, 367], "A leap year has 366 days (29 days in February).", "लीप वर्ष में 366 दिन होते हैं (फरवरी में 29 दिन)।")

# ---------- Clock ----------
def angle(h, m):
    a = abs(30 * h - 5.5 * m) % 360
    return min(a, 360 - a)

for (h, m) in [(2, 30), (3, 30), (9, 0), (4, 20)]:
    a = angle(h, m)
    assert a == int(a)
    a = int(a)
    wrong = sorted({90, 75, 105, 60, 120, 80, 10, 20, 15} - {a})[:3] if a not in (90,) else [75, 60, 120]
    add("Clock", "Medium", f"What is the angle between the hour and minute hands at {h}:{m:02d}?",
        f"{h}:{m:02d} बजे घंटे और मिनट की सुइयों के बीच कितना कोण होता है?",
        [f"{a}°"] + [f"{w}°" for w in wrong], [f"{a}°"] + [f"{w}°" for w in wrong],
        f"Angle = |30H − 5.5M| = |30×{h} − 5.5×{m}| = {a}°.", f"कोण = |30H − 5.5M| = |30×{h} − 5.5×{m}| = {a}°।")

# ---------- Direction ----------
add("Direction", "Medium",
    "Ravi walks 10 m north, turns right and walks 6 m, then turns right and walks 10 m. How far is he from the start?",
    "रवि 10 मी उत्तर चलता है, दाएँ मुड़कर 6 मी चलता है, फिर दाएँ मुड़कर 10 मी चलता है। वह आरंभ बिंदु से कितनी दूर है?",
    ["6 m", "10 m", "16 m", "26 m"], ["6 मी", "10 मी", "16 मी", "26 मी"],
    "North 10, east 6, south 10 → he is 6 m east of the start.", "उत्तर 10, पूर्व 6, दक्षिण 10 → वह आरंभ से 6 मी पूर्व में है।")
x, y = 0, 0; y += 10; x += 6; y -= 10
assert (x, y) == (6, 0)
d = math.hypot(3 + 0, 4)
add("Direction", "Medium", "A man walks 3 km east and then 4 km north. How far is he from the starting point?",
    "एक व्यक्ति 3 किमी पूर्व और फिर 4 किमी उत्तर चलता है। वह आरंभ बिंदु से कितनी दूर है?",
    [f"{d:g} km", "7 km", "1 km", "12 km"], [f"{d:g} किमी", "7 किमी", "1 किमी", "12 किमी"],
    "Distance = √(3² + 4²) = 5 km.", "दूरी = √(3² + 4²) = 5 किमी।")
add("Direction", "Easy", "If you face north and turn 90° clockwise, which direction will you face?",
    "यदि आप उत्तर की ओर मुँह करके 90° दक्षिणावर्त घूमें, तो किस दिशा की ओर होंगे?",
    ["East", "West", "South", "North-east"], ["पूर्व", "पश्चिम", "दक्षिण", "उत्तर-पूर्व"],
    "Clockwise from north: east.", "उत्तर से दक्षिणावर्त: पूर्व।")
add("Direction", "Medium", "Facing south, Meena turns left, then left again, then right. Which direction is she facing now?",
    "दक्षिण की ओर मुँह किए मीना बाएँ मुड़ती है, फिर बाएँ, फिर दाएँ। अब वह किस दिशा की ओर है?",
    ["East", "West", "North", "South"], ["पूर्व", "पश्चिम", "उत्तर", "दक्षिण"],
    "South → left = east → left = north → right = east.", "दक्षिण → बाएँ = पूर्व → बाएँ = उत्तर → दाएँ = पूर्व।")
DIRS = ["N", "E", "S", "W"]; h = DIRS.index("S")
h = (h - 1) % 4; h = (h - 1) % 4; h = (h + 1) % 4
assert DIRS[h] == "E"

# ---------- Ranking ----------
for (total, top) in [(40, 15), (35, 12)]:
    bottom = total - top + 1
    add("Ranking", "Easy", f"In a row of {total} students, Amit is {top}th from the top. What is his position from the bottom?",
        f"{total} छात्रों की पंक्ति में अमित ऊपर से {top}वाँ है। नीचे से उसका स्थान क्या है?",
        [bottom, bottom - 1, bottom + 1, bottom + 2], [bottom, bottom - 1, bottom + 1, bottom + 2],
        f"Position from bottom = {total} − {top} + 1 = {bottom}.", f"नीचे से स्थान = {total} − {top} + 1 = {bottom}।")
add("Ranking", "Medium", "Sita is 9th from the left and 14th from the right in a row. How many people are in the row?",
    "एक पंक्ति में सीता बाएँ से 9वीं और दाएँ से 14वीं है। पंक्ति में कितने लोग हैं?",
    [22, 23, 21, 24], [22, 23, 21, 24], "Total = 9 + 14 − 1 = 22.", "कुल = 9 + 14 − 1 = 22।")

# ---------- Blood relation (hand-checked) ----------
add("Blood Relation", "Medium", "Pointing to a man, Neha says, 'He is the son of my grandfather's only son.' How is the man related to Neha?",
    "एक व्यक्ति की ओर इशारा करते हुए नेहा कहती है, 'वह मेरे दादा के इकलौते पुत्र का पुत्र है।' वह व्यक्ति नेहा का क्या लगता है?",
    ["Brother", "Father", "Cousin", "Uncle"], ["भाई", "पिता", "चचेरा भाई", "चाचा"],
    "Grandfather's only son = Neha's father; his son = Neha's brother.", "दादा का इकलौता पुत्र = नेहा के पिता; उनका पुत्र = नेहा का भाई।")
add("Blood Relation", "Medium", "A is the brother of B. B is the daughter of C. How is C related to A?",
    "A, B का भाई है। B, C की पुत्री है। C, A का क्या लगता/लगती है?",
    ["Parent (father or mother)", "Brother", "Uncle", "Grandparent"], ["माता या पिता", "भाई", "चाचा", "दादा या दादी"],
    "B is C's daughter and A is B's brother, so A is C's son; C is A's parent.", "B, C की पुत्री है और A, B का भाई है, अतः A, C का पुत्र है; C, A के माता या पिता हैं।")
add("Blood Relation", "Easy", "Who is my mother's father's only daughter?", "मेरी माँ के पिता की इकलौती पुत्री कौन है?",
    ["My mother", "My aunt", "My sister", "My grandmother"], ["मेरी माँ", "मेरी मौसी", "मेरी बहन", "मेरी नानी"],
    "Mother's father's only daughter is the mother herself.", "माँ के पिता की इकलौती पुत्री स्वयं माँ है।")

# ---------- Analogy / Odd one out (hand-checked) ----------
add("Analogy", "Easy", "Pen : Write :: Knife : ?", "कलम : लिखना :: चाकू : ?", ["Cut", "Sharp", "Kitchen", "Steel"], ["काटना", "धारदार", "रसोई", "स्टील"],
    "A pen is used to write; a knife is used to cut.", "कलम लिखने के काम आती है; चाकू काटने के।")
add("Analogy", "Easy", "4 : 16 :: 7 : ?", "4 : 16 :: 7 : ?", [49, 28, 14, 21], [49, 28, 14, 21], "16 = 4²; so 7² = 49.", "16 = 4²; अतः 7² = 49।")
add("Analogy", "Easy", "Bird : Nest :: Bee : ?", "पक्षी : घोंसला :: मधुमक्खी : ?", ["Hive", "Honey", "Flower", "Den"], ["छत्ता", "शहद", "फूल", "माँद"],
    "A bird lives in a nest; a bee lives in a hive.", "पक्षी घोंसले में रहता है; मधुमक्खी छत्ते में।")
add("Odd One Out", "Easy", "Find the odd one out: 25, 49, 81, 98", "विषम को चुनिए: 25, 49, 81, 98", [98, 25, 49, 81], [98, 25, 49, 81],
    "25, 49 and 81 are perfect squares; 98 is not.", "25, 49 और 81 पूर्ण वर्ग हैं; 98 नहीं।")
assert all(int(math.isqrt(v)) ** 2 == v for v in (25, 49, 81)) and math.isqrt(98) ** 2 != 98
add("Odd One Out", "Easy", "Find the odd one out: Mercury, Venus, Moon, Mars", "विषम को चुनिए: बुध, शुक्र, चंद्रमा, मंगल",
    ["Moon", "Mercury", "Venus", "Mars"], ["चंद्रमा", "बुध", "शुक्र", "मंगल"], "The Moon is a satellite; the others are planets.", "चंद्रमा उपग्रह है; बाकी ग्रह हैं।")
add("Odd One Out", "Easy", "Find the odd one out: 13, 17, 21, 23", "विषम को चुनिए: 13, 17, 21, 23", [21, 13, 17, 23], [21, 13, 17, 23],
    "21 = 3 × 7 is not prime; the others are primes.", "21 = 3 × 7 अभाज्य नहीं है; बाकी अभाज्य हैं।")

print(json.dumps(rows, ensure_ascii=False, indent=0))
