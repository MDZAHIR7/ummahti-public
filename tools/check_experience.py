"""Check generated showcase assets and local Guide delivery contracts.

Run after build_v15.py. This reads files only and complements check_v15.py and
check_site.py. It does not establish rendered geometry, contrast, motion quality
or an exhaustive privacy audit; those still require the browser walkthrough.
"""

from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import json
import re
import sys

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
LOCALES = ("en", "ar", "ur", "id")
LOCALE_NAMES = {"en": "English", "ar": "العربية", "ur": "اردو", "id": "Bahasa Indonesia"}
ROUTES = ("", "quran")
GUIDE_COPY_KEYS = (
    "guideSearchSubmit", "guideSearchClear", "guideTryQuestion",
    "guideSearchHint", "guideResultsLabel", "guideBrowseTopic",
    "guideResultReady",
)
PREVIEW_COPY_KEYS = (
    "rHeroPreviewLabel", "rHeroFeatures", "rHeroPreviewNote", "rHeroTry",
    "rHeroTryGuide", "rHeroResume",
)
# Existing approved, uncropped capture derivatives have two source ratios.
# Their dimensions differ by source; a blanket height=933 caused a real shift.
CAPTURE_FAMILIES = {
    "/media/screens/2026-10/": {420: 933, 840: 1867},
    "/media/v15/": {420: 910, 840: 1820},
}


class CheckError(ValueError):
    """A public experience contract was not preserved."""


def require(condition, message):
    if not condition:
        raise CheckError(message)


@dataclass
class Element:
    tag: str
    attrs: dict
    parent: object = None
    text: list = field(default_factory=list)

    def within(self, attribute, value=None):
        item = self
        while item:
            if attribute in item.attrs and (value is None or item.attrs[attribute] == value):
                return True
            item = item.parent
        return False

    def accessible_name(self):
        return (self.attrs.get("aria-label") or " ".join(self.text)).strip()

    def belongs_to(self, ancestor):
        node = self
        while node:
            if node is ancestor:
                return True
            node = node.parent
        return False


class Page(HTMLParser):
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
            "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self, text, label):
        super().__init__(convert_charrefs=True)
        self.label = label
        self.elements = []
        self.ids = {}
        self.stack = []
        self.feed(text)

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        node = Element(tag, attrs, self.stack[-1] if self.stack else None)
        if attrs.get("id"):
            identifier = attrs["id"]
            require(identifier not in self.ids,
                    f"{self.label}: duplicate id #{identifier}")
            self.ids[identifier] = node
        self.elements.append(node)
        if tag not in self.VOID:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_startendtag(self, tag, attributes):
        self.handle_starttag(tag, attributes)
        if tag not in self.VOID:
            self.handle_endtag(tag)

    def handle_data(self, data):
        for node in self.stack:
            node.text.append(data)

    def with_attribute(self, name):
        return [node for node in self.elements if name in node.attrs]

    def resource_paths(self, tag, attribute):
        return {urlsplit(node.attrs[attribute]).path for node in self.elements
                if node.tag == tag and node.attrs.get(attribute)}


def local_file(root, url, label):
    parsed = urlsplit(url)
    require(not parsed.scheme and not parsed.netloc and parsed.path.startswith("/"),
            f"{label}: expected an own-origin asset, got {url}")
    path = (root / unquote(parsed.path).lstrip("/")).resolve()
    require(path.is_relative_to(root.resolve()) and path.is_file(),
            f"{label}: missing/invalid asset {url}")
    return path


def capture_family(url):
    path = urlsplit(url).path
    if not re.search(r"-\d+\.webp$", path):
        return None
    return next((family for family in CAPTURE_FAMILIES if path.startswith(family)), None)


def image_size(root, url, label):
    path = local_file(root, url, label)
    with Image.open(path) as image:
        return image.size


def check_capture(root, node, label):
    src = node.attrs.get("src", "")
    family = capture_family(src)
    require(family is not None, f"{label}: unrecognized capture source {src}")
    actual = image_size(root, src, label)
    try:
        declared = (int(node.attrs.get("width", "")), int(node.attrs.get("height", "")))
    except ValueError as error:
        raise CheckError(f"{label}: capture needs numeric width and height: {src}") from error
    require(declared == actual,
            f"{label}: {src} declares {declared}, actual {actual}")
    approved = CAPTURE_FAMILIES[family]
    require(actual[0] in approved and actual[1] == approved[actual[0]],
            f"{label}: capture has an unapproved crop/size: {src} {actual}")
    for candidate in node.attrs.get("srcset", "").split(","):
        if not candidate.strip():
            continue
        parts = candidate.split()
        require(len(parts) == 2 and re.fullmatch(r"\d+w", parts[1]),
                f"{label}: capture srcset needs width descriptors: {candidate}")
        url, descriptor = parts
        require(capture_family(url) == family,
                f"{label}: srcset leaves the approved capture family: {url}")
        size = image_size(root, url, label)
        require(int(descriptor[:-1]) == size[0],
                f"{label}: srcset width disagrees with {url}: {descriptor}, actual {size}")
        require(size[0] in approved and size[1] == approved[size[0]],
                f"{label}: srcset derivative has an unapproved crop/size: {url} {size}")


def exactly_one(page, attribute):
    nodes = page.with_attribute(attribute)
    require(len(nodes) == 1,
            f"{page.label}: expected one [{attribute}], got {len(nodes)}")
    return nodes[0]


def check_preview_delivery(page):
    label = page.label
    require("/v15-renders.js" in page.resource_paths("script", "src"),
            f"{label}: shared preview behavior is not included")
    scripts = [urlsplit(node.attrs["src"]).path for node in page.elements
               if node.tag == "script" and node.attrs.get("src")]
    require("/v15-phone-handoff.js" in scripts
            and scripts.index("/v15-phone-handoff.js") < scripts.index("/v15-renders.js"),
            f"{label}: the single phone owner must load before the preview")
    require("/v15-field-light.js" in scripts
            and scripts.index("/v15-field-light.js") < scripts.index("/v15-guide.js")
            and scripts.index("/v15-field-light.js") < scripts.index("/v15-renders.js"),
            f"{label}: both search surfaces need their shared flowing-rim owner")
    for helper, consumers in (("/v15-guide-search.js", ("/v15-guide.js", "/v15-renders.js")),
                              ("/v15-preview-audio.js", ("/v15-renders.js",)),
                              ("/v15-hifz-preview.js", ("/v15-renders.js",))):
        require(helper in scripts and all(scripts.index(helper) < scripts.index(consumer) for consumer in consumers),
                f"{label}: shared interaction owner missing or loaded too late: {helper}")
    for attribute in ("data-r-read-play", "data-r-unlock-play", "data-r-unlock-reset", "data-hh-reset"):
        node = exactly_one(page, attribute)
        require(node.tag == "button" and node.accessible_name(),
                f"{label}: local preview action [{attribute}] must be a named button")
    manual = exactly_one(page, "data-hh-form")
    reference = page.ids.get("hero-hifz-reference")
    require(manual.tag == "form" and not manual.attrs.get("action") and reference is not None
            and reference.belongs_to(manual) and not reference.attrs.get("name"),
            f"{label}: Hifz reference must remain a real local-only form")
    require("/v15-handoff-craft.css" in page.resource_paths("link", "href"),
            f"{label}: the authored handoff material is not included")
    require("/v15-hifz-refinement.css" in page.resource_paths("link", "href"),
            f"{label}: compact Hifz surfaces are not included")
    exactly_one(page, "data-r-guide-hero")
    require("preview" in page.ids, f"{label}: shared preview destination #preview is missing")
    dock = exactly_one(page, "data-r-phone-dock")
    require(dock.within("id", "preview"), f"{label}: phone dock is outside #preview")
    exactly_one(page, "data-r-preview-controls")
    exactly_one(page, "data-r-dock-controls")
    for attribute in ("data-r-take-control", "data-r-gh-open"):
        node = exactly_one(page, attribute)
        require(node.tag == "button" and node.accessible_name(),
                f"{label}: [{attribute}] needs a named button")
    scenes = page.with_attribute("data-r-scene")
    expected = {"guide", "read", "unlock", "recite"}
    require(len(scenes) == len(expected) * 2
            and {node.attrs["data-r-scene"] for node in scenes} == expected,
            f"{label}: named Guide/read/Unlock/Hifz scene choices are missing")
    require(all(node.tag == "button" and node.accessible_name()
                and node.attrs.get("aria-pressed") in ("true", "false") for node in scenes),
            f"{label}: scene choices need accessible names and pressed state")
    require(sum(node.attrs["aria-pressed"] == "true" for node in scenes) == 2,
            f"{label}: home and dock each need one initial preview scene selected")
    for group in [node for node in page.elements if "r-scene-choices" in node.attrs.get("class", "").split()]:
        choices = [node for node in scenes if node.belongs_to(group)]
        require(len(choices) == 4 and sum(node.attrs["aria-pressed"] == "true" for node in choices) == 1,
                f"{label}: each stable control group must expose all four named moments")
    headings = page.with_attribute("data-r-dock-heading")
    require(len(headings) == len(expected)
            and {node.attrs["data-r-dock-heading"] for node in headings} == expected
            and all(node.tag == "template" for node in headings),
            f"{label}: dock needs reviewed heading templates for all four scenes")
    form = exactly_one(page, "data-r-gh-form")
    search = page.ids.get("hero-guide-input")
    require(form.tag == "form" and not form.attrs.get("action")
            and search is not None and search.tag == "input"
            and search.within("data-r-gh-form") and not search.attrs.get("name"),
            f"{label}: preview needs its real local search input/form")


def check_header(page, lang):
    globe = exactly_one(page, "data-language-globe")
    summary = globe.parent
    require(globe.tag == "svg" and summary is not None and summary.tag == "summary"
            and summary.attrs.get("aria-label", "").strip(),
            f"{page.label}: globe belongs in a named language control")
    require(LOCALE_NAMES[lang] in " ".join(summary.text),
            f"{page.label}: language control must display its native language name")
    menu = summary.parent
    require(menu is not None and menu.tag == "details",
            f"{page.label}: language control needs its native disclosure")
    choices = [node for node in page.elements if node.tag == "a"
               and node.belongs_to(menu)
               and node.attrs.get("hreflang") in LOCALES]
    require({node.attrs["hreflang"] for node in choices} == set(LOCALES),
            f"{page.label}: language menu must retain all four locales")
    current = [node for node in choices if node.attrs.get("aria-current") == "page"]
    require(len(current) == 1 and current[0].attrs["hreflang"] == lang,
            f"{page.label}: language menu current state is incorrect")


def check_guide_delivery(root, page, lang, copy):
    label = page.label
    require("/v15-guide.js" in page.resource_paths("script", "src"),
            f"{label}: Guide behavior is not included")
    styles = {urlsplit(node.attrs["href"]).path for node in page.elements
              if node.tag == "link" and node.attrs.get("rel") == "stylesheet"
              and node.attrs.get("href")}
    require("/v15-guide-light.css" in styles,
            f"{label}: Guide search illumination stylesheet is not included")
    require("/v15-experience.css" in styles,
            f"{label}: shared experience stylesheet is not included")
    inputs = page.with_attribute("data-guide-search")
    require(len(inputs) == 1 and inputs[0].tag == "input",
            f"{label}: expected one real Guide search input")
    search = inputs[0]
    require(not search.attrs.get("name"),
            f"{label}: no-JS search must not put a query into the URL")
    form = search.parent
    while form and form.tag != "form":
        form = form.parent
    require(form is not None and not form.attrs.get("action"),
            f"{label}: Guide input must stay in its local form")
    require(search.attrs.get("id") in page.ids,
            f"{label}: Guide search input needs its label target")
    labels = [node for node in page.elements if node.tag == "label"
              and node.attrs.get("for") == search.attrs.get("id")]
    require(any(node.accessible_name() for node in labels),
            f"{label}: Guide input lacks its localized label")

    i18n_path = f"/i18n/v15-{lang}.js"
    require(i18n_path in page.resource_paths("script", "src"),
            f"{label}: wrong or missing locale script")
    payload = local_file(root, i18n_path, label).read_text(encoding="utf-8")
    try:
        generated = json.loads(payload[payload.index("{"):payload.rindex("}") + 1])
    except (ValueError, json.JSONDecodeError) as error:
        raise CheckError(f"{label}: locale script is not the generated dictionary") from error
    for key in GUIDE_COPY_KEYS + PREVIEW_COPY_KEYS:
        value = copy.get(lang, {}).get(key)
        require(isinstance(value, str) and value.strip(),
                f"{label}: missing localized copy {key}")
        require(generated.get(key) == value,
                f"{label}: generated locale copy is stale for {key}; run build_v15.py")


def check_privacy_guards(root):
    headers = (root / "_headers").read_text(encoding="utf-8")
    policy = re.search(r"^\s*Content-Security-Policy:\s*(.+)$", headers, re.M)
    require(policy is not None, "Production Content-Security-Policy is missing")
    directives = {part.split()[0]: part.split()[1:]
                  for part in policy[1].split(";") if part.split()}
    require(directives.get("connect-src") == ["'none'"],
            "Guide remains local: production connect-src must remain 'none'")
    source = (root / "v15-guide.js").read_text(encoding="utf-8")
    # A narrow guard for unnecessary transport/capture APIs in this local search.
    # It is deliberately not presented as proof against every possible exfiltration.
    forbidden = {
        "fetch": r"\bfetch\s*\(",
        "XMLHttpRequest": r"\bXMLHttpRequest\b",
        "sendBeacon": r"\bsendBeacon\s*\(",
        "WebSocket": r"\bWebSocket\s*\(",
        "EventSource": r"\bEventSource\s*\(",
        "microphone/camera capture": r"\b(?:getUserMedia|mediaDevices)\b",
    }
    for name, pattern in forbidden.items():
        require(not re.search(pattern, source),
                f"Local reviewed Guide must not introduce {name}")


def check(root=ROOT):
    copy = json.loads((root / "i18n/v15.json").read_text(encoding="utf-8"))
    captures = 0
    for lang in LOCALES:
        prefix = root if lang == "en" else root / lang
        for route in ROUTES:
            path = prefix / route / "index.html"
            text = path.read_text(encoding="utf-8")
            label = path.relative_to(root).as_posix()
            require("{{" not in text, f"{label}: unresolved template copy")
            page = Page(text, label)
            for node in page.elements:
                if node.tag != "img":
                    continue
                if capture_family(node.attrs.get("src", "")) or node.within("data-slide"):
                    check_capture(root, node, label)
                    captures += 1
            check_preview_delivery(page)
            check_header(page, lang)
            check_guide_delivery(root, page, lang, copy)
    check_privacy_guards(root)
    return captures


if __name__ == "__main__":
    try:
        captures = check()
    except (CheckError, OSError, json.JSONDecodeError) as error:
        print(f"Experience check failed: {error}", file=sys.stderr)
        sys.exit(1)
    print(f"8 home/app pages: {captures} screenshot declarations, derivatives, unique IDs,")
    print("Guide inclusion, localized search copy and local-query guards passed.")
    print("Rendered phone geometry, theme contrast and motion lifecycle still need browser checks.")
