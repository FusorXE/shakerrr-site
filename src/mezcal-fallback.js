// Only used after exact recipe images and the online lookup fail.
// Real Pexels photographs of mezcal drinks, clearly labeled as illustrative.
// Never introduce these photos as verified pictures of a named cocktail.
const MEZCAL_PHOTOS = [
  {
    path: "https://images.pexels.com/photos/34222954/pexels-photo-34222954.jpeg?auto=compress&cs=tinysrgb&h=627&fit=crop&w=1200",
    sourceUrl: "https://www.pexels.com/photo/refreshing-mezcal-cocktail-with-chili-and-lime-34222954/",
    photographer: "Angel Rkaoz",
    category: "citrus",
  },
  {
    path: "https://images.pexels.com/photos/19841844/pexels-photo-19841844.jpeg?auto=compress&cs=tinysrgb&h=627&fit=crop&w=1200",
    sourceUrl: "https://www.pexels.com/photo/drink-by-bottle-of-alcohol-19841844/",
    photographer: "Jonathan Reynaga",
    category: "spirit",
  },
  {
    path: "https://images.pexels.com/photos/27585455/pexels-photo-27585455.jpeg?auto=compress&cs=tinysrgb&h=627&fit=crop&w=1200",
    sourceUrl: "https://www.pexels.com/photo/la-tizateria-27585455/",
    photographer: "Joyboy",
    category: "refreshing",
  },
  {
    path: "https://images.pexels.com/photos/15866910/pexels-photo-15866910.jpeg?auto=compress&cs=tinysrgb&h=627&fit=crop&w=1200",
    sourceUrl: "https://www.pexels.com/photo/cocktail-and-bottle-of-alcohol-on-table-15866910/",
    photographer: "Tim Durand",
    category: "bottle",
  },
];
export function mezcalIllustrativePhoto(recipe) {
  if (!recipe) return null;
  const ingredients = (recipe.ingredients || []).map(x => x.name).join(" ");
  const kind = [recipe.name, ingredients, ...(recipe.tags || [])].join(" ").toLowerCase();
  if (recipe.category !== "Mezcal" && !/mezcal/i.test(kind)) return null;
  const category = /paloma|mule|fizz|grapefruit|cucumber|pepino|mint|swizzle/.test(kind)
    ? "refreshing"
    : /pepper|chile|spicy|jalape|lime|margarita|citrus/.test(kind)
      ? "citrus"
      : /old.fashioned|negroni|martini|manhattan|vermouth|bitters/.test(kind)
        ? "spirit" : "bottle";
  const match = MEZCAL_PHOTOS.find(photo => photo.category === category);
  return match ? {
    url: match.path,
    credit: "Illustrative mezcal photograph, not this exact recipe · Pexels · " + match.photographer,
    sourceUrl: match.sourceUrl,
    illustrative: true,
  } : null;
}
