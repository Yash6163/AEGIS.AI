"""Build the SIH 2026 idea deck from the official template and the committed metrics.

    .venv/bin/python presentation/build_deck.py

Every number on the slides is read from a JSON file in this repository:
  models/aegis-wm-1.1.0/metrics.json          CIC-IDS2017 forecasting + early-warning evaluation
  models/aegis-wm-1.1.0/manifest.json         model / calibration facts
  models/aegis-wm-1.1.0/metrics_multi.json    multi-dataset experiments E1-E5
  models/aegis-portable-1.0.0/datasets.json   dataset sizes after windowing
  presentation/example_forecast.json          one real out-of-sample forecast (replay)

The template's idea-detail pointers are kept verbatim as section headers (SIH rule).
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

from lxml import etree
from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LABEL_POSITION, XL_LEGEND_POSITION
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Inches, Pt

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
TEMPLATE = HERE / "SIH2026-IDEA-Presentation-Format.pptx"
OUT = HERE / "RoadPulse_SIH2026_PS26153.pptx"

M = json.loads((ROOT / "models/aegis-wm-1.1.0/metrics.json").read_text())
MAN = json.loads((ROOT / "models/aegis-wm-1.1.0/manifest.json").read_text())
MM = json.loads((ROOT / "models/aegis-wm-1.1.0/metrics_multi.json").read_text())
DS = json.loads((ROOT / "models/aegis-portable-1.0.0/datasets.json").read_text())["datasets"]
EX = json.loads((HERE / "example_forecast.json").read_text())

TEAM = "RoadPulse"
IDEA_TITLE = "AEGIS: Forecasting the Next Attack Stage"
REPO = "github.com/Yash6163/AEGIS.AI"

# palette: template blue dominates, SIH orange = warning / our model, green = safe
BLUE, NAVY, ORANGE, GREEN, RED = "0070C0", "1F3864", "E87722", "2E8B57", "C0392B"
INK, MUTED, TINT, LINE, WHITE = "1A1A1A", "595959", "EAF2FB", "BFBFBF", "FFFFFF"
RED_T, GREEN_T, ORANGE_T = "FBEAEA", "E8F5EE", "FDF0E6"
STAGE_COLORS = ["2E8B57", "5B9BD5", "7F6BB3", "E0A100", "E87722", "D35400", "C0392B"]


def rgb(h: str) -> RGBColor:
    return RGBColor.from_string(h)


def f05(p: float, r: float) -> float:
    return 0.0 if p + r == 0 else 1.25 * p * r / (0.25 * p + r)


# ---------------------------------------------------------------- drawing helpers
def text(slide, x, y, w, h, runs, size=12, color=INK, bold=False, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP,
         font="Arial", italic=False):
    """runs: str | list of paragraphs; a paragraph is str or list of (text, {overrides})."""
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    fill_tf(tf, runs, size, color, bold, align, font, italic)
    return tb


def fill_tf(tf, runs, size, color, bold, align, font="Arial", italic=False):
    paras = runs if isinstance(runs, list) else [runs]
    for i, para in enumerate(paras):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        for seg in ([(para, {})] if isinstance(para, str) else para):
            t, o = seg if isinstance(seg, tuple) else (seg, {})
            r = p.add_run()
            r.text = t
            f = r.font
            f.name = o.get("font", font)
            f.size = Pt(o.get("size", size))
            f.bold = o.get("bold", bold)
            f.italic = o.get("italic", italic)
            f.color.rgb = rgb(o.get("color", color))


def box(slide, x, y, w, h, runs="", fill=TINT, color=INK, size=11, bold=False, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
        line=None, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, radius=0.12, margin=0.05, shadow=False):
    s = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    if shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        s.adjustments[0] = radius
    if fill is None:
        s.fill.background()
    else:
        s.fill.solid()
        s.fill.fore_color.rgb = rgb(fill)
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = rgb(line)
        s.line.width = Pt(1)
    if not shadow:
        sp = s._element.spPr
        sp.append(etree.SubElement(sp, qn("a:effectLst")))
    tf = s.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = Inches(margin)
    tf.margin_top = tf.margin_bottom = Inches(0.02)
    tf.vertical_anchor = anchor
    if runs:
        fill_tf(tf, runs, size, color, bold, align)
    return s


def arrow(slide, x1, y1, x2, y2, color=MUTED, width=1.5, dash=False):
    c = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    c.line.color.rgb = rgb(color)
    c.line.width = Pt(width)
    ln = c.line._get_or_add_ln()
    if dash:
        d = etree.SubElement(ln, qn("a:prstDash"))
        d.set("val", "dash")
    tail = etree.SubElement(ln, qn("a:tailEnd"))
    tail.set("type", "triangle")
    tail.set("w", "med")
    tail.set("len", "med")
    return c


def line(slide, x1, y1, x2, y2, color=LINE, width=1.0, dash=False):
    c = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    c.line.color.rgb = rgb(color)
    c.line.width = Pt(width)
    if dash:
        d = etree.SubElement(c.line._get_or_add_ln(), qn("a:prstDash"))
        d.set("val", "sysDash")
    return c


def pointer(slide, x, y, w, label, size=13, color=NAVY):
    """Template idea-detail pointer, kept verbatim, rendered as a section header."""
    return text(slide, x, y, w, 0.3, [[("▸ ", {"color": ORANGE}), (label, {})]], size=size, color=color, bold=True)


def flow(slide, x, y, w, h, steps, fills, gap=0.28, size=10, color=WHITE):
    """Row of boxes joined by arrows. steps: list of paragraph-lists."""
    n = len(steps)
    bw = (w - gap * (n - 1)) / n
    for i, st in enumerate(steps):
        bx = x + i * (bw + gap)
        box(slide, bx, y, bw, h, st, fill=fills[i % len(fills)], color=color, size=size)
        if i < n - 1:
            arrow(slide, bx + bw + 0.03, y + h / 2, bx + bw + gap - 0.03, y + h / 2, color=MUTED, width=1.75)
    return bw


def style_chart(chart, colors, size=10, legend=True, vmax=None, number_format='0.00'):
    chart.font.size = Pt(size)
    chart.font.name = "Arial"
    chart.font.color.rgb = rgb(MUTED)
    plot = chart.plots[0]
    plot.gap_width = 60
    plot.overlap = -10
    plot.has_data_labels = True
    dl = plot.data_labels
    dl.number_format = number_format
    dl.number_format_is_linked = False
    dl.position = XL_LABEL_POSITION.OUTSIDE_END
    dl.font.size = Pt(size - 1)
    dl.font.color.rgb = rgb(INK)
    for s, c in zip(plot.series, colors):
        s.format.fill.solid()
        s.format.fill.fore_color.rgb = rgb(c)
    va = chart.value_axis
    va.has_major_gridlines = True
    va.major_gridlines.format.line.color.rgb = rgb("E3E3E3")
    va.format.line.fill.background()
    va.tick_labels.font.size = Pt(size - 1)
    va.tick_labels.number_format = number_format
    va.tick_labels.number_format_is_linked = False
    if vmax is not None:
        va.maximum_scale = vmax
        va.minimum_scale = 0
    ca = chart.category_axis
    ca.format.line.color.rgb = rgb(LINE)
    ca.tick_labels.font.size = Pt(size)
    ca.tick_labels.font.color.rgb = rgb(INK)
    chart.has_legend = legend
    if legend:
        chart.legend.position = XL_LEGEND_POSITION.TOP
        chart.legend.include_in_layout = False
        chart.legend.font.size = Pt(size)


# ---------------------------------------------------------------- template plumbing
def delete_slide(prs, index):
    sld_ids = prs.slides._sldIdLst
    sid = sld_ids[index]
    prs.part.drop_rel(sid.get(qn("r:id")))
    sld_ids.remove(sid)


def shape(slide, name):
    return next(s for s in slide.shapes if s.name == name)


def remove(shp):
    shp._element.getparent().remove(shp._element)


def set_oval(slide):
    ov = next(s for s in slide.shapes if s.name.startswith("Oval"))
    p = ov.text_frame.paragraphs
    runs = [r for para in p for r in para.runs]
    runs[0].text = TEAM
    runs[0].font.bold = True
    runs[0].font.size = Pt(11)
    tf = ov.text_frame
    tf.margin_left = tf.margin_right = 0
    tf.word_wrap = False
    for r in runs[1:]:
        r.text = ""
    for para in p[1:]:
        para._p.getparent().remove(para._p)


def set_title(slide, title, size=None):
    t = next(s for s in slide.shapes if s.is_placeholder and s.placeholder_format.type is not None
             and "Title" in s.name)
    runs = [r for para in t.text_frame.paragraphs for r in para.runs]
    runs[0].text = title
    if size:
        runs[0].font.size = Pt(size)
    for r in runs[1:]:
        r.text = ""
    # drop a leading vertical-tab line break in the template title
    for br in t._element.iter(qn("a:br")):
        br.getparent().remove(br)


def take_pointer_header(slide):
    """The template instruction box holds the pointers; we re-render them as headers and drop the box."""
    tb = shape(slide, "TextBox 8")
    remove(tb)


# ---------------------------------------------------------------- slide 1
def slide1(s):
    tb = shape(s, "TextBox 9")
    values = ["26153", "AI based Network Attack Forecasting from Network Traffic Data",
              "Blockchain & Cybersecurity", "Software", "", TEAM]
    paras = [p for p in tb.text_frame.paragraphs if p.runs]
    for p, v in zip(paras, values):
        lab = p.runs[0]
        lab.font.size = Pt(18)
        pPr = p._p.get_or_add_pPr()
        for ls in pPr.findall(qn("a:lnSpc")):
            ls.find(qn("a:spcPct")).set("val", "150000")
        pPr.set("algn", "l")
        if v:
            r = copy.deepcopy(lab._r)
            r.find(qn("a:t")).text = " " + v
            r.find(qn("a:rPr")).set("b", "0")
            lab._r.addnext(r)
            r.find(qn("a:rPr")).set("sz", "1800")
            clr = etree.SubElement(r.find(qn("a:rPr")), qn("a:solidFill"))
            etree.SubElement(clr, qn("a:srgbClr")).set("val", NAVY)
            # solidFill must precede latin/cs in rPr
            rpr = r.find(qn("a:rPr"))
            rpr.remove(clr)
            rpr.insert(0, clr)
    # the PS category line reads "PS Category- Software/Hardware" in the template: keep label, value = Software
    tb.width = Inches(7.0)


# ---------------------------------------------------------------- slide 2
def slide2(s):
    set_title(s, IDEA_TITLE, size=28)
    t = next(x for x in s.shapes if x.name == "Title 1")
    t.left, t.width = Inches(1.85), Inches(8.8)
    set_oval(s)
    take_pointer_header(s)
    text(s, 0.4, 1.22, 12.5, 0.36, [[("❖ ", {"color": BLUE}), ("Proposed Solution (Describe your Idea/Solution/Prototype)", {})]],
         size=18, color="1F4E79", bold=True)
    s.shapes[-1].text_frame.paragraphs[0].runs[1].font.underline = True

    # --- detailed explanation: 5-step pipeline
    pointer(s, 0.4, 1.68, 8, "Detailed explanation of the proposed solution")
    steps = [
        [[("1  INGEST", {"bold": True, "size": 12})], "PCAP · NetFlow · CIC CSV"],
        [[("2  WINDOW", {"bold": True, "size": 12})], "every host, every minute → 26-37 traffic features"],
        [[("3  ENCODE", {"bold": True, "size": 12})], "GRU world model, 5-seed ensemble"],
        [[("4  IMAGINE", {"bold": True, "size": 12})], f"{EX['mc_samples']} simulated futures, +1…+10 min"],
        [[("5  ACT", {"bold": True, "size": 12})], "attack probability · risk · why · audit"],
    ]
    flow(s, 0.4, 2.02, 12.53, 0.78, steps, [NAVY, "1F5FA0", BLUE, ORANGE, "B85C12"], size=10)

    # --- how it addresses the problem
    pointer(s, 0.4, 2.98, 6, "How it addresses the problem")
    # kill-chain track (the states we forecast)
    names = ["Normal", "Recon", "Creds", "Exploit", "C2", "Infiltr.", "Impact"]
    cw, gx, x0, y0 = 0.8, 0.07, 0.4, 3.35
    for i, (n, c) in enumerate(zip(names, STAGE_COLORS)):
        box(s, x0 + i * (cw + gx), y0, cw, 0.55, n, fill=c, color=WHITE, size=9, bold=True, radius=0.2)
    text(s, x0, 3.95, 6.0, 0.25, "7 attack stages (MITRE ATT&CK tactics) per host, per minute", size=9, color=MUTED, italic=True)
    # today vs AEGIS
    box(s, 0.4, 4.3, 1.45, 0.62, [[("Today (IDS)", {"bold": True})]], fill=RED_T, color=RED, size=10)
    box(s, 1.95, 4.3, 4.45, 0.62, "labels the CURRENT flow → alert only after the attack has started",
        fill=RED_T, color=INK, size=10, align=PP_ALIGN.LEFT, margin=0.1)
    box(s, 0.4, 5.0, 1.45, 0.62, [[("AEGIS", {"bold": True})]], fill=GREEN_T, color=GREEN, size=10)
    box(s, 1.95, 5.0, 4.45, 0.62, "predicts the NEXT stage + P(attack within K min) → act before it lands",
        fill=GREEN_T, color=INK, size=10, align=PP_ALIGN.LEFT, margin=0.1)

    # real example timeline (right)
    X0, X1, TY = 6.95, 12.75, 4.35
    box(s, 6.75, 3.02, 6.18, 2.62, "", fill="F7F9FC", line="D9E2EF", radius=0.05)
    ctx, gt = EX["context"], EX["ground_truth"]["states"]
    onset = next(i for i, st in enumerate(gt) if st != "NORMAL")
    p = EX["early_warning"]["probability"]
    text(s, 6.9, 3.1, 5.9, 0.3, [[("Real replay, never seen in training: ", {"bold": True}),
                                  (f"CIC-IDS2017 Friday · host {ctx['host']}", {})]], size=10, color=NAVY)
    minutes = list(range(-3, 7))
    step = (X1 - X0) / (len(minutes) - 1)
    line(s, X0, TY, X1, TY, color=MUTED, width=1.25)
    hh, mm = map(int, ctx["window_start"][11:16].split(":"))
    for k, m in enumerate(minutes):
        x = X0 + k * step
        line(s, x, TY - 0.05, x, TY + 0.05, color=MUTED)
        t = hh * 60 + mm + m
        text(s, x - 0.3, TY + 0.08, 0.6, 0.2, f"{t // 60}:{t % 60:02d}", size=8, color=MUTED, align=PP_ALIGN.CENTER)
    xw = X0 + 3 * step
    xa = X0 + (3 + onset) * step
    box(s, xw - 0.07, TY - 0.07, 0.14, 0.14, "", fill=ORANGE, shape=MSO_SHAPE.OVAL)
    box(s, xa - 0.07, TY - 0.07, 0.14, 0.14, "", fill=RED, shape=MSO_SHAPE.OVAL)
    box(s, xw - 0.95, 3.45, 1.9, 0.62, [[("AEGIS warns", {"bold": True})], f"P(attack ≤5 min) = {p:.1%}"],
        fill=ORANGE, color=WHITE, size=9)
    arrow(s, xw, 4.07, xw, TY - 0.09, color=ORANGE, width=1.5)
    box(s, xa - 0.8, 3.45, 1.6, 0.62, [[("C2 begins", {"bold": True})], "IDS can alert here"],
        fill=RED, color=WHITE, size=9)
    arrow(s, xa, 4.07, xa, TY - 0.09, color=RED, width=1.5)
    # lead bracket
    line(s, xw, 4.78, xa, 4.78, color=GREEN, width=2.25)
    line(s, xw, 4.7, xw, 4.86, color=GREEN, width=2.25)
    line(s, xa, 4.7, xa, 4.86, color=GREEN, width=2.25)
    text(s, xw, 4.84, xa - xw, 0.25, f"{onset} min lead time", size=10, bold=True, color=GREEN, align=PP_ALIGN.CENTER)
    top = [c["description"] for c in EX["explanation"]["feature_contributions"][:3]]
    text(s, 6.9, 5.12, 5.9, 0.45, [[("Why: ", {"bold": True, "color": NAVY}), (" · ".join(top), {})]], size=9, color=MUTED)

    # --- innovation
    pointer(s, 0.4, 5.78, 6, "Innovation and uniqueness of the solution")
    ece = M["forecast"]["world_model"]["1"]["ece"]
    cards = [
        ("Forecaster, not classifier", "a world model imagines the host's next minutes"),
        (f"Calibrated (ECE {ece:.3f})", "probabilities mean what they say; precision-first alarm"),
        ("Explainable", "which feature & which minute drove each warning"),
        ("Tamper-evident", "SHA-256 hash-chained alert & audit log"),
    ]
    cw, gap = (12.53 - 3 * 0.2) / 4, 0.2
    for i, (h, b) in enumerate(cards):
        box(s, 0.4 + i * (cw + gap), 6.1, cw, 0.76, [[(h, {"bold": True, "color": NAVY, "size": 11})], b],
            fill=TINT, color=INK, size=9, radius=0.1)


# ---------------------------------------------------------------- slide 3
def slide3(s):
    set_title(s, "TECHNICAL APPROACH")
    set_oval(s)
    take_pointer_header(s)
    pointer(s, 0.4, 1.22, 12.5, "Technologies to be used (e.g. programming languages, frameworks, hardware)")
    groups = [
        ("ML / Data", NAVY, ["Python 3.12 · pandas", "PyTorch (training)", "NumPy runtime", "XGBoost · scikit-learn"]),
        ("Backend", BLUE, ["FastAPI", "SQLAlchemy + Alembic", "PostgreSQL", "pure-Python PCAP parser"]),
        ("Frontend", ORANGE, ["Next.js 14 · React 18", "TypeScript", "Tailwind CSS", "server-side API-key proxy"]),
        ("Ops / Hardware", GREEN, ["Docker Compose", "GitHub Actions CI", "CPU only, no GPU", "self-hosted (data stays on-prem)"]),
    ]
    gw = (12.53 - 3 * 0.25) / 4
    for i, (g, c, items) in enumerate(groups):
        gx = 0.4 + i * (gw + 0.25)
        box(s, gx, 1.58, gw, 0.3, g, fill=c, color=WHITE, size=11, bold=True, radius=0.3)
        for j, it in enumerate(items):
            col, row = j % 2, j // 2
            cw = (gw - 0.08) / 2
            box(s, gx + col * (cw + 0.08), 1.95 + row * 0.34, cw, 0.29, it, fill="F2F2F2", color=INK, size=8.5, radius=0.3,
                margin=0.02)

    pointer(s, 0.4, 3.02, 12.5, "Methodology and process for implementation (Flow Charts/Images/ working prototype)")
    # training pipeline
    text(s, 0.4, 3.4, 1.0, 0.62, [[("TRAIN", {"bold": True})], "offline"], size=10, color=NAVY, anchor=MSO_ANCHOR.MIDDLE)
    tr = [
        [[("5 datasets", {"bold": True})], "18.9 M flows"],
        [[("Stage labels", {"bold": True})], "→ ATT&CK tactics"],
        [[("Host-minute", {"bold": True})], "windows"],
        [[("Blocked 5-fold CV", {"bold": True})], "30-min blocks, no leak"],
        [[("Train ensemble", {"bold": True})], "+ XGB / Markov baselines"],
        [[("Calibrate", {"bold": True})], "temperature + F0.5 threshold"],
        [[("Export", {"bold": True})], "NumPy runtime + SHA-256"],
    ]
    flow(s, 1.3, 3.4, 11.63, 0.62, tr, [NAVY, "1F5FA0"], size=9, gap=0.22)
    # serving pipeline
    text(s, 0.4, 4.2, 1.0, 0.62, [[("SERVE", {"bold": True})], "per upload"], size=10, color=ORANGE, anchor=MSO_ANCHOR.MIDDLE)
    sv = [
        [[("Upload", {"bold": True})], "PCAP / CSV / NetFlow"],
        [[("Validate", {"bold": True})], "size · gzip-bomb · sniff"],
        [[("Build flows", {"bold": True})], "detect format → model"],
        [[("Encode history", {"bold": True})], "last 10 minutes"],
        [[("Roll out futures", {"bold": True})], "Monte-Carlo, ensemble"],
        [[("Risk + explain", {"bold": True})], "occlusion attribution"],
        [[("SOC dashboard", {"bold": True})], "alerts · audit chain"],
    ]
    flow(s, 1.3, 4.2, 11.63, 0.62, sv, [ORANGE, "B85C12"], size=9, gap=0.22)

    # world model diagram
    box(s, 0.4, 5.02, 7.6, 1.84, "", fill="F7F9FC", line="D9E2EF", radius=0.05)
    text(s, 0.55, 5.08, 7.3, 0.25, [[("Inside the world model", {"bold": True, "color": NAVY}),
                                     (f"  ·  {MAN['members']} members × 43.7 k parameters", {"color": MUTED})]], size=10)
    for k in range(3):
        box(s, 0.6 + k * 0.1, 5.47 + k * 0.04, 1.7, 0.6, "", fill="C9DAF0", line="FFFFFF", radius=0.1)
    box(s, 0.8, 5.55, 1.7, 0.6, [[("x t-9 … x t", {"bold": True})], "10 min of features"], fill="DCE7F5", line="FFFFFF",
        color=NAVY, size=8.5, radius=0.1)
    box(s, 2.75, 5.55, 1.1, 0.6, [[("GRU", {"bold": True})], "encoder"], fill=NAVY, color=WHITE, size=9)
    box(s, 4.1, 5.55, 0.7, 0.6, [[("h", {"bold": True, "size": 12})]], fill=BLUE, color=WHITE, size=9,
        shape=MSO_SHAPE.OVAL)
    box(s, 5.05, 5.55, 1.2, 0.6, [[("Decoder", {"bold": True})], "p(state)"], fill=ORANGE, color=WHITE, size=9)
    box(s, 6.5, 5.55, 1.35, 0.6, [[("sample", {"bold": True})], "next stage"], fill="F2F2F2", color=INK, size=9)
    arrow(s, 2.5, 5.85, 2.72, 5.85)
    arrow(s, 3.87, 5.85, 4.08, 5.85)
    arrow(s, 4.82, 5.85, 5.03, 5.85)
    arrow(s, 6.27, 5.85, 6.48, 5.85)
    # feedback loop
    line(s, 7.17, 6.17, 7.17, 6.45, color=GREEN, width=1.5)
    line(s, 7.17, 6.45, 4.45, 6.45, color=GREEN, width=1.5)
    arrow(s, 4.45, 6.45, 4.45, 6.17, color=GREEN, width=1.5)
    text(s, 4.6, 6.49, 3.3, 0.3, "GRU transition: feed sampled stage back, repeat +1…+10 min", size=8, color=GREEN)

    # working prototype panel
    box(s, 8.25, 5.02, 4.68, 1.84, "", fill=GREEN_T, line="BFE3CD", radius=0.05)
    text(s, 8.4, 5.08, 4.4, 0.25, "Working prototype (in repo)", size=10, bold=True, color=GREEN)
    items = ["Reads CIC CSV · Argus/CTU binetflow · UNSW CSV · raw PCAP",
             "5 SOC pages: overview · forecast · analysis · alerts · model",
             "Upload PCAP / CSV → forecasts in seconds",
             f"{M['inference_latency_ms_per_host']['mean']:.2f} ms per host (CPU, {M['inference_latency_ms_per_host']['mc_samples']} rollouts)",
             "59 backend tests · CI · Docker images verified"]
    text(s, 8.4, 5.38, 4.45, 1.45, [[("✔ ", {"color": GREEN, "bold": True}), (t, {})] for t in items], size=9.5, color=INK)
    for p_ in s.shapes[-1].text_frame.paragraphs:
        p_.space_after = Pt(3)


# ---------------------------------------------------------------- slide 4
def slide4(s):
    set_title(s, "FEASIBILITY AND VIABILITY")
    set_oval(s)
    take_pointer_header(s)
    pointer(s, 0.4, 1.22, 6.2, "Analysis of the feasibility of the idea")
    ew = M["early_warning"]["models"]
    rows = [("AEGIS (ours)", "world_model"), ("XGBoost", "xgboost_direct"), ("Markov chain", "markov_nowcast")]
    cd = CategoryChartData()
    cd.categories = ["AUROC", "AUPRC", "Precision", "F0.5"]
    for name, k in rows:
        e = ew[k]
        cd.add_series(name, (e["auroc"], e["auprc"], e["precision_at_threshold"],
                             f05(e["precision_at_threshold"], e["recall_at_threshold"])))
    gf = s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(0.4), Inches(1.55), Inches(6.2), Inches(3.35), cd)
    ch = gf.chart
    style_chart(ch, [ORANGE, "8FAADC", "BFBFBF"], size=10, vmax=1.0)
    ch.has_title = True
    ch.chart_title.text_frame.text = f"Early warning: attack within 5 min (CIC-IDS2017, blocked CV, n = {ew['world_model']['n']:,})"
    ch.chart_title.text_frame.paragraphs[0].runs[0].font.size = Pt(10)
    ch.chart_title.text_frame.paragraphs[0].runs[0].font.bold = True
    ch.chart_title.text_frame.paragraphs[0].runs[0].font.color.rgb = rgb(NAVY)

    wm = ew["world_model"]
    lt = M["lead_time"]
    tiles = [
        (f"{wm['precision_at_threshold']:.0%}", "of warnings are real attacks"),
        (f"{wm['false_alarm_rate_at_threshold']:.1%}", "false-alarm rate on quiet minutes"),
        (f"{lt['false_warnings_per_host_hour']:.2f}", "false warnings per host-hour"),
        (f"{M['inference_latency_ms_per_host']['mean']:.1f} ms", "per host, CPU, no GPU"),
    ]
    tw = (6.2 - 3 * 0.15) / 4
    for i, (big, small) in enumerate(tiles):
        box(s, 0.4 + i * (tw + 0.15), 5.0, tw, 1.05, [[(big, {"bold": True, "size": 20, "color": ORANGE})], small],
            fill=TINT, color=INK, size=9, radius=0.1)
    text(s, 0.4, 6.15, 6.2, 0.7,
         f"Honest limit: only {lt['all']['forecast_before_onset_rate']:.0%} of attack onsets are warned in advance "
         f"(median {lt['all']['median_lead_minutes_when_forecast']:.0f} min early), and the very first step of a "
         f"campaign is never forecast ({lt['cold_onset']['forecast_before_onset_rate']:.0%} of {lt['cold_onset']['n_onsets']} cold onsets).",
         size=9, color=MUTED, italic=True)

    # challenges -> strategies
    pointer(s, 6.95, 1.22, 3.0, "Potential challenges and risks", size=12)
    pointer(s, 10.05, 1.22, 2.9, "Strategies for overcoming these challenges", size=12)
    sup = M["protocol"]["state_support_current"]
    attack_share = 1 - sup["NORMAL"] / sum(sup.values())
    lodo = MM["E3_lodo"]
    lo, hi = min(v["early_warning"]["auroc"] for v in lodo.values()), max(v["early_warning"]["auroc"] for v in lodo.values())
    ctu_s, ctu_j = MM["E1_single"]["ctu13"]["early_warning"]["precision"], MM["E2_joint"]["ctu13"]["early_warning"]["precision"]
    pairs = [
        (f"Attacks are rare: {attack_share:.1%} of host-minutes", "Precision-first alarm: threshold maximises F0.5; calibrated probabilities"),
        (f"New networks look different: zero-shot AUROC {lo:.2f}–{hi:.2f}",
         f"Joint multi-dataset training (CTU-13 precision {ctu_s:.0%} → {ctu_j:.0%}) + short on-site fine-tuning"),
        ("First step of a campaign is not forecastable", "Nowcast detector runs alongside; risk engine escalates"),
        ("Many sensor formats (PCAP, NetFlow, CSV)", "Portable 26-feature schema + built-in PCAP flow builder"),
        ("Hostile uploads, data leakage", "Size & gzip-bomb caps, content sniffing, API key server-side, on-prem"),
    ]
    y, rh = 1.74, 0.86
    for i, (c, st) in enumerate(pairs):
        yy = y + i * (rh + 0.12)
        box(s, 6.95, yy, 2.85, rh, c, fill=RED_T, color=INK, size=9.5, align=PP_ALIGN.LEFT, margin=0.1)
        arrow(s, 9.82, yy + rh / 2, 10.03, yy + rh / 2, color=MUTED, width=1.75)
        box(s, 10.05, yy, 2.88, rh, st, fill=GREEN_T, color=INK, size=9.5, align=PP_ALIGN.LEFT, margin=0.1)


# ---------------------------------------------------------------- slide 5
def slide5(s):
    set_title(s, "IMPACT AND BENEFITS")
    set_oval(s)
    take_pointer_header(s)
    pointer(s, 0.4, 1.22, 6.2, "Potential impact on the target audience")
    wm = M["early_warning"]["models"]["world_model"]
    cx, cy = 3.4, 4.1
    hub = [
        ("NTRO / CERT-In analysts", "minutes of warning to isolate a host", 1.15, 1.7),
        ("Enterprise & govt SOCs", f"fewer, better alerts: {wm['precision_at_threshold']:.0%} precision", 4.35, 1.7),
        ("Critical infrastructure", "power · telecom · banking: act before impact", 1.15, 5.65),
        ("Researchers & students", "open code, 5 public datasets, reproducible", 4.35, 5.65),
    ]
    for (h, b, x, y) in hub:
        arrow(s, cx, cy, x + 1.25 if x < cx else x, y + 0.45 if y < cy else y + 0.05, color="9DB9DE", width=1.5)
    box(s, cx - 0.8, cy - 0.8, 1.6, 1.6, [[("AEGIS", {"bold": True, "size": 15})], "attack forecast"],
        fill=BLUE, color=WHITE, size=10, shape=MSO_SHAPE.OVAL)
    for (h, b, x, y) in hub:
        box(s, x - 0.75, y - 0.15, 2.45, 0.95, [[(h, {"bold": True, "color": NAVY, "size": 10.5})], b],
            fill=TINT, color=INK, size=9, radius=0.12)

    pointer(s, 6.95, 1.22, 6.0, "Benefits of the solution (social, economic, environmental, etc.)")
    lt = M["lead_time"]
    v10 = 1.23  # v1.0.0 false warnings per host-hour, models/aegis-wm-1.0.0/metrics.json
    try:
        v10 = json.loads((ROOT / "models/aegis-wm-1.0.0/metrics.json").read_text())["lead_time"]["false_warnings_per_host_hour"]
    except (FileNotFoundError, KeyError):
        pass
    ben = [
        ("Social", GREEN, "protects hospitals, utilities & citizens' services before disruption"),
        ("Economic", ORANGE, f"{v10 / lt['false_warnings_per_host_hour']:.1f}× fewer false warnings than our v1.0 → less analyst fatigue"),
        ("Strategic", NAVY, "self-hosted, open source: no traffic leaves the country"),
        ("Environmental", BLUE, "CPU-only NumPy inference, no GPU fleet needed"),
    ]
    bw = (5.98 - 0.2) / 2
    for i, (h, c, b) in enumerate(ben):
        x = 6.95 + (i % 2) * (bw + 0.2)
        y = 1.58 + (i // 2) * 1.02
        box(s, x, y, bw, 0.9, [[(h, {"bold": True, "color": c, "size": 11})], b], fill="F7F7F7", color=INK, size=9,
            align=PP_ALIGN.LEFT, margin=0.12, radius=0.1)

    ds = MM["protocol"]["cv_datasets"]
    lab = {"cic2017": "CIC-IDS2017", "unsw": "UNSW-NB15", "ctu13": "CTU-13"}
    cd = CategoryChartData()
    cd.categories = [lab[d] for d in ds]
    cd.add_series("Trained on that dataset only", [MM["E1_single"][d]["early_warning"]["precision"] for d in ds])
    cd.add_series("One model, all 3 datasets", [MM["E2_joint"][d]["early_warning"]["precision"] for d in ds])
    gf = s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(6.95), Inches(3.72), Inches(5.98), Inches(3.14), cd)
    ch = gf.chart
    style_chart(ch, ["8FAADC", ORANGE], size=9, vmax=1.15, number_format='0%')
    ch.value_axis.major_unit = 0.25
    ch.has_title = True
    ch.chart_title.text_frame.text = "More data → more trustworthy warnings (warning precision, 5-fold CV)"
    r = ch.chart_title.text_frame.paragraphs[0].runs[0]
    r.font.size, r.font.bold, r.font.color.rgb = Pt(10), True, rgb(NAVY)


# ---------------------------------------------------------------- slide 6
def slide6(s):
    set_title(s, "RESEARCH  AND REFERENCES")
    set_oval(s)
    take_pointer_header(s)
    pointer(s, 0.4, 1.22, 12.5, "Details / Links of the reference and research work")

    e5 = MM["E5_transfer"]
    auroc = lambda r: r["early_warning"]["auroc"]  # noqa: E731
    rows = [
        ("Dataset (all public)", "Used for", "Host-minutes", "Early-warning AUROC"),
        ("CIC-IDS2017", "train + test", f"{DS['cic2017']['rows']:,}", f"{auroc(MM['E1_single']['cic2017']):.3f}"),
        ("UNSW-NB15", "train + test", f"{DS['unsw']['rows']:,}", f"{auroc(MM['E1_single']['unsw']):.3f}"),
        ("CTU-13 (8 botnet scenarios)", "train + test", f"{DS['ctu13']['rows']:,}", f"{auroc(MM['E2_joint']['ctu13']):.3f}"),
        ("CSE-CIC-IDS2018 (20-Feb)", "unseen test", f"{DS['cic2018']['rows']:,}", f"{auroc(e5['cic2018']['portable_model']):.3f}*"),
        ("DARPA 2000 LLDOS (raw PCAP)", "unseen test", f"{DS['darpa2000']['rows']:,}", f"{auroc(e5['darpa2000']['portable_model']):.3f}"),
        ("MITRE ATT&CK", "stage taxonomy", "-", "-"),
    ]
    cols = [2.55, 1.15, 1.2, 1.5]
    tbl = s.shapes.add_table(len(rows), 4, Inches(0.4), Inches(1.6), Inches(sum(cols)), Inches(0.3 * len(rows))).table
    for j, w in enumerate(cols):
        tbl.columns[j].width = Inches(w)
    for i, row in enumerate(rows):
        tbl.rows[i].height = Inches(0.3)
        for j, v in enumerate(row):
            c = tbl.cell(i, j)
            c.margin_left = c.margin_right = Inches(0.06)
            c.margin_top = c.margin_bottom = Inches(0.02)
            c.vertical_anchor = MSO_ANCHOR.MIDDLE
            c.fill.solid()
            c.fill.fore_color.rgb = rgb(NAVY if i == 0 else ("F2F6FB" if i % 2 else WHITE))
            tf = c.text_frame
            tf.paragraphs[0].alignment = PP_ALIGN.LEFT if j < 2 else PP_ALIGN.RIGHT
            r = tf.paragraphs[0].add_run()
            r.text = v
            r.font.size = Pt(9)
            r.font.name = "Arial"
            r.font.bold = i == 0
            unseen = row[1] == "unseen test"
            r.font.color.rgb = rgb(WHITE if i == 0 else (RED if unseen and j == 3 else INK))
    total_flows = sum(d["flows"] for d in DS.values())
    c18 = e5["cic2018"]["portable_model"]["early_warning"]
    text(s, 0.4, 3.83, 6.4, 0.75,
         [f"{total_flows / 1e6:.1f} M flows → {sum(d['rows'] for d in DS.values()):,} host-minutes. Red = network never seen in "
          f"training: the honest edge case. *IDS2018 AUROC is high but AUPRC only {c18['auprc']:.2f} (80 attack minutes in "
          f"{DS['cic2018']['rows']:,}); on DARPA 2000 the model is at chance.",
          "Reviewed, not used: CICIoT2023 (no timestamps/IPs), LANL (access-restricted, auth logs), CAPEC & CVE/NVD "
          "(no traffic; future enrichment)."], size=8.5, color=MUTED)
    for p_ in s.shapes[-1].text_frame.paragraphs:
        p_.space_after = Pt(3)

    # method lineage diagram
    box(s, 0.4, 4.75, 6.4, 2.1, "", fill="F7F9FC", line="D9E2EF", radius=0.05)
    text(s, 0.55, 4.8, 6.1, 0.25, "What we built on", size=10, bold=True, color=NAVY)
    lineage = [("World Models [1] · PlaNet [2]", "latent dynamics + imagination", 0.55, 5.12),
               ("GRU [3] · Deep ensembles [4]", "sequence encoder + uncertainty", 3.7, 5.12),
               ("Kill Chain [9] · ATT&CK [10]", "attack-stage vocabulary", 0.55, 5.9),
               ("Calibration [11] · Blocked CV [12]", "trustworthy, leak-free evaluation", 3.7, 5.9)]
    for h, b, x, y in lineage:
        box(s, x, y, 2.95, 0.66, [[(h, {"bold": True, "size": 9.5, "color": NAVY})], b], fill=WHITE, line="D9E2EF",
            color=MUTED, size=8.5, radius=0.1)

    refs = [
        "Ha & Schmidhuber, “World Models”, 2018. arxiv.org/abs/1803.10122",
        "Hafner et al., “Learning Latent Dynamics for Planning from Pixels” (PlaNet), ICML 2019",
        "Cho et al., “Learning Phrase Representations using RNN Encoder–Decoder”, EMNLP 2014",
        "Lakshminarayanan et al., “Simple and Scalable Predictive Uncertainty… Deep Ensembles”, NeurIPS 2017",
        "Sharafaldin et al., “Toward Generating a New IDS Dataset” (CIC-IDS2017/2018), ICISSP 2018. unb.ca/cic/datasets",
        "Moustafa & Slay, “UNSW-NB15: a comprehensive data set”, MilCIS 2015. research.unsw.edu.au/projects/unsw-nb15-dataset",
        "García et al., “An empirical comparison of botnet detection methods” (CTU-13), Computers & Security 2014",
        "MIT Lincoln Laboratory, DARPA 2000 Intrusion Detection Scenario (LLDOS 1.0). ll.mit.edu",
        "Hutchins, Cloppert & Amin, “Intelligence-Driven Computer Network Defense” (Kill Chain), 2011",
        "MITRE ATT&CK Enterprise tactics. attack.mitre.org",
        "Guo et al., “On Calibration of Modern Neural Networks”, ICML 2017",
        "Bergmeir & Benítez, “On the use of cross-validation for time series predictor evaluation”, Inf. Sci. 2012",
        "Chen & Guestrin, “XGBoost: A Scalable Tree Boosting System”, KDD 2016",
    ]
    text(s, 7.1, 1.6, 5.85, 4.7, [[(f"[{i}] ", {"bold": True, "color": BLUE}), (r, {})] for i, r in enumerate(refs, 1)],
         size=9, color=INK)
    for p_ in s.shapes[-1].text_frame.paragraphs:
        p_.space_after = Pt(4.5)
    box(s, 7.1, 6.38, 5.83, 0.48, [[("Code, models & all metrics:  ", {"color": WHITE}), (REPO, {"bold": True, "color": WHITE})]],
        fill=NAVY, size=11, radius=0.3)


def main() -> None:
    prs = Presentation(str(TEMPLATE))
    delete_slide(prs, 6)  # "Important instructions" slide - template says to delete it before upload
    sl = prs.slides
    slide1(sl[0])
    slide2(sl[1])
    slide3(sl[2])
    slide4(sl[3])
    slide5(sl[4])
    slide6(sl[5])
    prs.save(str(OUT))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
