import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";
import { ArrowLeft, Download, FileSpreadsheet, LockKeyhole, Search, Users, Package, Wallet, LogOut } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { withBase } from "@/lib/base";

export default function Admin() {
  const [adminKey, setAdminKey] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const summary = trpc.orders.summary.useQuery({ adminKey }, { enabled: false, retry: false });

  const filteredOrders = useMemo(() => {
    const orders = summary.data?.studentOrders || [];
    const keyword = search.trim();
    return keyword ? orders.filter((order) => order.name.includes(keyword) || order.studentNo.includes(keyword)) : orders;
  }, [summary.data, search]);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    if (!adminKey) return;
    const result = await summary.refetch();
    if (result.data) setUnlocked(true);
  }

  async function downloadExcel() {
    setExporting(true);
    try {
      const response = await fetch(withBase("/api/export"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(result?.error || "导出失败，请稍后重试");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "情归纸笔-购买明细表.xlsx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Excel 已生成，包含商品汇总与个人订单");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导出失败");
    } finally {
      setExporting(false);
    }
  }

  if (!unlocked) {
    return (
      <main className="admin-login paper-grid">
        <Link to="/" className="admin-back"><ArrowLeft size={17} /> 返回订购页</Link>
        <form onSubmit={unlock} className="login-sheet">
          <span className="login-mark">情</span>
          <p>CLASS 5 · ORDER DESK</p>
          <h1>班级统计台</h1>
          <span className="login-desc">输入管理口令，查看订购汇总并导出班级购买明细表。</span>
          <label htmlFor="admin-key">管理口令</label>
          <div className="password-field"><LockKeyhole size={18} /><input id="admin-key" type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} autoFocus placeholder="请输入管理口令" /></div>
          {summary.isError && <p className="form-error">{summary.error.message}</p>}
          <button type="submit" disabled={summary.isFetching || !adminKey}>{summary.isFetching ? "正在验证…" : "进入统计台"}</button>
        </form>
      </main>
    );
  }

  const data = summary.data;
  return (
    <div className="admin-page">
      <header className="admin-header">
        <div><span className="brand-mark">情</span><span>情归纸笔<small>班级统计台</small></span></div>
        <nav><Link to="/"><ArrowLeft size={16} /> 订购页</Link><button type="button" onClick={() => { setUnlocked(false); setAdminKey(""); }}><LogOut size={16} /> 退出</button></nav>
      </header>
      <main className="admin-main">
        <div className="admin-title">
          <div><p>ORDER OVERVIEW · 2026</p><h1>订购汇总</h1><span>数据来自同学们已提交的订单，重复提交已自动合并。</span></div>
          <button type="button" className="export-button" onClick={downloadExcel} disabled={exporting}><Download size={18} />{exporting ? "正在生成…" : "导出 Excel 明细表"}</button>
        </div>

        <section className="stats-grid" aria-label="班级订购概览">
          <div><Users size={22} /><span>已订购人数</span><strong>{data?.orderedStudents || 0}<small> / {data?.rosterCount || 51} 人</small></strong></div>
          <div><Package size={22} /><span>商品总件数</span><strong>{data?.itemCount || 0}<small> 件</small></strong></div>
          <div><Wallet size={22} /><span>班级应付总额</span><strong>¥{data?.totalAmount.toFixed(1) || "0.0"}</strong></div>
        </section>

        <section className="admin-section">
          <div className="admin-section-heading"><div><p>01 / PRODUCT TOTALS</p><h2>商品分类汇总</h2></div><span>与商品清单逐项对应</span></div>
          <div className="table-wrap">
            <table className="summary-table">
              <thead><tr><th>商品款式</th><th>单价</th><th>订购总数量</th><th>小计金额</th></tr></thead>
              <tbody>{data?.productTotals.map((product) => <tr key={product.id}><td><img src={withBase(product.image)} alt="" /><span>{product.name}<small>{product.category}</small></span></td><td>¥{product.price.toFixed(1)} / {product.unit}</td><td><b>{product.quantity}</b> {product.unit}</td><td>¥{product.subtotal.toFixed(1)}</td></tr>)}</tbody>
              <tfoot><tr><td colSpan={2}>本班应付总金额</td><td>{data?.itemCount || 0} 件</td><td>¥{data?.totalAmount.toFixed(1) || "0.0"}</td></tr></tfoot>
            </table>
          </div>
        </section>

        <section className="admin-section orders-admin-section">
          <div className="admin-section-heading"><div><p>02 / STUDENT ORDERS</p><h2>个人订单核对</h2></div><label className="admin-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索姓名或学号" /></label></div>
          {filteredOrders.length === 0 ? <div className="admin-empty"><FileSpreadsheet size={32} /><p>{search ? "没有匹配的订单" : "还没有同学提交订单"}</p></div> : (
            <div className="admin-order-list">{filteredOrders.map((order) => (
              <article key={order.orderId}>
                <div className="admin-order-person"><span><b>{order.name}</b><small>{order.studentNo} · 订单 #{String(order.orderId).padStart(4, "0")}</small></span><strong>¥{order.total.toFixed(1)}</strong></div>
                <p>{order.items.map((item) => `${item.name} × ${item.quantity}`).join("；")}</p>
                <div className="admin-order-meta"><span>共 {order.itemCount} 件{order.note ? ` · 备注：${order.note}` : ""}</span><time>{new Date(order.updatedAt).toLocaleString("zh-CN", { hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</time></div>
              </article>
            ))}</div>
          )}
        </section>
      </main>
      <footer className="admin-footer">情归纸笔 · 演示数据</footer>
    </div>
  );
}
