import { type CategoryIconKey } from "./category-icons";

export type SuggestionConfidence = "high" | "medium" | "low";

export type SuggestionResult = {
  primary: CategoryIconKey;
  suggestions: CategoryIconKey[];
  confidence: SuggestionConfidence;
  matchedOn?: string;
};

// Bilingual keyword dictionary (ES/EN)
const KEYWORD_MAP: Record<string, CategoryIconKey> = {
  // Food & Dining
  comida: "ForkKnife",
  food: "ForkKnife",
  restaurante: "ForkKnife",
  restaurant: "ForkKnife",
  bar: "ForkKnife",
  cafe: "ForkKnife",
  coffee: "ForkKnife",
  almuerzo: "ForkKnife",
  lunch: "ForkKnife",
  cena: "ForkKnife",
  dinner: "ForkKnife",
  desayuno: "ForkKnife",
  breakfast: "ForkKnife",

  // Groceries & Shopping
  groceries: "ShoppingCart",
  supermercado: "ShoppingCart",
  mercado: "ShoppingCart",
  market: "ShoppingCart",
  compras: "ShoppingCart",
  shopping: "ShoppingCart",
  tienda: "Storefront",
  store: "Storefront",
  ropa: "TShirt",
  clothes: "TShirt",
  clothing: "TShirt",
  moda: "TShirt",
  fashion: "TShirt",
  bolso: "Handbag",
  bag: "Handbag",
  accesorios: "Handbag",
  accessories: "Handbag",

  // Housing
  hogar: "House",
  casa: "House",
  home: "House",
  alquiler: "House",
  rent: "House",
  hipoteca: "House",
  mortgage: "House",
  vivienda: "House",
  housing: "House",
  apartamento: "Buildings",
  apartment: "Buildings",
  edificio: "Buildings",
  building: "Buildings",
  muebles: "Couch",
  furniture: "Couch",
  sofa: "Couch",
  cama: "Bed",
  bed: "Bed",
  dormitorio: "Bed",
  bedroom: "Bed",
  limpieza: "Broom",
  cleaning: "Broom",

  // Transportation
  gasolina: "GasPump",
  fuel: "GasPump",
  gas: "GasPump",
  combustible: "GasPump",
  coche: "Car",
  auto: "Car",
  car: "Car",
  vehiculo: "Car",
  vehicle: "Car",
  parking: "Car",
  estacionamiento: "Car",
  bus: "Bus",
  autobus: "Bus",
  metro: "Train",
  tren: "Train",
  train: "Train",
  subway: "Train",
  avion: "Airplane",
  flight: "Airplane",
  vuelo: "Airplane",
  viaje: "Airplane",
  travel: "Airplane",
  vacaciones: "Airplane",
  vacation: "Airplane",
  entrada: "Ticket",
  entradas: "Ticket",
  ticket: "Ticket",
  evento: "Ticket",
  event: "Ticket",
  concierto: "Ticket",
  concert: "Ticket",

  // Health & Wellness
  salud: "Heart",
  health: "Heart",
  bienestar: "Heart",
  wellness: "Heart",
  medico: "Stethoscope",
  doctor: "Stethoscope",
  hospital: "FirstAidKit",
  clinica: "FirstAidKit",
  clinic: "FirstAidKit",
  emergencia: "FirstAidKit",
  emergency: "FirstAidKit",
  farmacia: "Pill",
  pharmacy: "Pill",
  medicamento: "Pill",
  medicine: "Pill",
  medicinas: "Pill",
  seguro: "FirstAidKit",
  insurance: "FirstAidKit",

  // Finance & Banking
  banco: "Bank",
  bank: "Bank",
  ahorro: "PiggyBank",
  savings: "PiggyBank",
  ahorros: "PiggyBank",
  inversion: "PiggyBank",
  investment: "PiggyBank",
  tarjeta: "CreditCard",
  card: "CreditCard",
  credito: "CreditCard",
  credit: "CreditCard",
  debito: "CreditCard",
  debit: "CreditCard",
  factura: "Receipt",
  bill: "Receipt",
  bills: "Receipt",
  facturas: "Receipt",
  recibo: "Receipt",
  receipt: "Receipt",
  suscripcion: "Receipt",
  subscription: "Receipt",
  mensualidad: "Receipt",
  cartera: "Wallet",
  wallet: "Wallet",
  efectivo: "Wallet",
  cash: "Wallet",

  // Work & Business
  trabajo: "Briefcase",
  work: "Briefcase",
  oficina: "Briefcase",
  office: "Briefcase",
  salario: "Briefcase",
  salary: "Briefcase",
  sueldo: "Briefcase",
  nomina: "Briefcase",
  payroll: "Briefcase",
  ingreso: "Briefcase",
  income: "Briefcase",
  negocio: "Briefcase",
  business: "Briefcase",
  freelance: "Briefcase",
  empleo: "Briefcase",
  job: "Briefcase",

  // Education
  educacion: "GraduationCap",
  education: "GraduationCap",
  escuela: "GraduationCap",
  school: "GraduationCap",
  universidad: "GraduationCap",
  university: "GraduationCap",
  colegio: "GraduationCap",
  college: "GraduationCap",
  curso: "GraduationCap",
  course: "GraduationCap",
  clases: "GraduationCap",
  classes: "GraduationCap",
  libro: "BookOpen",
  book: "BookOpen",
  libros: "BookOpen",
  books: "BookOpen",
  lectura: "BookOpen",
  reading: "BookOpen",

  // Entertainment
  entretenimiento: "FilmSlate",
  entertainment: "FilmSlate",
  ocio: "GameController",
  hobby: "GameController",
  diversion: "GameController",
  fun: "GameController",
  leisure: "GameController",
  cine: "FilmSlate",
  movie: "FilmSlate",
  movies: "FilmSlate",
  pelicula: "FilmSlate",
  peliculas: "FilmSlate",
  netflix: "FilmSlate",
  streaming: "FilmSlate",
  teatro: "FilmSlate",
  musica: "MusicNotes",
  music: "MusicNotes",
  spotify: "MusicNotes",
  juego: "GameController",
  juegos: "GameController",
  game: "GameController",
  games: "GameController",
  gaming: "GameController",
  videojuegos: "GameController",

  // Sports & Fitness
  deporte: "Basketball",
  sport: "Basketball",
  sports: "Basketball",
  deportes: "Basketball",
  futbol: "Basketball",
  football: "Basketball",
  soccer: "Basketball",
  basket: "Basketball",
  basketball: "Basketball",
  gym: "Barbell",
  gimnasio: "Barbell",
  fitness: "Barbell",
  ejercicio: "Barbell",
  exercise: "Barbell",
  entrenamiento: "Barbell",
  training: "Barbell",

  // Utilities & Tech
  luz: "Lightbulb",
  electricity: "Lightbulb",
  electricidad: "Lightbulb",
  energia: "Lightbulb",
  energy: "Lightbulb",
  agua: "Plug",
  water: "Plug",
  servicios: "Plug",
  utilities: "Plug",
  internet: "WifiHigh",
  wifi: "WifiHigh",
  red: "WifiHigh",
  network: "WifiHigh",
  telefono: "Phone",
  phone: "Phone",
  movil: "Phone",
  mobile: "Phone",
  celular: "Phone",
  cell: "Phone",
  tecnologia: "Laptop",
  tech: "Laptop",
  technology: "Laptop",
  computadora: "Laptop",
  computer: "Laptop",
  ordenador: "Laptop",
  portatil: "Laptop",
  laptop: "Laptop",
  pantalla: "Monitor",
  monitor: "Monitor",
  tv: "Monitor",
  television: "Monitor",
  foto: "Camera",
  photo: "Camera",
  fotografia: "Camera",
  photography: "Camera",
  camara: "Camera",
  camera: "Camera",

  // Tools & Maintenance
  reparacion: "Wrench",
  repair: "Wrench",
  mantenimiento: "Wrench",
  maintenance: "Wrench",
  herramienta: "Hammer",
  herramientas: "Hammer",
  tool: "Hammer",
  tools: "Hammer",
  bricolaje: "Hammer",
  diy: "Hammer",
  configuracion: "Gear",
  settings: "Gear",
  config: "Gear",
  peluqueria: "Scissors",
  hairdresser: "Scissors",
  barberia: "Scissors",
  barber: "Scissors",
  belleza: "Scissors",
  beauty: "Scissors",

  // Nature & Pets
  mascota: "PawPrint",
  mascotas: "PawPrint",
  pet: "PawPrint",
  pets: "PawPrint",
  perro: "PawPrint",
  dog: "PawPrint",
  gato: "PawPrint",
  cat: "PawPrint",
  veterinario: "PawPrint",
  vet: "PawPrint",
  jardin: "Leaf",
  garden: "Leaf",
  plantas: "Leaf",
  plants: "Leaf",
  naturaleza: "Tree",
  nature: "Tree",
  parque: "Tree",
  park: "Tree",

  // Social & Family
  familia: "UsersThree",
  family: "UsersThree",
  pareja: "UsersThree",
  amigos: "UsersThree",
  friends: "UsersThree",
  social: "UsersThree",
  regalo: "Gift",
  regalos: "Gift",
  gift: "Gift",
  gifts: "Gift",
  presente: "Gift",
  cumple: "Gift",
  cumpleanos: "Gift",
  birthday: "Gift",
  navidad: "Gift",
  christmas: "Gift",

  // Children & Childhood
  nino: "UsersThree",
  ninos: "UsersThree",
  hijo: "UsersThree",
  hija: "UsersThree",
  guarderia: "UsersThree",
  kids: "UsersThree",
  kid: "UsersThree",
  child: "UsersThree",
  children: "UsersThree",
  infancia: "Gift",
  childhood: "Gift",
  juguete: "Gift",
  juguetes: "Gift",
  toy: "Gift",
  toys: "Gift",
};

const CHILD_KEYWORDS = new Set([
  "nino",
  "ninos",
  "hijo",
  "hija",
  "guarderia",
  "kids",
  "kid",
  "child",
  "children",
  "infancia",
  "childhood",
  "juguete",
  "juguetes",
  "toy",
  "toys",
]);

const CHILD_SUGGESTIONS: CategoryIconKey[] = [
  "UsersThree",
  "Gift",
  "BookOpen",
];

/**
 * Normalize input text: lowercase, trim, remove accents, split by separators
 */
function normalizeText(input: string): string[] {
  const normalized = input
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Remove diacritics

  // Split by common separators
  return normalized.split(/[\s/\-_,&]+/).filter(Boolean);
}

/**
 * Default suggestions when no match is found
 */
const DEFAULT_SUGGESTIONS: CategoryIconKey[] = [
  "Tag",
  "House",
  "ShoppingCart",
  "ForkKnife",
  "Car",
  "Receipt",
];

/**
 * Suggest a category icon based on the category name.
 *
 * @param inputName - The category name to analyze
 * @returns A suggestion result with primary icon, alternatives, and confidence level
 */
export function suggestCategoryIcon(inputName: string): SuggestionResult {
  if (!inputName || inputName.trim().length === 0) {
    return {
      primary: "Tag",
      suggestions: DEFAULT_SUGGESTIONS,
      confidence: "low",
    };
  }

  const tokens = normalizeText(inputName);

  // Try exact keyword matches
  for (const token of tokens) {
    const match = KEYWORD_MAP[token];
    if (match) {
      const isChildKeyword = CHILD_KEYWORDS.has(token);
      const suggestions = isChildKeyword
        ? [match, ...CHILD_SUGGESTIONS.filter((icon) => icon !== match)]
        : [match];
      return {
        primary: match,
        suggestions,
        confidence: isChildKeyword ? "medium" : "high",
        matchedOn: token,
      };
    }
  }

  // Try partial matches (keyword contains token or vice versa)
  const partialMatches: CategoryIconKey[] = [];
  const seenIcons = new Set<CategoryIconKey>();

  for (const token of tokens) {
    if (token.length < 3) continue; // Skip very short tokens

    for (const [keyword, iconKey] of Object.entries(KEYWORD_MAP)) {
      if (
        (keyword.includes(token) || token.includes(keyword)) &&
        !seenIcons.has(iconKey)
      ) {
        partialMatches.push(iconKey);
        seenIcons.add(iconKey);
      }
    }
  }

  if (partialMatches.length > 0) {
    const primary = partialMatches[0];
    if (primary) {
      return {
        primary,
        suggestions: partialMatches.slice(0, 6),
        confidence: "medium",
        matchedOn: tokens.join(" "),
      };
    }
  }

  // Fallback: return defaults
  return {
    primary: "Tag",
    suggestions: DEFAULT_SUGGESTIONS,
    confidence: "low",
  };
}
