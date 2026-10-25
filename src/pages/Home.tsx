import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Minus, Plus, Search, ShoppingBag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { categories, money, productCategory, products, roster } from "@contracts/catalog";
import { trpc } from "@/providers/trpc";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { withBase } from "@/lib/base";

const priceLists = [
  { src: withBase("/images/price-lists/price-1.jpg"), label: "信封信纸 · A 款明信片" },
  { src: withBase("/images/price-lists/price-2.jpg"), label: "商品价目速览" },
  { src: withBase("/images/price-lists/price-3.jpg"), label: "B / C 款明信片 · 其他周边" },
];

export default function Home() {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("全部");
  const [selectedNo, setSelectedNo] = useState("");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [priceListOpen, setPriceListOpen] = useState(false);
  const [activeList, setActiveList] = useState(0);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lookupName, setLookupName] = useState("");
  const [lookupNo, setLookupNo] = useState("");
  const [lookupTouched, setLookupTouched] = useState(false);

  const selectedStudent = roster.find(([, no]) => no === selectedNo);
  const cartItems = products.filter((product) => (cart[product.id] || 0) > 0);
  const itemCount = cartItems.reduce((sum, product) => sum + cart[product.id], 0);
  const total = money(cartItems.reduce((sum, product) => sum + product.price * cart[product.id], 0));
  const visibleProducts = activeCategory === "全部" ? products : products.filter((product) => productCategory(product) === activeCategory);

  const submit = trpc.orders.submit.useMutation({
    onSuccess: () => {
      setReceiptOpen(true);
      setEditing(false);
      toast.success("订单已保存到班级统计中");
    },
    onError: (error) => toast.error(error.message),
  });
  const mine = trpc.orders.mine.useQuery(
    { name: lookupName, studentNo: lookupNo },
    { enabled: false, retry: false },
  );
  const remove = trpc.orders.remove.useMutation({
    onSuccess: () => {
      toast.success("订单已删除");
      setCart({});
      setNote("");
      setEditing(false);
      void mine.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const summaryText = useMemo(() => {
    if (!submit.data) return "";
    return submit.data.items.map((item) => `${item.name} × ${item.quantity}`).join("；");
  }, [submit.data]);

  function changeQuantity(id: string, delta: number) {
    setCart((current) => {
      const next = Math.min(99, Math.max(0, (current[id] || 0) + delta));
      const updated = { ...current, [id]: next };
      if (next === 0) delete updated[id];
      return updated;
    });
  }

  function submitOrder() {
    if (!selectedStudent) return toast.error("请先选择花名册中的姓名");
    if (!cartItems.length) return toast.error("请先选择至少一件商品");
    submit.mutate({
      name: selectedStudent[0],
      studentNo: selectedStudent[1],
      note,
      items: cartItems.map((product) => ({ productId: product.id, quantity: cart[product.id] })),
    });
  }

  function lookupOrder() {
    setLookupTouched(true);
    if (!lookupName || !lookupNo) return toast.error("请填写姓名和学号");
    void mine.refetch();
  }

  function editCurrentOrder() {
    const order = mine.data;
    if (!order) return;
    setCart(Object.fromEntries(order.items.map((item) => [item.productId, item.quantity])));
    setSelectedNo(order.studentNo);
    setNote(order.note);
    setEditing(true);
    setOrdersOpen(false);
    document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth", block: "center" });
    toast.success("已载入订单，可修改后重新提交");
  }

  function openPriceList(index: number) {
    setActiveList(index);
    setPriceListOpen(true);
  }

  return (
    <div className="min-h-dvh overflow-x-hidden bg-paper text-ink">
      <header className="site-header">
        <a href="#top" className="brand" aria-label="情归纸笔首页">
          <span className="brand-mark">情</span>
          <span>情归纸笔<small>CLASS 5 · ORDER DESK</small></span>
        </a>
        <nav className="desktop-nav" aria-label="主导航">
          <a href="#price-list">产品价目</a>
          <a href="#shop">立即选购</a>
          <button type="button" onClick={() => setOrdersOpen(true)}>我的订单</button>
          <Link to="/admin">统计导出</Link>
        </nav>
        <button className="header-order" type="button" onClick={() => setOrdersOpen(true)}>
          <Search size={17} /> 查订单
        </button>
      </header>

      <main id="top">
        <section className="hero paper-grid">
          <div className="hero-copy">
            <p className="hero-kicker">A LETTER, A LITTLE UNIVERSE.</p>
            <h1>把心意，<br /><span>寄给远方。</span></h1>
            <p className="hero-intro">一纸一笔，写下平日的感谢与珍重。挑选信封、明信片和校园周边，让没有说出口的话，都有迹可循。</p>
            <a className="primary-cta" href="#shop">开始选购 <ArrowRight size={19} /></a>
            <div className="hero-meta">
              <span>演示班级</span><span>18 款商品</span><span>统一汇总订购</span>
            </div>
          </div>
          <div className="hero-visual" aria-label="情归纸笔产品价目表预览">
            <button className="hero-sheet hero-sheet-back" onClick={() => openPriceList(2)} type="button" aria-label="查看第三张价目表">
              <img src={withBase("/images/price-lists/price-3.jpg")} alt="明信片、贴纸、冰箱贴和书签价目表" />
            </button>
            <button className="hero-sheet hero-sheet-front" onClick={() => openPriceList(0)} type="button" aria-label="查看第一张价目表">
              <img src={withBase("/images/price-lists/price-1.jpg")} alt="信封、信纸、封口贴和明信片价目表" />
              <span>查看完整价目 <ArrowRight size={15} /></span>
            </button>
            <span className="postmark">纸短<br />情长</span>
          </div>
        </section>

        <div className="marquee" aria-hidden="true">
          <div>LETTERS · POSTCARDS · CATS ON CAMPUS · KEEPSAKES · LETTERS · POSTCARDS · CATS ON CAMPUS · KEEPSAKES ·&nbsp;</div>
          <div>LETTERS · POSTCARDS · CATS ON CAMPUS · KEEPSAKES · LETTERS · POSTCARDS · CATS ON CAMPUS · KEEPSAKES ·&nbsp;</div>
        </div>

        <section id="price-list" className="section-shell price-section">
          <div className="section-heading">
            <div><p className="section-index">01 / PRICE LIST</p><h2>先看价目，再挑心意</h2></div>
            <p>所有价格以正式价目表与班级报表为准。<br />点击任意图片可放大查看。</p>
          </div>
          <div className="price-list-grid">
            {priceLists.map((list, index) => (
              <button type="button" className={`price-preview price-preview-${index + 1}`} key={list.src} onClick={() => openPriceList(index)}>
                <div className="price-image-wrap"><img src={list.src} alt={list.label} loading="lazy" /></div>
                <span><b>价目表 {index + 1}</b>{list.label}<ArrowRight size={17} /></span>
              </button>
            ))}
          </div>
        </section>

        <section id="shop" className="section-shell shop-section">
          <div className="section-heading shop-title">
            <div><p className="section-index">02 / MAKE YOUR ORDER</p><h2>把喜欢的，放进信封</h2></div>
            <p>点“加入”选择商品，数量可自由增减。<br />提交前请确认姓名与订单金额。</p>
          </div>
          <div className="category-tabs" role="tablist" aria-label="商品分类">
            {categories.map((category) => (
              <button key={category} type="button" role="tab" aria-selected={activeCategory === category} className={activeCategory === category ? "active" : ""} onClick={() => setActiveCategory(category)}>{category}</button>
            ))}
          </div>

          <div className="shop-layout">
            <div className="product-grid">
              {visibleProducts.map((product) => {
                const quantity = cart[product.id] || 0;
                return (
                  <article className="product" key={product.id}>
                    <div className="product-image"><img src={withBase(product.image)} alt={product.name} loading="lazy" /></div>
                    <div className="product-info">
                      <p>{product.category}</p>
                      <h3>{product.name}</h3>
                      <div className="product-buy">
                        <strong>¥{product.price.toFixed(1)}<small> / {product.unit}</small></strong>
                        {quantity === 0 ? (
                          <button className="add-button" type="button" onClick={() => changeQuantity(product.id, 1)}>加入 <Plus size={16} /></button>
                        ) : (
                          <div className="stepper" aria-label={`${product.name}数量`}>
                            <button type="button" onClick={() => changeQuantity(product.id, -1)} aria-label={`减少${product.name}`}><Minus size={16} /></button>
                            <output aria-live="polite">{quantity}</output>
                            <button type="button" onClick={() => changeQuantity(product.id, 1)} aria-label={`增加${product.name}`}><Plus size={16} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <aside id="checkout" className="cart-panel">
              <div className="cart-heading"><span><ShoppingBag size={20} /> 我的订购单</span><b>{itemCount} 件</b></div>
              <div className="identity-fields">
                <label htmlFor="student-name">订购人姓名</label>
                <select id="student-name" value={selectedNo} onChange={(event) => setSelectedNo(event.target.value)}>
                  <option value="">请从 5 班花名册选择</option>
                  {roster.map(([name, no]) => <option value={no} key={no}>{name}</option>)}
                </select>
                <label htmlFor="student-no">学号</label>
                <input id="student-no" value={selectedNo} readOnly placeholder="选择姓名后自动填入" />
              </div>
              <div className="cart-lines">
                {cartItems.length === 0 ? (
                  <div className="empty-cart"><ShoppingBag size={30} /><p>订购单还是空的</p><span>从左侧商品中挑一份心意吧</span></div>
                ) : cartItems.map((product) => (
                  <div className="cart-line" key={product.id}>
                    <div><b>{product.name}</b><span>¥{product.price.toFixed(1)} × {cart[product.id]}</span></div>
                    <strong>¥{money(product.price * cart[product.id]).toFixed(1)}</strong>
                    <button type="button" onClick={() => setCart((current) => { const next = { ...current }; delete next[product.id]; return next; })} aria-label={`移除${product.name}`}><X size={15} /></button>
                  </div>
                ))}
              </div>
              <label className="note-field" htmlFor="order-note">备注 <span>选填，200 字以内</span></label>
              <textarea id="order-note" maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} placeholder="如有其他说明，可写在这里" />
              <div className="cart-total"><span>合计 <small>共 {itemCount} 件</small></span><strong>¥{total.toFixed(1)}</strong></div>
              <button className="submit-order" type="button" disabled={submit.isPending || !itemCount} onClick={submitOrder}>
                {submit.isPending ? "正在保存…" : editing ? "保存订单修改" : "确认并提交订单"}<ArrowRight size={18} />
              </button>
              <p className="cart-footnote">同一学号重复提交将更新原订单，不会重复计数。</p>
            </aside>
          </div>
        </section>

        <section className="closing-section paper-grid">
          <p>WORDS MATTER. LETTERS REMAIN.</p>
          <h2>愿每一封信，<br />都有温暖的回音。</h2>
          <button type="button" onClick={() => setOrdersOpen(true)}>查询 / 修改我的订单 <ArrowRight size={18} /></button>
        </section>
      </main>

      <footer><span className="footer-brand">情归纸笔</span><span>演示站点 · 数据均为虚构</span><Link to="/admin">班级管理</Link></footer>

      {itemCount > 0 && <a className="mobile-cart-bar" href="#checkout"><span>{itemCount} 件 · ¥{total.toFixed(1)}</span><b>去填写订购单 <ArrowRight size={16} /></b></a>}

      <Dialog open={priceListOpen} onOpenChange={setPriceListOpen}>
        <DialogContent className="price-dialog" showCloseButton={false}>
          <DialogHeader><DialogTitle>情归纸笔 · 产品价目表</DialogTitle><DialogDescription>{priceLists[activeList].label}，上下滚动查看完整图片。</DialogDescription></DialogHeader>
          <div className="dialog-toolbar">
            <div>{priceLists.map((_, index) => <button type="button" className={activeList === index ? "active" : ""} key={index} onClick={() => setActiveList(index)}>价目表 {index + 1}</button>)}</div>
            <button type="button" onClick={() => setPriceListOpen(false)} aria-label="关闭价目表"><X size={20} /></button>
          </div>
          <div className="full-price-image"><img src={priceLists[activeList].src} alt={priceLists[activeList].label} /></div>
          <div className="dialog-pager">
            <button type="button" disabled={activeList === 0} onClick={() => setActiveList((value) => value - 1)}><ChevronLeft size={17} /> 上一张</button>
            <button type="button" disabled={activeList === 2} onClick={() => setActiveList((value) => value + 1)}>下一张 <ChevronRight size={17} /></button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={ordersOpen} onOpenChange={setOrdersOpen}>
        <DialogContent className="order-dialog">
          <DialogHeader><DialogTitle>我的订单</DialogTitle><DialogDescription>输入花名册姓名与对应学号，可查询、修改或删除已提交的订单。</DialogDescription></DialogHeader>
          <div className="lookup-form">
            <label>姓名<select value={lookupName} onChange={(event) => { setLookupName(event.target.value); setLookupNo(roster.find(([name]) => name === event.target.value)?.[1] || ""); }}><option value="">请选择姓名</option>{roster.map(([name]) => <option key={name}>{name}</option>)}</select></label>
            <label>学号<input value={lookupNo} inputMode="numeric" onChange={(event) => setLookupNo(event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10 位学号" /></label>
            <button type="button" onClick={lookupOrder} disabled={mine.isFetching}><Search size={17} />{mine.isFetching ? "查询中" : "查询订单"}</button>
          </div>
          {mine.isError && <p className="form-error">{mine.error.message}</p>}
          {lookupTouched && !mine.isFetching && !mine.isError && mine.data === null && <div className="no-order">暂未查询到订单。选购商品后，可在本页右侧提交。</div>}
          {mine.data && (
            <div className="order-receipt">
              <div className="receipt-status"><span><Check size={17} /> 已提交</span><small>订单号 #{String(mine.data.id).padStart(4, "0")}</small></div>
              <h3>{mine.data.name}<small>{mine.data.studentNo}</small></h3>
              <div className="receipt-items">{mine.data.items.map((item) => <div key={item.id}><span>{item.name} × {item.quantity}</span><b>¥{item.subtotal.toFixed(1)}</b></div>)}</div>
              {mine.data.note && <p className="receipt-note">备注：{mine.data.note}</p>}
              <div className="receipt-total"><span>共 {mine.data.itemCount} 件</span><strong>¥{mine.data.total.toFixed(1)}</strong></div>
              <div className="receipt-actions"><button type="button" onClick={editCurrentOrder}>载入并修改</button><button type="button" className="danger-link" disabled={remove.isPending} onClick={() => { if (window.confirm("确定删除这份订单吗？删除后需要重新填写。")) remove.mutate({ name: lookupName, studentNo: lookupNo }); }}><Trash2 size={16} /> 删除订单</button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="success-dialog">
          <div className="success-stamp"><Check size={34} /></div>
          <DialogHeader><DialogTitle>订单提交成功</DialogTitle><DialogDescription>{submit.data?.name}，你的心意已记录。班级统计会自动更新。</DialogDescription></DialogHeader>
          <div className="success-number">ORDER #{String(submit.data?.id || 0).padStart(4, "0")}</div>
          <p className="success-items">{summaryText}</p>
          <div className="success-total"><span>{submit.data?.itemCount} 件商品</span><strong>¥{submit.data?.total.toFixed(1)}</strong></div>
          <button className="submit-order" type="button" onClick={() => setReceiptOpen(false)}>完成 <Check size={18} /></button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
