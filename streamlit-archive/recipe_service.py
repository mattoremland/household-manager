"""Scrape ingredients from a recipe URL — no AI, uses the recipe-scrapers library.

Shared by the Grocery & Meals page and (later) the AI assistant's tools.
recipe-scrapers has dedicated parsers for hundreds of recipe sites and falls
back to schema.org / JSON-LD metadata (wild_mode) for the rest.
"""

import requests
from recipe_scrapers import scrape_html

_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; HouseholdManager/1.0)"}


class RecipeScrapeError(Exception):
    """Raised when a URL can't be fetched or no ingredients could be found."""


def scrape_recipe(url: str) -> dict:
    """Return {"title": str | None, "ingredients": list[str]} for a recipe URL.

    Raises RecipeScrapeError on a network failure, a non-recipe page, or an
    empty ingredient list.
    """
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=15)
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise RecipeScrapeError(f"Couldn't open that link: {exc}") from exc

    try:
        scraper = scrape_html(resp.text, org_url=url, wild_mode=True)
        ingredients = [i.strip() for i in scraper.ingredients() if i and i.strip()]
    except Exception as exc:  # recipe-scrapers raises a variety of parse errors
        raise RecipeScrapeError("Couldn't read a recipe from that page.") from exc

    if not ingredients:
        raise RecipeScrapeError("No ingredients found on that page.")

    try:
        title = scraper.title() or None
    except Exception:
        title = None

    return {"title": title, "ingredients": ingredients}
