"""Third generated batch: Maths + Reasoning with fresh numbers. Every answer is computed.
Run: python3 content/gen_2026-10-31.py   → writes content/maths/2026-10-31.json and content/reasoning/2026-10-31.json
"""
import datetime
import json
import random
from fractions import Fraction as F
from math import gcd

random.seed(20261031)


def fmt(x):
    x = F(x)
    if x.denominator == 1:
        return str(x.numerator)
    v = float(x)
    return f"{v:g}" if round(v, 3) == v else f"{x.numerator}/{x.denominator}"


def opts(answer, wrong, pre="", unit="", unit_hi=None):
    unit_hi = unit if unit_hi is None else unit_hi
    seen, out = set(), []
    for o in [answer] + list(wrong):
        k = F(o)
        if k not in seen and k > 0:
            seen.add(k)
            out.append(o)
    assert len(out) >= 4, (answer, wrong)
    out = out[:4]
    return [f"{pre}{fmt(o)}{unit}" for o in out], [f"{pre}{fmt(o)}{unit_hi}" for o in out]


maths, reasoning = [], []


def M(topic, diff, q, qh, answer, wrong, e, eh, **kw):
    en, hi = opts(answer, wrong, **kw)
    maths.append([topic, diff, q, qh, en, hi, 0, e, eh])


def R(topic, diff, q, qh, o, oh, e, eh):
    o, oh = [str(x) for x in o], [str(x) for x in oh]
    assert len(set(o)) == 4, (q, o)
    reasoning.append([topic, diff, q, qh, o, oh, 0, e, eh])


# ---------------- Maths ----------------
for n, p in [(520, 25), (880, 15), (1600, 35)]:
    a = F(n * p, 100)
    M("Percentage", "Easy", f"What is {p}% of {n}?", f"{n} का {p}% कितना है?", a, [a + 20, a - 20, a * 2],
      f"{n} × {p}/100 = {fmt(a)}.", f"{n} × {p}/100 = {fmt(a)}।")
for cp, sp in [(750, 900), (1500, 1260)]:
    pct = F(abs(sp - cp) * 100, cp)
    w, wh = ("profit", "लाभ") if sp > cp else ("loss", "हानि")
    M("Profit and Loss", "Easy", f"Bought for ₹{cp} and sold for ₹{sp}. Find the {w} percent.", f"₹{cp} में खरीदकर ₹{sp} में बेचा। {wh} प्रतिशत ज्ञात कीजिए।",
      pct, [pct + 5, pct - 4, pct * 2], f"{w.capitalize()} = {abs(sp - cp)}; {abs(sp - cp)}/{cp} × 100 = {fmt(pct)}%.",
      f"{wh} = {abs(sp - cp)}; {abs(sp - cp)}/{cp} × 100 = {fmt(pct)}%।", unit="%")
for p, r, t in [(8000, 6, 4), (15000, 8, 2)]:
    si = F(p * r * t, 100)
    M("Simple Interest", "Easy", f"Simple interest on ₹{p} at {r}% p.a. for {t} years is:", f"₹{p} पर {r}% वार्षिक दर से {t} वर्ष का साधारण ब्याज है:",
      si, [si + 300, F(p * r, 100), si * 2], f"{p} × {r} × {t}/100 = ₹{fmt(si)}.", f"{p} × {r} × {t}/100 = ₹{fmt(si)}।", pre="₹")
amt = F(5000) * F(110, 100) ** 3
M("Compound Interest", "Medium", "₹5,000 at 10% p.a. compound interest amounts to how much in 3 years?", "₹5,000 पर 10% वार्षिक चक्रवृद्धि ब्याज से 3 वर्ष में मिश्रधन कितना होगा?",
  amt, [6500, 6600, 6550], "5000 × 1.1³ = ₹6655.", "5000 × 1.1³ = ₹6655।", pre="₹")
assert amt == 6655
for a, b in [(15, 30), (9, 18), (24, 40)]:
    t = F(a * b, a + b)
    M("Time and Work", "Medium", f"A does a work in {a} days, B in {b} days. Together they finish it in:", f"A किसी काम को {a} दिन में, B {b} दिन में करता है। दोनों मिलकर इसे कितने दिन में पूरा करेंगे?",
      t, [F(a + b, 2), t + 2, t + 5], f"{a}×{b}/({a}+{b}) = {fmt(t)} days.", f"{a}×{b}/({a}+{b}) = {fmt(t)} दिन।", unit=" days", unit_hi=" दिन")
for d, h in [(270, 3), (425, 5)]:
    s = F(d, h)
    M("Speed, Time and Distance", "Easy", f"A bus covers {d} km in {h} hours. Its speed is:", f"एक बस {d} किमी {h} घंटे में तय करती है। उसकी चाल है:",
      s, [s + 5, s - 5, s + 10], f"{d}/{h} = {fmt(s)} km/h.", f"{d}/{h} = {fmt(s)} किमी/घंटा।", unit=" km/h", unit_hi=" किमी/घंटा")
for total, a, b in [(960, 5, 3), (1350, 4, 5)]:
    sh = F(total * a, a + b)
    M("Ratio and Proportion", "Easy", f"Divide ₹{total} in the ratio {a}:{b}. The larger share is:", f"₹{total} को {a}:{b} में बाँटने पर बड़ा भाग है:",
      max(sh, total - sh), [min(sh, total - sh), F(total, 2), max(sh, total - sh) + 50],
      f"Shares {fmt(sh)} and {fmt(total - sh)}; larger = ₹{fmt(max(sh, total - sh))}.", f"भाग {fmt(sh)} और {fmt(total - sh)}; बड़ा = ₹{fmt(max(sh, total - sh))}।", pre="₹")
for a, b in [(16, 24), (20, 45)]:
    l = a * b // gcd(a, b)
    M("Number System", "Easy", f"LCM of {a} and {b} is:", f"{a} और {b} का LCM है:", l, [gcd(a, b), a * b, l * 2],
      f"{a} × {b} / HCF {gcd(a, b)} = {l}.", f"{a} × {b} / HCF {gcd(a, b)} = {l}।")
nums = [14, 22, 30, 38, 46]
avg = F(sum(nums), len(nums))
M("Average", "Easy", f"Average of {', '.join(map(str, nums))} is:", f"{', '.join(map(str, nums))} का औसत है:", avg, [avg + 4, avg - 4, avg + 8],
  f"{sum(nums)}/5 = {fmt(avg)}.", f"{sum(nums)}/5 = {fmt(avg)}।")
M("Mensuration", "Easy", "Area of a square of side 17 cm is:", "17 सेमी भुजा वाले वर्ग का क्षेत्रफल है:", 289, [68, 34, 279],
  "17² = 289 cm².", "17² = 289 सेमी²।", unit=" cm²", unit_hi=" सेमी²")
M("Mensuration", "Medium", "Perimeter of a rectangle is 60 cm and its length is 18 cm. Its area is:", "किसी आयत का परिमाप 60 सेमी और लंबाई 18 सेमी है। उसका क्षेत्रफल है:",
  18 * (30 - 18), [180, 240, 1080], "Breadth = 30 − 18 = 12; area = 18 × 12 = 216 cm².", "चौड़ाई = 30 − 18 = 12; क्षेत्रफल = 18 × 12 = 216 सेमी²।", unit=" cm²", unit_hi=" सेमी²")
M("Simplification", "Easy", "Simplify: 48 ÷ 6 × 3 + 7", "सरल कीजिए: 48 ÷ 6 × 3 + 7", F(48, 6) * 3 + 7, [10, 33, 30],
  "48 ÷ 6 = 8; 8 × 3 = 24; 24 + 7 = 31.", "48 ÷ 6 = 8; 8 × 3 = 24; 24 + 7 = 31।")
M("Discount", "Medium", "A shop gives 10% and then 5% successive discounts on ₹2,000. The price paid is:", "₹2,000 पर 10% और फिर 5% क्रमिक छूट के बाद चुकाई गई राशि है:",
  F(2000) * F(90, 100) * F(95, 100), [1700, 1800, 1750], "2000 × 0.9 × 0.95 = ₹1710.", "2000 × 0.9 × 0.95 = ₹1710।", pre="₹")
M("Ages", "Medium", "Six years ago a father was 4 times his son's age. Now he is 2.5 times. The son's present age is:", "छह वर्ष पहले पिता की आयु पुत्र की 4 गुना थी। अब 2.5 गुना है। पुत्र की वर्तमान आयु है:",
  12, [10, 15, 18], "F − 6 = 4(S − 6) and F = 2.5S ⇒ 2.5S − 6 = 4S − 24 ⇒ S = 12 years.", "F − 6 = 4(S − 6) और F = 2.5S ⇒ 2.5S − 6 = 4S − 24 ⇒ S = 12 वर्ष।",
  unit=" years", unit_hi=" वर्ष")
assert 2.5 * 12 - 6 == 4 * (12 - 6)

# ---------------- Reasoning ----------------
for seq, ans, rule, rule_hi, wrong in [
    ([4, 12, 36, 108], 324, "× 3", "× 3", [216, 312, 432]),
    ([1, 3, 7, 15, 31], 63, "× 2 + 1", "× 2 + 1", [62, 47, 64]),
    ([10, 13, 19, 28, 40], 55, "differences 3, 6, 9, 12, 15", "अंतर 3, 6, 9, 12, 15", [52, 53, 58]),
    ([2, 5, 10, 17, 26, 37], 50, "n² + 1", "n² + 1", [48, 49, 51]),
    ([81, 27, 9, 3], 1, "÷ 3", "÷ 3", [0.5, 2, 1.5]),
    ([5, 10, 20, 35, 55], 80, "differences 5, 10, 15, 20, 25", "अंतर 5, 10, 15, 20, 25", [75, 85, 90]),
]:
    s = ", ".join(map(str, seq))
    R("Number Series", "Easy", f"Next number: {s}, ?", f"अगली संख्या: {s}, ?", [ans] + wrong, [ans] + wrong,
      f"Rule {rule}; next = {ans}.", f"नियम {rule_hi}; अगला = {ans}।")
assert 108 * 3 == 324 and 31 * 2 + 1 == 63 and 40 + 15 == 55 and 6 ** 2 + 1 == 37 and 7 ** 2 + 1 == 50 and 55 + 25 == 80

A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
def shift(w, k):
    return "".join(A[(A.index(c) + k) % 26] for c in w)
for w, k, t in [("MILK", 3, "BREAD"), ("HOUSE", -1, "TRAIN")]:
    R("Coding-Decoding", "Medium", f"If {w} is coded {shift(w, k)}, then {t} is coded:", f"यदि {w} को {shift(w, k)} लिखा जाए, तो {t} को लिखा जाएगा:",
      [shift(t, k), shift(t, k + 1), shift(t, k - 1), shift(t[::-1], k)], [shift(t, k), shift(t, k + 1), shift(t, k - 1), shift(t[::-1], k)],
      f"Each letter {'+' if k > 0 else ''}{k}: {t} → {shift(t, k)}.", f"हर अक्षर {'+' if k > 0 else ''}{k}: {t} → {shift(t, k)}।")
for start, step in [("C", 5), ("X", -4)]:
    seq = [A[(A.index(start) + step * i) % 26] for i in range(6)]
    ans = seq[-1]
    R("Letter Series", "Easy", f"Next letter: {', '.join(seq[:-1])}, ?", f"अगला अक्षर: {', '.join(seq[:-1])}, ?",
      [ans, A[(A.index(ans) + 1) % 26], A[(A.index(ans) - 1) % 26], A[(A.index(ans) + 2) % 26]],
      [ans, A[(A.index(ans) + 1) % 26], A[(A.index(ans) - 1) % 26], A[(A.index(ans) + 2) % 26]],
      f"Step {step:+d}; next {ans}.", f"चरण {step:+d}; अगला {ans}।")
WD = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
WD_HI = ["सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार", "रविवार"]
for (y, m, d, en, hi) in [(2015, 1, 22, "22 January 2015 (Beti Bachao Beti Padhao launch)", "22 जनवरी 2015 (बेटी बचाओ बेटी पढ़ाओ की शुरुआत)"),
                          (2014, 11, 1, "1 November 2014", "1 नवंबर 2014")]:
    w = datetime.date(y, m, d).weekday()
    R("Calendar", "Hard", f"What day was {en}?", f"{hi} को कौन सा दिन था?",
      [WD[w], WD[(w + 1) % 7], WD[(w + 2) % 7], WD[(w + 4) % 7]], [WD_HI[w], WD_HI[(w + 1) % 7], WD_HI[(w + 2) % 7], WD_HI[(w + 4) % 7]],
      f"It was a {WD[w]}.", f"उस दिन {WD_HI[w]} था।")
def ang(h, m):
    a = abs(30 * h - 5.5 * m) % 360
    return min(a, 360 - a)
for h, m in [(7, 20), (10, 10)]:
    a = ang(h, m)
    a = int(a) if a == int(a) else a
    w = [x for x in (100, 115, 90, 120, 80, 105) if x != a][:3]
    R("Clock", "Medium", f"Angle between the hands at {h}:{m:02d}?", f"{h}:{m:02d} बजे सुइयों के बीच का कोण?",
      [f"{a}°"] + [f"{x}°" for x in w], [f"{a}°"] + [f"{x}°" for x in w], f"|30×{h} − 5.5×{m}| = {a}°.", f"|30×{h} − 5.5×{m}| = {a}°।")
R("Direction", "Medium", "A man walks 8 km north, then 6 km east. How far is he from the start?", "एक व्यक्ति 8 किमी उत्तर और फिर 6 किमी पूर्व चलता है। वह आरंभ से कितनी दूर है?",
  ["10 km", "14 km", "2 km", "12 km"], ["10 किमी", "14 किमी", "2 किमी", "12 किमी"], "√(8² + 6²) = 10 km.", "√(8² + 6²) = 10 किमी।")
R("Direction", "Easy", "Facing south, you turn 180°. Which way do you face?", "दक्षिण की ओर मुँह करके आप 180° घूमते हैं। अब किस दिशा में हैं?",
  ["North", "East", "West", "South"], ["उत्तर", "पूर्व", "पश्चिम", "दक्षिण"], "180° from south is north.", "दक्षिण से 180° उत्तर है।")
R("Ranking", "Easy", "In a queue Rita is 12th from the front and 20th from the back. How many people are in the queue?", "एक कतार में रीता आगे से 12वीं और पीछे से 20वीं है। कतार में कितने लोग हैं?",
  [31, 32, 30, 33], [31, 32, 30, 33], "12 + 20 − 1 = 31.", "12 + 20 − 1 = 31।")
R("Analogy", "Easy", "Doctor : Patient :: Teacher : ?", "डॉक्टर : मरीज़ :: शिक्षक : ?", ["Student", "School", "Book", "Class"], ["छात्र", "विद्यालय", "पुस्तक", "कक्षा"],
  "A doctor treats patients; a teacher teaches students.", "डॉक्टर मरीज़ों का इलाज करता है; शिक्षक छात्रों को पढ़ाता है।")
R("Analogy", "Easy", "6 : 36 :: 9 : ?", "6 : 36 :: 9 : ?", [81, 72, 54, 99], [81, 72, 54, 99], "36 = 6²; 9² = 81.", "36 = 6²; 9² = 81।")
R("Odd One Out", "Easy", "Odd one out: Hockey, Cricket, Chess, Football", "विषम चुनिए: हॉकी, क्रिकेट, शतरंज, फुटबॉल", ["Chess", "Hockey", "Cricket", "Football"],
  ["शतरंज", "हॉकी", "क्रिकेट", "फुटबॉल"], "Chess is an indoor board game; the others are field games.", "शतरंज इनडोर बोर्ड खेल है; बाकी मैदानी खेल हैं।")
R("Odd One Out", "Easy", "Odd one out: 16, 36, 49, 63", "विषम चुनिए: 16, 36, 49, 63", [63, 16, 36, 49], [63, 16, 36, 49], "16, 36, 49 are squares; 63 is not.", "16, 36, 49 वर्ग हैं; 63 नहीं।")
R("Blood Relation", "Medium", "A's father is B's son. How is B related to A?", "A के पिता, B के पुत्र हैं। B, A का क्या है?",
  ["Grandparent", "Parent", "Uncle", "Brother"], ["दादा/दादी", "माता/पिता", "चाचा", "भाई"], "B's son is A's father, so B is A's grandparent.", "B का पुत्र A का पिता है, अतः B, A के दादा/दादी हैं।")

json.dump(maths, open("content/maths/2026-10-31.json", "w"), ensure_ascii=False, indent=0)
json.dump(reasoning, open("content/reasoning/2026-10-31.json", "w"), ensure_ascii=False, indent=0)
print(len(maths), "maths,", len(reasoning), "reasoning")
