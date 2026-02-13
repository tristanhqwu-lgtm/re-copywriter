import axios from "axios";

const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;

export function pollTask(
  taskId: string,
  onUpdate: (data: Record<string, unknown>) => void,
  interval = 1500
): () => void {
  let stopped = false;
  const poll = async () => {
    while (!stopped) {
      try {
        const { data } = await api.get(`/tasks/${taskId}`);
        onUpdate(data);
        if (data.status === "completed" || data.status === "failed") return;
      } catch { /* ignore */ }
      await new Promise((r) => setTimeout(r, interval));
    }
  };
  poll();
  return () => { stopped = true; };
}
