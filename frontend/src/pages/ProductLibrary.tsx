import { useState, useEffect } from "react";
import { Plus, Search, Upload, Trash2, Edit2, X } from "lucide-react";
import api from "../api/client";
import type { Product } from "../types";

interface ProductForm {
  name: string;
  top_notes: string;
  middle_notes: string;
  base_notes: string;
  price: number | "";
  spec: string;
  brand_story: string;
  scenarios: string;
}

const emptyForm: ProductForm = {
  name: "",
  top_notes: "",
  middle_notes: "",
  base_notes: "",
  price: "",
  spec: "",
  brand_story: "",
  scenarios: "",
};

interface ImportResult {
  products: Product[];
  errors: string[];
}

export default function ProductLibrary() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Add/Edit modal
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // CSV Import
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Fetch products
  const fetchProducts = async (query = "") => {
    setLoading(true);
    try {
      const { data } = await api.get("/products/", {
        params: { search: query, skip: 0, limit: 50 },
      });
      setProducts(data);
    } catch {
      // silently fail, products remain empty
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Open add form
  const handleAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormError("");
    setShowForm(true);
  };

  // Open edit form
  const handleEdit = (product: Product) => {
    setForm({
      name: product.name,
      top_notes: product.top_notes,
      middle_notes: product.middle_notes,
      base_notes: product.base_notes,
      price: product.price,
      spec: product.spec,
      brand_story: product.brand_story,
      scenarios: product.scenarios.join(", "),
    });
    setEditingId(product.id);
    setFormError("");
    setShowForm(true);
  };

  // Save (create or update)
  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError("产品名称不能为空");
      return;
    }
    setSaving(true);
    setFormError("");

    const payload = {
      name: form.name.trim(),
      top_notes: form.top_notes.trim(),
      middle_notes: form.middle_notes.trim(),
      base_notes: form.base_notes.trim(),
      price: form.price === "" ? 0 : Number(form.price),
      spec: form.spec.trim(),
      brand_story: form.brand_story.trim(),
      scenarios: form.scenarios
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    try {
      if (editingId !== null) {
        await api.put(`/products/${editingId}`, payload);
      } else {
        await api.post("/products/", payload);
      }
      setShowForm(false);
      fetchProducts(search);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "保存失败，请重试";
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async () => {
    if (deletingId === null) return;
    setDeleting(true);
    try {
      await api.delete(`/products/${deletingId}`);
      setDeletingId(null);
      fetchProducts(search);
    } catch {
      // silently fail
    } finally {
      setDeleting(false);
    }
  };

  // CSV Import
  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append("file", importFile);
    try {
      const { data } = await api.post("/products/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportResult(data);
      fetchProducts(search);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "导入失败，请重试";
      setImportResult({ products: [], errors: [message] });
    } finally {
      setImporting(false);
    }
  };

  const updateField = <K extends keyof ProductForm>(
    key: K,
    value: ProductForm[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-brand">产品库</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowImport(true);
              setImportFile(null);
              setImportResult(null);
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-brand text-brand rounded-lg hover:bg-brand-50 transition"
          >
            <Upload size={16} />
            导入CSV
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark transition"
          >
            <Plus size={16} />
            添加
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          placeholder="搜索产品名称..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
        />
      </div>

      {/* Product List */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">加载中...</div>
      ) : products.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          {search ? "未找到匹配的产品" : "暂无产品，点击「添加」创建"}
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <div
              key={product.id}
              onClick={() => handleEdit(product)}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 active:bg-gray-50 cursor-pointer transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-800 truncate">
                      {product.name}
                    </h3>
                    {product.spec && (
                      <span className="text-xs text-gray-400 shrink-0">
                        {product.spec}
                      </span>
                    )}
                  </div>
                  {product.price > 0 && (
                    <p className="text-brand font-medium text-sm mb-1.5">
                      ¥{product.price}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5 text-xs text-gray-500">
                    {product.top_notes && (
                      <span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full">
                        前调: {product.top_notes}
                      </span>
                    )}
                    {product.middle_notes && (
                      <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
                        中调: {product.middle_notes}
                      </span>
                    )}
                    {product.base_notes && (
                      <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                        尾调: {product.base_notes}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(product);
                    }}
                    className="p-1.5 text-gray-400 hover:text-brand rounded-lg hover:bg-brand-50 transition"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingId(product.id);
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowForm(false)}
          />
          <div className="relative w-full max-w-[430px] max-h-[85vh] bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">
                {editingId !== null ? "编辑产品" : "添加产品"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {formError && (
                <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  产品名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="输入产品名称"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    价格
                  </label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) =>
                      updateField(
                        "price",
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    placeholder="¥0"
                    min={0}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    规格
                  </label>
                  <input
                    type="text"
                    value={form.spec}
                    onChange={(e) => updateField("spec", e.target.value)}
                    placeholder="如 50ml"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  前调
                </label>
                <input
                  type="text"
                  value={form.top_notes}
                  onChange={(e) => updateField("top_notes", e.target.value)}
                  placeholder="如 柑橘、佛手柑"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  中调
                </label>
                <input
                  type="text"
                  value={form.middle_notes}
                  onChange={(e) => updateField("middle_notes", e.target.value)}
                  placeholder="如 茉莉、玫瑰"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  尾调
                </label>
                <input
                  type="text"
                  value={form.base_notes}
                  onChange={(e) => updateField("base_notes", e.target.value)}
                  placeholder="如 麝香、琥珀"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  使用场景
                </label>
                <input
                  type="text"
                  value={form.scenarios}
                  onChange={(e) => updateField("scenarios", e.target.value)}
                  placeholder="用逗号分隔，如 约会, 办公, 日常"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  品牌故事
                </label>
                <textarea
                  value={form.brand_story}
                  onChange={(e) => updateField("brand_story", e.target.value)}
                  placeholder="输入品牌故事..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 px-4 py-3 border-t border-gray-100">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 text-sm text-white bg-brand rounded-lg hover:bg-brand-dark transition disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDeletingId(null)}
          />
          <div className="relative w-[320px] bg-white rounded-2xl p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-50 flex items-center justify-center">
              <Trash2 size={24} className="text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">
              确认删除
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              删除后无法恢复，确定要删除这个产品吗？
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 transition disabled:opacity-50"
              >
                {deleting ? "删除中..." : "删除"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowImport(false)}
          />
          <div className="relative w-full max-w-[430px] bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden">
            {/* Import Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">
                导入CSV文件
              </h2>
              <button
                onClick={() => setShowImport(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Import Body */}
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择CSV文件
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    setImportFile(e.target.files?.[0] ?? null);
                    setImportResult(null);
                  }}
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand hover:file:bg-brand-100 cursor-pointer"
                />
              </div>

              <button
                onClick={handleImport}
                disabled={!importFile || importing}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-white bg-brand rounded-lg hover:bg-brand-dark transition disabled:opacity-50"
              >
                <Upload size={16} />
                {importing ? "导入中..." : "开始导入"}
              </button>

              {/* Import Results */}
              {importResult && (
                <div className="space-y-2">
                  {importResult.products.length > 0 && (
                    <div className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                      成功导入 {importResult.products.length} 个产品
                    </div>
                  )}
                  {importResult.errors.length > 0 && (
                    <div className="text-sm text-red-700 bg-red-50 px-3 py-2 rounded-lg space-y-1">
                      <p className="font-medium">
                        {importResult.errors.length} 个错误:
                      </p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {importResult.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
