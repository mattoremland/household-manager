"""Data-access layer for Supabase — shared by every page's UI and, later, the AI assistant's tools.

Every function returns/accepts plain dicts (Supabase rows), no ORM models.
"""

import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

supabase: Client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# --- Household Info ---

def list_household_info(category: str | None = None) -> list[dict]:
    query = supabase.table("household_info").select("*").order("category")
    if category:
        query = query.eq("category", category)
    return query.execute().data


def search_household_info(text: str) -> list[dict]:
    return (
        supabase.table("household_info")
        .select("*")
        .or_(f"title.ilike.%{text}%,content.ilike.%{text}%")
        .execute()
        .data
    )


def add_household_info(category: str, title: str, content: str) -> dict:
    row = {"category": category, "title": title, "content": content}
    return supabase.table("household_info").insert(row).execute().data[0]


def update_household_info(item_id: int, **fields) -> dict:
    fields["updated_at"] = _now()
    return supabase.table("household_info").update(fields).eq("id", item_id).execute().data[0]


def delete_household_info(item_id: int) -> None:
    supabase.table("household_info").delete().eq("id", item_id).execute()


# --- To-Do lists ---

def list_todo_lists() -> list[dict]:
    return supabase.table("todo_lists").select("*").execute().data


def add_todo_list(name: str) -> dict:
    return supabase.table("todo_lists").insert({"name": name}).execute().data[0]


def rename_todo_list(list_id: int, name: str) -> dict:
    return supabase.table("todo_lists").update({"name": name}).eq("id", list_id).execute().data[0]


def delete_todo_list(list_id: int) -> None:
    supabase.table("todo_lists").delete().eq("id", list_id).execute()


def list_todo_items(list_id: int) -> list[dict]:
    return (
        supabase.table("todo_items")
        .select("*")
        .eq("list_id", list_id)
        .order("created_at")
        .execute()
        .data
    )


def add_todo_item(list_id: int, text: str, tag: str | None = None) -> dict:
    row = {"list_id": list_id, "text": text, "tag": tag}
    return supabase.table("todo_items").insert(row).execute().data[0]


def set_todo_item_done(item_id: int, is_done: bool) -> dict:
    return supabase.table("todo_items").update({"is_done": is_done}).eq("id", item_id).execute().data[0]


def update_todo_item(item_id: int, **fields) -> dict:
    return supabase.table("todo_items").update(fields).eq("id", item_id).execute().data[0]


def delete_todo_item(item_id: int) -> None:
    supabase.table("todo_items").delete().eq("id", item_id).execute()


def clear_checked_todo_items(list_id: int) -> None:
    supabase.table("todo_items").delete().eq("list_id", list_id).eq("is_done", True).execute()


# --- Grocery items ---

def list_grocery_items() -> list[dict]:
    return supabase.table("grocery_items").select("*").order("id").execute().data


def add_grocery_item(name: str, quantity: str = "", added_by: str = "") -> dict:
    row = {"name": name, "quantity": quantity, "added_by": added_by}
    return supabase.table("grocery_items").insert(row).execute().data[0]


def set_grocery_item_checked(item_id: int, is_checked: bool) -> dict:
    return (
        supabase.table("grocery_items")
        .update({"is_checked": is_checked})
        .eq("id", item_id)
        .execute()
        .data[0]
    )


def delete_grocery_item(item_id: int) -> None:
    supabase.table("grocery_items").delete().eq("id", item_id).execute()


def clear_checked_grocery_items() -> None:
    supabase.table("grocery_items").delete().eq("is_checked", True).execute()


def add_ingredients_to_grocery_list(
    ingredients: list[str], added_by: str | None = None
) -> list[dict]:
    """Add each ingredient as a grocery item, skipping any name already present as
    an unchecked item (case-insensitive). Returns the rows that were actually added.

    Shared by the Grocery & Meals page and (later) the AI assistant's tools.
    """
    existing = {
        i["name"].strip().lower()
        for i in list_grocery_items()
        if not i["is_checked"] and i.get("name")
    }
    added: list[dict] = []
    for raw in ingredients:
        name = raw.strip()
        if not name or name.lower() in existing:
            continue
        added.append(add_grocery_item(name, "", added_by or ""))
        existing.add(name.lower())
    return added


# --- Meal plan ---

def list_meal_plan() -> list[dict]:
    return supabase.table("meal_plan").select("*").order("date").execute().data


def add_meal_plan_entry(
    date: str,
    meal_name: str,
    notes: str | None = None,
    ingredients: str | None = None,
    source_url: str | None = None,
) -> dict:
    row = {
        "date": date,
        "meal_name": meal_name,
        "notes": notes,
        "ingredients": ingredients,
        "source_url": source_url,
    }
    return supabase.table("meal_plan").insert(row).execute().data[0]


def update_meal_plan_entry(entry_id: int, **fields) -> dict:
    return supabase.table("meal_plan").update(fields).eq("id", entry_id).execute().data[0]


def delete_meal_plan_entry(entry_id: int) -> None:
    supabase.table("meal_plan").delete().eq("id", entry_id).execute()


# --- Inventory ---
# The Inventory UI page was cut on 2026-09-08 (not needed for now). These helpers
# and the `inventory` table are kept intact so the feature can be re-added later
# without a migration. Nothing in the app currently calls them.

def list_inventory() -> list[dict]:
    return supabase.table("inventory").select("*").execute().data


def add_inventory_item(
    item_name: str,
    purchase_date: str | None = None,
    warranty_expiry: str | None = None,
    serial_number: str | None = None,
    notes: str | None = None,
) -> dict:
    row = {
        "item_name": item_name,
        "purchase_date": purchase_date,
        "warranty_expiry": warranty_expiry,
        "serial_number": serial_number,
        "notes": notes,
    }
    return supabase.table("inventory").insert(row).execute().data[0]


def update_inventory_item(item_id: int, **fields) -> dict:
    return supabase.table("inventory").update(fields).eq("id", item_id).execute().data[0]


def delete_inventory_item(item_id: int) -> None:
    supabase.table("inventory").delete().eq("id", item_id).execute()


# --- Notes ---

def list_notes() -> list[dict]:
    return supabase.table("notes").select("*").order("updated_at", desc=True).execute().data


def search_notes(text: str) -> list[dict]:
    return (
        supabase.table("notes")
        .select("*")
        .or_(f"title.ilike.%{text}%,body.ilike.%{text}%")
        .execute()
        .data
    )


def add_note(title: str, body: str) -> dict:
    return supabase.table("notes").insert({"title": title, "body": body}).execute().data[0]


def update_note(note_id: int, **fields) -> dict:
    fields["updated_at"] = _now()
    return supabase.table("notes").update(fields).eq("id", note_id).execute().data[0]


def delete_note(note_id: int) -> None:
    supabase.table("notes").delete().eq("id", note_id).execute()
