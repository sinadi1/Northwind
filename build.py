#!/usr/bin/env python3
"""Assemble the static pages from components/ and src/.

Run:  python3 build.py
The generated .html files in the repo root are committed, so the site works
(and deploys) with no build step. This script only keeps shared markup
(header, sidebar, footer, dialogs) in one place.
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).parent
read = lambda p: (ROOT / p).read_text(encoding="utf-8")

# layout "app" = header + sidebar + footer, protected by the route guard.
# layout "auth" = centred card, no navigation, public.
PAGES = {
    "index": {
        "title": "Dashboard - Northwind Tasks", "layout": "app", "module": "js/dashboard.js",
        "sidebar": [("#metrics", "Key metrics"), ("#upcoming", "Upcoming tasks")],
    },
    "tasks": {
        "title": "Tasks - Northwind Tasks", "layout": "app", "module": "js/tasks.js",
        "scripts": ["modal", "form-validation", "char-count"],
        "dialogs": ["dialog-task", "dialog-confirm-task-delete"],
        "sidebar": [("#filters", "Search and filters"), ("#task-list-section", "Your tasks")],
    },
    "products": {
        "title": "Store - Northwind Tasks", "layout": "app", "module": "js/app.js",
        "sidebar": [("#filters", "Search and filters"), ("#products", "Products"), ("#cart", "Your cart")],
    },
    "accessibility": {
        "title": "Accessibility statement - Northwind Tasks", "layout": "app",
        "sidebar": [("#standards", "Standards followed"), ("#features", "Built-in features"), ("#feedback", "Report a problem")],
    },
    "login": {
        "title": "Sign in - Northwind Tasks", "layout": "auth", "module": "js/login.js",
        "scripts": ["form-validation"],
    },
    "register": {
        "title": "Create account - Northwind Tasks", "layout": "auth", "module": "js/register.js",
        "scripts": ["form-validation"],
    },
}

HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="{description}">
  <title>{title}</title>
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="css/style.css">
{guard}</head>
"""

APP_BODY = """<body>
  <a class="skip-link" href="#main-content">Skip to main content</a>
{header}
{sidebar}
  <main id="main-content" class="main-content" tabindex="-1">
{main}
  </main>
{footer}
{scripts}</body>
</html>
"""

AUTH_BODY = """<body class="auth-body">
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <main id="main-content" class="auth-main" tabindex="-1">
    <div class="auth-card panel">
      <p class="brand-line">Northwind Tasks</p>
{main}
    </div>
  </main>
{scripts}</body>
</html>
"""

def indent(text, n=2):
    pad = " " * n
    return "\n".join(pad + line if line.strip() else line for line in text.rstrip().splitlines())

for key, cfg in PAGES.items():
    is_app = cfg["layout"] == "app"
    main = read(f"src/{key}.main.html")
    dialogs = "\n".join(indent(read(f"components/{d}.html"), 4) for d in cfg.get("dialogs", []))
    main = main.replace("    <!--DIALOGS-->", dialogs).rstrip()

    names = list(cfg.get("scripts", []))
    if is_app:
        names += ["session-ui", "theme-toggle"]
    else:
        names += ["theme-toggle"]
    scripts = "".join(f'  <script src="js/components/{s}.js" defer></script>\n' for s in names)
    if cfg.get("module"):
        scripts += f'  <script type="module" src="{cfg["module"]}"></script>\n'

    head = HEAD.format(
        title=cfg["title"],
        description="Northwind Tasks: a task manager and storefront capstone built with semantic HTML, responsive CSS and vanilla JavaScript.",
        guard='  <script src="js/guard.js"></script>\n' if is_app else "",
    )

    if is_app:
        header = read("components/header.html")
        header = re.sub(r"\{\{cur:(\w+)\}\}", lambda m: ' aria-current="page"' if m.group(1) == key else "", header)
        links = "\n".join(f'      <li><a href="{h}">{t}</a></li>' for h, t in cfg["sidebar"])
        sidebar = read("components/sidebar.html").replace("{{sidebar_links}}", links)
        body = APP_BODY.format(header=indent(header), sidebar=indent(sidebar), main=main,
                               footer=indent(read("components/footer.html")), scripts=scripts)
    else:
        body = AUTH_BODY.format(main=main, scripts=scripts)

    (ROOT / f"{key}.html").write_text(head + body, encoding="utf-8")
    print("built", f"{key}.html")
