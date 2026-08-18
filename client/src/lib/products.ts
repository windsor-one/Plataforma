/**
 * Catálogo Heliot Media: base visible para todo el Personal. Administración/IT
 * puede sobrescribir cada paquete mediante documentos equivalentes en Firestore.
 */
import type { Product } from "./types";

export const defaultProducts: Product[] = [
  { id: "basic", name: "Paquete Básico", category: "tariff", price: 5, unit: "por persona", tagline: "Para momentos simples", active: true, details: [{ label: "Tiempo de entrega", value: "2 días hábiles" }, { label: "Tiempo de sesión", value: "5 minutos dirigidos" }, { label: "Fotos digitales", value: "2 fotos enviadas por WhatsApp / Drive" }, { label: "Foto impresa", value: "1 foto tamaño 5x7\" en sobre decorado" }] },
  { id: "friends-duo", name: "Paquete Amigos / Dúo", category: "tariff", price: 8, unit: "por pareja", tagline: "Ideal para compartir", active: true, details: [{ label: "Tiempo de entrega", value: "2 días hábiles" }, { label: "Tiempo de sesión", value: "10 minutos dirigidos" }, { label: "Fotos digitales", value: "4 fotos del grupo" }, { label: "Fotos impresas", value: "2 fotos (una para cada uno)" }] },
  { id: "premium-plus", name: "Premium Plus", category: "tariff", price: 10, unit: "por persona", tagline: "Captura Instantánea", active: true, details: [{ label: "Tiempo de entrega", value: "3 a 4 días hábiles" }, { label: "Tiempo de sesión", value: "20 minutos dirigidos" }, { label: "Locación", value: "Estudio o exterior" }, { label: "Entrega digital", value: "Galería con 8 fotos editadas en alta resolución" }, { label: "Entrega física", value: "1 foto 5x7\" + 2 fotos billetera" }, { label: "Empaque", value: "Sobre de cartulina Kraft decorado" }] },
  { id: "student-basic", name: "Paquete Básico", category: "promotion", price: 1, unit: "promo especial", tagline: "Especial Día del Alumno", active: true, details: [{ label: "Fotos", value: "1 fotografía digital editada" }, { label: "Entrega", value: "Entrega digital por WhatsApp o correo" }, { label: "Estilo", value: "Fondo temático Día del Alumno" }, { label: "Edición", value: "Edición de color profesional" }] },
  { id: "student-friends", name: "Paquete Amigos", category: "promotion", price: 1.75, unit: "promo especial", tagline: "Ideal para compartir", active: true, details: [{ label: "Fotos", value: "3 fotografías digitales editadas" }, { label: "Contenido", value: "Foto individual y grupal" }, { label: "Entrega", value: "Entrega digital inmediata" }, { label: "Estilo", value: "Marcos temáticos del Día del Alumno" }] },
  { id: "student-premium", name: "Paquete Premium", category: "promotion", price: 2.25, unit: "promo especial", tagline: "Para quienes desean conservar más recuerdos", active: true, details: [{ label: "Fotos", value: "5 fotografías digitales editadas" }, { label: "Variedad", value: "Diferentes poses y escenarios" }, { label: "Contenido", value: "Foto individual y grupal" }, { label: "Edición", value: "Retoque profesional" }, { label: "Extra", value: "Diseño con nombre personalizado" }] },
  { id: "heliot-star", name: "Estrella Heliot", category: "promotion", price: 3, unit: "estrella", tagline: "El paquete más completo", active: true, details: [{ label: "Fotos", value: "10 fotografías digitales editadas" }, { label: "Sesión", value: "Sesión completa de 10 minutos" }, { label: "Contenido", value: "Fotos individuales y grupales ilimitadas durante la sesión" }, { label: "Edición", value: "Edición premium" }, { label: "Diseño", value: "Diseño conmemorativo del Día del Alumno" }, { label: "Redes", value: "Fotografía destacada para redes sociales" }, { label: "Promoción grupal", value: "5 alumnos o más reciben una fotografía grupal adicional GRATIS" }] },
];

export function resolveProducts(remote: Product[]) {
  const overrides = new Map(remote.map((product) => [product.id, product]));
  const catalog = defaultProducts.map((product) => overrides.get(product.id) || product);
  return [...catalog, ...remote.filter((product) => !defaultProducts.some((item) => item.id === product.id))].filter((product) => product.active);
}
