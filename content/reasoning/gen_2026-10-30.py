"""Second verified Reasoning batch. Computed answers + asserted hand-written items.
Run: python3 content/reasoning/gen_2026-10-30.py > content/reasoning/2026-10-30.json
"""
import datetime
import json
import math

rows = []
A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
WD = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
WD_HI = ["सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार", "रविवार"]


def add(topic, diff, q, qh, opts, opts_hi, exp, exph):
    opts, opts_hi = [str(o) for o in opts], [str(o) for o in opts_hi]
    assert len(opts) == 4 and len(set(opts)) == 4, (q, opts)
    rows.append([topic, diff, q, qh, opts, opts_hi, 0, exp, exph])


def same(o):
    return o, o


# ---------- Number series ----------
for seq, ans, e, eh, wrong in [
    ([7, 14, 28, 56], 112, "Each term × 2.", "हर पद × 2।", [84, 98, 120]),
    ([3, 7, 15, 31, 63], 127, "Each term × 2 + 1.", "हर पद × 2 + 1।", [125, 126, 129]),
    ([6, 11, 21, 36, 56], 81, "Differences 5, 10, 15, 20, 25.", "अंतर 5, 10, 15, 20, 25।", [76, 86, 79]),
    ([2, 6, 18, 54], 162, "Each term × 3.", "हर पद × 3।", [108, 156, 216]),
    ([120, 60, 20, 5], 1, "Divide by 2, 3, 4, 5.", "क्रम से 2, 3, 4, 5 से भाग।", [2, 0.5, 4]),
    ([1, 2, 6, 24, 120], 720, "Multiply by 2, 3, 4, 5, 6 (factorials).", "क्रम से 2, 3, 4, 5, 6 से गुणा (क्रमगुणित)।", [600, 240, 840]),
    ([11, 13, 17, 19, 23], 29, "Consecutive primes.", "क्रमागत अभाज्य संख्याएँ।", [25, 27, 31]),
]:
    s = ", ".join(map(str, seq))
    add("Number Series", "Medium" if ans > 100 else "Easy", f"Find the next number: {s}, ?", f"अगली संख्या ज्ञात कीजिए: {s}, ?",
        [ans] + wrong, [ans] + wrong, f"{e} Next = {ans}.", f"{eh} अगला = {ans}।")
assert 56 * 2 == 112 and 63 * 2 + 1 == 127 and 56 + 25 == 81 and 54 * 3 == 162 and 5 / 5 == 1 and 120 * 6 == 720
add("Number Series", "Medium", "Find the missing number: 2, 5, 11, 23, ?, 95", "लुप्त संख्या ज्ञात कीजिए: 2, 5, 11, 23, ?, 95",
    *same([47, 46, 45, 48]), "Each term × 2 + 1: 23 × 2 + 1 = 47, 47 × 2 + 1 = 95.", "हर पद × 2 + 1: 23 × 2 + 1 = 47, 47 × 2 + 1 = 95।")
assert 23 * 2 + 1 == 47 and 47 * 2 + 1 == 95
add("Number Series", "Medium", "Find the wrong number in the series: 4, 8, 16, 30, 64", "श्रृंखला में गलत संख्या ज्ञात कीजिए: 4, 8, 16, 30, 64",
    *same([30, 16, 8, 64]), "Each term doubles; 30 should be 32.", "हर पद दोगुना होता है; 30 के स्थान पर 32 होना चाहिए।")

# ---------- Letter series / alphabet ----------
def letters(start, step, n):
    return [A[(A.index(start) + step * i) % 26] for i in range(n)]

for start, step in [("B", 4), ("Y", -3)]:
    seq = letters(start, step, 6)
    ans = seq[-1]
    add("Letter Series", "Easy", f"Find the next letter: {', '.join(seq[:-1])}, ?", f"अगला अक्षर ज्ञात कीजिए: {', '.join(seq[:-1])}, ?",
        *same([ans] + [A[(A.index(ans) + k) % 26] for k in (1, -1, 2)]),
        f"Each letter moves {abs(step)} places {'forward' if step > 0 else 'back'}; next is {ans}.",
        f"हर अक्षर {abs(step)} स्थान {'आगे' if step > 0 else 'पीछे'} जाता है; अगला {ans}।")
add("Letter Series", "Medium", "Find the next term: AB, DE, GH, JK, ?", "अगला पद ज्ञात कीजिए: AB, DE, GH, JK, ?",
    *same(["MN", "LM", "NO", "MO"]), "Each pair starts 3 letters after the previous pair's start: A, D, G, J, M → MN.",
    "हर जोड़ा पिछले जोड़े से 3 अक्षर आगे शुरू होता है: A, D, G, J, M → MN।")
p = A.index("K") + 1 + A.index("P") + 1
add("Alphabet", "Easy", "What is the sum of the positions of K and P in the English alphabet?", "अंग्रेज़ी वर्णमाला में K और P के स्थानों का योग क्या है?",
    *same([p, p - 1, p + 1, p + 2]), "K = 11, P = 16; sum = 27.", "K = 11, P = 16; योग = 27।")
assert p == 27
mid = A[A.index("D") + (A.index("P") - A.index("D")) // 2]
add("Alphabet", "Medium", "Which letter is exactly midway between D and P in the English alphabet?", "अंग्रेज़ी वर्णमाला में D और P के ठीक बीच में कौन सा अक्षर है?",
    *same([mid, "I", "K", "L"]), "D = 4, P = 16; midway = 10 = J.", "D = 4, P = 16; बीच = 10 = J।")
assert mid == "J"

# ---------- Coding ----------
def shift(word, k):
    return "".join(A[(A.index(c) + k) % 26] for c in word)

for word, k, target in [("RAIN", 2, "CLOUD"), ("TABLE", -2, "CHAIR")]:
    add("Coding-Decoding", "Medium", f"If {word} is coded as {shift(word, k)}, how is {target} coded?",
        f"यदि {word} को {shift(word, k)} लिखा जाता है, तो {target} को कैसे लिखा जाएगा?",
        *same([shift(target, k), shift(target, k + 1), shift(target, k - 1), shift(target, -k)]),
        f"Each letter shifts {abs(k)} {'forward' if k > 0 else 'back'}: {target} → {shift(target, k)}.",
        f"हर अक्षर {abs(k)} स्थान {'आगे' if k > 0 else 'पीछे'}: {target} → {shift(target, k)}।")
val = sum(A.index(c) + 1 for c in "DOG")
add("Coding-Decoding", "Medium", "If CAT = 24 (C=3, A=1, T=20 added), what is DOG?", "यदि CAT = 24 (C=3, A=1, T=20 का योग), तो DOG = ?",
    *same([val, val - 2, val + 3, val + 1]), "D = 4, O = 15, G = 7; sum = 26.", "D = 4, O = 15, G = 7; योग = 26।")
assert sum(A.index(c) + 1 for c in "CAT") == 24 and val == 26
add("Coding-Decoding", "Medium", "If 'PAPER' is written as 'REPAP', how is 'PENCIL' written?", "यदि 'PAPER' को 'REPAP' लिखा जाता है, तो 'PENCIL' कैसे लिखा जाएगा?",
    *same(["LICNEP", "LICENP", "PENCIL", "LCINEP"]), "The word is reversed.", "शब्द उल्टा लिखा गया है।")
assert "PAPER"[::-1] == "REPAP" and "PENCIL"[::-1] == "LICNEP"

# ---------- Mathematical operations ----------
add("Mathematical Operations", "Medium", "If '+' means '×', '×' means '−', '−' means '÷' and '÷' means '+', what is 8 + 4 × 6 − 3 ÷ 5?",
    "यदि '+' का अर्थ '×', '×' का अर्थ '−', '−' का अर्थ '÷' और '÷' का अर्थ '+' है, तो 8 + 4 × 6 − 3 ÷ 5 = ?",
    *same([8 * 4 - 6 / 3 + 5, 33, 29, 37]), "Becomes 8 × 4 − 6 ÷ 3 + 5 = 32 − 2 + 5 = 35.", "बनता है 8 × 4 − 6 ÷ 3 + 5 = 32 − 2 + 5 = 35।")
rows[-1][4][0] = rows[-1][5][0] = "35"
assert 8 * 4 - 6 / 3 + 5 == 35

# ---------- Calendar ----------
for (y, m, d, label, label_hi) in [(2000, 1, 1, "1 January 2000", "1 जनवरी 2000"), (1869, 10, 2, "2 October 1869 (Gandhi's birth)", "2 अक्टूबर 1869 (गांधीजी का जन्म)")]:
    w = datetime.date(y, m, d).weekday()
    add("Calendar", "Hard", f"What day of the week was {label}?", f"{label_hi} को सप्ताह का कौन सा दिन था?",
        [WD[w], WD[(w + 1) % 7], WD[(w + 3) % 7], WD[(w + 6) % 7]], [WD_HI[w], WD_HI[(w + 1) % 7], WD_HI[(w + 3) % 7], WD_HI[(w + 6) % 7]],
        f"{label} was a {WD[w]}.", f"{label_hi} को {WD_HI[w]} था।")
add("Calendar", "Medium", "If 5 March is a Tuesday, what day is 26 March of the same year?", "यदि 5 मार्च को मंगलवार है, तो उसी वर्ष 26 मार्च को कौन सा दिन होगा?",
    [WD[(1 + 21) % 7], WD[(1 + 20) % 7], WD[(1 + 22) % 7], WD[(1 + 3) % 7]], [WD_HI[(1 + 21) % 7], WD_HI[(1 + 20) % 7], WD_HI[(1 + 22) % 7], WD_HI[(1 + 3) % 7]],
    "26 − 5 = 21 days = exactly 3 weeks, so it is also a Tuesday.", "26 − 5 = 21 दिन = ठीक 3 सप्ताह, अतः मंगलवार ही।")
add("Calendar", "Easy", "Which of these years is a leap year?", "इनमें से कौन सा वर्ष लीप वर्ष है?", *same([2024, 2100, 2023, 1900]),
    "Divisible by 4, and century years only if divisible by 400: 2024 is; 2100 and 1900 are not.",
    "4 से विभाज्य, और शताब्दी वर्ष केवल 400 से विभाज्य होने पर: 2024 है; 2100 और 1900 नहीं।")
leap = lambda y: (y % 4 == 0 and y % 100 != 0) or y % 400 == 0
assert leap(2024) and not leap(2100) and not leap(2023) and not leap(1900)

# ---------- Clock ----------
def angle(h, m):
    a = abs(30 * h - 5.5 * m) % 360
    return min(a, 360 - a)

for (h, m) in [(6, 0), (5, 30), (8, 20)]:
    a = angle(h, m)
    a = int(a) if a == int(a) else a
    wrong = [x for x in (180, 15, 130, 120, 100, 90, 45) if x != a][:3]
    add("Clock", "Medium", f"What is the angle between the hands of a clock at {h}:{m:02d}?", f"{h}:{m:02d} बजे घड़ी की सुइयों के बीच का कोण कितना है?",
        *same([f"{a}°"] + [f"{w}°" for w in wrong]), f"|30×{h} − 5.5×{m}| = {a}°.", f"|30×{h} − 5.5×{m}| = {a}°।")
add("Clock", "Medium", "How many times do the hands of a clock coincide in a day?", "एक दिन में घड़ी की सुइयाँ कितनी बार एक-दूसरे पर आती हैं?",
    *same([22, 24, 12, 48]), "They coincide 11 times in 12 hours, so 22 times in 24 hours.", "12 घंटे में 11 बार, अतः 24 घंटे में 22 बार।")

# ---------- Direction ----------
add("Direction", "Medium", "Kiran walks 5 km south, then 12 km west. How far is she from the start?", "किरण 5 किमी दक्षिण और फिर 12 किमी पश्चिम चलती है। वह आरंभ से कितनी दूर है?",
    [f"{math.hypot(5, 12):g} km", "17 km", "7 km", "15 km"], [f"{math.hypot(5, 12):g} किमी", "17 किमी", "7 किमी", "15 किमी"],
    "√(5² + 12²) = 13 km.", "√(5² + 12²) = 13 किमी।")
add("Direction", "Medium", "In the evening, Raj's shadow falls directly behind him. Which way is he facing?", "शाम को राज की परछाई ठीक उसके पीछे पड़ती है। उसका मुँह किस दिशा में है?",
    ["West", "East", "North", "South"], ["पश्चिम", "पूर्व", "उत्तर", "दक्षिण"],
    "Evening sun is in the west and shadows fall east; shadow behind him means he faces west.", "शाम को सूर्य पश्चिम में और परछाई पूर्व में; परछाई पीछे है तो मुँह पश्चिम की ओर।")
DIRS = ["N", "E", "S", "W"]; h = DIRS.index("W"); h = (h + 1) % 4; h = (h + 1) % 4
add("Direction", "Easy", "Facing west, Asha turns right twice (90° each). Which direction does she face now?", "पश्चिम की ओर मुँह किए आशा दो बार दाएँ (हर बार 90°) मुड़ती है। अब वह किस दिशा में है?",
    ["East", "North", "South", "West"], ["पूर्व", "उत्तर", "दक्षिण", "पश्चिम"], "West → right = north → right = east.", "पश्चिम → दाएँ = उत्तर → दाएँ = पूर्व।")
assert DIRS[h] == "E"

# ---------- Ranking ----------
add("Ranking", "Easy", "In a class of 45, Mohan's rank is 18th from the top. What is his rank from the bottom?", "45 छात्रों की कक्षा में मोहन ऊपर से 18वाँ है। नीचे से उसका स्थान क्या है?",
    *same([45 - 18 + 1, 27, 29, 26]), "45 − 18 + 1 = 28.", "45 − 18 + 1 = 28।")
add("Ranking", "Medium", "In a row, A is 10th from the left and B is 15th from the right. If they interchange, A becomes 18th from the left. How many people are in the row?",
    "एक पंक्ति में A बाएँ से 10वाँ और B दाएँ से 15वाँ है। स्थान बदलने पर A बाएँ से 18वाँ हो जाता है। पंक्ति में कितने लोग हैं?",
    *same([18 + 15 - 1, 33, 31, 43]), "A takes B's place: 18th from left and 15th from right → 18 + 15 − 1 = 32.", "A, B के स्थान पर: बाएँ से 18वाँ, दाएँ से 15वाँ → 18 + 15 − 1 = 32।")

# ---------- Blood relation ----------
add("Blood Relation", "Medium", "Ravi is the son of Mohan. Mohan is the brother of Sita. How is Sita related to Ravi?", "रवि, मोहन का पुत्र है। मोहन, सीता का भाई है। सीता, रवि की क्या लगती है?",
    ["Aunt (father's sister)", "Mother", "Sister", "Grandmother"], ["बुआ", "माँ", "बहन", "दादी"],
    "Sita is the sister of Ravi's father, so she is his aunt (bua).", "सीता रवि के पिता की बहन है, अतः बुआ।")
add("Blood Relation", "Medium", "Introducing a woman, Amit says, 'Her mother is the only daughter of my mother.' How is Amit related to the woman?",
    "एक महिला का परिचय देते हुए अमित कहता है, 'इसकी माँ मेरी माँ की इकलौती बेटी है।' अमित उस महिला का क्या लगता है?",
    ["Maternal uncle (mama)", "Father", "Brother", "Grandfather"], ["मामा", "पिता", "भाई", "नाना"],
    "The only daughter of Amit's mother is Amit's sister; her daughter's mama is Amit.", "अमित की माँ की इकलौती बेटी = अमित की बहन; उसकी बेटी के मामा = अमित।")

# ---------- Analogy / classification ----------
add("Analogy", "Easy", "Eye : See :: Ear : ?", "आँख : देखना :: कान : ?", ["Hear", "Speak", "Smell", "Touch"], ["सुनना", "बोलना", "सूँघना", "छूना"],
    "The eye is for seeing; the ear is for hearing.", "आँख देखने के लिए; कान सुनने के लिए।")
add("Analogy", "Easy", "3 : 27 :: 5 : ?", "3 : 27 :: 5 : ?", *same([125, 25, 75, 15]), "27 = 3³; so 5³ = 125.", "27 = 3³; अतः 5³ = 125।")
add("Analogy", "Medium", "Painter : Brush :: Writer : ?", "चित्रकार : ब्रश :: लेखक : ?", ["Pen", "Book", "Paper", "Story"], ["कलम", "पुस्तक", "कागज़", "कहानी"],
    "A brush is a painter's tool; a pen is a writer's tool.", "ब्रश चित्रकार का औज़ार; कलम लेखक का।")
add("Odd One Out", "Easy", "Find the odd one out: Rose, Lotus, Lily, Mango", "विषम को चुनिए: गुलाब, कमल, लिली, आम",
    ["Mango", "Rose", "Lotus", "Lily"], ["आम", "गुलाब", "कमल", "लिली"], "Mango is a fruit; the others are flowers.", "आम फल है; बाकी फूल हैं।")
add("Odd One Out", "Easy", "Find the odd one out: 27, 64, 125, 150", "विषम को चुनिए: 27, 64, 125, 150", *same([150, 27, 64, 125]),
    "27, 64 and 125 are cubes; 150 is not.", "27, 64 और 125 घन हैं; 150 नहीं।")
assert all(round(v ** (1 / 3)) ** 3 == v for v in (27, 64, 125)) and round(150 ** (1 / 3)) ** 3 != 150
add("Odd One Out", "Medium", "Find the odd one out: Delhi, Mumbai, Chennai, Nepal", "विषम को चुनिए: दिल्ली, मुंबई, चेन्नई, नेपाल",
    ["Nepal", "Delhi", "Mumbai", "Chennai"], ["नेपाल", "दिल्ली", "मुंबई", "चेन्नई"], "Nepal is a country; the others are Indian cities.", "नेपाल देश है; बाकी भारतीय शहर हैं।")

print(json.dumps(rows, ensure_ascii=False, indent=0))
