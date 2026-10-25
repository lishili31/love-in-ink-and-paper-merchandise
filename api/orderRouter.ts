import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { products, roster } from "@contracts/catalog";
import { createRouter, publicQuery } from "./middleware";
import { assertAdmin } from "./admin";
import { deleteOrder, findStudent, getClassSummary, getOrderForStudent, saveOrder } from "./queries/orders";

const identityInput = z.object({
  name: z.string().trim().min(1, "请选择姓名"),
  studentNo: z.string().regex(/^\d{10}$/, "学号格式不正确"),
});

const orderInput = identityInput.extend({
  note: z.string().trim().max(200, "备注最多 200 字").default(""),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().min(1).max(99),
  })).min(1, "请至少选择一件商品").max(18).refine((items) => {
    const ids = items.map((item) => item.productId);
    return new Set(ids).size === ids.length && ids.every((id) => products.some((product) => product.id === id));
  }, "商品信息不正确"),
});

async function requireStudent(input: { name: string; studentNo: string }) {
  const student = await findStudent(input.studentNo, input.name);
  if (!student) throw new TRPCError({ code: "NOT_FOUND", message: "姓名与学号不匹配，请检查后重试" });
  return student;
}

export const orderRouter = createRouter({
  catalog: publicQuery.query(() => ({
    products,
    students: roster.map(([name, studentNo], index) => ({ id: index + 1, name, studentNo })),
  })),
  mine: publicQuery.input(identityInput).query(async ({ input }) => {
    const student = await requireStudent(input);
    const order = await getOrderForStudent(student.id);
    return order ? { ...order, name: student.name, studentNo: student.studentNo } : null;
  }),
  submit: publicQuery.input(orderInput).mutation(async ({ input }) => {
    const student = await requireStudent(input);
    const order = await saveOrder(student.id, input.note, input.items);
    return { ...order!, name: student.name, studentNo: student.studentNo };
  }),
  remove: publicQuery.input(identityInput).mutation(async ({ input }) => {
    const student = await requireStudent(input);
    await deleteOrder(student.id);
    return { ok: true };
  }),
  summary: publicQuery.input(z.object({ adminKey: z.string().min(1) })).query(async ({ input }) => {
    assertAdmin(input.adminKey);
    return getClassSummary();
  }),
});
