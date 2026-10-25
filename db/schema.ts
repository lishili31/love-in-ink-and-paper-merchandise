import {
  bigint,
  int,
  mysqlTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const students = mysqlTable("students", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  studentNo: varchar("student_no", { length: 20 }).notNull().unique(),
  rosterOrder: int("roster_order").notNull().unique(),
});

export const orders = mysqlTable("orders", {
  id: serial("id").primaryKey(),
  studentId: bigint("student_id", { mode: "number", unsigned: true }).notNull().unique().references(() => students.id),
  note: varchar("note", { length: 200 }).notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const orderItems = mysqlTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: bigint("order_id", { mode: "number", unsigned: true }).notNull().references(() => orders.id),
  productId: varchar("product_id", { length: 40 }).notNull(),
  quantity: int("quantity").notNull(),
  priceCents: int("price_cents").notNull(),
}, (table) => ({
  orderProduct: uniqueIndex("order_product_unique").on(table.orderId, table.productId),
}));

export type Student = typeof students.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
