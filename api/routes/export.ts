import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import ExcelJS from "exceljs";
import { isAdminKey } from "../admin";
import { getClassSummary } from "../queries/orders";

export const exportRoutes = new Hono();

exportRoutes.post("/", bodyLimit({ maxSize: 8 * 1024, onError: (c) => c.body(null, 413) }), async (c) => {
  const { adminKey } = await c.req.json<{ adminKey?: string }>().catch(() => ({ adminKey: "" }));
  if (!adminKey || !isAdminKey(adminKey)) return c.json({ error: "管理口令不正确" }, 401);

  const summary = await getClassSummary();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "情归纸笔·演示站点";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("table_20261024", {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  sheet.columns = [
    { width: 15 }, { width: 28 }, { width: 15 }, { width: 23 }, { width: 19 }, { width: 3 },
  ];
  sheet.addRow(["商品大类", "具体款式（请填数量）", "单价", "班级订购总数量（件）", "小计金额（元）"]);
  const categories: Record<number, string | null> = {
    2: "信封", 3: null, 4: "信纸", 5: "封口贴", 6: "明信片\n(A款)", 7: null, 8: null,
    9: "明信片\n(B款)", 10: null, 11: null, 12: "明信片\n(C款)", 13: null, 14: null,
    15: "贴纸", 16: "冰箱贴", 17: "书签", 18: null, 19: null, 20: "贴纸",
  };
  const excelNames: Record<string, string> = {
    "envelope-blue": "蓝色款信封", "envelope-green": "绿色款信封", "letter-paper": "信纸", "wax-seal": "封口贴",
    "postcard-a1": "A款①", "postcard-a2": "A款②", "postcard-a3": "A款③",
    "postcard-b1": "B款①", "postcard-b2": "B款②", "postcard-b3": "B款③",
    "postcard-c1": "C款①", "postcard-c2": "C款②", "postcard-c3": "C款③",
    "sticker": "猫猫贴纸", "fridge-magnet": "校门建筑款冰箱贴",
    "bookmark-1": "书签①", "bookmark-2": "书签②", "bookmark-3": "书签③",
    "abstract-sticker": "抽象贴纸",
  };
  for (const product of summary.productTotals) {
    const row = sheet.getRow(product.excelRow);
    row.getCell(1).value = categories[product.excelRow];
    row.getCell(2).value = excelNames[product.id];
    row.getCell(3).value = `${product.price}元/${product.unit}`;
    row.getCell(4).value = product.quantity;
    row.getCell(5).value = product.subtotal;
    row.height = 25;
  }
  sheet.getCell("A21").value = "汇总";
  sheet.getCell("B21").value = "本班应付总金额";
  sheet.getCell("E21").value = summary.totalAmount;
  sheet.getRow(21).height = 28;
  sheet.eachRow((row) => row.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col > 5) return;
    cell.font = { name: "Microsoft YaHei", size: 11, bold: row.number === 1 || row.number === 21 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    if (row.number === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6DF" } };
    if (col >= 4 && row.number > 1) cell.numFmt = "0.00";
  }));
  sheet.getRow(1).height = 32;

  const detail = workbook.addWorksheet("个人订单");
  detail.columns = [
    { width: 12 }, { width: 16 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 70 }, { width: 30 }, { width: 22 },
  ];
  detail.addRow(["姓名", "学号", "订单号", "商品总件数", "订单金额（元）", "订单明细", "备注", "最后修改时间"]);
  for (const order of summary.studentOrders) {
    detail.addRow([
      order.name, order.studentNo, order.orderId, order.itemCount, order.total,
      order.items.map((item) => `${item.name}×${item.quantity}`).join("；"), order.note,
      new Date(order.updatedAt).toLocaleString("zh-CN", { hour12: false }),
    ]);
  }
  detail.eachRow((row) => row.eachCell((cell) => {
    cell.font = { name: "Microsoft YaHei", size: 11, bold: row.number === 1 };
    cell.alignment = { vertical: "middle", wrapText: true };
    if (row.number === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6DF" } };
  }));
  detail.views = [{ state: "frozen", ySplit: 1 }];
  detail.autoFilter = { from: "A1", to: "H1" };

  const buffer = await workbook.xlsx.writeBuffer();
  c.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  c.header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent("高三（5）班购买明细表.xlsx")}`);
  return c.body(new Uint8Array(buffer));
});
