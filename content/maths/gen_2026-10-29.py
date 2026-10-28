"""Generate a verified Maths batch for HSSC CET practice.

Every answer is computed here, so the marked option is always arithmetically
correct. Distractors are common slips (wrong base, off-by-one step, etc.).
Run:  python3 content/maths/gen_2026-10-29.py  > content/maths/2026-10-29.json
Rows: [topic, difficulty, q, qHindi, [4 options], [4 Hindi options], correctIndex, explanation, explanationHindi]
"""
import json
from fractions import Fraction as F
from math import gcd

rows = []


def fmt(x):
    x = F(x)
    if x.denominator == 1:
        return str(x.numerator)
    v = float(x)
    if round(v, 2) == v:
        return f"{v:g}"
    raise ValueError(f"non-terminating answer {x}")


def add(topic, diff, q, qh, answer, distractors, exp, exph, unit="", unit_hi=None):
    unit_hi = unit if unit_hi is None else unit_hi
    opts = [answer] + [d for d in distractors if F(d) != F(answer)]
    seen, uniq = set(), []
    for o in opts:
        k = F(o)
        if k not in seen:
            seen.add(k)
            uniq.append(o)
    assert len(uniq) >= 4, (q, uniq)
    uniq = uniq[:4]
    en = [f"{fmt(o)}{unit}" for o in uniq]
    hi = [f"{fmt(o)}{unit_hi}" for o in uniq]
    rows.append([topic, diff, q, qh, en, hi, 0, exp, exph])


def lcm(a, b):
    return a * b // gcd(a, b)


# ---------- Percentage ----------
for (n, p) in [(480, 35), (750, 12), (1250, 8)]:
    a = F(n * p, 100)
    add("Percentage", "Easy", f"What is {p}% of {n}?", f"{n} का {p}% कितना है?", a,
        [a + 10, a - 10, F(n * p, 1000), a * 2],
        f"{p}% of {n} = {n} × {p}/100 = {fmt(a)}.", f"{n} का {p}% = {n} × {p}/100 = {fmt(a)}।")
add("Percentage", "Medium", "A number is first increased by 20% and then decreased by 20%. What is the net change?",
    "किसी संख्या को पहले 20% बढ़ाया और फिर 20% घटाया गया। कुल परिवर्तन कितना है?",
    -4, [0, 4, -2],
    "Net change = 20 − 20 − (20 × 20)/100 = −4%, i.e. a 4% decrease.",
    "कुल परिवर्तन = 20 − 20 − (20 × 20)/100 = −4%, यानी 4% कमी।", unit="%")
rows[-1][4] = ["4% decrease", "No change", "4% increase", "2% decrease"]
rows[-1][5] = ["4% कमी", "कोई परिवर्तन नहीं", "4% वृद्धि", "2% कमी"]

# ---------- Profit and Loss ----------
for (cp, sp) in [(400, 460), (1200, 1050), (250, 300)]:
    pct = F(sp - cp, cp) * 100
    word, word_hi = ("profit", "लाभ") if sp > cp else ("loss", "हानि")
    add("Profit and Loss", "Easy",
        f"An article bought for ₹{cp} is sold for ₹{sp}. What is the {word} percent?",
        f"₹{cp} में खरीदी गई वस्तु ₹{sp} में बेची गई। {word_hi} प्रतिशत कितना है?",
        abs(pct), [abs(pct) + 5, F(abs(sp - cp), sp) * 100 if (F(abs(sp - cp), sp) * 100).denominator in (1, 2, 4, 5, 10, 20, 25, 50) else abs(pct) - 2, abs(pct) * 2, abs(pct) + 2],
        f"{word.capitalize()} = ₹{abs(sp - cp)}; {word} % = {abs(sp - cp)}/{cp} × 100 = {fmt(abs(pct))}%.",
        f"{word_hi} = ₹{abs(sp - cp)}; {word_hi} % = {abs(sp - cp)}/{cp} × 100 = {fmt(abs(pct))}%।", unit="%")
cp = F(500); mp = F(800); d = 25
sp = mp * (100 - d) / 100
add("Profit and Loss", "Medium",
    "A shopkeeper marks an item at ₹800 and gives a 25% discount. If the cost price is ₹500, what is his profit?",
    "दुकानदार किसी वस्तु पर ₹800 अंकित करता है और 25% छूट देता है। यदि क्रय मूल्य ₹500 है, तो उसका लाभ कितना है?",
    sp - cp, [mp - cp, sp - cp + 50, 200 - 25],
    "Selling price = 800 × 75/100 = ₹600; profit = 600 − 500 = ₹100.",
    "विक्रय मूल्य = 800 × 75/100 = ₹600; लाभ = 600 − 500 = ₹100।", unit="", unit_hi="")
rows[-1][4] = ["₹" + o for o in rows[-1][4]]
rows[-1][5] = ["₹" + o for o in rows[-1][5]]

# ---------- Simple Interest ----------
for (p, r, t) in [(5000, 8, 3), (12000, 5, 4), (7500, 6, 2)]:
    si = F(p * r * t, 100)
    add("Simple Interest", "Easy",
        f"What is the simple interest on ₹{p} at {r}% per annum for {t} years?",
        f"₹{p} पर {r}% वार्षिक दर से {t} वर्ष का साधारण ब्याज कितना है?",
        si, [si + p * r // 100, F(p * r, 100), si * 2],
        f"SI = P × R × T / 100 = {p} × {r} × {t} / 100 = ₹{fmt(si)}.",
        f"साधारण ब्याज = P × R × T / 100 = {p} × {r} × {t} / 100 = ₹{fmt(si)}।")
    rows[-1][4] = ["₹" + o for o in rows[-1][4]]
    rows[-1][5] = ["₹" + o for o in rows[-1][5]]
add("Simple Interest", "Medium",
    "In how many years will a sum double itself at 10% simple interest per annum?",
    "कोई राशि 10% वार्षिक साधारण ब्याज पर कितने वर्षों में दोगुनी हो जाएगी?",
    10, [5, 12, 20],
    "To double, SI = P, so P = P × 10 × T / 100 ⇒ T = 10 years.",
    "दोगुना होने के लिए ब्याज = मूलधन, अतः P = P × 10 × T / 100 ⇒ T = 10 वर्ष।",
    unit=" years", unit_hi=" वर्ष")

# ---------- Compound Interest ----------
for (p, r) in [(10000, 10), (8000, 5)]:
    amt = F(p) * (1 + F(r, 100)) ** 2
    ci = amt - p
    si = F(p * r * 2, 100)
    add("Compound Interest", "Medium",
        f"What is the compound interest on ₹{p} at {r}% per annum for 2 years, compounded annually?",
        f"₹{p} पर {r}% वार्षिक दर से 2 वर्ष का चक्रवृद्धि ब्याज (वार्षिक संयोजित) कितना है?",
        ci, [si, amt, ci + r * 10],
        f"Amount = {p} × (1 + {r}/100)² = ₹{fmt(amt)}; CI = {fmt(amt)} − {p} = ₹{fmt(ci)}.",
        f"मिश्रधन = {p} × (1 + {r}/100)² = ₹{fmt(amt)}; चक्रवृद्धि ब्याज = {fmt(amt)} − {p} = ₹{fmt(ci)}।")
    rows[-1][4] = ["₹" + o for o in rows[-1][4]]
    rows[-1][5] = ["₹" + o for o in rows[-1][5]]
add("Compound Interest", "Hard",
    "The difference between compound and simple interest on a sum for 2 years at 10% per annum is ₹50. What is the sum?",
    "किसी राशि पर 10% वार्षिक दर से 2 वर्ष के चक्रवृद्धि और साधारण ब्याज का अंतर ₹50 है। राशि कितनी है?",
    5000, [500, 2500, 10000],
    "For 2 years, CI − SI = P × (R/100)² ⇒ 50 = P × 1/100 ⇒ P = ₹5000.",
    "2 वर्ष के लिए CI − SI = P × (R/100)² ⇒ 50 = P × 1/100 ⇒ P = ₹5000।")
rows[-1][4] = ["₹" + o for o in rows[-1][4]]
rows[-1][5] = ["₹" + o for o in rows[-1][5]]

# ---------- Ratio and Proportion ----------
for (total, a, b) in [(840, 3, 4), (1500, 2, 3), (720, 5, 7)]:
    share_a = F(total * a, a + b)
    add("Ratio and Proportion", "Easy",
        f"₹{total} is divided between A and B in the ratio {a}:{b}. What is A's share?",
        f"₹{total} को A और B में {a}:{b} के अनुपात में बाँटा गया। A का हिस्सा कितना है?",
        share_a, [F(total * b, a + b), F(total, a + b), share_a + 60],
        f"A's share = {total} × {a}/{a + b} = ₹{fmt(share_a)}.",
        f"A का हिस्सा = {total} × {a}/{a + b} = ₹{fmt(share_a)}।")
    rows[-1][4] = ["₹" + o for o in rows[-1][4]]
    rows[-1][5] = ["₹" + o for o in rows[-1][5]]
add("Ratio and Proportion", "Easy", "What is the fourth proportional to 4, 9 and 12?",
    "4, 9 और 12 का चतुर्थानुपाती क्या है?", 27, [36, 24, 18],
    "4 : 9 = 12 : x ⇒ x = 9 × 12 / 4 = 27.", "4 : 9 = 12 : x ⇒ x = 9 × 12 / 4 = 27।")

# ---------- Average ----------
for nums in [(12, 18, 24, 30, 36), (45, 55, 65, 75)]:
    avg = F(sum(nums), len(nums))
    s = ", ".join(map(str, nums))
    add("Average", "Easy", f"What is the average of {s}?", f"{s} का औसत क्या है?",
        avg, [avg + 2, avg - 3, F(sum(nums), len(nums) - 1)],
        f"Average = ({' + '.join(map(str, nums))}) / {len(nums)} = {sum(nums)}/{len(nums)} = {fmt(avg)}.",
        f"औसत = ({' + '.join(map(str, nums))}) / {len(nums)} = {sum(nums)}/{len(nums)} = {fmt(avg)}।")
add("Average", "Easy", "What is the average of the first 10 natural numbers?",
    "पहली 10 प्राकृत संख्याओं का औसत क्या है?", F(11, 2), [5, 6, 10],
    "Sum = 55; average = 55/10 = 5.5.", "योग = 55; औसत = 55/10 = 5.5।")
add("Average", "Medium",
    "The average age of 20 students is 15 years. If the teacher's age is included, the average rises by 1 year. What is the teacher's age?",
    "20 छात्रों की औसत आयु 15 वर्ष है। शिक्षक की आयु जोड़ने पर औसत 1 वर्ष बढ़ जाता है। शिक्षक की आयु कितनी है?",
    36, [35, 16, 21],
    "New total = 21 × 16 = 336; old total = 20 × 15 = 300; teacher = 336 − 300 = 36 years.",
    "नया योग = 21 × 16 = 336; पुराना योग = 20 × 15 = 300; शिक्षक = 336 − 300 = 36 वर्ष।",
    unit=" years", unit_hi=" वर्ष")

# ---------- Time and Work ----------
for (a, b) in [(12, 24), (10, 15), (20, 30)]:
    t = F(a * b, a + b)
    add("Time and Work", "Medium",
        f"A can finish a work in {a} days and B in {b} days. In how many days can they finish it together?",
        f"A किसी काम को {a} दिन में और B {b} दिन में पूरा कर सकता है। दोनों मिलकर कितने दिन में पूरा करेंगे?",
        t, [F(a + b, 2), t + 2, a + b],
        f"Together per day = 1/{a} + 1/{b} = {a + b}/{a * b}; time = {a * b}/{a + b} = {fmt(t)} days.",
        f"एक दिन का संयुक्त काम = 1/{a} + 1/{b} = {a + b}/{a * b}; समय = {a * b}/{a + b} = {fmt(t)} दिन।",
        unit=" days", unit_hi=" दिन")
add("Time and Work", "Medium",
    "If 6 men can build a wall in 10 days, how many days will 15 men take to build the same wall?",
    "यदि 6 आदमी एक दीवार 10 दिन में बना सकते हैं, तो 15 आदमी वही दीवार कितने दिन में बनाएँगे?",
    4, [25, 5, 6],
    "Work = 6 × 10 = 60 man-days; 60 ÷ 15 = 4 days.", "काम = 6 × 10 = 60 मानव-दिवस; 60 ÷ 15 = 4 दिन।",
    unit=" days", unit_hi=" दिन")

# ---------- Speed, Time and Distance ----------
add("Speed, Time and Distance", "Easy", "What is 72 km/h in metres per second?",
    "72 किमी/घंटा कितने मीटर/सेकंड के बराबर है?", 20, [72, 25, 18],
    "72 × 5/18 = 20 m/s.", "72 × 5/18 = 20 मी/से।", unit=" m/s", unit_hi=" मी/से")
add("Speed, Time and Distance", "Easy",
    "A car covers 360 km in 4 hours 30 minutes. What is its average speed?",
    "एक कार 360 किमी की दूरी 4 घंटे 30 मिनट में तय करती है। उसकी औसत चाल कितनी है?",
    80, [90, 75, 72],
    "Time = 4.5 h; speed = 360/4.5 = 80 km/h.", "समय = 4.5 घंटे; चाल = 360/4.5 = 80 किमी/घंटा।",
    unit=" km/h", unit_hi=" किमी/घंटा")
length, speed_kmh = 150, 54
t = F(length) / (F(speed_kmh) * F(5, 18))
add("Speed, Time and Distance", "Medium",
    "A 150 m long train running at 54 km/h will cross a pole in how many seconds?",
    "54 किमी/घंटा की चाल से चल रही 150 मीटर लंबी रेलगाड़ी एक खंभे को कितने सेकंड में पार करेगी?",
    t, [15, 12, 9],
    "54 km/h = 15 m/s; time = 150/15 = 10 s.", "54 किमी/घंटा = 15 मी/से; समय = 150/15 = 10 सेकंड।",
    unit=" s", unit_hi=" सेकंड")
add("Speed, Time and Distance", "Medium",
    "A person goes to a place at 40 km/h and returns at 60 km/h. What is his average speed for the whole journey?",
    "एक व्यक्ति किसी स्थान पर 40 किमी/घंटा से जाता है और 60 किमी/घंटा से लौटता है। पूरी यात्रा की औसत चाल क्या है?",
    48, [50, 45, 52],
    "Average speed = 2xy/(x + y) = 2 × 40 × 60 / 100 = 48 km/h.",
    "औसत चाल = 2xy/(x + y) = 2 × 40 × 60 / 100 = 48 किमी/घंटा।", unit=" km/h", unit_hi=" किमी/घंटा")

# ---------- Number System ----------
for (a, b) in [(12, 18), (24, 36), (15, 25)]:
    add("Number System", "Easy", f"What is the LCM of {a} and {b}?", f"{a} और {b} का लघुत्तम समापवर्त्य (LCM) क्या है?",
        lcm(a, b), [gcd(a, b), a * b, lcm(a, b) * 2],
        f"LCM({a}, {b}) = {a} × {b} / HCF({gcd(a, b)}) = {lcm(a, b)}.",
        f"LCM({a}, {b}) = {a} × {b} / HCF({gcd(a, b)}) = {lcm(a, b)}।")
add("Number System", "Easy", "What is the HCF of 84 and 126?", "84 और 126 का महत्तम समापवर्तक (HCF) क्या है?",
    gcd(84, 126), [21, 14, 252],
    "84 = 2² × 3 × 7, 126 = 2 × 3² × 7; HCF = 2 × 3 × 7 = 42.",
    "84 = 2² × 3 × 7, 126 = 2 × 3² × 7; HCF = 2 × 3 × 7 = 42।")
add("Number System", "Easy", "What is the sum of the first 20 natural numbers?", "पहली 20 प्राकृत संख्याओं का योग क्या है?",
    210, [200, 220, 400], "Sum = n(n + 1)/2 = 20 × 21 / 2 = 210.", "योग = n(n + 1)/2 = 20 × 21 / 2 = 210।")

# ---------- Simplification ----------
add("Simplification", "Easy", "Simplify: 18 + 6 × 4 − 12 ÷ 3", "सरल कीजिए: 18 + 6 × 4 − 12 ÷ 3",
    18 + 6 * 4 - 12 // 3, [92, 30, 34],
    "BODMAS: 6 × 4 = 24, 12 ÷ 3 = 4; 18 + 24 − 4 = 38.", "BODMAS: 6 × 4 = 24, 12 ÷ 3 = 4; 18 + 24 − 4 = 38।")
add("Simplification", "Easy", "What is the square root of 1764?", "1764 का वर्गमूल क्या है?",
    42, [44, 38, 48], "42 × 42 = 1764.", "42 × 42 = 1764।")
add("Simplification", "Easy", "What is 15² − 13²?", "15² − 13² का मान क्या है?",
    15 ** 2 - 13 ** 2, [4, 28, 64],
    "a² − b² = (a + b)(a − b) = 28 × 2 = 56.", "a² − b² = (a + b)(a − b) = 28 × 2 = 56।")

# ---------- Mensuration ----------
add("Mensuration", "Easy", "What is the area of a rectangle 24 m long and 15 m wide?",
    "24 मी लंबे और 15 मी चौड़े आयत का क्षेत्रफल कितना है?", 360, [78, 39, 720],
    "Area = 24 × 15 = 360 m².", "क्षेत्रफल = 24 × 15 = 360 मी²।", unit=" m²", unit_hi=" मी²")
add("Mensuration", "Easy", "What is the perimeter of a square whose area is 196 cm²?",
    "जिस वर्ग का क्षेत्रफल 196 सेमी² है, उसका परिमाप कितना है?", 56, [14, 28, 49],
    "Side = √196 = 14 cm; perimeter = 4 × 14 = 56 cm.", "भुजा = √196 = 14 सेमी; परिमाप = 4 × 14 = 56 सेमी।",
    unit=" cm", unit_hi=" सेमी")
add("Mensuration", "Medium", "What is the volume of a cube whose edge is 7 cm?",
    "7 सेमी किनारे वाले घन का आयतन कितना है?", 343, [49, 294, 21],
    "Volume = a³ = 7³ = 343 cm³.", "आयतन = a³ = 7³ = 343 सेमी³।", unit=" cm³", unit_hi=" सेमी³")

# ---------- Ages ----------
add("Ages", "Medium",
    "The ratio of the ages of A and B is 3:5. After 6 years it will be 3:4. What is A's present age?",
    "A और B की आयु का अनुपात 3:5 है। 6 वर्ष बाद यह 3:4 होगा। A की वर्तमान आयु कितनी है?",
    3 * F(6 * (4 - 3), 5 * 3 - 3 * 4),  # 3x with x = 6(4 − 3)/(15 − 12) = 2
    [10, 9, 15],
    "Let ages be 3x and 5x: (3x + 6)/(5x + 6) = 3/4 ⇒ 12x + 24 = 15x + 18 ⇒ x = 2; A = 6 years.",
    "आयु 3x और 5x मानें: (3x + 6)/(5x + 6) = 3/4 ⇒ 12x + 24 = 15x + 18 ⇒ x = 2; A = 6 वर्ष।",
    unit=" years", unit_hi=" वर्ष")
add("Ages", "Easy",
    "A father is 30 years older than his son. In 5 years he will be three times as old as his son. What is the son's present age?",
    "पिता अपने पुत्र से 30 वर्ष बड़े हैं। 5 वर्ष बाद पिता की आयु पुत्र की तीन गुनी होगी। पुत्र की वर्तमान आयु कितनी है?",
    10, [15, 5, 12],
    "Son = x: x + 35 = 3(x + 5) ⇒ 2x = 20 ⇒ x = 10 years.", "पुत्र = x: x + 35 = 3(x + 5) ⇒ 2x = 20 ⇒ x = 10 वर्ष।",
    unit=" years", unit_hi=" वर्ष")

# ---------- self-checks ----------
assert rows[[r[2] for r in rows].index("What is the HCF of 84 and 126?")][4][0] == "42"
assert rows[[r[2] for r in rows].index("Simplify: 18 + 6 × 4 − 12 ÷ 3")][4][0] == "38"
assert rows[[r[2] for r in rows].index("What is 15² − 13²?")][4][0] == "56"
ages = rows[[r[2] for r in rows].index("The ratio of the ages of A and B is 3:5. After 6 years it will be 3:4. What is A's present age?")]
assert ages[4][0] == "6 years", ages[4][0]
assert (3 * 2 + 6) * 4 == (5 * 2 + 6) * 3  # x = 2 satisfies the ratio
assert 10 + 35 == 3 * (10 + 5)
print(json.dumps(rows, ensure_ascii=False, indent=0))
