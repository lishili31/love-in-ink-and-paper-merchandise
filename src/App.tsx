import { Routes, Route } from "react-router";
import { Toaster } from "sonner";
import Home from "./pages/Home";
import Admin from "./pages/Admin";

export default function App() {
  return (
    <>
      <div className="demo-banner" role="note">
        演示站点 · 学生与订单数据均为虚构
      </div>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Home />} />
      </Routes>
      <Toaster position="top-center" richColors />
    </>
  );
}
