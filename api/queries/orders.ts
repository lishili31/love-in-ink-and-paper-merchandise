import { and, asc, eq } from "drizzle-orm";
import { orderItems, orders, students } from "@db/schema";
import { products, roster, money } from "@contracts/catalog";
import { getDb } from "./connection";

const productMap = new Map(products.map((product) => [product.id, product]));

export async function findStudent(studentNo: string, name?: string) {
  const conditions = name
    ? and(eq(students.studentNo, studentNo), eq(students.name, name))
    : eq(students.studentNo, studentNo);
  const [student] = await getDb().select().from(students).where(conditions).limit(1);
  return student;
}

export async function getOrderForStudent(studentId: number) {
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.studentId, studentId)).limit(1);
  if (!order) return null;
  const rows = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const items = rows.map((row) => {
    const product = productMap.get(row.productId)!;
    return { ...row, name: product.name, unit: product.unit, image: product.image, subtotal: money(row.quantity * row.priceCents / 100) };
  }).sort((a, b) => products.findIndex((p) => p.id === a.productId) - products.findIndex((p) => p.id === b.productId));
  return {
    ...order,
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    total: money(items.reduce((sum, item) => sum + item.subtotal, 0)),
  };
}

export async function saveOrder(studentId: number, note: string, items: { productId: string; quantity: number }[]) {
  const db = getDb();
  const orderId = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(orders).where(eq(orders.studentId, studentId)).limit(1);
    let id: number;
    if (existing) {
      id = existing.id;
      await tx.update(orders).set({ note, updatedAt: new Date() }).where(eq(orders.id, id));
      await tx.delete(orderItems).where(eq(orderItems.orderId, id));
    } else {
      const [created] = await tx.insert(orders).values({ studentId, note }).$returningId();
      id = created.id;
    }
    await tx.insert(orderItems).values(items.map((item) => ({
      orderId: id,
      productId: item.productId,
      quantity: item.quantity,
      priceCents: Math.round(productMap.get(item.productId)!.price * 100),
    })));
    return id;
  });
  return getOrderById(orderId);
}

export async function getOrderById(orderId: number) {
  const [order] = await getDb().select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  return getOrderForStudent(order.studentId);
}

export async function deleteOrder(studentId: number) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.studentId, studentId)).limit(1);
    if (!order) return;
    await tx.delete(orderItems).where(eq(orderItems.orderId, order.id));
    await tx.delete(orders).where(eq(orders.id, order.id));
  });
}

export async function getClassSummary() {
  const db = getDb();
  const [allStudents, allOrders, allItems] = await Promise.all([
    db.select().from(students).orderBy(asc(students.rosterOrder)),
    db.select().from(orders),
    db.select().from(orderItems),
  ]);
  const studentMap = new Map(allStudents.map((student) => [student.id, student]));
  const byOrder = new Map<number, typeof allItems>();
  for (const item of allItems) {
    byOrder.set(item.orderId, [...(byOrder.get(item.orderId) || []), item]);
  }
  const studentOrders = allOrders.map((order) => {
    const student = studentMap.get(order.studentId)!;
    const items = (byOrder.get(order.id) || []).map((item) => ({
      ...item,
      name: productMap.get(item.productId)?.name || item.productId,
      subtotal: money(item.quantity * item.priceCents / 100),
    })).sort((a, b) => products.findIndex((p) => p.id === a.productId) - products.findIndex((p) => p.id === b.productId));
    return {
      orderId: order.id,
      name: student.name,
      studentNo: student.studentNo,
      note: order.note,
      updatedAt: order.updatedAt,
      items,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      total: money(items.reduce((sum, item) => sum + item.subtotal, 0)),
    };
  }).sort((a, b) => roster.findIndex(([, no]) => no === a.studentNo) - roster.findIndex(([, no]) => no === b.studentNo));
  const productTotals = products.map((product) => {
    const quantity = allItems.filter((item) => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0);
    return { ...product, quantity, subtotal: money(quantity * product.price) };
  });
  return {
    orderedStudents: allOrders.length,
    rosterCount: roster.length,
    itemCount: allItems.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: money(productTotals.reduce((sum, item) => sum + item.subtotal, 0)),
    productTotals,
    studentOrders,
  };
}
