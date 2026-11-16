"""Export acquisition prototypes as self-contained HTML documents."""
from pathlib import Path
import base64
import html as html_entities
import re
import urllib.request
import zipfile

root = Path(__file__).resolve().parents[1]
source = root / "artifacts/dtp-portal/public/mockups"
target = root / "generated-artifacts/acquisto-e-avvio"
target.mkdir(parents=True, exist_ok=True)
pages = [
    "vetrina-V01-catalogo.html",
    "vetrina-V02-contratto.html",
    "cliente-PS01-delegati.html",
    "cliente-PS02-soglie.html",
    "cliente-H-catalogo.html",
]

def fetch(url):
    with urllib.request.urlopen(url, timeout=30) as response:
        return response.read()

font_cache = {}
def font_data(match):
    url = match.group(1).strip("'\"")
    if url not in font_cache:
        font_cache[url] = base64.b64encode(fetch(url)).decode()
    mime = "font/ttf" if ".ttf" in url else "font/woff2"
    return "url(data:" + mime + ";base64," + font_cache[url] + ")"
font_stylesheets = {}
def embedded_fonts(document):
    urls = re.findall(r'<link\b[^>]*href="(https://fonts.googleapis.com/css[^"]+)"[^>]*>', document)
    styles = []
    for raw_url in urls:
        url = html_entities.unescape(raw_url)
        if url not in font_stylesheets:
            css = fetch(url).decode()
            font_stylesheets[url] = re.sub(r"url\((https://[^)]+)\)", font_data, css)
        styles.append(font_stylesheets[url])
    return "\n".join(styles)

icon = base64.b64encode((source.parent / "favicon.svg").read_bytes()).decode()
for page in pages:
    html = (source / page).read_text()
    font_css = embedded_fonts(html)
    html = re.sub(r'<link\b[^>]*href="https://fonts\.[^"]+"[^>]*>', "", html)
    html = html.replace("</head>", "<style>" + font_css + "</style>\n</head>")
    html = html.replace('href="../favicon.svg"', 'href="data:image/svg+xml;base64,' + icon + '"')
    html = re.sub(
        r'<link rel="stylesheet" href="([^"]+)">',
        lambda m: "<style>\n" + (source / m[1]).read_text() + "\n</style>", html)
    html = re.sub(
        r'<script src="([^"]+)"></script>',
        lambda m: "<script>\n" + re.sub(r"</script", r"<\\/script", (source / m[1]).read_text(), flags=re.I) + "\n</script>", html)
    assert not re.search(r'<script[^>]+src=|<link[^>]+href="(?!data:)', html)
    (target / page).write_text(html)
    print(page, len(html.encode()), "bytes")

(target / "LEGGIMI.txt").write_text(
    "ACQUISTO E AVVIO — Digital Trust Platform\n\n"
    "Estrai tutti i file nella stessa cartella e apri vetrina-V01-catalogo.html.\n"
    "Ogni HTML include stili, font e JavaScript, anche il generatore PDF di V-02.\n"
    "Percorso: vetrina → richiesta → attesa verifica. Dopo attivazione e primo login\n"
    "del Rappresentante Legale: PS-01 → PS-02 → homepage cliente.\n"
    "Login, invio, verifica ed email sono dimostrativi, non servizi reali.\n"
    "Le pagine PS-01 e PS-02 si aprono direttamente per esplorare il setup.\n"
    "I link della homepage verso dashboard fuori da questa sezione non sono inclusi.\n"
)
archive = target.parent / "acquisto-e-avvio.zip"
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
    for path in sorted(target.iterdir()):
        z.write(path, path.name)
print(archive.relative_to(root))
