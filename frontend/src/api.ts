import axios from "axios";
import { supabase } from "./supabaseClient";

const API = "http://127.0.0.1:8000";

export const api = axios.create({
  baseURL: API,
});

api.interceptors.request.use(
  async (config) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      config.headers.Authorization =
        `Bearer ${session.access_token}`;
    }

    return config;
  }
);

export default api;