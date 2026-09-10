"""One-time script to seed the Supabase tables with sample data for Stage 3 testing.

Run after applying schema.sql in the Supabase SQL Editor:
    python seed.py
"""

from datetime import date, timedelta

import db


def seed() -> None:
    print("Seeding household_info...")
    db.add_household_info("Wifi", "Home Network", "SSID: HomeNet | Password: changeme123")
    db.add_household_info("Contacts", "Plumber", "Joe's Plumbing -- (555) 012-3456")

    print("Seeding todo_lists + todo_items...")
    errands = db.add_todo_list("Weekend errands")
    db.add_todo_item(errands["id"], "Pick up dry cleaning")
    db.add_todo_item(errands["id"], "Return library books")

    print("Seeding grocery_items...")
    db.add_grocery_item("Milk", "1 gallon", "Matt")
    db.add_grocery_item("Eggs", "1 dozen", "Wife")

    print("Seeding meal_plan...")
    db.add_meal_plan_entry(str(date.today() + timedelta(days=1)), "Tacos", "Use up leftover chicken")

    # Inventory stage was cut (2026-09-08) — no seed data. Table + db.py helpers
    # kept in case it's added back later.

    print("Seeding notes...")
    db.add_note("Welcome", "This is the household notes page. Add anything worth remembering here.")

    print("Done.")


if __name__ == "__main__":
    seed()
