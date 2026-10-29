"""Second verified Maths batch (new numbers + new topics). Every answer is computed.
Run:  python3 content/maths/gen_2026-10-30.py > content/maths/2026-10-30.json
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
    if round(v, 3) == v:
        return f"{v:g}"
    return f"{x.numerator}/{x.denominator}"  # exact fraction when the decimal doesn't terminate


def add(topic, diff, q, qh, answer, distractors, exp, exph, pre="", unit="", unit_hi=None):
    unit_hi = unit if unit_hi is None else unit_hi
    seen, opts = set(), []
    for o in [answer] + list(distractors):
        if F(o) not in seen and F(o) > 0:
            seen.add(F(o))
            opts.append(o)
    assert len(opts) >= 4, (q, opts)
    opts = opts[:4]
    rows.append([topic, diff, q, qh, [f"{pre}{fmt(o)}{unit}" for o in opts], [f"{pre}{fmt(o)}{unit_hi}" for o in opts], 0, exp, exph])


# Percentage
for (n, p) in [(640, 15), (2400, 6.25), (360, 45)]:
    a = F(n) * F(p) / 100
    add("Percentage", "Easy", f"What is {fmt(p)}% of {n}?", f"{n} का {fmt(p)}% कितना है?", a, [a + 12, a - 8, a * 2, a / 2],
        f"{n} × {fmt(p)}/100 = {fmt(a)}.", f"{n} × {fmt(p)}/100 = {fmt(a)}।")
a = F(40, 80) * 100
add("Percentage", "Easy", "40 is what percent of 80?", "40, 80 का कितना प्रतिशत है?", a, [40, 25, 80],
    "40/80 × 100 = 50%.", "40/80 × 100 = 50%।", unit="%")
add("Percentage", "Medium", "If the price of sugar rises by 25%, by what percent must a family cut consumption to keep spending the same?",
    "चीनी का मूल्य 25% बढ़ने पर खर्च समान रखने के लिए परिवार को खपत कितने प्रतिशत घटानी होगी?",
    20, [25, 15, 30],
    "Reduction = 25/(100 + 25) × 100 = 20%.", "कमी = 25/(100 + 25) × 100 = 20%।", unit="%")

# Discount
for (mp, d) in [(1500, 20), (2400, 15)]:
    sp = F(mp) * (100 - d) / 100
    add("Discount", "Easy", f"An item marked at ₹{mp} is sold at a {d}% discount. What is the selling price?",
        f"₹{mp} अंकित मूल्य की वस्तु {d}% छूट पर बेची जाती है। विक्रय मूल्य कितना है?",
        sp, [F(mp) * d / 100, sp - 100, mp - d],
        f"SP = {mp} × {100 - d}/100 = ₹{fmt(sp)}.", f"विक्रय मूल्य = {mp} × {100 - d}/100 = ₹{fmt(sp)}।", pre="₹")
net = 100 - F(80 * 90, 100)
add("Discount", "Medium", "What single discount is equal to two successive discounts of 20% and 10%?",
    "20% और 10% की दो क्रमिक छूटों के बराबर एकल छूट कितनी है?", net, [30, 25, 27],
    "Net = 20 + 10 − (20 × 10)/100 = 28%.", "शुद्ध छूट = 20 + 10 − (20 × 10)/100 = 28%।", unit="%")

# Profit and Loss
for (cp, pct) in [(600, 15), (840, 25)]:
    sp = F(cp) * (100 + pct) / 100
    add("Profit and Loss", "Easy", f"A man buys an article for ₹{cp} and sells it at {pct}% profit. What is the selling price?",
        f"एक व्यक्ति ₹{cp} में वस्तु खरीदकर {pct}% लाभ पर बेचता है। विक्रय मूल्य कितना है?",
        sp, [F(cp) * pct / 100, sp + 50, cp + pct],
        f"SP = {cp} × {100 + pct}/100 = ₹{fmt(sp)}.", f"विक्रय मूल्य = {cp} × {100 + pct}/100 = ₹{fmt(sp)}।", pre="₹")
add("Profit and Loss", "Medium", "By selling 12 pens a shopkeeper gains the cost price of 3 pens. What is his gain percent?",
    "12 पेन बेचकर दुकानदार को 3 पेन के क्रय मूल्य के बराबर लाभ होता है। लाभ प्रतिशत कितना है?",
    25, [20, 30, 15],
    "Gain% = 3/12 × 100 = 25%.", "लाभ% = 3/12 × 100 = 25%।", unit="%")

# Simple / Compound interest
for (p, r, t) in [(9000, 4, 5), (6400, 7, 3)]:
    si = F(p * r * t, 100)
    add("Simple Interest", "Easy", f"Find the simple interest on ₹{p} at {r}% per annum for {t} years.",
        f"₹{p} पर {r}% वार्षिक दर से {t} वर्ष का साधारण ब्याज ज्ञात कीजिए।",
        si, [si + 200, F(p * r, 100), si * 2],
        f"SI = {p} × {r} × {t}/100 = ₹{fmt(si)}.", f"साधारण ब्याज = {p} × {r} × {t}/100 = ₹{fmt(si)}।", pre="₹")
amt = F(6250) * F(108, 100) ** 2
add("Compound Interest", "Medium", "What amount will ₹6,250 become in 2 years at 8% per annum compound interest?",
    "₹6,250 की राशि 8% वार्षिक चक्रवृद्धि ब्याज पर 2 वर्ष में कितनी हो जाएगी?",
    amt, [F(6250) + F(6250 * 8 * 2, 100), amt + 100, amt - 250],
    "A = 6250 × 1.08 × 1.08 = ₹7290.", "मिश्रधन = 6250 × 1.08 × 1.08 = ₹7290।", pre="₹")
assert amt == 7290

# Partnership
a_inv, b_inv, profit = 4000, 6000, 15000
share = F(profit * a_inv, a_inv + b_inv)
add("Partnership", "Medium", f"A and B invest ₹{a_inv} and ₹{b_inv} for the same period. Out of a profit of ₹{profit}, what is A's share?",
    f"A और B समान अवधि के लिए ₹{a_inv} और ₹{b_inv} लगाते हैं। ₹{profit} के लाभ में A का हिस्सा कितना है?",
    share, [F(profit * b_inv, a_inv + b_inv), F(profit, 2), share + 1000],
    "Ratio 4000:6000 = 2:3; A = 15000 × 2/5 = ₹6000.", "अनुपात 4000:6000 = 2:3; A = 15000 × 2/5 = ₹6000।", pre="₹")
share2 = F(9000 * 5000 * 12, 5000 * 12 + 6000 * 10)
add("Partnership", "Hard", "A invests ₹5,000 for 12 months and B invests ₹6,000 for 10 months. Out of a profit of ₹9,000, what is A's share?",
    "A ₹5,000 को 12 महीने और B ₹6,000 को 10 महीने के लिए लगाते हैं। ₹9,000 के लाभ में A का हिस्सा कितना है?",
    share2, [5400, 5000, 3600],
    "Ratio = 5000×12 : 6000×10 = 60000 : 60000 = 1:1; A = ₹4500.", "अनुपात = 5000×12 : 6000×10 = 1:1; A = ₹4500।", pre="₹")

# Average
nums = [21, 27, 33, 39, 45, 51]
avg = F(sum(nums), len(nums))
add("Average", "Easy", f"Find the average of {', '.join(map(str, nums))}.", f"{', '.join(map(str, nums))} का औसत ज्ञात कीजिए।",
    avg, [avg + 3, avg - 3, avg + 6],
    f"Sum = {sum(nums)}; average = {sum(nums)}/6 = {fmt(avg)}.", f"योग = {sum(nums)}; औसत = {sum(nums)}/6 = {fmt(avg)}।")
add("Average", "Medium", "The average of 5 numbers is 40. If one number is removed, the average becomes 38. What is the removed number?",
    "5 संख्याओं का औसत 40 है। एक संख्या हटाने पर औसत 38 हो जाता है। हटाई गई संख्या क्या है?",
    5 * 40 - 4 * 38, [38, 40, 42],
    "Removed = 5 × 40 − 4 × 38 = 200 − 152 = 48.", "हटाई गई = 5 × 40 − 4 × 38 = 200 − 152 = 48।")

# Time and Work / Pipes
for (a, b) in [(18, 36), (8, 24)]:
    t = F(a * b, a + b)
    add("Time and Work", "Medium", f"A can do a job in {a} days and B in {b} days. Working together, how many days will they take?",
        f"A किसी काम को {a} दिन में और B {b} दिन में कर सकता है। दोनों साथ मिलकर कितने दिन लेंगे?",
        t, [F(a + b, 2), t + 3, a + b],
        f"1/{a} + 1/{b} = {a + b}/{a * b}; time = {fmt(t)} days.", f"1/{a} + 1/{b} = {a + b}/{a * b}; समय = {fmt(t)} दिन।", unit=" days", unit_hi=" दिन")
t = F(1) / (F(1, 10) - F(1, 15))
add("Pipes and Cisterns", "Medium", "Pipe A fills a tank in 10 hours and pipe B empties it in 15 hours. If both are opened, how long will the tank take to fill?",
    "पाइप A टंकी को 10 घंटे में भरता है और पाइप B उसे 15 घंटे में खाली करता है। दोनों खोलने पर टंकी कितने समय में भरेगी?",
    t, [6, 25, 12], "1/10 − 1/15 = 1/30; time = 30 hours.", "1/10 − 1/15 = 1/30; समय = 30 घंटे।", unit=" hours", unit_hi=" घंटे")
t = F(1) / (F(1, 6) + F(1, 12))
add("Pipes and Cisterns", "Easy", "Two pipes can fill a tank in 6 hours and 12 hours. How long will both together take?",
    "दो पाइप एक टंकी को 6 घंटे और 12 घंटे में भर सकते हैं। दोनों मिलकर कितना समय लेंगे?",
    t, [9, 6, 18], "1/6 + 1/12 = 3/12 = 1/4; time = 4 hours.", "1/6 + 1/12 = 3/12 = 1/4; समय = 4 घंटे।", unit=" hours", unit_hi=" घंटे")

# Speed, boats
add("Speed, Time and Distance", "Easy", "What is 15 m/s in km/h?", "15 मी/से कितने किमी/घंटा के बराबर है?",
    F(15 * 18, 5), [15, 45, 60], "15 × 18/5 = 54 km/h.", "15 × 18/5 = 54 किमी/घंटा।", unit=" km/h", unit_hi=" किमी/घंटा")
t = F(200 + 300) / (F(72) * F(5, 18))
add("Speed, Time and Distance", "Medium", "A 200 m long train at 72 km/h crosses a 300 m long bridge. How many seconds does it take?",
    "72 किमी/घंटा से चल रही 200 मी लंबी रेलगाड़ी 300 मी लंबे पुल को कितने सेकंड में पार करेगी?",
    t, [10, 15, 30], "Distance = 500 m, speed = 20 m/s; time = 25 s.", "दूरी = 500 मी, चाल = 20 मी/से; समय = 25 सेकंड।", unit=" s", unit_hi=" सेकंड")
add("Boats and Streams", "Medium", "A boat goes 12 km/h downstream and 8 km/h upstream. What is the speed of the stream?",
    "एक नाव धारा के अनुकूल 12 किमी/घंटा और प्रतिकूल 8 किमी/घंटा चलती है। धारा की चाल क्या है?",
    F(12 - 8, 2), [4, 10, 20], "Stream = (12 − 8)/2 = 2 km/h.", "धारा की चाल = (12 − 8)/2 = 2 किमी/घंटा।", unit=" km/h", unit_hi=" किमी/घंटा")
add("Boats and Streams", "Medium", "A boat goes 12 km/h downstream and 8 km/h upstream. What is the speed of the boat in still water?",
    "एक नाव धारा के अनुकूल 12 किमी/घंटा और प्रतिकूल 8 किमी/घंटा चलती है। शांत जल में नाव की चाल क्या है?",
    F(12 + 8, 2), [2, 12, 20], "Boat = (12 + 8)/2 = 10 km/h.", "नाव की चाल = (12 + 8)/2 = 10 किमी/घंटा।", unit=" km/h", unit_hi=" किमी/घंटा")

# Ratio, mixture
add("Ratio and Proportion", "Easy", "If A : B = 2 : 3 and B : C = 4 : 5, what is A : C?", "यदि A : B = 2 : 3 और B : C = 4 : 5 है, तो A : C क्या है?",
    1, [2, 3, 4], "A : C = (2 × 4) : (3 × 5) = 8 : 15.", "A : C = (2 × 4) : (3 × 5) = 8 : 15।")
rows[-1][4] = ["8 : 15", "2 : 5", "4 : 5", "10 : 12"]
rows[-1][5] = rows[-1][4]
add("Mixture", "Medium", "A 60-litre mixture has milk and water in the ratio 2 : 1. How much water must be added to make the ratio 1 : 1?",
    "60 लीटर मिश्रण में दूध और पानी का अनुपात 2 : 1 है। अनुपात 1 : 1 करने के लिए कितना पानी मिलाना होगा?",
    20, [10, 30, 40], "Milk 40 L, water 20 L; water must become 40 L, so add 20 L.", "दूध 40 ली, पानी 20 ली; पानी 40 ली करना है, अतः 20 ली मिलाएँ।",
    unit=" litres", unit_hi=" लीटर")

# Number system / simplification
add("Number System", "Easy", "What is the LCM of 8, 12 and 18?", "8, 12 और 18 का LCM क्या है?",
    72, [36, 144, 24], "8 = 2³, 12 = 2²×3, 18 = 2×3²; LCM = 2³ × 3² = 72.", "8 = 2³, 12 = 2²×3, 18 = 2×3²; LCM = 2³ × 3² = 72।")
assert 72 % 8 == 72 % 12 == 72 % 18 == 0
add("Number System", "Easy", "What is the HCF of 36, 48 and 60?", "36, 48 और 60 का HCF क्या है?",
    gcd(gcd(36, 48), 60), [6, 24, 4], "HCF(36, 48, 60) = 12.", "HCF(36, 48, 60) = 12।")
add("Number System", "Medium", "What is the smallest number that must be added to 1000 to make it exactly divisible by 23?",
    "1000 में कौन सी सबसे छोटी संख्या जोड़ें कि वह 23 से पूर्णतः विभाज्य हो जाए?",
    23 - 1000 % 23, [1000 % 23, 3, 9], f"1000 ÷ 23 leaves remainder {1000 % 23}; add 23 − {1000 % 23} = {23 - 1000 % 23}.",
    f"1000 ÷ 23 का शेषफल {1000 % 23}; जोड़ें 23 − {1000 % 23} = {23 - 1000 % 23}।")
add("Simplification", "Easy", "Simplify: 3/4 + 5/8 − 1/2", "सरल कीजिए: 3/4 + 5/8 − 1/2", F(3, 4) + F(5, 8) - F(1, 2), [1, F(1, 2), F(5, 4)],
    "6/8 + 5/8 − 4/8 = 7/8 = 0.875.", "6/8 + 5/8 − 4/8 = 7/8 = 0.875।")
add("Simplification", "Easy", "What is the cube root of 2744?", "2744 का घनमूल क्या है?", 14, [12, 16, 18], "14 × 14 × 14 = 2744.", "14 × 14 × 14 = 2744।")
assert 14 ** 3 == 2744
add("Simplification", "Easy", "What is 0.25 × 0.4?", "0.25 × 0.4 का मान क्या है?", F(1, 10), [1, F(1, 100), F(4, 10)], "0.25 × 0.4 = 0.1.", "0.25 × 0.4 = 0.1।")

# Mensuration
add("Mensuration", "Easy", "What is the area of a triangle with base 16 cm and height 9 cm?", "16 सेमी आधार और 9 सेमी ऊँचाई वाले त्रिभुज का क्षेत्रफल कितना है?",
    72, [144, 25, 36], "Area = ½ × 16 × 9 = 72 cm².", "क्षेत्रफल = ½ × 16 × 9 = 72 सेमी²।", unit=" cm²", unit_hi=" सेमी²")
add("Mensuration", "Medium", "What is the circumference of a circle of radius 21 cm? (π = 22/7)", "21 सेमी त्रिज्या वाले वृत्त की परिधि कितनी है? (π = 22/7)",
    2 * F(22, 7) * 21, [66, 1386, 44], "C = 2πr = 2 × 22/7 × 21 = 132 cm.", "परिधि = 2πr = 2 × 22/7 × 21 = 132 सेमी।", unit=" cm", unit_hi=" सेमी")
add("Mensuration", "Medium", "What is the volume of a cuboid 10 cm × 8 cm × 5 cm?", "10 सेमी × 8 सेमी × 5 सेमी घनाभ का आयतन कितना है?",
    400, [23, 340, 200], "V = 10 × 8 × 5 = 400 cm³.", "आयतन = 10 × 8 × 5 = 400 सेमी³।", unit=" cm³", unit_hi=" सेमी³")
add("Mensuration", "Medium", "The diagonal of a square is 10 cm. What is its area?", "किसी वर्ग का विकर्ण 10 सेमी है। उसका क्षेत्रफल कितना है?",
    F(10 * 10, 2), [100, 25, 40], "Area = d²/2 = 100/2 = 50 cm².", "क्षेत्रफल = d²/2 = 100/2 = 50 सेमी²।", unit=" cm²", unit_hi=" सेमी²")

# Ages, probability
add("Ages", "Easy", "The sum of the ages of a mother and daughter is 50 years. The mother is 30 years older. What is the daughter's age?",
    "माँ और बेटी की आयु का योग 50 वर्ष है। माँ 30 वर्ष बड़ी है। बेटी की आयु कितनी है?",
    F(50 - 30, 2), [20, 15, 40], "d + (d + 30) = 50 ⇒ d = 10 years.", "d + (d + 30) = 50 ⇒ d = 10 वर्ष।", unit=" years", unit_hi=" वर्ष")
add("Probability", "Easy", "A die is thrown once. What is the probability of getting an even number?", "एक पासा एक बार फेंका जाता है। सम संख्या आने की प्रायिकता क्या है?",
    F(1, 2), [F(1, 3), F(1, 6), F(2, 3)], "Even outcomes 2, 4, 6 → 3/6 = 1/2.", "सम परिणाम 2, 4, 6 → 3/6 = 1/2।")
rows[-1][4] = ["1/2", "1/3", "1/6", "2/3"]; rows[-1][5] = rows[-1][4]
add("Probability", "Medium", "Two coins are tossed. What is the probability of getting at least one head?", "दो सिक्के उछाले जाते हैं। कम से कम एक चित आने की प्रायिकता क्या है?",
    F(3, 4), [F(1, 2), F(1, 4), 1], "Outcomes HH, HT, TH, TT; 3 of 4 have a head → 3/4.", "परिणाम HH, HT, TH, TT; 4 में से 3 में चित → 3/4।")
rows[-1][4] = ["3/4", "1/2", "1/4", "1"]; rows[-1][5] = rows[-1][4]

for r in rows:
    assert len(set(r[4])) == 4, r[2]
print(json.dumps(rows, ensure_ascii=False, indent=0))
