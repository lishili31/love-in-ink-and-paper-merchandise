export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  image: string;
  excelRow: number;
};

export const products: Product[] = [
  { id: "envelope-blue", name: "蓝色款信封", category: "信封", price: 2.5, unit: "封", image: "/images/products/envelope-blue.jpg", excelRow: 2 },
  { id: "envelope-green", name: "绿色款信封", category: "信封", price: 2.5, unit: "封", image: "/images/products/envelope-green.jpg", excelRow: 3 },
  { id: "letter-paper", name: "信纸", category: "信纸", price: 1, unit: "张", image: "/images/products/letter-paper.jpg", excelRow: 4 },
  { id: "wax-seal", name: "封口贴（火漆贴纸）", category: "封口贴", price: 0.5, unit: "个", image: "/images/products/wax-seal.jpg", excelRow: 5 },
  { id: "postcard-a1", name: "明信片 A 款①", category: "长方形猫猫", price: 1.5, unit: "张", image: "/images/products/postcard-a1.jpg", excelRow: 6 },
  { id: "postcard-a2", name: "明信片 A 款②", category: "长方形猫猫", price: 1.5, unit: "张", image: "/images/products/postcard-a2.jpg", excelRow: 7 },
  { id: "postcard-a3", name: "明信片 A 款③", category: "长方形猫猫", price: 1.5, unit: "张", image: "/images/products/postcard-a3.jpg", excelRow: 8 },
  { id: "postcard-b1", name: "明信片 B 款①", category: "建筑风景", price: 1.5, unit: "张", image: "/images/products/postcard-b1.jpg", excelRow: 9 },
  { id: "postcard-b2", name: "明信片 B 款②", category: "建筑风景", price: 1.5, unit: "张", image: "/images/products/postcard-b2.jpg", excelRow: 10 },
  { id: "postcard-b3", name: "明信片 B 款③", category: "建筑风景", price: 1.5, unit: "张", image: "/images/products/postcard-b3.jpg", excelRow: 11 },
  { id: "postcard-c1", name: "明信片 C 款①", category: "异形猫猫", price: 1.5, unit: "张", image: "/images/products/postcard-c1.jpg", excelRow: 12 },
  { id: "postcard-c2", name: "明信片 C 款②", category: "异形猫猫", price: 1.5, unit: "张", image: "/images/products/postcard-c2.jpg", excelRow: 13 },
  { id: "postcard-c3", name: "明信片 C 款③", category: "异形猫猫", price: 1.5, unit: "张", image: "/images/products/postcard-c3.jpg", excelRow: 14 },
  { id: "sticker", name: "猫猫贴纸", category: "贴纸", price: 1, unit: "张", image: "/images/products/sticker.jpg", excelRow: 15 },
  { id: "abstract-sticker", name: "抽象贴纸", category: "贴纸", price: 0.5, unit: "张", image: "/images/products/abstract-sticker.jpg", excelRow: 20 },
  { id: "fridge-magnet", name: "校门建筑款冰箱贴", category: "冰箱贴", price: 10, unit: "个", image: "/images/products/fridge-magnet.jpg", excelRow: 16 },
  { id: "bookmark-1", name: "书签①", category: "书签", price: 1.5, unit: "张", image: "/images/products/bookmark-1.jpg", excelRow: 17 },
  { id: "bookmark-2", name: "书签②", category: "书签", price: 1.5, unit: "张", image: "/images/products/bookmark-2.jpg", excelRow: 18 },
  { id: "bookmark-3", name: "书签③", category: "书签", price: 1.5, unit: "张", image: "/images/products/bookmark-3.jpg", excelRow: 19 },
];

// 花名册单独放在 contracts/roster.ts 中（已被 .gitignore 忽略），避免真实学生信息进入公开仓库。
export { roster } from "./roster";

export const categories = ["全部", "信封信纸", "明信片 A", "明信片 B", "明信片 C", "贴纸", "冰箱贴", "书签"] as const;

export function productCategory(product: Product) {
  if (["信封", "信纸", "封口贴"].includes(product.category)) return "信封信纸";
  if (product.name.includes("A 款")) return "明信片 A";
  if (product.name.includes("B 款")) return "明信片 B";
  if (product.name.includes("C 款")) return "明信片 C";
  return product.category;
}

export function money(value: number) {
  return Math.round(value * 100) / 100;
}
