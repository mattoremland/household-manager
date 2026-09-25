// Pure data + matching, no Supabase client, so the assistant Netlify Function can import it too.

export const SECTION_ORDER = [
  'produce',
  'deli',
  'seafood',
  'meat',
  'medicine / toiletries',
  'baking',
  'canned goods / sauces / condiments',
  'soda and water',
  'breakfast',
  'bread',
  'frozen',
  'dairy',
  'bjs',
  'other',
]

export const STORE_ONLY_SECTIONS = new Set(['bjs'])

export const SECTION_LABELS = {
  'produce': 'Produce',
  'deli': 'Deli',
  'seafood': 'Seafood',
  'meat': 'Meat',
  'medicine / toiletries': 'Medicine / Toiletries',
  'baking': 'Baking',
  'canned goods / sauces / condiments': 'Canned Goods / Sauces / Condiments',
  'soda and water': 'Soda and Water',
  'breakfast': 'Breakfast',
  'bread': 'Bread',
  'frozen': 'Frozen',
  'dairy': 'Dairy',
  'bjs': "BJ's",
  'other': 'Other',
}

const KEYWORD_MAP = {
  produce: [
    'apple', 'apples', 'avocado', 'banana', 'bananas', 'basil', 'bell pepper',
    'berries', 'blueberries', 'broccoli', 'cabbage', 'carrot', 'carrots',
    'celery', 'cilantro', 'corn', 'cucumber', 'fruit', 'garlic', 'ginger',
    'grape', 'grapes', 'green beans', 'green onion', 'herbs', 'jalapeño',
    'kale', 'lemon', 'lemons', 'lettuce', 'lime', 'limes', 'mango',
    'mushroom', 'mushrooms', 'onion', 'onions', 'orange', 'oranges',
    'parsley', 'peach', 'peaches', 'pear', 'pears', 'pepper', 'peppers',
    'pineapple', 'potato', 'potatoes', 'raspberries', 'romaine', 'salad',
    'scallion', 'scallions', 'spinach', 'squash', 'strawberries',
    'sweet potato', 'sweet potatoes', 'tomato', 'tomatoes', 'watermelon',
    'zucchini',
  ],
  deli: [
    'deli', 'deli meat', 'ham', 'hummus', 'lunch meat', 'prosciutto',
    'rotisserie', 'salami', 'sliced turkey', 'turkey breast',
  ],
  seafood: [
    'clam', 'clams', 'cod', 'crab', 'fish', 'lobster', 'mahi', 'mussels',
    'salmon', 'scallops', 'shrimp', 'tilapia', 'tuna',
  ],
  meat: [
    'bacon', 'beef', 'brisket', 'chicken', 'chicken breast', 'chicken thigh',
    'ground beef', 'ground turkey', 'hot dog', 'hot dogs', 'lamb', 'meatball',
    'pork', 'pork chop', 'ribs', 'sausage', 'steak', 'turkey',
  ],
  'medicine / toiletries': [
    'advil', 'aspirin', 'band-aid', 'body wash', 'conditioner', 'cough',
    'deodorant', 'floss', 'ibuprofen', 'lotion', 'medicine', 'mouthwash',
    'razors', 'shampoo', 'soap', 'sunscreen', 'tissues', 'toilet paper',
    'toothbrush', 'toothpaste', 'tylenol', 'vitamins',
  ],
  baking: [
    'baking powder', 'baking soda', 'brown sugar', 'chocolate chips',
    'cocoa', 'cornstarch', 'flour', 'powdered sugar', 'sprinkles', 'sugar',
    'vanilla', 'vanilla extract', 'yeast',
  ],
  'canned goods / sauces / condiments': [
    'bbq sauce', 'broth', 'canned beans', 'canned tomatoes', 'chicken broth',
    'coconut milk', 'hot sauce', 'ketchup', 'marinara', 'mayo', 'mayonnaise',
    'mustard', 'olive oil', 'pasta sauce', 'peanut butter', 'pickle',
    'pickles', 'ranch', 'salsa', 'soy sauce', 'sriracha', 'stock',
    'tomato paste', 'tomato sauce', 'vegetable broth', 'vinegar',
    'worcestershire',
  ],
  'soda and water': [
    'coca-cola', 'coke', 'dr pepper', 'gatorade', 'juice', 'la croix',
    'lemonade', 'pepsi', 'seltzer', 'soda', 'sparkling water', 'sprite',
    'water', 'water bottles',
  ],
  breakfast: [
    'cereal', 'cheerios', 'eggs', 'granola', 'grits', 'instant oatmeal',
    'maple syrup', 'oatmeal', 'oats', 'pancake mix', 'pancakes', 'syrup',
    'waffle', 'waffles',
  ],
  bread: [
    'bagel', 'bagels', 'baguette', 'bread', 'brioche', 'buns', 'croissant',
    'english muffin', 'hamburger buns', 'hot dog buns', 'naan', 'pita',
    'rolls', 'sourdough', 'tortilla', 'tortillas', 'wraps',
  ],
  frozen: [
    'frozen', 'frozen chicken', 'frozen fries', 'frozen pizza',
    'frozen vegetables', 'frozen veggies', 'ice cream', 'ice pops',
    'popsicles', 'tater tots',
  ],
  dairy: [
    'almond milk', 'butter', 'cheddar', 'cheese', 'cottage cheese',
    'cream', 'cream cheese', 'creamer', 'egg', 'feta', 'greek yogurt',
    'half and half', 'heavy cream', 'milk', 'mozzarella', 'oat milk',
    'parmesan', 'ricotta', 'shredded cheese', 'sour cream', 'whipped cream',
    'yogurt',
  ],
}

const keywordIndex = new Map()
for (const [category, keywords] of Object.entries(KEYWORD_MAP)) {
  for (const kw of keywords) {
    keywordIndex.set(kw.toLowerCase(), category)
  }
}

export function normalizeItemName(itemName) {
  return itemName.toLowerCase().trim()
}

export function matchStaticKeyword(itemName) {
  const name = normalizeItemName(itemName)
  if (keywordIndex.has(name)) return keywordIndex.get(name)
  for (const [kw, cat] of keywordIndex) {
    if (name.includes(kw) || kw.includes(name)) return cat
  }
  return null
}

// Learned mappings (from the user moving items between sections) win over keywords.
export async function categorizeWith(supabase, itemName) {
  const normalized = normalizeItemName(itemName)
  const { data } = await supabase
    .from('grocery_category_mappings')
    .select('category')
    .eq('item_name', normalized)
    .maybeSingle()
  if (data) return data.category
  return matchStaticKeyword(normalized) || 'other'
}

export async function nextSortOrder(supabase, category) {
  const { data } = await supabase
    .from('grocery_items')
    .select('sort_order')
    .eq('category', category)
    .eq('is_checked', false)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.sort_order ?? 0) + 1
}
